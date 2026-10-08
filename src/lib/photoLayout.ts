import { drawCover, drawGlassPage, drawSignature, glassStyleOf, isGlassFrame, loadPhoto, loadSignatureFont, type Rect } from '@/lib/glassFrame';

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
  /** Nombre que escribió el invitado: va en la píldora o, con un PNG, en una etiqueta abajo */
  guestName?: string;
  /** Imagen de fondo de la hoja (detrás de las fotos) */
  background?: string | null;
  /** Varias fotos: 'full' = cada una entera con su forma (sin recortar); 'fill' = llenan su lugar (recorta) */
  photoFit?: 'full' | 'fill';
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

/**
 * Celdas de una cuadrícula para n fotos dentro de un área. Con `aspect` (ancho/alto de
 * la foto) las celdas toman la forma de la foto, así se ve entera sin recortar, y el
 * bloque queda centrado (o arriba, con align 'start').
 */
function grid(area: Rect, n: number, orientation: 'portrait' | 'landscape' | 'column', gap: number, aspect?: number, align: 'center' | 'start' = 'center'): Rect[] {
  let cols = 1;
  let rows = 1;
  // Tira: siempre una debajo de la otra
  if (orientation === 'column') rows = n;
  else if (n === 2 || n === 3) {
    if (orientation === 'portrait') rows = n; else cols = n;
  } else if (n >= 4) {
    cols = 2;
    rows = Math.ceil(n / 2);
  }
  let w = (area.w - gap * (cols - 1)) / cols;
  let h = (area.h - gap * (rows - 1)) / rows;
  let x0 = area.x;
  let y0 = area.y;
  if (aspect) {
    if (w / h > aspect) w = h * aspect; else h = w / aspect;
    x0 += (area.w - (cols * w + gap * (cols - 1))) / 2;
    if (align === 'center') y0 += (area.h - (rows * h + gap * (rows - 1))) / 2;
  }
  const cells: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    cells.push({ x: x0 + c * (w + gap), y: y0 + r * (h + gap), w, h });
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

function planPage(n: number, orientation: 'portrait' | 'landscape', strips: boolean, caption: boolean, k = 1, aspect?: number): PagePlan {
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
      const cells = grid(area, n, aspect ? 'column' : 'portrait', gap * 0.7, aspect, 'start');
      // Fotos enteras: las fotos y el nombre van juntos, centrados en la tira
      const photosH = Math.max(...cells.map(c => c.y + c.h)) - area.y;
      const groupH = photosH + (caption ? gap * 0.5 + capH : 0);
      const shift = aspect ? (H - margin * 1.6 - groupH) / 2 : 0;
      cells.forEach((cell, i) => { slots.push({ ...cell, y: cell.y + shift }); photoIndex.push(i); });
      if (caption) captions.push({ x: area.x, y: aspect ? area.y + shift + photosH + gap * 0.5 : area.y + area.h + gap * 0.5, w: area.w, h: capH });
    }
    return { width: W, height: H, slots, photoIndex, captions };
  }

  const capH = caption ? (orientation === 'portrait' ? 300 : 230) * k : 0;
  const area = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 - capH + (caption ? margin : 0) };
  const slots = grid(area, n, orientation, gap, aspect);
  const captions = caption ? [{ x: margin, y: H - capH, w: W - margin * 2, h: capH - margin * 0.4 }] : [];
  return { width: W, height: H, slots, photoIndex: slots.map((_, i) => i), captions };
}

/** Une las fotos en la hoja final y devuelve un JPEG en data URL. */
/** Lugares donde va la firma: la última foto (de cada tira, en la tira doble). */
const signatureSlots = (photoIndex: number[], n: number) =>
  photoIndex.map((p, i) => (p === n - 1 ? i : -1)).filter(i => i >= 0);

