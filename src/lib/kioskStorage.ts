import { Capacitor, registerPlugin } from '@capacitor/core';
import { getGeneralSettings } from '@/lib/kioskSettings';

// Respaldo de las fotos del kiosco en el equipo, una carpeta por evento.
// En la app: Imágenes/EventPix/<carpeta> (plugin KioskStorage). En el navegador
// (para probar): IndexedDB.

export interface StoredPhoto {
  uri: string;
  name: string;
  date: number;
}

interface KioskStoragePlugin {
  saveImage(options: { dataUrl: string; folder: string; fileName: string }): Promise<{ uri: string; folder: string }>;
  listImages(options: { folder: string; limit?: number }): Promise<{ items: StoredPhoto[] }>;
  readImage(options: { uri: string; maxSize?: number }): Promise<{ dataUrl: string }>;
  storageInfo(options: { folder: string }): Promise<StorageInfo>;
  deleteImages(options: { folder?: string }): Promise<{ deleted: number }>;
}

export interface StorageInfo {
  /** bytes del almacenamiento del equipo */
  total: number;
  free: number;
  /** fotos de EventPix (todas las carpetas) */
  photosBytes: number;
  photosCount: number;
  /** fotos del evento actual */
  eventBytes: number;
  eventCount: number;
}

const KioskStorage = registerPlugin<KioskStoragePlugin>('KioskStorage');
const isNative = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KioskStorage');

/** Carpeta del evento: la configurada en Ajustes, o el nombre del evento. */
export const folderNameFor = (name: string) =>
  name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 60) || 'EventPix';

export const eventFolder = () => {
  const s = getGeneralSettings();
  return folderNameFor(s.localFolder || s.eventTitle || 'EventPix');
};

// ─── IndexedDB (navegador) ─────────────────────────────────────────
const DB_NAME = 'eventpix_kiosk_photos';
const STORE = 'photos';

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const store = req.result.createObjectStore(STORE, { keyPath: 'uri' });
    store.createIndex('folder', 'folder');
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const webSave = async (dataUrl: string, folder: string, name: string) => {
  const db = await openDb();
  const uri = `idb:${folder}/${name}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ uri, folder, name, date: Date.now(), dataUrl });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return uri;
};

const webList = async (folder: string, limit: number): Promise<StoredPhoto[]> => {
  const db = await openDb();
  const rows = await new Promise<(StoredPhoto & { folder: string })[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).index('folder').getAll(folder);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return rows.sort((a, b) => b.date - a.date).slice(0, limit).map(({ uri, name, date }) => ({ uri, name, date }));
};

const webRead = async (uri: string) => {
  const db = await openDb();
  return new Promise<string>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(uri);
    req.onsuccess = () => (req.result ? resolve(req.result.dataUrl) : reject(new Error('Foto no encontrada')));
    req.onerror = () => reject(req.error);
  });
};

// ─── API ───────────────────────────────────────────────────────────
const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export async function savePhotoLocally(dataUrl: string, fileName: string, folder = eventFolder()) {
  if (isNative()) return (await KioskStorage.saveImage({ dataUrl, folder, fileName })).uri;
  return webSave(dataUrl, folder, fileName);
}

/**
 * Guarda la foto final (con marco o IA) y, si la hay, la original de la cámara.
 * Las fotos que no son data URL (p. ej. una URL de la IA) se descargan primero.
 */
export interface SavedPhoto {
  uri: string;
  name: string;
  folder: string;
  /** Toma original de la cámara (no la foto final) */
  original: boolean;
}

export async function backupPhoto(final: string, original: string | string[] | null, kind: string) {
  const base = `${stamp()}-${kind}`;
  const toDataUrl = async (src: string) => {
    if (src.startsWith('data:')) return src;
    const blob = await (await fetch(src)).blob();
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  };
  const folder = eventFolder();
  const results: SavedPhoto[] = [];
  results.push({ uri: await savePhotoLocally(await toDataUrl(final), `${base}.jpg`, folder), name: `${base}.jpg`, folder, original: false });
  // Originales de la cámara (varias si la toma fue de 2 a 4 fotos)
  const originals = (Array.isArray(original) ? original : original ? [original] : []).filter(o => o !== final);
  for (let i = 0; i < originals.length; i++) {
    const suffix = originals.length > 1 ? `-original-${i + 1}` : '-original';
    const name = `${base}${suffix}.jpg`;
    results.push({ uri: await savePhotoLocally(await toDataUrl(originals[i]), name, folder), name, folder, original: true });
  }
  return results;
}

/** Fotos finales del evento (sin las originales), para la galería. */
export async function listEventPhotos(limit = 120, folder = eventFolder()): Promise<StoredPhoto[]> {
  const items = isNative()
    ? (await KioskStorage.listImages({ folder, limit: limit * 2 })).items
    : await webList(folder, limit * 2);
  return items.filter(i => !i.name.includes('-original')).slice(0, limit);
}

export async function readStoredPhoto(uri: string, maxSize = 1200) {
  if (isNative()) return (await KioskStorage.readImage({ uri, maxSize })).dataUrl;
  return webRead(uri);
}

// ─── Espacio y borrado ─────────────────────────────────────────────
const webAllRows = async () => {
  const db = await openDb();
  return new Promise<{ uri: string; folder: string; dataUrl: string }[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

/** Espacio del equipo y cuánto ocupan las fotos (todas y del evento actual). */
export async function storageInfo(folder = eventFolder()): Promise<StorageInfo> {
  if (isNative()) return KioskStorage.storageInfo({ folder });
  const rows = await webAllRows().catch(() => []);
  const size = (r: { dataUrl: string }) => Math.round(r.dataUrl.length * 0.75);
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const total = est?.quota ?? 0;
  return {
    total,
    free: Math.max(0, total - (est?.usage ?? 0)),
    photosBytes: rows.reduce((a, r) => a + size(r), 0),
    photosCount: rows.length,
    eventBytes: rows.filter(r => r.folder === folder).reduce((a, r) => a + size(r), 0),
    eventCount: rows.filter(r => r.folder === folder).length,
  };
}

/** Borra las fotos del evento indicado, o todas las de EventPix (folder = null). */
export async function deletePhotos(folder: string | null): Promise<number> {
  if (isNative()) return (await KioskStorage.deleteImages(folder ? { folder } : {})).deleted;
  const rows = (await webAllRows()).filter(r => !folder || r.folder === folder);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    rows.forEach(r => tx.objectStore(STORE).delete(r.uri));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return rows.length;
}

export const formatBytes = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.round(b / 1e3)} KB`;
