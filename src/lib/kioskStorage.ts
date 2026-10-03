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
}

const KioskStorage = registerPlugin<KioskStoragePlugin>('KioskStorage');
const isNative = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KioskStorage');

/** Carpeta del evento: la configurada en Ajustes, o el nombre del evento. */
export const eventFolder = () => {
  const s = getGeneralSettings();
  const name = (s.localFolder || s.eventTitle || 'EventPix').trim();
  return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 60) || 'EventPix';
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
  const results: string[] = [];
  results.push(await savePhotoLocally(await toDataUrl(final), `${base}.jpg`));
  // Originales de la cámara (varias si la toma fue de 2 a 4 fotos)
  const originals = (Array.isArray(original) ? original : original ? [original] : []).filter(o => o !== final);
  for (let i = 0; i < originals.length; i++) {
    const suffix = originals.length > 1 ? `-original-${i + 1}` : '-original';
    results.push(await savePhotoLocally(await toDataUrl(originals[i]), `${base}${suffix}.jpg`));
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
