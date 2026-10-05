import { drawCover, loadPhoto } from '@/lib/glassFrame';

// Portada Fashion: la foto del invitado como tapa de revista (10×15 vertical,
// 1200×1800). El fondo es la foto; todos los textos se editan en Ajustes.
// Por ahora sin IA: cuando haya un proveedor de IA, la foto se puede "producir"
// antes (ropa de gala, estudio) y se arma la misma tapa encima.

export type CoverColor = 'white' | 'black' | 'red' | 'gold' | 'pink';

export const COVER_COLORS: { value: CoverColor; label: string; hex: string }[] = [
  { value: 'white', label: 'Blanco', hex: '#ffffff' },
  { value: 'black', label: 'Negro', hex: '#111111' },
  { value: 'red', label: 'Rojo', hex: '#e0182d' },
  { value: 'gold', label: 'Dorado', hex: '#e6b84a' },
  { value: 'pink', label: 'Rosa', hex: '#ff2e93' },
];

export interface CoverOptions {
  /** Nombre de la revista (arriba, grande) */
  title: string;
  /** Línea chica debajo del nombre (edición, fecha) */
  issue?: string;
  /** Titulares (uno por línea) */
  headlines?: string[];
  /** Nombre de la estrella de tapa (el invitado) */
  starName?: string;
  /** Texto chico sobre el nombre de la estrella */
  starLabel?: string;
  /** Sello redondo (ej. "¡EXCLUSIVO!") */
  badge?: string;
  color?: CoverColor;
  width?: number;
}

const SERIF = "'Playfair Display', 'Didot', 'Bodoni 72', Georgia, serif";
const SANS = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";

const hexOf = (c?: CoverColor) => COVER_COLORS.find(x => x.value === c)?.hex ?? '#ffffff';
/** Texto sobre la foto: con color oscuro se usa sombra clara y al revés */
const shadowFor = (hex: string) => (hex === '#111111' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)');

function fit(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, maxSize: number, maxWidth: number, minSize = 14) {
  let size = maxSize;
  for (;;) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) return size;
    size -= 2;
  }
}

