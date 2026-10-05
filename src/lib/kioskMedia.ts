import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';

// Fondos de cada pantalla del kiosco: una animación incluida o un video/imagen
// propio que se sube en Ajustes. Los archivos propios quedan en el equipo
// (IndexedDB del WebView), no en la nube: funcionan sin internet.

export const SCREENS = [
  { key: 'splash', label: 'Bienvenida', hint: '"Tocá para empezar"' },
  { key: 'home', label: 'Inicio del equipo', hint: 'Íconos Fotos / Fotos IA' },
  { key: 'modes', label: 'Elegir experiencia', hint: '"¿Cómo querés tu foto?"' },
  { key: 'getReady', label: 'Preparate', hint: '"Vamos a empezar"' },
  { key: 'processing', label: 'Procesando', hint: 'Mientras se arma la foto' },
  { key: 'reveal', label: 'Frase y marco', hint: 'Frase divertida y elegir marco' },
  { key: 'result', label: 'Resultado', hint: 'Foto final, imprimir y QR' },
] as const;
export type ScreenKey = typeof SCREENS[number]['key'];

/** Valores: 'aurora', una escena ('polaroids', 'flash', 'neon', 'fiesta'), un video '1'..'3', 'none' o 'custom:<pantalla>'. */
export const getScreenBackground = (screen: ScreenKey): string => {
  const s = getGeneralSettings();
  const map = (s.screenBackgrounds ?? {}) as Record<string, string>;
  if (map[screen]) return map[screen];
  if (screen === 'splash') return s.splashVideo || 'polaroids';
  return 'aurora';
};

export const setScreenBackground = (screen: ScreenKey, value: string) => {
  const s = getGeneralSettings();
  const map = { ...((s.screenBackgrounds ?? {}) as Record<string, string>), [screen]: value };
  return saveGeneralSettings({ screenBackgrounds: map, ...(screen === 'splash' && !value.startsWith('custom:') ? { splashVideo: value } : {}) });
};

export const customKey = (screen: ScreenKey) => `custom:${screen}`;

// ─── Archivos propios (IndexedDB) ───────────────────────────────────
const DB_NAME = 'eventpix_kiosk_media';
const STORE = 'media';
export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;

interface MediaRecord { screen: string; blob: Blob; type: string; name: string }

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'screen' }); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const tx = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
};

export const saveScreenMedia = async (screen: ScreenKey | `acc:${string}`, file: File) => {
  if (file.size > MAX_MEDIA_BYTES) throw new Error('El archivo pesa más de 40 MB');
  await tx('readwrite', s => s.put({ screen, blob: file, type: file.type, name: file.name } satisfies MediaRecord));
  window.dispatchEvent(new CustomEvent('kiosk-media-changed', { detail: screen }));
};

export const getScreenMedia = async (screen: string): Promise<MediaRecord | null> =>
  (await tx<MediaRecord | undefined>('readonly', s => s.get(screen))) ?? null;

export const removeScreenMedia = async (screen: ScreenKey | `acc:${string}`) => {
  await tx('readwrite', s => s.delete(screen));
  window.dispatchEvent(new CustomEvent('kiosk-media-changed', { detail: screen }));
};

// ─── Fondo de la hoja impresa (detrás de las fotos) ─────────────────
const PAGE_BG = 'page-bg';

export const savePageBackground = async (file: File) => {
  if (file.size > MAX_MEDIA_BYTES) throw new Error('El archivo pesa más de 40 MB');
  await tx('readwrite', s => s.put({ screen: PAGE_BG, blob: file, type: file.type, name: file.name } satisfies MediaRecord));
  window.dispatchEvent(new CustomEvent('kiosk-media-changed', { detail: PAGE_BG }));
};
export const removePageBackground = async () => {
  await tx('readwrite', s => s.delete(PAGE_BG));
  window.dispatchEvent(new CustomEvent('kiosk-media-changed', { detail: PAGE_BG }));
};
/** Imagen de fondo de la hoja como data URL (o null si no hay). */
export const getPageBackground = async (): Promise<string | null> => {
  const rec = await getScreenMedia(PAGE_BG).catch(() => null);
  if (!rec) return null;
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(rec.blob);
  });
};
export const getPageBackgroundName = async () => (await getScreenMedia(PAGE_BG).catch(() => null))?.name ?? null;
