import { removeScreenMedia, saveScreenMedia } from '@/lib/kioskMedia';
import { ANIM_KEY, frameKey, getVideoSettings, LOGO_KEY, saveVideoSettings, songKey, type MediaItem, type SongItem } from './settings';

// Archivos de la cabina de video que se suben desde el panel (Supabase Storage).
// El equipo los baja una vez y los guarda: después funcionan sin internet.
// Los que vienen del panel tienen ID con "r-"; los cargados en el equipo no se tocan.

export interface RemoteFile { id: string; name: string; url: string }
export interface VideoAssets {
  frames?: RemoteFile[];
  songs?: (RemoteFile & { start?: number })[];
  /** URL del logo (null = quitar el que mandó el panel) */
  logo?: string | null;
  /** URL de la animación propia (null = quitar) */
  anim?: string | null;
}

const APPLIED_KEY = 'kiosk_video_assets_applied';
const readApplied = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(APPLIED_KEY) || '{}'); } catch { return {}; }
};
const writeApplied = (m: Record<string, string>) => {
  try { localStorage.setItem(APPLIED_KEY, JSON.stringify(m)); } catch { /* sin espacio */ }
};

export const isRemoteId = (id: string) => id.startsWith('r-');

async function download(key: string, url: string, name: string, applied: Record<string, string>) {
  if (applied[key] === url) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo bajar ${name} (${res.status})`);
  const blob = await res.blob();
  await saveScreenMedia(key as `video:${string}`, new File([blob], name, { type: blob.type }));
  applied[key] = url;
}

async function remove(key: string, applied: Record<string, string>) {
  if (!applied[key]) return;
  await removeScreenMedia(key as `video:${string}`).catch(() => {});
  delete applied[key];
}

/** Aplica la lista de archivos del panel. */
export async function applyVideoAssets(assets: VideoAssets) {
  const applied = readApplied();
  try {
    const s = getVideoSettings();
    if (assets.frames) {
      const remote = assets.frames.map(f => ({ ...f, id: isRemoteId(f.id) ? f.id : `r-${f.id}` }));
      for (const f of remote) await download(frameKey(f.id), f.url, f.name, applied);
      for (const old of (s.frames ?? []).filter(f => isRemoteId(f.id) && !remote.some(r => r.id === f.id))) await remove(frameKey(old.id), applied);
      const local = (s.frames ?? []).filter(f => !isRemoteId(f.id));
      saveVideoSettings({ frames: [...local, ...remote.map<MediaItem>(f => ({ id: f.id, name: f.name }))] });
    }
    if (assets.songs) {
      const remote = assets.songs.map(f => ({ ...f, id: isRemoteId(f.id) ? f.id : `r-${f.id}` }));
      for (const f of remote) await download(songKey(f.id), f.url, f.name, applied);
      for (const old of (s.songs ?? []).filter(f => isRemoteId(f.id) && !remote.some(r => r.id === f.id))) await remove(songKey(old.id), applied);
      const local = (s.songs ?? []).filter(f => !isRemoteId(f.id));
      saveVideoSettings({ songs: [...local, ...remote.map<SongItem>(f => ({ id: f.id, name: f.name, start: f.start }))] });
    }
    if (assets.logo !== undefined) {
      if (assets.logo) await download(LOGO_KEY, assets.logo, 'logo', applied);
      else await remove(LOGO_KEY, applied);
    }
    if (assets.anim !== undefined) {
      if (assets.anim) await download(ANIM_KEY, assets.anim, 'animacion', applied);
      else await remove(ANIM_KEY, applied);
    }
  } finally {
    writeApplied(applied);
  }
}
