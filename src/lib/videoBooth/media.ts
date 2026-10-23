import { getMedia } from './mediaStore';
import { Decor, disposeAnimVideo, loadAnimVideo, type Caption } from './decor';
import { decodeMusic } from './recorder';
import { ANIM_KEY, END_KEY, frameKey, LOGO_KEY, overlayDateText, songKey, type AnimationKey, type SongItem, type VideoBoothSettings } from './settings';

import { allFrames, BUILT_IN_VIDEO_FRAMES, builtinFrameThumb, isBuiltinFrame, renderBuiltinFrame } from './builtinFrames';

// Archivos de la cabina guardados en el equipo: marcos, logo, animación y música.

const bitmap = async (key: string) => {
  const rec = await getMedia(key).catch(() => null);
  if (!rec) return null;
  try { return await createImageBitmap(rec.blob); } catch { return null; }
};

/** Imagen de un marco para mostrarlo (los de fábrica, del tamaño del video). */
export const frameUrl = async (id: string, size = { width: 1080, height: 1920 }) => {
  if (isBuiltinFrame(id)) return builtinFrameThumb(id, size.width, size.height);
  const rec = await getMedia(frameKey(id)).catch(() => null);
  return rec ? URL.createObjectURL(rec.blob) : null;
};

/** Marcos para que elija el invitado o para "uno al azar". */
export function framePool(s: VideoBoothSettings) {
  const all = allFrames(s);
  const picked = (s.guestFrames ?? []).filter(id => all.some(f => f.id === id));
  if (picked.length) return all.filter(f => picked.includes(f.id));
  return (s.frames?.length ? s.frames : BUILT_IN_VIDEO_FRAMES.map(f => ({ id: f.id, name: f.name })));
}

/** Canción que corresponde: la elegida por el invitado, una al azar o la fija (de la experiencia o de General). */
export function pickSong(s: VideoBoothSettings, chosen?: string | null, mode?: { songMode: 'fixed' | 'random' | 'guest'; songId?: string }): SongItem | null {
  const songs = s.songs ?? [];
  if (!songs.length) return null;
  if (chosen) return songs.find(x => x.id === chosen) ?? null;
  const songMode = mode?.songMode ?? s.songMode;
  const songId = mode ? mode.songId : s.songId;
  if (songMode === 'random') return songs[Math.floor(Math.random() * songs.length)];
  return songs.find(x => x.id === songId) ?? songs[0];
}

export async function loadSong(song: SongItem | null) {
  if (!song) return null;
  const rec = await getMedia(songKey(song.id)).catch(() => null);
  if (!rec) return null;
  return decodeMusic(rec.blob).catch(() => null);
}

export interface DecorBundle { decor: Decor; dispose: () => void }

/** Arma las capas del video según Ajustes (marco elegido por el invitado si lo hay). */
export async function buildDecor(s: VideoBoothSettings, size: { width: number; height: number }, opts: {
  frameId?: string | null; eventTitle?: string;
  /** Marco y animación de la experiencia (si no, los de General) */
  overlay?: 'none' | 'title' | 'custom'; animation?: AnimationKey;
}): Promise<DecorBundle> {
  const overlay = opts.overlay ?? s.overlay;
  const animation = opts.animation ?? s.animation;
  let frame: ImageBitmap | HTMLCanvasElement | null = null;
  if (overlay === 'custom') {
    const frames = allFrames(s);
    let id = opts.frameId || s.frameId || frames[0]?.id;
    if (id === 'random') {
      const pool = framePool(s);
      id = pool[Math.floor(Math.random() * pool.length)]?.id;
    }
    // Si el marco elegido ya no está, el primero
    if (id && !frames.some(f => f.id === id)) id = frames[0]?.id;
    if (id) frame = isBuiltinFrame(id) ? await renderBuiltinFrame(id, size.width, size.height) : await bitmap(frameKey(id));
  }
  // Nombre y fecha: el marco "nombre del evento", o encima del PNG si se pidió
  const title = (s.overlayText || opts.eventTitle || '').trim();
  const caption: Caption | null = overlay === 'title' || (overlay === 'custom' && s.frameText)
    ? { title: title || (overlay === 'title' ? 'EventPix' : ''), date: overlayDateText(s), position: s.textPosition, color: s.textColor, scale: s.textScale, band: overlay === 'title' }
    : null;
  const logo = s.showLogo !== false ? await bitmap(LOGO_KEY) : null;
  const endImage = s.endCard ? await bitmap(END_KEY) : null;
  let animVideo: HTMLVideoElement | null = null;
  if (animation === 'custom') {
    const rec = await getMedia(ANIM_KEY).catch(() => null);
    if (rec) animVideo = await loadAnimVideo(rec.blob);
  }
  const decor = new Decor({
    width: size.width, height: size.height, frame,
    animation, animVideo, animBlend: s.animBlend, caption,
    logo, logoPosition: s.logoPosition, logoSize: s.logoSize, logoOpacity: s.logoOpacity,
    watermark: s.watermark?.trim() || undefined, watermarkPosition: s.watermarkPosition,
    watermarkSize: s.watermarkSize, watermarkOpacity: s.watermarkOpacity,
    brandColor: s.brandColor, title: opts.eventTitle || s.overlayText || '', endText: s.endCardText?.trim() || undefined,
    endImage, endOverlay: s.endCardOverlay !== false,
  });
  return {
    decor,
    dispose: () => {
      disposeAnimVideo(animVideo);
      if (frame && 'close' in frame) frame.close();
      endImage?.close();
      logo?.close();
    },
  };
}
