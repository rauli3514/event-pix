import type { FaceDetector as MPFaceDetector } from '@mediapipe/tasks-vision';
import { getGeneralSettings } from '@/lib/kioskSettings';

// Filtros de color y accesorios que siguen la cara, 100 % en el equipo (sin internet).
// El detector de caras es MediaPipe (BlazeFace corto alcance): devuelve ojos, nariz,
// boca y orejas, y ahí se ubican los accesorios (dibujados por la app o PNG propios).

// ─── Filtros de color ───────────────────────────────────────────────
export const COLOR_FILTERS = [
  { value: 'none', label: 'Normal', css: '' },
  { value: 'bw', label: 'Blanco y negro', css: 'grayscale(1) contrast(1.1)' },
  { value: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.92)' },
  { value: 'vintage', label: 'Vintage', css: 'sepia(0.45) contrast(1.05) saturate(0.85) brightness(1.05)' },
  { value: 'glam', label: 'Glam', css: 'contrast(1.12) saturate(1.25) brightness(1.05)' },
  { value: 'warm', label: 'Cálido', css: 'sepia(0.2) saturate(1.3) hue-rotate(-8deg)' },
  { value: 'cold', label: 'Frío', css: 'saturate(1.1) hue-rotate(14deg) brightness(1.03)' },
  { value: 'pop', label: 'Pop', css: 'saturate(1.8) contrast(1.15)' },
] as const;
export type ColorFilter = typeof COLOR_FILTERS[number]['value'];
export const filterCss = (f?: string) => COLOR_FILTERS.find(x => x.value === f)?.css ?? '';

// ─── Accesorios ─────────────────────────────────────────────────────
export type Anchor = 'eyes' | 'head' | 'mouth';
export const ANCHORS: { value: Anchor; label: string }[] = [
  { value: 'eyes', label: 'Ojos (anteojos, antifaz)' },
  { value: 'head', label: 'Cabeza (sombrero, corona, orejas)' },
  { value: 'mouth', label: 'Boca (bigote, labios)' },
];

/** Accesorio subido por el usuario (PNG con fondo transparente, guardado en el equipo). */
export interface CustomAccessory { id: string; name: string; anchor: Anchor; scale: number }

export const BUILT_IN_ACCESSORIES = [
  { value: 'glasses', label: 'Anteojos' },
  { value: 'stars', label: 'Anteojos estrella' },
  { value: 'crown', label: 'Corona' },
  { value: 'bunny', label: 'Orejas de conejo' },
  { value: 'party', label: 'Gorro de fiesta' },
  { value: 'mustache', label: 'Bigote' },
] as const;

export interface Face {
  /** puntos en píxeles de la imagen */
  rightEye: { x: number; y: number };
  leftEye: { x: number; y: number };
  nose: { x: number; y: number };
  mouth: { x: number; y: number };
}

/** Sistema de la cara: origen entre los ojos, eje X hacia el otro ojo, unidad = distancia entre ojos. */
function faceFrame(f: Face) {
  const a = f.rightEye.x <= f.leftEye.x ? f.rightEye : f.leftEye; // el que está a la izquierda en la imagen
  const b = a === f.rightEye ? f.leftEye : f.rightEye;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x), d };
}