export async function composePhotos(photoSrcs: string[], options: LayoutOptions): Promise<string> {
  const imgs = await Promise.all(photoSrcs.map(loadPhoto));
  if (!imgs.length) throw new Error('No hay fotos para armar');
  const n = imgs.length;
  const strips = !!options.strips && n > 1;
  // Fotos enteras: las celdas toman la forma de la cámara (no con un marco PNG, que tiene sus ventanas)
  const aspect = n > 1 && options.photoFit !== 'fill' ? imgs[0].width / imgs[0].height : undefined;
  const bgImg = options.background ? await loadPhoto(options.background).catch(() => null) : null;
  const subtitle = options.subtitle;
  // El nombre del invitado va como firma sobre la foto, igual con cualquier marco
  const guest = options.guestName?.trim();
  if (guest) await loadSignatureFont();

  // ─── Marco de vidrio ────────────────────────────────────────────
  if (isGlassFrame(options.frame)) {
    const orientation = strips ? 'portrait'
      : options.orientation && options.orientation !== 'auto' ? options.orientation : autoOrientation(imgs);
    const caption = !!(options.title || subtitle);
    const plan = planPage(n, orientation, strips, caption, 1, aspect);
    const canvas = await drawGlassPage(plan.photoIndex.map(i => imgs[i]), {
      width: plan.width,
      height: plan.height,
      slots: plan.slots,
      captions: plan.captions,
      // Una sola foto se muestra entera; varias llenan su lugar
      fit: n === 1 ? 'contain' : 'cover',
      background: bgImg,
      signature: guest ? { name: guest, slots: signatureSlots(plan.photoIndex, n) } : undefined,
    }, { style: glassStyleOf(options.frame), title: options.title, subtitle });
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

  if (bgImg) {
    // Fondo propio: las fotos van sobre la imagen; el PNG (si hay) encima de todo
    const caption = !frameImg && !!(options.title || subtitle);
    const plan = planPage(n, orientation, strips, caption, 1, frameImg ? undefined : aspect);
    const page = await drawGlassPage(plan.photoIndex.map(i => imgs[i]), {
      width: W, height: H, slots: plan.slots, captions: plan.captions,
      fit: n === 1 ? 'contain' : 'cover', background: bgImg,
      // Con PNG la firma va encima del marco (abajo); sin PNG, sobre la foto
      signature: guest && !frameImg ? { name: guest, slots: signatureSlots(plan.photoIndex, n) } : undefined,
    }, { style: 'clear', title: caption ? options.title : undefined, subtitle: caption ? subtitle : undefined });
    if (frameImg) {
      const ctx = page.getContext('2d')!;
      ctx.drawImage(frameImg, 0, 0, W, H);
      if (guest) plan.slots.forEach((slot, i) => { if (signatureSlots(plan.photoIndex, n).includes(i)) drawSignature(ctx, guest, slot); });
    }
    return page.toDataURL('image/jpeg', 0.94);
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Dónde va la firma: con una foto a sangre, dentro de la parte libre del marco
  let signArea: Rect[] = [{ x: W * 0.08, y: H * 0.08, w: W * 0.84, h: H * 0.76 }];
  if (n === 1 && !strips) {
    const photo = imgs[0];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (isLandscape(photo) === (orientation === 'landscape')) {
      // Misma orientación: a sangre (el PNG la recorta con su ventana)
      drawCover(ctx, photo, 0, 0, W, H);
    } else {
      // Orientación distinta (p. ej. foto apaisada en marco vertical): la foto entra
      // entera y el resto se rellena con la misma foto desenfocada, sin recortar a nadie
      ctx.save();
      ctx.filter = 'blur(40px) saturate(140%) brightness(0.85)';
      drawCover(ctx, photo, -60, -60, W + 120, H + 120);
      ctx.restore();
      const scale = Math.min(W / photo.width, H / photo.height);
      const pw = photo.width * scale;
      const ph = photo.height * scale;
      const px = (W - pw) / 2;
      const py = (H - ph) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 40;
      ctx.drawImage(photo, px, py, pw, ph);
      ctx.restore();
      signArea = [{ x: px, y: py, w: pw, h: ph }];
    }
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const plan = planPage(n, orientation, strips, false, 1, frameImg ? undefined : aspect);
    plan.slots.forEach((slot, i) => drawCover(ctx, imgs[plan.photoIndex[i]], slot.x, slot.y, slot.w, slot.h));
    signArea = plan.slots.filter((_, i) => signatureSlots(plan.photoIndex, n).includes(i));
    if (!frameImg && (options.title || options.subtitle)) {
      // Sin marco: el nombre del evento abajo, chico, sobre el blanco
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.font = "700 44px 'CarlMarx', system-ui, sans-serif";
      const text = [options.title, subtitle].filter(Boolean).join(' · ');
      if (strips) {
        ctx.fillText(text, W / 4, H - 20, W / 2 - 40);
        ctx.fillText(text, (W * 3) / 4, H - 20, W / 2 - 40);
      } else {
        ctx.fillText(text, W / 2, H - 18, W - 80);
      }
    }
  }
  if (frameImg) ctx.drawImage(frameImg, 0, 0, W, H);
  if (guest) signArea.forEach(area => drawSignature(ctx, guest, area));
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
