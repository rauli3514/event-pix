import { isDriveConfigured, uploadForShare } from '@/lib/driveBackup';
import { getDeviceCode } from '@/lib/kioskDevice';
import { getGeneralSettings } from '@/lib/kioskSettings';
import { publicSiteUrl } from '@/lib/kioskShare';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { blobToDataUrl, openDb, UPLOADS, uploadVideoForShare } from './storage';

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
}

export const galleryUrl = (code: string) => `${publicSiteUrl()}/galeria-video/${encodeURIComponent(code)}`;

/** Se puede subir ahora (internet, Drive configurado y no está en "sin conexión"). */
export const canUpload = () => isDriveConfigured() && !getGeneralSettings().offline && navigator.onLine;

/** Anota el video en la galería online (si hay servidor). No corta si falla. */
async function registerClip(item: PendingUpload, driveId: string, thumbId: string | null) {
  if (!isSupabaseConfigured || !item.gallery) return;
  const { error } = await supabase.from('video_clips').upsert({
    gallery: item.gallery, drive_id: driveId, thumb_id: thumbId,
    title: item.title?.slice(0, 120) || null, mode: item.mode, device_code: getDeviceCode(),
  }, { onConflict: 'gallery,drive_id', ignoreDuplicates: true });
  if (error) console.warn('[video] no se pudo anotar en la galería', error.message);
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