// Dibujos de la app, en unidades de "distancia entre ojos" (d). y negativo = hacia arriba.
const DRAW: Record<string, (ctx: CanvasRenderingContext2D, d: number, f: Face, fr: ReturnType<typeof faceFrame>) => void> = {
  glasses: (ctx, d) => {
    ctx.lineWidth = d * 0.09;
    ctx.strokeStyle = '#111';
    ctx.fillStyle = 'rgba(40,40,60,0.18)';
    for (const sx of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.roundRect?.(sx * d - d * 0.42, -d * 0.3, d * 0.84, d * 0.62, d * 0.18);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-d * 0.08, -d * 0.05);
    ctx.quadraticCurveTo(0, -d * 0.16, d * 0.08, -d * 0.05);
    ctx.stroke();
  },
  stars: (ctx, d) => {
    const star = (cx: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.48 : r;
        const t = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(cx + Math.cos(t) * rr, Math.sin(t) * rr + d * 0.02);
      }
      ctx.closePath();
    };
    for (const sx of [-0.55, 0.55]) {
      star(sx * d, d * 0.5);
      const g = ctx.createLinearGradient(0, -d * 0.5, 0, d * 0.5);
      g.addColorStop(0, '#ff6ec4');
      g.addColorStop(1, '#ff2e93');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = d * 0.06;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  },
  crown: (ctx, d) => {
    const w = d * 2.2;
    const base = -d * 1.25;
    const h = d * 0.95;
    ctx.beginPath();
    ctx.moveTo(-w / 2, base);
    ctx.lineTo(-w / 2, base - h * 0.55);
    ctx.lineTo(-w / 4, base - h * 0.2);
    ctx.lineTo(0, base - h);
    ctx.lineTo(w / 4, base - h * 0.2);
    ctx.lineTo(w / 2, base - h * 0.55);
    ctx.lineTo(w / 2, base);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#f5c542');
    g.addColorStop(1, '#b8860b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = d * 0.04;
    ctx.strokeStyle = '#8a6200';
    ctx.stroke();
    for (const [x, c] of [[-w / 4, '#e0182d'], [0, '#2b8cff'], [w / 4, '#2ee6a6']] as const) {
      ctx.beginPath();
      ctx.arc(x, base - h * 0.18, d * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    }
  },
  bunny: (ctx, d) => {
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * d * 0.45, -d * 0.95);
      ctx.rotate(sx * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, -d * 0.75, d * 0.3, d * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = d * 0.04;
      ctx.strokeStyle = '#ddd';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -d * 0.75, d * 0.15, d * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb3d1';
      ctx.fill();
      ctx.restore();
    }
  },
  party: (ctx, d) => {
    const base = -d * 1.15;
    ctx.save();
    ctx.translate(d * 0.25, 0);
    ctx.rotate(0.15);
    ctx.beginPath();
    ctx.moveTo(-d * 0.75, base);
    ctx.lineTo(0, base - d * 1.9);
    ctx.lineTo(d * 0.75, base);
    ctx.closePath();
    const g = ctx.createLinearGradient(-d, 0, d, 0);
    g.addColorStop(0, '#7b2ff7');
    g.addColorStop(1, '#00d4ff');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = d * 0.12;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(-d * 0.75 * (1 - t), base - d * 1.9 * t);
      ctx.lineTo(d * 0.75 * (1 - t), base - d * 1.9 * t);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, base - d * 1.95, d * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2e93';
    ctx.fill();
    ctx.restore();
  },
  mustache: (ctx, d, f, fr) => {
    // entre la nariz y la boca
    const local = toLocal(fr, { x: (f.nose.x + f.mouth.x) / 2, y: (f.nose.y * 0.4 + f.mouth.y * 0.6) });
    ctx.save();
    ctx.translate(local.x, local.y);
    ctx.scale(1.45, 1.45);
    ctx.fillStyle = '#1e120a';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -d * 0.05);
      ctx.bezierCurveTo(sx * d * 0.3, -d * 0.25, sx * d * 0.6, -d * 0.05, sx * d * 0.62, d * 0.05);
      ctx.bezierCurveTo(sx * d * 0.45, d * 0.02, sx * d * 0.25, d * 0.12, 0, d * 0.05);
      ctx.fill();
    }
    ctx.restore();
  },
};

const toLocal = (fr: ReturnType<typeof faceFrame>, p: { x: number; y: number }) => {
  const dx = p.x - fr.cx;
  const dy = p.y - fr.cy;
  const c = Math.cos(-fr.angle);
  const s = Math.sin(-fr.angle);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
};

/** Dibuja un accesorio sobre una cara (en el canvas, en coordenadas de la imagen). */
export function drawAccessory(ctx: CanvasRenderingContext2D, face: Face, accessory: string, custom?: { img: HTMLImageElement; anchor: Anchor; scale: number }) {
  const fr = faceFrame(face);
  if (fr.d < 4) return;
  ctx.save();
  ctx.translate(fr.cx, fr.cy);
  ctx.rotate(fr.angle);
  if (custom) {
    const { img, anchor, scale } = custom;
    const width = fr.d * (anchor === 'eyes' ? 2.5 : anchor === 'head' ? 2.8 : 1.6) * (scale || 1);
    const height = width * (img.height / img.width);
    if (anchor === 'eyes') ctx.drawImage(img, -width / 2, -height / 2, width, height);
    else if (anchor === 'head') ctx.drawImage(img, -width / 2, -fr.d * 1.05 - height, width, height);
    else {
      const m = toLocal(fr, face.mouth);
      ctx.drawImage(img, m.x - width / 2, m.y - height / 2, width, height);
    }
  } else {
    DRAW[accessory]?.(ctx, fr.d, face, fr);
  }
  ctx.restore();
}

