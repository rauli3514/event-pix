// Detector de movimiento para la plataforma 360: compara cada cuadro de la cámara
// con el anterior en una copia chiquita en grises. Cuando la plataforma gira, la
// imagen cambia mucho y sostenido; con alguien quieto (o subiéndose), poco.
// El nivel va de 0 a 100 y el umbral se calibra en Ajustes.

const W = 64;
const H = 36;
/** Muestras por segundo (liviano para la TV box) */
const RATE = 12;

export interface MotionOptions {
  /** Se llama con el nivel suavizado (0–100) en cada muestra */
  onLevel?: (level: number) => void;
}

export class MotionDetector {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private prev: Uint8ClampedArray | null = null;
  private timer = 0;
  private smooth = 0;
  private video: HTMLVideoElement;
  private opts: MotionOptions;

  constructor(video: HTMLVideoElement, opts: MotionOptions = {}) {
    this.video = video;
    this.opts = opts;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  get level() { return this.smooth; }

  start() {
    this.stop();
    this.prev = null;
    this.smooth = 0;
    this.timer = window.setInterval(() => this.sample(), 1000 / RATE);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private sample() {
    const v = this.video;
    if (!v.videoWidth || v.readyState < 2) return;
    this.ctx.drawImage(v, 0, 0, W, H);
    const data = this.ctx.getImageData(0, 0, W, H).data;
    const gray = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (data[i] * 3 + data[i + 1] * 6 + data[i + 2]) / 10;
    if (this.prev) {
      // Diferencia promedio, con un piso para ignorar el ruido de la cámara
      let sum = 0;
      for (let j = 0; j < gray.length; j++) {
        const d = Math.abs(gray[j] - this.prev[j]);
        if (d > 6) sum += d;
      }
      const raw = Math.min(100, (sum / gray.length) * 2.5);
      this.smooth = this.smooth * 0.6 + raw * 0.4;
      this.opts.onLevel?.(this.smooth);
    }
    this.prev = gray;
  }
}

/**
 * Espera movimiento sostenido por encima del umbral (arranque) o quietud por
 * debajo (corte). Devuelve una función para cancelar.
 */
export function watchMotion(detector: MotionDetector, opts: {
  threshold: number;
  /** 'above': dispara con movimiento; 'below': dispara con quietud */
  when: 'above' | 'below';
  /** Milisegundos que tiene que sostenerse */
  holdMs: number;
  onTrigger: () => void;
  onLevel?: (level: number) => void;
}) {
  let since = 0;
  let fired = false;
  const timer = window.setInterval(() => {
    if (fired) return;
    const level = detector.level;
    opts.onLevel?.(level);
    const ok = opts.when === 'above' ? level >= opts.threshold : level < opts.threshold;
    if (!ok) { since = 0; return; }
    if (!since) since = performance.now();
    if (performance.now() - since >= opts.holdMs) {
      fired = true;
      opts.onTrigger();
    }
  }, 1000 / RATE);
  return () => window.clearInterval(timer);
}

/** Umbral sugerido a partir del nivel quieto y del nivel girando (calibración). */
export const suggestThreshold = (idle: number, spinning: number) =>
  Math.round(Math.max(idle + 2, idle + (spinning - idle) * 0.4));
