import { Capacitor, registerPlugin } from '@capacitor/core';
import { isDriveConfigured, uploadBlobForShare } from './drive';
import { baseMime } from './recorder';
import { getVideoSettings } from './settings';

// Guardado de los videos: en el equipo siempre (Películas/EventPix Video/<evento>
// con el plugin nativo VideoStorage de la app; IndexedDB en el navegador) y en el
// Drive de la cabina para el QR del invitado.

interface VideoStoragePlugin {
  saveVideo(options: { data: string; folder: string; fileName: string; mime: string }): Promise<{ uri: string; folder: string }>;
  // De a partes (videos largos sin llenar la memoria)
  beginVideo(): Promise<{ id: string }>;
  appendVideo(options: { id: string; data: string }): Promise<void>;
  finishVideo(options: { id: string; folder: string; fileName: string; mime: string }): Promise<{ uri: string; folder: string }>;
  abortVideo(options: { id: string }): Promise<void>;
}
const VideoStorage = registerPlugin<VideoStoragePlugin>('VideoStorage');

/** Carpeta del evento: el nombre del evento sin caracteres raros. */
export const folderNameFor = (name: string) =>
  name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 60) || 'Videos';
export const eventFolder = () => folderNameFor(getVideoSettings().eventTitle || 'Videos');

export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** Un pedazo del archivo en base64 (sin el "data:…;base64,"). */
export const blobToBase64 = async (blob: Blob) => {
  const url = await blobToDataUrl(blob);
  return url.slice(url.indexOf(',') + 1);
};

/** Partes de ~768 KB (múltiplo de 3: el base64 de cada parte se puede pegar seguido). */
export const CHUNK_BYTES = 3 * 256 * 1024;

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export const videoFileName = (mode: string, ext: string) => `${stamp()}-video-${mode}.${ext}`;

// ─── IndexedDB (navegador, o APK viejo sin saveVideo) ─────────────────────
const DB_NAME = 'eventpix_video_files';
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
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('VideoStorage')) {
    try {
      // De a partes: mandar el video entero de una vez cerraba la app con videos largos
      const { id } = await VideoStorage.beginVideo();
      try {
        for (let i = 0; i < blob.size; i += CHUNK_BYTES) {
          await VideoStorage.appendVideo({ id, data: await blobToBase64(blob.slice(i, i + CHUNK_BYTES)) });
        }
        return (await VideoStorage.finishVideo({ id, folder, fileName, mime: baseMime(blob.type) })).uri;
      } catch (e) {
        void VideoStorage.abortVideo({ id }).catch(() => {});
        throw e;
      }
    } catch (e) {
      // Si falla la galería del equipo, queda en la memoria de la app
      console.warn('[video] no se pudo guardar en la galería del equipo', e);
    }
  }
  return webSave(blob, folder, fileName);
}

/** Sube el video a Drive para el QR. Devuelve el ID del archivo. */
export async function uploadVideoForShare(blob: Blob, fileName: string, folder = eventFolder()) {
  if (!isDriveConfigured()) throw new Error('Falta configurar Google Drive en Ajustes → Nube');
  if (blob.size > 45 * 1024 * 1024) throw new Error('El video pesa demasiado para subirlo (más de 45 MB)');
  return uploadBlobForShare(blob, fileName, folder, baseMime(blob.type));
}
