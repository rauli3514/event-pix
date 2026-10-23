import { getMedia } from './mediaStore';
import { titleOverlay } from './compositor';
import { Decor, disposeAnimVideo, loadAnimVideo } from './decor';
import { decodeMusic } from './recorder';
import { ANIM_KEY, frameKey, LOGO_KEY, songKey, type SongItem, type VideoBoothSettings } from './settings';

// Archivos de la cabina guardados en el equipo: marcos, logo, animación y música.

const bitmap = async (key: string) => {
  const rec = await getMedia(key).catch(() => null);
  if (!rec) return null;
  try { return await createImageBitmap(rec.blob); } catch { return null; }
};

export const frameUrl = async (id: string) => {
  const rec = await getMedia(frameKey(id)).catch(() => null);
  return rec ? URL.createObjectURL(rec.blob) : null;
};

/** Canción que corresponde: la elegida por el invitado, una al azar o la fija. */
export function pickSong(s: VideoBoothSettings, chosen?: string | null): SongItem | null {
  const songs = s.songs ?? [];
  if (!songs.length) return null;
  if (chosen) return songs.find(x => x.id === chosen) ?? null;
  if (s.songMode === 'random') return songs[Math.floor(Math.random() * songs.length)];
  return songs.find(x => x.id === s.songId) ?? songs[0];
}

export async function loadSong(song: SongItem | null) {
  if (!song) return null;
  const rec = await getMedia(songKey(song.id)).catch(() => null);
  if (!rec) return null;
  return decodeMusic(rec.blob).catch(() => null);
}

export interface DecorBundle { decor: Decor; dispose: () => void }

/** Arma las capas del video según Ajustes (marco elegido por el invitado si lo hay). */
export async function buildDecor(s: VideoBoothSettings, size: { width: number; height: number }, opts: { frameId?: string | null; eventTitle?: string }): Promise<DecorBundle> {
  const title = s.overlayText || opts.eventTitle || 'EventPix';
  let frame: CanvasImageSource | null = null;
  if (s.overlay === 'title') frame = titleOverlay(size.width, size.height, title);
  else if (s.overlay === 'custom') {
    const id = opts.frameId || s.frameId || s.frames?.[0]?.id;
    if (id) frame = await bitmap(frameKey(id));
  }
  const logo = s.showLogo !== false ? await bitmap(LOGO_KEY) : null;
  let animVideo: HTMLVideoElement | null = null;
  if (s.animation === 'custom') {
    const rec = await getMedia(ANIM_KEY).catch(() => null);
    if (rec) animVideo = await loadAnimVideo(rec.blob);
  }
  const decor = new Decor({
    width: size.width, height: size.height, frame,
    animation: s.animation, animVideo, animBlend: s.animBlend,
    logo, logoPosition: s.logoPosition, logoSize: s.logoSize, logoOpacity: s.logoOpacity,
    watermark: s.watermark?.trim() || undefined, watermarkPosition: s.watermarkPosition,
    brandColor: s.brandColor, title: opts.eventTitle || s.overlayText || '', endText: s.endCardText?.trim() || undefined,
  });
  return {
    decor,
    dispose: () => {
      disposeAnimVideo(animVideo);
      if (frame && 'close' in frame) (frame as ImageBitmap).close();
      logo?.close();
    },
  };
}