/** Código de barras de adorno (siempre igual para el mismo texto). */
function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: string, k: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  ctx.fillStyle = '#000';
  let cx = x + 10 * k;
  const barsH = h - 34 * k;
  while (cx < x + w - 12 * k) {
    n = (n * 1103515245 + 12345) >>> 0;
    const bw = (1 + (n % 3)) * 2 * k;
    ctx.fillRect(cx, y + 8 * k, bw, barsH);
    cx += bw + (1 + ((n >> 4) % 3)) * 2 * k;
  }
  ctx.font = `600 ${Math.round(16 * k)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('7 791234 567893', x + w / 2, y + h - 6 * k);
}

export async function renderMagazineCover(photoSrc: string, o: CoverOptions): Promise<string> {
  const W = o.width ?? 1200;
  const H = Math.round(W * 1.5);
  const k = W / 1200;
  const img = await loadPhoto(photoSrc);
  try {
    await Promise.all([
      document.fonts?.load(`400 200px ${SERIF}`),
      document.fonts?.load(`italic 400 80px ${SERIF}`),
      document.fonts?.load(`700 40px ${SANS}`),
    ]);
  } catch { /* sigue con las de respaldo */ }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const color = hexOf(o.color);
  const shadow = shadowFor(color);

  // 1. La foto a sangre (el fondo de la tapa)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  drawCover(ctx, img, 0, 0, W, H);

  // 2. Degradés suaves arriba y abajo para que se lean los textos
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.32);
  top.addColorStop(0, color === '#111111' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.32);
  const bottom = ctx.createLinearGradient(0, H * 0.62, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

  const margin = 60 * k;

  // 3. Nombre de la revista, grande y ocupando todo el ancho
  const title = (o.title || 'GLAM').toUpperCase();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 18 * k;
  const titleSize = fit(ctx, title, s => `400 ${s}px ${SERIF}`, 300 * k, W - margin * 2, 60 * k);
  const titleY = 40 * k + titleSize * 0.82;
  ctx.fillText(title, W / 2, titleY);
  ctx.restore();

  // 4. Línea de edición
  let y = titleY + 46 * k;
  if (o.issue) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 8 * k;
    ctx.textAlign = 'center';
    fit(ctx, o.issue.toUpperCase(), s => `600 ${s}px ${SANS}`, 26 * k, W - margin * 2);
    ctx.letterSpacing = `${6 * k}px`;
    ctx.fillText(o.issue.toUpperCase(), W / 2, y);
    ctx.restore();
    y += 30 * k;
  }

  // 5. Titulares a la izquierda: la primera palabra en color
  const lines = (o.headlines ?? []).map(l => l.trim()).filter(Boolean).slice(0, 4);
  let hy = H * 0.36;
  for (const line of lines) {
    const [first, ...rest] = line.split(' ');
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10 * k;
    const maxW = W * 0.46;
    // Palabra destacada
    ctx.font = `800 ${Math.round(60 * k)}px ${SANS}`;
    const firstUpper = first.toUpperCase();
    const size1 = fit(ctx, firstUpper, s => `800 ${s}px ${SANS}`, 60 * k, maxW);
    ctx.fillStyle = color === '#111111' || color === '#ffffff' ? '#ffd23f' : color;
    ctx.fillText(firstUpper, margin, hy);
    hy += size1 * 0.95;
    if (rest.length) {
      ctx.fillStyle = '#ffffff';
      const restText = rest.join(' ');
      // Partir en dos renglones si es largo
      const words = restText.split(' ');
      let current = '';
      const out: string[] = [];
      ctx.font = `600 ${Math.round(38 * k)}px ${SANS}`;
      for (const w of words) {
        const test = current ? `${current} ${w}` : w;
        if (ctx.measureText(test).width > maxW && current) { out.push(current); current = w; } else current = test;
      }
      if (current) out.push(current);
      for (const t of out.slice(0, 2)) {
        ctx.fillText(t, margin, hy);
        hy += 44 * k;
      }
    }
    ctx.restore();
    hy += 34 * k;
  }

  // 6. Sello redondo arriba a la derecha (debajo del título)
  if (o.badge) {
    const r = 92 * k;
    const bx = W - margin - r + 10 * k;
    const by = y + r + 20 * k;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(0.22);
    ctx.fillStyle = color === '#111111' || color === '#ffffff' ? '#e0182d' : color;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16 * k;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = o.badge.toUpperCase().split(' ').slice(0, 3);
    const size = Math.min(40 * k, (r * 1.6) / Math.max(...words.map(w => w.length)) * 1.6);
    ctx.font = `800 ${Math.round(size)}px ${SANS}`;
    words.forEach((w, i) => ctx.fillText(w, 0, (i - (words.length - 1) / 2) * size * 1.05, r * 1.7));
    ctx.restore();
  }

  // 7. Estrella de tapa: etiqueta + nombre del invitado, abajo
  const star = (o.starName || '').trim();
  const barcodeW = 210 * k;
  const barcodeH = 120 * k;
  if (star || o.starLabel) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 14 * k;
    const maxW = W - margin * 2 - barcodeW - 30 * k;
    let sy = H - margin - 10 * k;
    if (star) {
      ctx.fillStyle = '#ffffff';
      const size = fit(ctx, star, s => `italic 400 ${s}px ${SERIF}`, 130 * k, maxW, 40 * k);
      ctx.fillText(star, margin, sy);
      sy -= size * 0.95;
    }
    if (o.starLabel) {
      ctx.fillStyle = color === '#111111' ? '#ffd23f' : color;
      fit(ctx, o.starLabel.toUpperCase(), s => `700 ${s}px ${SANS}`, 30 * k, maxW);
      ctx.letterSpacing = `${4 * k}px`;
      ctx.fillText(o.starLabel.toUpperCase(), margin, sy);
    }
    ctx.restore();
  }

  // 8. Código de barras
  drawBarcode(ctx, W - margin - barcodeW, H - margin - barcodeH, barcodeW, barcodeH, `${title}${star}`, k);

  return canvas.toDataURL('image/jpeg', 0.94);
}

// ─── Textos desde Ajustes (con valores por defecto) ─────────────────
export const DEFAULT_HEADLINES = [
  'Glamour la noche más esperada del año',
  'Looks los estilos que brillaron en la pista',
  'Exclusivo todos los secretos de la fiesta',
];

export interface CoverSettings {
  eventTitle?: string;
  portadaTitle?: string;
  portadaIssue?: string;
  portadaHeadlines?: string;
  portadaStarLabel?: string;
  portadaBadge?: string;
  portadaColor?: CoverColor;
}

export const coverOptionsFrom = (s: CoverSettings, starName?: string): CoverOptions => {
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  return {
    title: (s.portadaTitle || s.eventTitle || 'GLAM').trim(),
    issue: s.portadaIssue ?? `Edición especial · ${today}`,
    headlines: s.portadaHeadlines !== undefined ? s.portadaHeadlines.split('\n') : DEFAULT_HEADLINES,
    starLabel: s.portadaStarLabel ?? 'La estrella de la noche',
    badge: s.portadaBadge ?? 'Edición exclusiva',
    color: s.portadaColor || 'white',
    starName,
  };
};
