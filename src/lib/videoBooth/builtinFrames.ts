import logoUrl from '@/assets/brand/eventpix-logo.webp';
import cumpleUrl from '@/assets/video-frames/cumple.webp';
import floresUrl from '@/assets/video-frames/flores.webp';
import navidadUrl from '@/assets/video-frames/navidad.webp';
import monstruosUrl from '@/assets/video-frames/monstruos.webp';
import type { MediaItem, VideoBoothSettings } from './settings';

// Marcos de fábrica de la cabina: cuatro del espejo (PNG verticales) y tres de
// EventPix dibujados con código, que se adaptan a vertical, horizontal y cuadrado.
// Sus IDs empiezan con "b-" (los cargados en el equipo o el panel no).

type Draw = (ctx: CanvasRenderingContext2D, W: number, H: number, logo: HTMLImageElement | null) => void;
interface BuiltinFrame { id: string; name: string; src?: string; draw?: Draw }

const GRAD = ['#ff2e93', '#7b2ff7', '#00d4ff'];

const loadImage = (src: string) => new Promise<HTMLImageElement | null>(resolve => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});
let logoPromise: Promise<HTMLImageElement | null> | null = null;
const getLogo = () => (logoPromise ??= loadImage(logoUrl));

/** "EventPix" con "Pix" en degradé, centrado en (x, y). */
function wordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, light = true) {
  ctx.save();
  ctx.font = `800 ${size}px 'Poppins', 'Montserrat', sans-serif`;
  ctx.textBaseline = 'middle';
  const a = ctx.measureText('Event').width;
  const b = ctx.measureText('Pix').width;
  const left = x - (a + b) / 2;
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = size * 0.25;
  ctx.fillStyle = light ? '#ffffff' : '#1d1530';
  ctx.fillText('Event', left, y);
  const g = ctx.createLinearGradient(left + a, 0, left + a + b, 0);
  g.addColorStop(0, GRAD[0]);
  g.addColorStop(1, GRAD[2]);
  ctx.fillStyle = g;
  ctx.fillText('Pix', left + a, y);
  ctx.restore();
}

/** Logo + "EventPix" en una píldora, centrado en (x, y). */
function brandPill(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, logo: HTMLImageElement | null) {
  ctx.save();
  ctx.font = `800 ${h * 0.5}px 'Poppins', 'Montserrat', sans-serif`;
  const textW = ctx.measureText('EventPix').width;
  const w = h * 0.9 + textW + h * 0.9;
  ctx.fillStyle = 'rgba(10,6,30,0.55)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  if (logo) ctx.drawImage(logo, x - w / 2 + h * 0.15, y - h * 0.35, h * 0.7, h * 0.7);
  ctx.restore();
  wordmark(ctx, x + h * 0.35, y, h * 0.5);
}

const neon: Draw = (ctx, W, H, logo) => {
  const u = Math.min(W, H);
  const inset = u * 0.035;
  const g = ctx.createLinearGradient(0, 0, W, H);
  GRAD.forEach((c, i) => g.addColorStop(i / (GRAD.length - 1), c));
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = u * 0.018;
  ctx.shadowColor = '#c03bff';
  ctx.shadowBlur = u * 0.04;
  ctx.beginPath();
  ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, u * 0.06);
  ctx.stroke();
  ctx.restore();
  brandPill(ctx, W / 2, H - inset - u * 0.085, u * 0.1, logo);
};

