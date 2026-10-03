import { drawCover, drawGlassPage, glassStyleOf, isGlassFrame, loadPhoto, type Rect } from '@/lib/glassFrame';

// Arma la hoja final del kiosco (10×15 a 300 dpi aprox.: 1200×1800 o 1800×1200)
// con una o varias fotos:
// - Orientación automática: una foto apaisada va en hoja horizontal y se ve entera;
//   con la cámara girada (foto vertical) la hoja es vertical.
// - 2 a 4 fotos en cuadrícula, o "tira doble" (dos tiras iguales para cortar al medio).
// - Marco de vidrio: se adapta a cualquier hoja. Marco PNG: la hoja toma la
//   orientación del PNG y las fotos van debajo de él.

export type PageOrientation = 'auto' | 'portrait' | 'landscape';

export interface LayoutOptions {
  /** null = sin marco; 'glass:<estilo>' o URL de un PNG */
  frame: string | null;
  orientation?: PageOrientation;
  /** Tira doble: dos columnas iguales con las fotos una debajo de la otra */
  strips?: boolean;
  title?: string;
  subtitle?: string;
}

const LONG = 1800;
const SHORT = 1200;

const isLandscape = (img: { width: number; height: number }) => img.width >= img.height;

/** Orientación de la hoja según las fotos (cuando está en automático). */
function autoOrientation(imgs: HTMLImageElement[]): 'portrait' | 'landscape' {
  const wide = isLandscape(imgs[0]);
  if (imgs.length === 2 || imgs.length === 3) return wide ? 'portrait' : 'landscape'; // apiladas o lado a lado
  return wide ? 'landscape' : 'portrait';
}

/** Celdas de una cuadrícula para n fotos dentro de un área. */
function grid(area: Rect, n: number, orientation: 'portrait' | 'landscape', gap: number): Rect[] {
  let cols = 1;
  let rows = 1;
  if (n === 2 || n === 3) {
    if (orientation === 'portrait') rows = n; else cols = n;
  } else if (n >= 4) {
    cols = 2;
    rows = Math.ceil(n / 2);
  }
  const w = (area.w - gap * (cols - 1)) / cols;
  const h = (area.h - gap * (rows - 1)) / rows;
  const cells: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    cells.push({ x: area.x + c * (w + gap), y: area.y + r * (h + gap), w, h });
  }
  return cells;
}

interface PagePlan {
  width: number;
  height: number;
  slots: Rect[];
  /** índice de la foto que va en cada lugar (en la tira doble se repiten) */
  photoIndex: number[];
  captions: Rect[];
}

function planPage(n: number, orientation: 'portrait' | 'landscape', strips: boolean, caption: boolean, k = 1): PagePlan {
  const W = orientation === 'portrait' ? SHORT : LONG;
  const H = orientation === 'portrait' ? LONG : SHORT;
  const margin = 64 * k;
  const gap = 36 * k;

  if (strips) {
    // Dos tiras de 600×1800 con las fotos apiladas y el nombre abajo
    const colW = W / 2;
    const capH = caption ? 170 * k : 0;
    const slots: Rect[] = [];
    const photoIndex: number[] = [];
    const captions: Rect[] = [];
    for (let col = 0; col < 2; col++) {
      const area = { x: col * colW + margin * 0.6, y: margin * 0.8, w: colW - margin * 1.2, h: H - margin * 1.6 - capH - (caption ? gap : 0) };
      grid(area, n, 'portrait', gap * 0.7).forEach((cell, i) => { slots.push(cell); photoIndex.push(i); });
      if (caption) captions.push({ x: area.x, y: area.y + area.h + gap * 0.5, w: area.w, h: capH });
    }
    return { width: W, height: H, slots, photoIndex, captions };
  }

  const capH = caption ? (orientation === 'portrait' ? 300 : 230) * k : 0;
  const area = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 - capH + (caption ? margin : 0) };
  const slots = grid(area, n, orientation, gap);
  const captions = caption ? [{ x: margin, y: H - capH, w: W - margin * 2, h: capH - margin * 0.4 }] : [];
  return { width: W, height: H, slots, photoIndex: slots.map((_, i) => i), captions };
}

/** Une las fotos en la hoja final y devuelve un JPEG en data URL. */
export async function composePhotos(photoSrcs: string[], options: LayoutOptions): Promise<string> {
  const imgs = await Promise.all(photoSrcs.map(loadPhoto));
  if (!imgs.length) throw new Error('No hay fotos para armar');
  const n = imgs.length;
  const strips = !!options.strips && n > 1;

  // ─── Marco de vidrio ────────────────────────────────────────────
  if (isGlassFrame(options.frame)) {
    const orientation = strips ? 'portrait'
      : options.orientation && options.orientation !== 'auto' ? options.orientation : autoOrientation(imgs);
    const caption = !!(options.title || options.subtitle);
    const plan = planPage(n, orientation, strips, caption);
    const canvas = await drawGlassPage(plan.photoIndex.map(i => imgs[i]), {
      width: plan.width,
      height: plan.height,
      slots: plan.slots,
      captions: plan.captions,
      // Una sola foto se muestra entera; varias llenan su lugar
      fit: n === 1 ? 'contain' : 'cover',
    }, { style: glassStyleOf(options.frame), title: options.title, subtitle: options.subtitle });
    return canvas.toDataURL('image/jpeg', 0.93);
  }

  // ─── PNG o sin marco ────────────────────────────────────────────
  const frameImg = options.frame ? await loadPhoto(options.frame).catch(() => null) : null;
  let orientation: 'portrait' | 'landscape';
  if (strips) orientation = 'portrait';
  else if (frameImg) orientation = isLandscape(frameImg) ? 'landscape' : 'portrait';
  else if (options.orientation && options.orientation !== 'auto') orientation = options.orientation;
  else orientation = autoOrientation(imgs);

  const W = orientation === 'portrait' ? SHORT : LONG;
  const H = orientation === 'portrait' ? LONG : SHORT;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (n === 1 && !strips) {
    // Una foto: a sangre (el PNG la recorta con su ventana)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawCover(ctx, imgs[0], 0, 0, W, H);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const plan = planPage(n, orientation, strips, false);
    plan.slots.forEach((slot, i) => drawCover(ctx, imgs[plan.photoIndex[i]], slot.x, slot.y, slot.w, slot.h));
    if (!frameImg && (options.title || options.subtitle)) {
      // Sin marco: el nombre del evento abajo, chico, sobre el blanco
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.font = "700 44px 'CarlMarx', system-ui, sans-serif";
      const text = [options.title, options.subtitle].filter(Boolean).join(' · ');
      if (strips) {
        ctx.fillText(text, W / 4, H - 20, W / 2 - 40);
        ctx.fillText(text, (W * 3) / 4, H - 20, W / 2 - 40);
      } else {
        ctx.fillText(text, W / 2, H - 18, W - 80);
      }
    }
  }
  if (frameImg) ctx.drawImage(frameImg, 0, 0, W, H);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/** Si la imagen es apaisada la gira 90° para imprimirla en el papel vertical (10×15). */
export async function toPortraitForPrint(src: string): Promise<string> {
  const img = await loadPhoto(src);
  if (img.height >= img.width) return src;
  const canvas = document.createElement('canvas');
  canvas.width = img.height;
  canvas.height = img.width;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}
