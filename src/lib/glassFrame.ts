// Marcos "Liquid Glass" generados sobre cada foto (sin PNG): el borde es la misma
// foto desenfocada y saturada, como vidrio esmerilado, con brillos en los bordes,
// gotas de luz y una píldora de vidrio con el nombre del evento.
// La hoja la arma photoLayout.ts (vertical u horizontal, una o varias fotos).

export type GlassStyle = 'clear' | 'dark' | 'aurora' | 'sunset';

export interface GlassFrameOptions {
  style: GlassStyle;
  title?: string;
  subtitle?: string;
  /** Ancho de salida; el alto es 1,5 veces. 1200 para imprimir, menos para vistas previas. */
  width?: number;
}

export const GLASS_STYLES: { value: GlassStyle; label: string }[] = [
  { value: 'clear', label: 'Vidrio claro' },
  { value: 'dark', label: 'Vidrio oscuro' },
  { value: 'aurora', label: 'Vidrio aurora' },
  { value: 'sunset', label: 'Vidrio atardecer' },
];

/** El marco se guarda como 'glass:<estilo>' en kiosk_frame_url. */
export const GLASS_PREFIX = 'glass:';
export const isGlassFrame = (frame?: string | null): frame is string => !!frame?.startsWith(GLASS_PREFIX);
export const glassStyleOf = (frame: string): GlassStyle =>
  (GLASS_STYLES.find(s => `${GLASS_PREFIX}${s.value}` === frame)?.value ?? 'clear');

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo cargar la foto para el marco'));
  img.src = src;
});

/** Dibuja la imagen cubriendo el rectángulo (como object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const TINTS: Record<GlassStyle, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  clear: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(0, 0, w, h);
  },
  dark: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(8,6,28,0.52)';
    ctx.fillRect(0, 0, w, h);
  },
  aurora: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,46,147,0.45)');
    g.addColorStop(0.5, 'rgba(123,47,247,0.40)');
    g.addColorStop(1, 'rgba(0,212,255,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, h);
  },
  sunset: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,210,63,0.40)');
    g.addColorStop(0.55, 'rgba(255,111,60,0.38)');
    g.addColorStop(1, 'rgba(255,46,147,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
};

/** Gota de "vidrio líquido": esfera translúcida con reflejo. */
function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  body.addColorStop(0, 'rgba(255,255,255,0.55)');
  body.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  body.addColorStop(1, 'rgba(255,255,255,0.28)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
}

/** Ajusta el tamaño de letra para que el texto entre en el ancho dado. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, maxSize: number, maxWidth: number, family: string) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 12);
  return size;
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Nombre del invitado como firma, abajo a la derecha dentro de la foto,
 * con letra manuscrita y sombra para que se lea sobre cualquier imagen.
 */
