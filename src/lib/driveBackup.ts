import { getGeneralSettings } from '@/lib/kioskSettings';
import { eventFolder, listEventPhotos, readStoredPhoto, type SavedPhoto } from '@/lib/kioskStorage';

// Respaldo en Google Drive a través de un Apps Script propio (docs/kiosco-drive-apps-script.gs).
// Las fotos quedan en una cola en el equipo y se suben cuando hay internet: si el
// kiosco trabaja sin conexión, se suben después, cuando vuelve.

const QUEUE_KEY = 'kiosk_drive_queue';
const DONE_KEY = 'kiosk_drive_done';
export const DRIVE_EVENT = 'kiosk-drive-changed';

interface QueueItem { uri: string; name: string; folder: string }

const read = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin espacio */ }
};

/** ID de la carpeta a partir del link de Drive (o el ID pegado directo). */
export const folderIdFromLink = (link?: string) => {
  const v = (link || '').trim();
  const m = v.match(/folders\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(v) ? v : '';
};

/** Script de Drive incluido al compilar la app (secreto VITE_KIOSK_DRIVE_SCRIPT_URL), igual para todos los equipos. */
export const DEFAULT_DRIVE_SCRIPT_URL = ((import.meta.env.VITE_KIOSK_DRIVE_SCRIPT_URL as string | undefined) || '').trim();

export const driveConfig = () => {
  const s = getGeneralSettings();
  return {
    scriptUrl: ((s.driveScriptUrl as string) || '').trim() || DEFAULT_DRIVE_SCRIPT_URL,
    // Sin carpeta elegida, el script usa "EventPix Kiosco" en Mi unidad
    folderId: folderIdFromLink(s.driveFolderLink as string),
    originals: !!s.driveOriginals,
    offline: !!s.offline,
  };
};
export const isDriveConfigured = () => {
  const c = driveConfig();
  // Con el script de la app alcanza (carpeta por defecto); con uno propio hace falta la carpeta
  return !!c.scriptUrl && (!!c.folderId || c.scriptUrl === DEFAULT_DRIVE_SCRIPT_URL);
};

export const pendingCount = () => read<QueueItem[]>(QUEUE_KEY, []).length;
const doneSet = () => new Set(read<string[]>(DONE_KEY, []));

const notify = () => window.dispatchEvent(new Event(DRIVE_EVENT));

interface DriveInfo { folder: string; url?: string; eventFolder?: string; eventUrl?: string }
const LINKS_KEY = 'kiosk_drive_links';

/** Último link conocido de la carpeta del evento en Drive (para el QR del operador). */
export const getDriveLinks = (): DriveInfo | null => {
  const all = read<Record<string, DriveInfo>>(LINKS_KEY, {});
  return all[eventFolder()] ?? null;
};

async function post(body: Record<string, unknown>) {
  const { scriptUrl } = driveConfig();
  // text/plain: pedido "simple", sin consulta previa de CORS (Apps Script no la responde)
  const res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null) as ({ ok?: boolean; error?: string; id?: string } & Partial<DriveInfo>) | null;
  if (!json?.ok) throw new Error(json?.error || `Drive respondió ${res.status}`);
  return json;
}

/** Prueba la conexión: devuelve el nombre de la carpeta. */
export async function testDrive() {
  const { folderId } = driveConfig();
  if (!isDriveConfigured()) throw new Error('Falta el link de la carpeta');
  const folder = eventFolder();
  const res = await post({ test: true, folderId, folder });
  const info: DriveInfo = { folder: res.folder || '', url: res.url, eventFolder: res.eventFolder, eventUrl: res.eventUrl };
  write(LINKS_KEY, { ...read<Record<string, DriveInfo>>(LINKS_KEY, {}), [folder]: info });
  notify();
  return info;
}

/**
 * Sube ya mismo la foto final para el QR: queda visible con el link (solo esa
 * foto) y devuelve su ID de Drive. Si falla, la foto sigue en la cola normal.
 */
export async function uploadForShare(dataUrl: string, name: string, folder: string): Promise<string> {
  const { folderId } = driveConfig();
  const res = await post({ folderId, folder, name, type: 'image/jpeg', share: true, data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
  if (!res.id) throw new Error('Drive no devolvió la foto (actualizá el script)');
  const done = doneSet();
  done.add(`${folder}/${name}`);
  write(DONE_KEY, [...done].slice(-5000));
  notify();
  return res.id;
}

/** Agrega fotos recién guardadas a la cola de Drive. */
export function queueForDrive(items: SavedPhoto[]) {
  if (!isDriveConfigured()) return;
  const { originals } = driveConfig();
  const queue = read<QueueItem[]>(QUEUE_KEY, []);
  const done = doneSet();
  for (const it of items) {
    if (it.original && !originals) continue;
    const key = `${it.folder}/${it.name}`;
    if (done.has(key) || queue.some(q => `${q.folder}/${q.name}` === key)) continue;
    queue.push({ uri: it.uri, name: it.name, folder: it.folder });
  }
  write(QUEUE_KEY, queue);
  notify();
  void processDriveQueue();
}

/** Encola todas las fotos del evento que todavía no se subieron. */
export async function queueWholeEvent() {
  const folder = eventFolder();
  const photos = await listEventPhotos(2000, folder);
  queueForDrive(photos.map(p => ({ uri: p.uri, name: p.name, folder, original: false })));
  return photos.length;
}

let running = false;
/** Sube lo que haya en la cola, de a una foto. Se corta si falla (p. ej. sin internet). */
export async function processDriveQueue() {
  if (running || !isDriveConfigured() || driveConfig().offline || !navigator.onLine) return;
  running = true;
  try {
    const { folderId } = driveConfig();
    for (;;) {
      const queue = read<QueueItem[]>(QUEUE_KEY, []);
      const item = queue[0];
      if (!item) break;
      try {
        const dataUrl = await readStoredPhoto(item.uri, 4000);
        await post({ folderId, folder: item.folder, name: item.name, type: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
      } catch (e) {
        // Si la foto ya no existe en el equipo se descarta; si es la red, se reintenta más tarde
        if (e instanceof Error && /leer|abrir|not found/i.test(e.message)) {
          write(QUEUE_KEY, read<QueueItem[]>(QUEUE_KEY, []).slice(1));
          continue;
        }
        break;
      }
      const done = doneSet();
      done.add(`${item.folder}/${item.name}`);
      write(DONE_KEY, [...done].slice(-5000));
      write(QUEUE_KEY, read<QueueItem[]>(QUEUE_KEY, []).filter(q => q.uri !== item.uri));
      notify();
    }
  } finally {
    running = false;
    notify();
  }
}

let started = false;
/** Reintenta la cola al volver internet y cada 2 minutos. */
export function startDriveSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => void processDriveQueue());
  window.setInterval(() => void processDriveQueue(), 120000);
  void processDriveQueue();
}
