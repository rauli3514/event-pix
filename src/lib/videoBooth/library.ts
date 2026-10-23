import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getMedia, removeMedia, saveMedia } from './mediaStore';
import { bgKey } from './backgrounds';
import { frameKey, getVideoSettings, saveVideoSettings, songKey, type MediaItem, type SongItem } from './settings';

// Biblioteca compartida de la cabina: música, marcos y fondos que se suben una
// sola vez en el panel (/admin/cabina-video → Biblioteca) y que bajan solos todos
// los equipos, también los que se instalan después. Vive en el bucket
// video-assets: los archivos en library/<tipo>/ y la lista en library/library.json.
// En el equipo sus IDs empiezan con "l-" (los del panel por equipo con "r-").

export type LibraryKind = 'songs' | 'frames' | 'backgrounds';
export interface LibraryItem {
  id: string;
  name: string;
  /** Dirección pública del archivo */
  url: string;
  /** Ruta en el bucket (para borrarlo) */
  path: string;
  /** Canciones: segundo donde empieza */
  start?: number;
}
export type VideoLibrary = Record<LibraryKind, LibraryItem[]> & { updatedAt?: string };

export const LIBRARY_PATH = 'library/library.json';
export const LIBRARY_EVENT = 'video-library-changed';
export const emptyLibrary = (): VideoLibrary => ({ songs: [], frames: [], backgrounds: [] });
export const isLibraryId = (id: string) => id.startsWith('l-');

const keyFor = (kind: LibraryKind, id: string) => (kind === 'songs' ? songKey(id) : kind === 'frames' ? frameKey(id) : bgKey(id));

/** La biblioteca publicada (vacía si todavía no hay). */
export async function fetchLibrary(): Promise<VideoLibrary> {
  if (!isSupabaseConfigured) return emptyLibrary();
  const url = supabase.storage.from('video-assets').getPublicUrl(LIBRARY_PATH).data.publicUrl;
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 400 || res.status === 404) return emptyLibrary();
  if (!res.ok) throw new Error(`No se pudo leer la biblioteca (${res.status})`);
  const json = await res.json() as Partial<VideoLibrary>;
  return { songs: json.songs ?? [], frames: json.frames ?? [], backgrounds: json.backgrounds ?? [], updatedAt: json.updatedAt };
}

// ─── En el equipo ────────────────────────────────────────────────────
const APPLIED_KEY = 'video_library_applied';
const readApplied = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(APPLIED_KEY) || '{}'); } catch { return {}; }
};
const writeApplied = (m: Record<string, string>) => {
  try { localStorage.setItem(APPLIED_KEY, JSON.stringify(m)); } catch { /* sin espacio */ }
};

let syncing = false;
/** Baja lo nuevo de la biblioteca, borra lo que se sacó y actualiza las listas del equipo. */
export async function syncLibrary() {
  if (syncing || !isSupabaseConfigured) return;
  syncing = true;
  try {
    const lib = await fetchLibrary();
    const applied = readApplied();
    const s = getVideoSettings();
    const patch: { songs?: SongItem[]; frames?: MediaItem[]; backgrounds?: MediaItem[] } = {};
    for (const kind of ['songs', 'frames', 'backgrounds'] as const) {
      const items = lib[kind].map(it => ({ ...it, id: isLibraryId(it.id) ? it.id : `l-${it.id}` }));
      const ok: typeof items = [];
      for (const it of items) {
        const key = keyFor(kind, it.id);
        try {
          if (applied[key] !== it.url || !(await getMedia(key).catch(() => null))) {
            const res = await fetch(it.url);
            if (!res.ok) throw new Error(String(res.status));
            await saveMedia(key, await res.blob(), it.name);
            applied[key] = it.url;
            writeApplied(applied);
          }
          ok.push(it);
        } catch (e) {
          // Se reintenta en la próxima vuelta
          console.warn('[video] biblioteca: no se pudo bajar', it.name, e);
        }
      }
      const current = (s[kind] ?? []) as (MediaItem & { start?: number })[];
      // Lo que se sacó de la biblioteca
      for (const old of current.filter(x => isLibraryId(x.id) && !items.some(it => it.id === x.id))) {
        const key = keyFor(kind, old.id);
        await removeMedia(key).catch(() => {});
        delete applied[key];
      }
      const own = current.filter(x => !isLibraryId(x.id));
      const next = [...own, ...ok.map(it => (kind === 'songs' ? { id: it.id, name: it.name, start: it.start ?? 0 } : { id: it.id, name: it.name }))];
      if (JSON.stringify(next) !== JSON.stringify(current)) patch[kind] = next;
    }
    writeApplied(applied);
    if (Object.keys(patch).length) {
      saveVideoSettings(patch);
      window.dispatchEvent(new Event(LIBRARY_EVENT));
    }
  } catch (e) {
    console.warn('[video] biblioteca', e);
  } finally {
    syncing = false;
  }
}

let started = false;
/** Revisa la biblioteca al abrir la app, cada 10 minutos y cuando vuelve internet. */
export function startLibrarySync() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  window.setTimeout(() => void syncLibrary(), 4000);
  window.setInterval(() => void syncLibrary(), 10 * 60 * 1000);
  window.addEventListener('online', () => void syncLibrary());
}

// ─── En el panel ─────────────────────────────────────────────────────
/** Publica la lista de la biblioteca (la leen todos los equipos). */
export async function saveLibrary(lib: VideoLibrary) {
  const body = new Blob([JSON.stringify({ ...lib, updatedAt: new Date().toISOString() })], { type: 'application/json' });
  const { error } = await supabase.storage.from('video-assets').upload(LIBRARY_PATH, body, { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) throw new Error(error.message);
}

/** Sube un archivo a la biblioteca y devuelve su entrada. */
export async function uploadLibraryFile(kind: LibraryKind, file: File): Promise<LibraryItem> {
  const id = `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const path = `library/${kind}/${id}-${file.name.replace(/[^\w.-]+/g, '_')}`;
  const { error } = await supabase.storage.from('video-assets').upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000' });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Falta correr la migración de la cabina de video (bucket video-assets)' : error.message);
  const url = supabase.storage.from('video-assets').getPublicUrl(path).data.publicUrl;
  return { id, name: file.name.replace(/\.\w+$/, ''), url, path, ...(kind === 'songs' ? { start: 0 } : {}) };
}

export async function removeLibraryFiles(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from('video-assets').remove(paths);
}
