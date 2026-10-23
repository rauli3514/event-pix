import type { ImageSegmenter } from '@mediapipe/tasks-vision';

// Aura: un contorno de neón que sigue a las personas, con rayos eléctricos
// opcionales (como los efectos "aura" de las apps de video). MediaPipe separa a
// las personas del fondo en una copia chiquita del cuadro (~10 veces por
// segundo); del borde de esa silueta sale el contorno y de ahí saltan los rayos.
// Se dibuja en el compositor, así que queda grabado en el video (y también en la
// cámara lenta, el boomerang y el 360).

export const AURA_STYLES = [
  { value: 'none', label: 'Sin aura' },
  { value: 'aura', label: 'Aura de neón' },
  { value: 'rayos', label: 'Aura con rayos' },
  { value: 'solo-rayos', label: 'Solo rayos' },
] as const;
export type AuraStyle = typeof AURA_STYLES[number]['value'];

export const AURA_COLORS = [
  { value: '#00e5ff', label: 'Celeste' },
  { value: '#ff2e93', label: 'Rosa' },
  { value: '#a64dff', label: 'Violeta' },
  { value: '#ffd23f', label: 'Dorado' },
  { value: '#2ee66b', label: 'Verde' },
  { value: '#ffffff', label: 'Blanco' },
  { value: 'rainbow', label: 'Arcoíris' },
] as const;

// ─── Segmentador (MediaPipe, una sola vez) ───────────────────────────
let forceCpu = false;
async function createSegmenter(): Promise<ImageSegmenter> {
  const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: '/mediapipe/selfie_segmenter.tflite', delegate },
    runningMode: 'IMAGE' as const,
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
  if (!forceCpu) {
    try {
      return await ImageSegmenter.createFromOptions(fileset, options('GPU'));
    } catch {
      forceCpu = true; // sin GPU compatible
    }
  }
  return ImageSegmenter.createFromOptions(fileset, options('CPU'));
}
let segmenterPromise: Promise<ImageSegmenter | null> | null = null;
const getSegmenter = () => (segmenterPromise ??= createSegmenter().catch(e => {
  console.warn('[video] aura: no se pudo cargar el detector de personas', e);
  segmenterPromise = null;
  return null;
}));

/** Carga el detector antes de que haga falta (al abrir la cámara). */
export const preloadAura = () => { void getSegmenter(); };

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const hslToRgb = (h: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)] as const;
};

/** Lado largo de la copia que se analiza (más chico = más rápido). */
const SEG_LONG = 256;
const SEG_EVERY_MS = 90;

export class AuraEffect {
  private small = document.createElement('canvas');
  private smallCtx: CanvasRenderingContext2D;
  private ring = document.createElement('canvas');
  private ringCtx: CanvasRenderingContext2D;
  private glow = document.createElement('canvas');
  private glowCtx: CanvasRenderingContext2D;
  /** El anillo apenas desenfocado: la línea sin escalones al agrandarla */
  private core = document.createElement('canvas');
  private coreCtx: CanvasRenderingContext2D;
  /** Puntos del borde de la silueta (coordenadas de la copia chica) */
  private edges: Int16Array = new Int16Array(0);
  private busy = false;
  private last = 0;
  private hasMask = false;
  private bolts: { pts: number[]; until: number }[] = [];
  private lastBolts = 0;

  private width: number;
  private height: number;
  style: AuraStyle;
  color: string;

  constructor(width: number, height: number, style: AuraStyle, color: string) {
    this.width = width;
    this.height = height;
    this.style = style;
    this.color = color;
    const k = SEG_LONG / Math.max(width, height);
    const w = Math.max(32, Math.round(width * k));
    const h = Math.max(32, Math.round(height * k));
    for (const c of [this.small, this.ring, this.glow, this.core]) { c.width = w; c.height = h; }
    this.smallCtx = this.small.getContext('2d', { willReadFrequently: true })!;
    this.ringCtx = this.ring.getContext('2d')!;
    this.glowCtx = this.glow.getContext('2d')!;
    this.coreCtx = this.core.getContext('2d')!;
    preloadAura();
  }

  /** Busca a las personas en el cuadro de ahora (a lo sumo ~11 veces por segundo). */
  update(source: CanvasImageSource, t: number) {
    const now = performance.now();
    if (this.busy || now - this.last < SEG_EVERY_MS) return;
    this.busy = true;
    this.last = now;
    const { width: w, height: h } = this.small;
    this.smallCtx.drawImage(source, 0, 0, w, h);
    void getSegmenter().then(seg => {
      if (!seg) return;
      seg.segment(this.small, result => {
        const mask = result.confidenceMasks?.[0];
        if (mask) this.buildRing(mask.getAsFloat32Array(), w, h, t);
        result.close();
      });
    }).catch(() => { /* se reintenta en el próximo cuadro */ })
      .finally(() => { this.busy = false; });
  }

