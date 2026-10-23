import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getDeviceCode, getDeviceSecret } from './device';
import { isDriveConfigured, uploadForShare } from './drive';
import { getVideoSettings } from './settings';
import { publicSiteUrl } from './share';
import { blobToDataUrl, openDb, UPLOADS, uploadVideoForShare } from './storage';
import { sendVideoWhatsApp } from './whatsapp';

// Entrega del video: se sube a Drive (QR al video) y se anota en la galería online
// del evento. Sin internet queda en una cola en el equipo y se sube solo cuando
// vuelve; mientras tanto el invitado puede llevarse el QR de la galería.

export const VIDEO_QUEUE_EVENT = 'video-queue-changed';

export interface PendingUpload {
  name: string;
  folder: string;
  blob: Blob;
  thumb?: Blob | null;
  title?: string;
  mode: string;
  gallery: string;
  created: number;
  /** WhatsApp de invitados que pidieron el video (se manda al subirlo) */
  phones?: string[];
}

export const galleryUrl = (code: string) => `${publicSiteUrl()}/galeria-video/${encodeURIComponent(code)}`;
/** Vistas de la pantalla de la galería (tele, tablet o compu del evento). */
export const SCREEN_VIEWS = [
  { value: 'completa', label: 'Videos y portadas', hint: 'Los videos pasando como demostración y las portadas con su QR' },
  { value: 'portadas', label: 'Solo portadas', hint: 'Portadas con un QR chico abajo; las páginas pasan solas' },
  { value: 'videos', label: 'Solo videos', hint: 'Los videos a pantalla completa con el QR del que se ve' },
] as const;
export type ScreenViewKey = typeof SCREEN_VIEWS[number]['value'];
export const galleryScreenUrl = (code: string, view: ScreenViewKey = 'completa') =>
  `${galleryUrl(code)}?pantalla=1${view === 'completa' ? '' : `&vista=${view}`}`;

/** Se puede subir ahora (internet, Drive configurado y no está en "sin conexión"). */
export const canUpload = () => isDriveConfigured() && !getVideoSettings().offline && navigator.onLine;

/** Anota el video en la galería online (el equipo se identifica con su clave). No corta si falla. */
async function registerClip(item: PendingUpload, driveId: string, thumbId: string | null) {
  if (!isSupabaseConfigured || !item.gallery) return;
  const { error } = await supabase.rpc('video_clip_add', {
    p_code: getDeviceCode(), p_secret: getDeviceSecret(),
    p_gallery: item.gallery, p_drive_id: driveId, p_thumb_id: thumbId,
    p_title: item.title?.slice(0, 120) || null, p_mode: item.mode,
    // Con aprobación previa el video entra oculto hasta que se apruebe en el panel
    p_hidden: getVideoSettings().galleryModeration === 'pre',
  });
  if (error) console.warn('[video] no se pudo anotar en la galería', error.message);
}

/** Manda el video a los WhatsApp anotados. Devuelve los que fallaron. */
export async function sendToPhones(item: Pick<PendingUpload, 'title' | 'gallery' | 'mode'>, driveId: string, phones: string[]) {
  const failed: string[] = [];
  for (const phone of phones) {
    try {
      await sendVideoWhatsApp({ phone, driveId, title: item.title, gallery: item.gallery || undefined, mode: item.mode });
    } catch (e) {
      console.warn('[video] WhatsApp', e);
      failed.push(phone);
    }
  }
  return failed;
}

async function uploadOne(item: PendingUpload) {
  const driveId = await uploadVideoForShare(item.blob, item.name, item.folder);
  let thumbId: string | null = null;
  if (item.thumb) {
    try {
      const thumbName = `miniatura-${item.name.replace(/\.\w+$/, '')}.jpg`;
      thumbId = await uploadForShare(await blobToDataUrl(item.thumb), thumbName, item.folder, 'image/jpeg');
    } catch (e) {
      console.warn('[video] miniatura', e);
    }
  }
  await registerClip(item, driveId, thumbId).catch(() => {});
  if (item.phones?.length) await sendToPhones(item, driveId, item.phones);
  return driveId;
}

// ─── Cola (IndexedDB) ──────────────────────────────────────────────
async function queuePut(item: PendingUpload) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(UPLOADS, 'readwrite');
    tx.objectStore(UPLOADS).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event(VIDEO_QUEUE_EVENT));
}

async function queueAll(): Promise<PendingUpload[]> {
  const db = await openDb();
  const rows = await new Promise<PendingUpload[]>((resolve, reject) => {
    const req = db.transaction(UPLOADS).objectStore(UPLOADS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => a.created - b.created);
}

async function queueDelete(name: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(UPLOADS, 'readwrite');
    tx.objectStore(UPLOADS).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event(VIDEO_QUEUE_EVENT));
}

export const pendingVideoCount = async () => (await queueAll().catch(() => [])).length;

/** Anota un WhatsApp en un video que espera internet: se manda cuando se sube. */
export async function addPhoneToQueued(name: string, phone: string) {
  const item = (await queueAll()).find(i => i.name === name);
  if (!item) return false;
  await queuePut({ ...item, phones: [...new Set([...(item.phones ?? []), phone])] });
  return true;
}

/**
 * Entrega un video: lo sube ya (devuelve el ID de Drive para el QR) o, si no se
 * puede, lo deja en la cola y devuelve null.
 */
export async function deliverVideo(item: PendingUpload): Promise<string | null> {
  if (canUpload()) {
    try {
      return await uploadOne(item);
    } catch (e) {
      console.warn('[video] no se pudo subir, queda en la cola', e);
    }
  }
  if (isDriveConfigured()) await queuePut(item).catch(e => console.error('[video] cola', e));
  return null;
}

let running = false;
/** Sube lo pendiente, de a un video. Se corta si falla (p. ej. se fue internet). */
export async function processVideoQueue() {
  if (running || !canUpload()) return;
  running = true;
  try {
    for (const item of await queueAll()) {
      if (!canUpload()) break;
      try {
        await uploadOne(item);
        await queueDelete(item.name);
      } catch (e) {
        console.warn('[video] reintento fallido', e);
        break;
      }
    }
  } finally {
    running = false;
  }
}

let started = false;
/** Reintenta la cola al volver internet y cada 2 minutos. */
export function startVideoSync() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => { void processVideoQueue(); });
  window.setInterval(() => { void processVideoQueue(); }, 120000);
  void processVideoQueue();
}
