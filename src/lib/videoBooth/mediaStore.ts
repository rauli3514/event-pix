// Archivos de la cabina guardados en el equipo (marcos, logo, música, animación):
// IndexedDB propia de la app EventPix Video. Funcionan sin internet.

const DB_NAME = 'eventpix_video_media';
const STORE = 'media';
export const MAX_MEDIA_BYTES = 60 * 1024 * 1024;
export const MEDIA_EVENT = 'video-media-changed';

export interface MediaRecord { key: string; blob: Blob; type: string; name: string }

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'key' }); };
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

export async function saveMedia(key: string, file: File | Blob, name = (file as File).name || key) {
  if (file.size > MAX_MEDIA_BYTES) throw new Error(`El archivo pesa más de ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)} MB`);
  await tx('readwrite', s => s.put({ key, blob: file, type: file.type, name } satisfies MediaRecord));
  window.dispatchEvent(new CustomEvent(MEDIA_EVENT, { detail: key }));
}

export const getMedia = async (key: string): Promise<MediaRecord | null> =>
  (await tx<MediaRecord | undefined>('readonly', s => s.get(key))) ?? null;

export async function removeMedia(key: string) {
  await tx('readwrite', s => s.delete(key));
  window.dispatchEvent(new CustomEvent(MEDIA_EVENT, { detail: key }));
}
