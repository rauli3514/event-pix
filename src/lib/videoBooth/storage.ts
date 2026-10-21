import { Capacitor } from '@capacitor/core';
import { eventFolder, KioskStorage } from '@/lib/kioskStorage';
import { isDriveConfigured, uploadForShare } from '@/lib/driveBackup';
import { baseMime } from './recorder';

// Guardado de los videos de la cabina: en el equipo siempre (Películas/EventPix/<evento>
// en la app, IndexedDB en el navegador) y en Drive para el QR del invitado.

export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export const videoFileName = (mode: string, ext: string) => `${stamp()}-video-${mode}.${ext}`;

// ─── IndexedDB (navegador, o APK viejo sin saveVideo) ─────────────────────
const DB_NAME = 'eventpix_kiosk_videos';
const STORE = 'videos';

/** Videos pendientes de subir (sin internet): se suben solos cuando vuelve */
export const UPLOADS = 'uploads';

export const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'uri' }).createIndex('folder', 'folder');
    if (!db.objectStoreNames.contains(UPLOADS)) db.createObjectStore(UPLOADS, { keyPath: 'name' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function webSave(blob: Blob, folder: string, name: string) {
  const db = await openDb();
  const uri = `idb-video:${folder}/${name}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ uri, folder, name, date: Date.now(), blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return uri;
}

export interface StoredVideo { uri: string; name: string; date: number; blob: Blob }

/** Videos guardados en el navegador para un evento (el más nuevo primero). */
export async function listWebVideos(folder = eventFolder(), limit = 60): Promise<StoredVideo[]> {
  const db = await openDb();
  const rows = await new Promise<(StoredVideo & { folder: string })[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).index('folder').getAll(folder);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => b.date - a.date).slice(0, limit);
}

/** Guarda el video en el equipo. Devuelve dónde quedó. */
export async function saveVideoLocally(blob: Blob, fileName: string, folder = eventFolder()): Promise<string> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('KioskStorage')) {
    try {
      const data = await blobToDataUrl(blob);
      return (await KioskStorage.saveVideo({ data, folder, fileName, mime: baseMime(blob.type) })).uri;
    } catch (e) {
      // APK anterior a la cabina de video: queda en la memoria de la app
      console.warn('[video] saveVideo nativo no disponible', e);
    }
  }
  return webSave(blob, folder, fileName);
}

/** Sube el video a Drive para el QR. Devuelve el ID del archivo. */
export async function uploadVideoForShare(blob: Blob, fileName: string, folder = eventFolder()) {
  if (!isDriveConfigured()) throw new Error('Falta configurar Google Drive en Ajustes → Compartir y nube');
  if (blob.size > 45 * 1024 * 1024) throw new Error('El video pesa demasiado para subirlo (más de 45 MB)');
  return uploadForShare(await blobToDataUrl(blob), fileName, folder, baseMime(blob.type));
}
