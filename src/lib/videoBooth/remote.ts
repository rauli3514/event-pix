import { getMedia, removeMedia, saveMedia } from './mediaStore';
import { getCameraSettings, saveCameraSettings } from './camera';
import {
  ANIM_KEY, END_KEY, frameKey, getVideoSettings, LOGO_KEY, saveVideoSettings, songKey,
  type MediaItem, type SongItem,
} from './settings';
import { bgKey } from './backgrounds';

// Configuración a distancia desde el panel de la cabina (/admin/cabina-video):
// el panel guarda en video_devices.settings lo que quiere cambiar y sube
// settings_rev; el equipo lo aplica en el próximo checkin e informa lo que tiene.
// Los archivos (marcos, canciones, logo, animación) se suben al bucket video-assets:
// el equipo los baja una vez y los guarda (después funcionan sin internet).
// Los que vienen del panel tienen ID con "r-"; los cargados en el equipo no se tocan.

export interface RemoteFile { id: string; name: string; url: string }
export interface VideoAssets {
  frames?: RemoteFile[];
  songs?: (RemoteFile & { start?: number })[];
  /** URL del logo (null = quitar el que mandó el panel) */
  logo?: string | null;
  /** URL de la animación propia (null = quitar) */
  anim?: string | null;
  /** URL de la imagen de fondo de la placa final (null = quitar) */
  endcard?: string | null;
  /** Fondos de las pantallas (imágenes o videos) */
  backgrounds?: RemoteFile[];
}
export interface RemoteVideoSettings {
  video?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  assets?: VideoAssets;
}

/** Ajustes que maneja el panel (los archivos van aparte, en assets). */
export const REMOTE_VIDEO_KEYS = [
  'eventTitle', 'offline', 'publicSiteUrl', 'driveScriptUrl', 'driveFolderLink',
  'modes', 'aspect', 'resolution', 'countdown', 'overlay', 'overlayText', 'musicVolume', 'slowSpeed', 'rampPreset',
  'boomerangLoops', 'prompts', 'showQr', 'resultSeconds', 'title', 'facing', 'highFps', 'review',
  'frameId', 'frameChoice', 'animation', 'animBlend', 'accessory',
  'showLogo', 'logoPosition', 'logoSize', 'logoOpacity', 'watermark', 'watermarkPosition', 'brandColor',
  'endCard', 'endCardSeconds', 'endCardText', 'zoomEffect', 'flashEffect',
  'songMode', 'songId', 'autoStart360', 'autoStop360', 'motionThreshold', 'continuous360', 'delivery', 'galleryCode',
  'galleryModeration', 'whatsappEnabled', 'whatsappPrefix', 'galleryEvent', 'autoUpdate',
  'overlayDateMode', 'overlayDate', 'frameText', 'textPosition', 'textColor', 'textScale', 'watermarkSize', 'watermarkOpacity', 'guestFrames', 'endCardOverlay',
  'background', 'backgroundDim', 'guestbookTitle', 'guestbookText',
] as const;
export const REMOTE_CAMERA_KEYS = ['mirror', 'rotation', 'quality', 'focus'] as const;
/** Se informan al panel pero no se pisan desde él */
const REPORT_ONLY_KEYS = ['frames', 'songs', 'backgrounds'] as const;

const pick = (src: Record<string, unknown>, keys: readonly string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
};

const APPLIED_KEY = 'video_remote_applied_rev';
const ASSETS_KEY = 'video_remote_assets';
export const REMOTE_APPLIED_EVENT = 'video-remote-applied';

export const getAppliedRev = () => {
  try { return Number(localStorage.getItem(APPLIED_KEY)) || 0; } catch { return 0; }
};

/** Ajustes actuales, para verlos en el panel. */
export function buildReport(): RemoteVideoSettings {
  return {
    video: pick(getVideoSettings() as Record<string, unknown>, [...REMOTE_VIDEO_KEYS, ...REPORT_ONLY_KEYS]),
    camera: pick(getCameraSettings() as Record<string, unknown>, REMOTE_CAMERA_KEYS),
  };
}

const readApplied = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(ASSETS_KEY) || '{}'); } catch { return {}; }
};
const writeApplied = (m: Record<string, string>) => {
  try { localStorage.setItem(ASSETS_KEY, JSON.stringify(m)); } catch { /* sin espacio */ }
};

export const isRemoteId = (id: string) => id.startsWith('r-');

async function download(key: string, url: string, name: string, applied: Record<string, string>) {
  if (applied[key] === url && await getMedia(key).catch(() => null)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo bajar ${name} (${res.status})`);
  await saveMedia(key, await res.blob(), name);
  applied[key] = url;
}

async function remove(key: string, applied: Record<string, string>) {
  if (!applied[key]) return;
  await removeMedia(key).catch(() => {});
  delete applied[key];
}

async function applyAssets(assets: VideoAssets) {
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
    if (assets.backgrounds) {
      const remote = assets.backgrounds.map(f => ({ ...f, id: isRemoteId(f.id) ? f.id : `r-${f.id}` }));
      for (const f of remote) await download(bgKey(f.id), f.url, f.name, applied);
      for (const old of (s.backgrounds ?? []).filter(f => isRemoteId(f.id) && !remote.some(r => r.id === f.id))) await remove(bgKey(old.id), applied);
      const local = (s.backgrounds ?? []).filter(f => !isRemoteId(f.id));
      saveVideoSettings({ backgrounds: [...local, ...remote.map<MediaItem>(f => ({ id: f.id, name: f.name }))] });
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
    if (assets.endcard !== undefined) {
      if (assets.endcard) await download(END_KEY, assets.endcard, 'placa-final', applied);
      else await remove(END_KEY, applied);
    }
    if (assets.anim !== undefined) {
      if (assets.anim) await download(ANIM_KEY, assets.anim, 'animacion', applied);
      else await remove(ANIM_KEY, applied);
    }
  } finally {
    writeApplied(applied);
  }
}

/** Aplica lo que mandó el panel. Devuelve true si cambió algo. */
export async function applyRemote(settings: RemoteVideoSettings | null | undefined, rev: number) {
  if (!rev || rev <= getAppliedRev() || !settings) return false;
  const video = pick(settings.video ?? {}, REMOTE_VIDEO_KEYS);
  const camera = pick(settings.camera ?? {}, REMOTE_CAMERA_KEYS);
  if (Object.keys(video).length) saveVideoSettings(video);
  if (Object.keys(camera).length) saveCameraSettings(camera);
  // Si un archivo no se puede bajar, se reintenta en el próximo checkin (no se marca como aplicado)
  if (settings.assets) await applyAssets(settings.assets);
  try { localStorage.setItem(APPLIED_KEY, String(rev)); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(REMOTE_APPLIED_EVENT));
  return true;
}