  private buildRing(conf: Float32Array, w: number, h: number, t: number) {
    const inside = new Uint8Array(w * h);
    for (let i = 0; i < inside.length; i++) inside[i] = conf[i] > 0.5 ? 1 : 0;
    // Anillo: lo que queda justo afuera de la silueta (dilatada 2 píxeles)
    const R = 2;
    const rowMax = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let dx = -R; dx <= R && !m; dx++) { const xx = x + dx; if (xx >= 0 && xx < w && inside[y * w + xx]) m = 1; }
        rowMax[y * w + x] = m;
      }
    }
    const img = this.ringCtx.createImageData(w, h);
    const edges: number[] = [];
    const [r, g, b] = this.color === 'rainbow' ? hslToRgb((t * 90) % 360) : hexToRgb(this.color);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (inside[i]) continue;
        let m = 0;
        for (let dy = -R; dy <= R && !m; dy++) { const yy = y + dy; if (yy >= 0 && yy < h && rowMax[yy * w + x]) m = 1; }
        if (!m) continue;
        const o = i * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
        if (edges.length < 1600 && (x + y) % 2 === 0) edges.push(x, y);
      }
    }
    this.ringCtx.putImageData(img, 0, 0);
    // Brillo: el anillo desenfocado (en chiquito es barato)
    this.glowCtx.clearRect(0, 0, w, h);
    this.glowCtx.filter = 'blur(3px)';
    this.glowCtx.drawImage(this.ring, 0, 0);
    this.glowCtx.drawImage(this.ring, 0, 0);
    this.glowCtx.filter = 'none';
    this.coreCtx.clearRect(0, 0, w, h);
    this.coreCtx.filter = 'blur(0.7px)';
    this.coreCtx.drawImage(this.ring, 0, 0);
    this.coreCtx.drawImage(this.ring, 0, 0);
    this.coreCtx.filter = 'none';
    this.edges = Int16Array.from(edges);
    this.hasMask = edges.length > 0;
  }

  /** Dibuja el aura y los rayos sobre el cuadro. */
  draw(ctx: CanvasRenderingContext2D, t: number) {
    if (!this.hasMask || this.style === 'none') return;
    const { width: W, height: H } = this;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    if (this.style !== 'solo-rayos') {
      const pulse = 0.75 + 0.25 * Math.sin(t * 5);
      ctx.globalAlpha = pulse;
      ctx.drawImage(this.glow, 0, 0, W, H);
      ctx.drawImage(this.glow, 0, 0, W, H);
      ctx.globalAlpha = 0.95;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.core, 0, 0, W, H);
    }
    ctx.restore();
    if (this.style === 'rayos' || this.style === 'solo-rayos') this.drawBolts(ctx, t);
  }

  private drawBolts(ctx: CanvasRenderingContext2D, t: number) {
    const n = this.edges.length / 2;
    if (n < 10) return;
    const { width: W, height: H } = this;
    const sx = W / this.small.width;
    const sy = H / this.small.height;
    const now = performance.now();
    this.bolts = this.bolts.filter(b => b.until > now);
    // Rayos nuevos ~12 veces por segundo, cada uno dura un instante
    if (now - this.lastBolts > 80) {
      this.lastBolts = now;
      const want = this.style === 'solo-rayos' ? 3 : 2;
      for (let k = 0; k < want; k++) {
        const a = Math.floor(Math.random() * n);
        const ax = this.edges[a * 2];
        const ay = this.edges[a * 2 + 1];
        // Otro punto del borde, ni muy cerca ni muy lejos
        let best = -1;
        for (let tries = 0; tries < 30; tries++) {
          const c = Math.floor(Math.random() * n);
          const d = Math.hypot(this.edges[c * 2] - ax, this.edges[c * 2 + 1] - ay);
          if (d > this.small.width * 0.12 && d < this.small.width * 0.45) { best = c; break; }
        }
        if (best < 0) continue;
        // Línea quebrada (desplazamiento del punto medio)
        let pts = [ax * sx, ay * sy, this.edges[best * 2] * sx, this.edges[best * 2 + 1] * sy];
        let spread = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) * 0.35;
        for (let level = 0; level < 5; level++) {
          const next: number[] = [];
          for (let i = 0; i < pts.length - 2; i += 2) {
            const mx = (pts[i] + pts[i + 2]) / 2 + (Math.random() - 0.5) * spread;
            const my = (pts[i + 1] + pts[i + 3]) / 2 + (Math.random() - 0.5) * spread;
            next.push(pts[i], pts[i + 1], mx, my);
          }
          next.push(pts[pts.length - 2], pts[pts.length - 1]);
          pts = next;
          spread /= 2;
        }
        this.bolts.push({ pts, until: now + 90 + Math.random() * 160 });
      }
    }
    const color = this.color === 'rainbow' ? `hsl(${(t * 90) % 360} 100% 60%)` : this.color;
    const u = Math.min(W, H) / 100;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const b of this.bolts) {
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
      ctx.shadowColor = color;
      ctx.shadowBlur = u * 3;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = u * 0.9;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.lineWidth = u * 0.3;
      ctx.stroke();
    }
    ctx.restore();
  }
}