// ─── Detector de caras ──────────────────────────────────────────────
let imageDetector: Promise<MPFaceDetector> | null = null;
let videoDetector: Promise<MPFaceDetector> | null = null;

async function createDetector(mode: 'IMAGE' | 'VIDEO') {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: '/mediapipe/blaze_face_short_range.tflite', delegate },
    runningMode: mode,
    minDetectionConfidence: 0.5,
  });
  try {
    return await FaceDetector.createFromOptions(fileset, options('GPU'));
  } catch {
    return FaceDetector.createFromOptions(fileset, options('CPU')); // sin GPU compatible
  }
}

const getDetector = (mode: 'IMAGE' | 'VIDEO') => {
  if (mode === 'IMAGE') return (imageDetector ??= createDetector('IMAGE'));
  return (videoDetector ??= createDetector('VIDEO'));
};

type Detection = { keypoints?: { x: number; y: number }[] };
const toFaces = (detections: Detection[], w: number, h: number): Face[] =>
  detections.filter(d => (d.keypoints?.length ?? 0) >= 4).map(d => {
    const k = d.keypoints!.map(p => ({ x: p.x * w, y: p.y * h }));
    return { rightEye: k[0], leftEye: k[1], nose: k[2], mouth: k[3] };
  });

/** Caras en una imagen (se busca en una copia chica, para que sea rápido). */
export async function detectFaces(img: HTMLImageElement | HTMLCanvasElement): Promise<Face[]> {
  const detector = await getDetector('IMAGE');
  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, 960 / Math.max(w, h));
  const small = document.createElement('canvas');
  small.width = Math.round(w * scale);
  small.height = Math.round(h * scale);
  small.getContext('2d')!.drawImage(img, 0, 0, small.width, small.height);
  return toFaces(detector.detect(small).detections as Detection[], w, h);
}

/** Caras en un cuadro de video (modo en vivo). */
export async function detectFacesInVideo(video: HTMLVideoElement, timestamp: number): Promise<Face[]> {
  const detector = await getDetector('VIDEO');
  return toFaces(detector.detectForVideo(video, timestamp).detections as Detection[], video.videoWidth, video.videoHeight);
}

// ─── Aplicar a una foto ─────────────────────────────────────────────
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
  img.src = src;
});

export interface FxChoice { filter?: string; accessory?: string }

// Las imágenes de los accesorios propios se cargan una vez (el modo en vivo las pide en cada cuadro)
const customCache = new Map<string, Promise<HTMLImageElement | null>>();
if (typeof window !== 'undefined') {
  window.addEventListener('kiosk-media-changed', (e) => {
    const key = (e as CustomEvent).detail as string;
    if (key?.startsWith('acc:')) customCache.delete(key.slice(4));
  });
}

/** Accesorio propio: 'custom:<id>' → imagen guardada en el equipo. */
export async function loadCustomAccessory(value: string) {
  if (!value.startsWith('custom:')) return undefined;
  const id = value.slice(7);
  const meta = ((getGeneralSettings().customAccessories ?? []) as CustomAccessory[]).find(a => a.id === id);
  if (!meta) return undefined;
  if (!customCache.has(id)) {
    customCache.set(id, (async () => {
      const { getScreenMedia } = await import('@/lib/kioskMedia');
      const rec = await getScreenMedia(`acc:${id}`);
      return rec ? loadImage(URL.createObjectURL(rec.blob)) : null;
    })());
  }
  const img = await customCache.get(id)!;
  return img ? { img, anchor: meta.anchor, scale: meta.scale } : undefined;
}

/**
 * Aplica filtro de color y accesorio a una foto. maxSize achica la salida
 * (para vistas previas rápidas); sin maxSize se mantiene la resolución.
 */
export async function applyFx(src: string, fx: FxChoice, maxSize?: number): Promise<string> {
  const hasFilter = !!fx.filter && fx.filter !== 'none';
  const hasAcc = !!fx.accessory && fx.accessory !== 'none';
  if (!hasFilter && !hasAcc && !maxSize) return src;
  const img = await loadImage(src);
  const scale = maxSize ? Math.min(1, maxSize / Math.max(img.width, img.height)) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.filter = hasFilter ? filterCss(fx.filter) || 'none' : 'none';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  if (hasAcc) {
    try {
      const faces = await detectFaces(canvas);
      const custom = await loadCustomAccessory(fx.accessory!);
      for (const f of faces) drawAccessory(ctx, f, fx.accessory!, custom);
    } catch (e) {
      console.error('No se pudo detectar la cara', e);
    }
  }
  return canvas.toDataURL('image/jpeg', 0.94);
}