export function drawSignature(ctx: CanvasRenderingContext2D, name: string, area: Rect) {
  const size = Math.max(28, Math.min(area.w * 0.13, area.h * 0.16, 130));
  const pad = size * 0.45;
  ctx.save();
  ctx.translate(area.x + area.w - pad, area.y + area.h - pad);
  ctx.rotate(-0.07);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(size)}px 'Dancing Script', 'Segoe Script', 'Brush Script MT', 'Apple Chancery', cursive`;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = size * 0.18;
  ctx.shadowOffsetY = size * 0.04;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 0, 0, area.w - pad * 2);
  ctx.restore();
}

export const loadPhoto = loadImage;
export { drawCover };

export interface GlassPage {
  width: number;
  height: number;
  /** Lugar de cada foto (misma cantidad que imgs) */
  slots: Rect[];
  /** Píldoras con el nombre del evento (una, o dos en las tiras dobles) */
  captions: Rect[];
  /** 'cover' recorta para llenar el lugar; 'contain' muestra la foto entera */
  fit: 'cover' | 'contain';
  /** Imagen de fondo propia (en lugar de la foto desenfocada) */
  background?: HTMLImageElement | null;
  /** Nombre del invitado: va como firma en los lugares indicados */
  signature?: { name: string; slots: number[] };
}

/**
 * Dibuja una hoja con marco de vidrio: fondo con la primera foto desenfocada,
 * cada foto nítida con esquinas redondeadas y las píldoras con el nombre.
 */
export async function drawGlassPage(imgs: HTMLImageElement[], page: GlassPage, options: GlassFrameOptions): Promise<HTMLCanvasElement> {
  const { width: W, height: H } = page;
  const k = Math.min(W, H) / 1200; // las medidas están pensadas para 1200 px del lado corto

  const titleFamily = "'CarlMarx', 'Fredoka', system-ui, sans-serif";
  const textFamily = "system-ui, 'Segoe UI', Roboto, sans-serif";
  if (options.title && document.fonts?.load) {
    try { await document.fonts.load(`700 ${Math.round(70 * k)}px CarlMarx`); } catch { /* sigue con la de respaldo */ }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. Fondo: la imagen propia, o la foto desenfocada y saturada (algo agrandada para que el blur no deje bordes)
  if (page.background) {
    drawCover(ctx, page.background, 0, 0, W, H);
  } else {
    ctx.save();
    ctx.filter = `blur(${Math.round(42 * k)}px) saturate(185%) brightness(1.06)`;
    const bleed = 80 * k;
    drawCover(ctx, imgs[0], -bleed, -bleed, W + bleed * 2, H + bleed * 2);
    ctx.restore();
    TINTS[options.style](ctx, W, H);
  }

  // 2. Reflejo diagonal sobre todo el vidrio
  const sheen = ctx.createLinearGradient(0, 0, W, H * 0.6);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  if (!page.background) ctx.fillRect(0, 0, W, H); // con fondo propio se respeta el diseño

  // 3. Fotos nítidas con esquinas redondeadas, "flotando" sobre el vidrio
  imgs.forEach((img, i) => {
    const slot = page.slots[i];
    if (!slot) return;
    let { x: px, y: py, w: pw, h: ph } = slot;
    if (page.fit === 'contain') {
      // La foto entera: el lugar se achica a la proporción de la foto
      const scale = Math.min(pw / img.width, ph / img.height);
      const fw = img.width * scale;
      const fh = img.height * scale;
      px += (pw - fw) / 2;
      py += (ph - fh) / 2;
      pw = fw;
      ph = fh;
    }
    const radius = Math.min(58 * k, Math.min(pw, ph) * 0.07);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = 48 * k;
    ctx.shadowOffsetY = 18 * k;
    roundRect(ctx, px, py, pw, ph, radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, px, py, pw, ph, radius);
    ctx.clip();
    drawCover(ctx, img, px, py, pw, ph);
    ctx.restore();

    // Borde de luz de la foto (más fuerte arriba a la izquierda, como luz cenital)
    const edge = ctx.createLinearGradient(px, py, px + pw, py + ph);
    edge.addColorStop(0, 'rgba(255,255,255,0.95)');
    edge.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    edge.addColorStop(1, 'rgba(255,255,255,0.6)');
    roundRect(ctx, px, py, pw, ph, radius);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 4 * k;
    ctx.stroke();

    if (page.signature?.slots.includes(i)) drawSignature(ctx, page.signature.name, { x: px, y: py, w: pw, h: ph });
  });

  if (!page.background) {
    // 4. Borde exterior del vidrio
    roundRect(ctx, 6 * k, 6 * k, W - 12 * k, H - 12 * k, 70 * k);
    const outer = ctx.createLinearGradient(0, 0, 0, H);
    outer.addColorStop(0, 'rgba(255,255,255,0.75)');
    outer.addColorStop(1, 'rgba(255,255,255,0.18)');
    ctx.strokeStyle = outer;
    ctx.lineWidth = 3 * k;
    ctx.stroke();

    // 5. Gotas de vidrio líquido, sobre el borde de la hoja
    const edgeX = 32 * k;
    drawDrop(ctx, W - edgeX, H * 0.18, 17 * k);
    drawDrop(ctx, W - edgeX, H * 0.18 + 44 * k, 8 * k);
    drawDrop(ctx, edgeX, H * 0.6, 12 * k);
  }

  // 6. Píldoras de vidrio con el nombre del evento
  if (options.title || options.subtitle) {
    for (const cap of page.captions) {
      const pillH = Math.min(cap.h, 200 * k);
      const pillW = cap.w;
      const pillX = cap.x;
      const pillY = cap.y + (cap.h - pillH) / 2;
      const kk = pillH / (200 * k) * k; // texto proporcional a la píldora

      ctx.save();
      roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fillStyle = options.style === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.20)';
      ctx.fill();
      const pillEdge = ctx.createLinearGradient(0, pillY, 0, pillY + pillH);
      pillEdge.addColorStop(0, 'rgba(255,255,255,0.85)');
      pillEdge.addColorStop(1, 'rgba(255,255,255,0.2)');
      ctx.strokeStyle = pillEdge;
      ctx.lineWidth = 3 * k;
      ctx.stroke();
      roundRect(ctx, pillX + 10 * k, pillY + 8 * k, pillW - 20 * k, pillH * 0.42, pillH * 0.3);
      const pillShine = ctx.createLinearGradient(0, pillY, 0, pillY + pillH * 0.5);
      pillShine.addColorStop(0, 'rgba(255,255,255,0.35)');
      pillShine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = pillShine;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 12 * k;
      const cx = pillX + pillW / 2;
      const maxTextW = pillW - 120 * kk;
      if (options.title && options.subtitle) {
        fitFont(ctx, options.title, '700', 76 * kk, maxTextW, titleFamily);
        ctx.fillText(options.title, cx, pillY + pillH * 0.4);
        fitFont(ctx, options.subtitle, '600', 36 * kk, maxTextW, textFamily);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(options.subtitle, cx, pillY + pillH * 0.75);
      } else {
        const text = (options.title || options.subtitle)!;
        fitFont(ctx, text, '700', 84 * kk, maxTextW, titleFamily);
        ctx.fillText(text, cx, pillY + pillH / 2 + 4 * kk);
      }
      ctx.restore();
    }
  }

  return canvas;
}

/** Marco de vidrio para una foto, en hoja vertical 10×15 (vistas previas de Ajustes). */
export async function renderGlassFrame(photoSrc: string, options: GlassFrameOptions): Promise<string> {
  const W = options.width ?? 1200;
  const H = Math.round(W * 1.5);
  const k = W / 1200;
  const img = await loadImage(photoSrc);
  const margin = 64 * k;
  const captionH = options.title || options.subtitle ? 300 * k : margin;
  const canvas = await drawGlassPage([img], {
    width: W,
    height: H,
    slots: [{ x: margin, y: margin, w: W - margin * 2, h: H - margin - captionH }],
    captions: [{ x: margin, y: H - captionH, w: W - margin * 2, h: captionH }],
    fit: 'cover',
  }, options);
  return canvas.toDataURL('image/jpeg', 0.93);
}