const clasico: Draw = (ctx, W, H, logo) => {
  const u = Math.min(W, H);
  const band = u * 0.16;
  // Borde blanco fino y franja oscura abajo con la marca
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = u * 0.014;
  ctx.strokeRect(u * 0.03, u * 0.03, W - u * 0.06, H - u * 0.06);
  const g = ctx.createLinearGradient(0, H - band * 1.6, 0, H);
  g.addColorStop(0, 'rgba(10,6,30,0)');
  g.addColorStop(0.45, 'rgba(10,6,30,0.75)');
  g.addColorStop(1, 'rgba(10,6,30,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - band * 1.6, W, band * 1.6);
  const s = band * 0.5;
  const total = s * 1.15 + u * 0.3;
  if (logo) ctx.drawImage(logo, W / 2 - total / 2, H - band * 0.55 - s / 2, s, s);
  ctx.restore();
  wordmark(ctx, W / 2 + s * 0.6, H - band * 0.55, s * 0.62);
};

const dorado: Draw = (ctx, W, H, logo) => {
  const u = Math.min(W, H);
  const gold = ctx.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#f7e3a1');
  gold.addColorStop(0.5, '#c9a24a');
  gold.addColorStop(1, '#f2d98a');
  ctx.save();
  ctx.strokeStyle = gold;
  for (const [k, lw] of [[0.03, 0.008], [0.048, 0.003]] as const) {
    ctx.lineWidth = u * lw;
    ctx.strokeRect(u * k, u * k, W - u * k * 2, H - u * k * 2);
  }
  // Esquinas con un rombo
  ctx.fillStyle = gold;
  for (const [x, y] of [[u * 0.039, u * 0.039], [W - u * 0.039, u * 0.039], [u * 0.039, H - u * 0.039], [W - u * 0.039, H - u * 0.039]]) {
    ctx.beginPath();
    ctx.moveTo(x, y - u * 0.022); ctx.lineTo(x + u * 0.022, y); ctx.lineTo(x, y + u * 0.022); ctx.lineTo(x - u * 0.022, y);
    ctx.fill();
  }
  const s = u * 0.075;
  if (logo) ctx.drawImage(logo, W / 2 - s / 2, H - u * 0.07 - s * 1.35, s, s);
  ctx.font = `600 ${u * 0.026}px 'Montserrat', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E V E N T P I X', W / 2, H - u * 0.085);
  ctx.restore();
};

export const BUILT_IN_VIDEO_FRAMES: BuiltinFrame[] = [
  { id: 'b-eventpix-neon', name: 'EventPix neón', draw: neon },
  { id: 'b-eventpix', name: 'EventPix clásico', draw: clasico },
  { id: 'b-eventpix-dorado', name: 'EventPix dorado', draw: dorado },
  { id: 'b-cumple', name: 'Cumpleaños', src: cumpleUrl },
  { id: 'b-flores', name: 'Flores', src: floresUrl },
  { id: 'b-navidad', name: 'Navidad', src: navidadUrl },
  { id: 'b-monstruos', name: 'Monstruos', src: monstruosUrl },
];

export const isBuiltinFrame = (id?: string) => !!id && id.startsWith('b-');

/** Todos los marcos para elegir: los propios primero y después los de fábrica. */
export const allFrames = (s: VideoBoothSettings): (MediaItem & { builtin?: boolean })[] => [
  ...(s.frames ?? []),
  ...BUILT_IN_VIDEO_FRAMES.map(f => ({ id: f.id, name: f.name, builtin: true })),
];

/** Dibuja un marco de fábrica del tamaño del video. */
export async function renderBuiltinFrame(id: string, width: number, height: number): Promise<HTMLCanvasElement | null> {
  const f = BUILT_IN_VIDEO_FRAMES.find(x => x.id === id);
  if (!f) return null;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  if (f.src) {
    const img = await loadImage(f.src);
    if (!img) return null;
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    await document.fonts?.ready.catch(() => {});
    f.draw!(ctx, width, height, await getLogo());
  }
  return c;
}

/** Miniatura de un marco de fábrica (data URL o la imagen misma). */
export async function builtinFrameThumb(id: string, width: number, height: number) {
  const f = BUILT_IN_VIDEO_FRAMES.find(x => x.id === id);
  if (!f) return null;
  if (f.src) return f.src;
  const k = 360 / Math.max(width, height);
  const c = await renderBuiltinFrame(id, Math.round(width * k), Math.round(height * k));
  return c?.toDataURL('image/png') ?? null;
}
