import { detectFaces, type Face } from '@/lib/faceFx';
import { drawVideoAccessory } from './accessories';
import type { Decor } from './decor';
import { videoFilter } from './settings';

// Compositor en vivo: dibuja la cámara en un canvas del tamaño del video final
// (recortada a la forma elegida, con espejo y giro), le aplica el filtro y el
// marco. Ese mismo canvas es la vista previa en pantalla y lo que se graba:
// lo que ve el invitado es exactamente lo que sale.

export interface CompositorOptions {
  width: number;
  height: number;
  mirror?: boolean;
  rotation?: number;
  filter?: string;
  /** Capas (marco, animación, logo) que se graban en vivo. Sin capas acá, se agregan después */
  decor?: Decor | null;
  /** Accesorio que sigue la cara ('none' o vacío = sin accesorio) */
  accessory?: string;
}

/** Un cuadro guardado para la reversa (boomerang / final del 360). */
export interface BufferedFrame { bitmap: ImageBitmap; t: number }

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/** Máximo de cuadros por segundo que se guardan para la reversa (cuida la memoria). */
const BUFFER_FPS = 30;
/** Lado corto máximo de los cuadros guardados (720p ≈ 3,7 MB por cuadro). */
const BUFFER_SHORT_SIDE = 720;

export class Compositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private vignette: CanvasGradient | null = null;
  private running = false;
  private handle = 0;
  private watchdog = 0;
  private lastDraw = 0;
  private opts: CompositorOptions;

  // Reversa: últimos `bufferSeconds` segundos en memoria
  private bufferSeconds = 0;
  private bufferStart = 0;
  private lastBufferAt = -1;
  private frames: BufferedFrame[] = [];
  private pending = 0;
  /** Cambia al empezar/terminar una ventana: los cuadros de otra ventana se descartan */
  private gen = 0;

  private video: HTMLVideoElement;
  private startedAt = performance.now();
  // Accesorios: se buscan caras ~8 veces por segundo y se dibujan en cada cuadro
  private faces: Face[] = [];
  private detecting = false;
  private lastDetect = 0;
  /** Mientras corre la placa final no se dibuja la cámara */
  private paused = false;

  constructor(video: HTMLVideoElement, opts: CompositorOptions) {
    this.video = video;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.width = opts.width;
    this.canvas.height = opts.height;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    // Brillo difuso del glam: una copia chiquita del cuadro, agrandada (desenfoque barato)
    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.width = Math.max(16, Math.round(opts.width / 6));
    this.glowCanvas.height = Math.max(16, Math.round(opts.height / 6));
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.buildVignette();
  }

  get width() { return this.opts.width; }
  get height() { return this.opts.height; }

  update(patch: Partial<CompositorOptions>) {
    this.opts = { ...this.opts, ...patch };
  }

  /** Segundos desde que arrancó (para las animaciones en vivo). */
  get time() { return (performance.now() - this.startedAt) / 1000; }

  /**
   * Placa final en vivo (videos sin efectos): deja de dibujar la cámara y muestra
   * la placa durante `seconds` mientras la grabación sigue.
   */
  async playEndCard(decor: Decor, seconds: number) {
    this.paused = true;
    const start = performance.now();
    await new Promise<void>(resolve => {
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        decor.drawEndCard(this.ctx, Math.min(t, seconds), seconds);
        if (t >= seconds) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /** Foto chica del cuadro actual (miniatura para la galería). */
  snapshot(maxWidth = 360): Promise<Blob | null> {
    const k = Math.min(1, maxWidth / this.opts.width);
    const c = document.createElement('canvas');
    c.width = Math.round(this.opts.width * k);
    c.height = Math.round(this.opts.height * k);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(this.canvas, 0, 0, c.width, c.height);
    // Si las capas no van grabadas en vivo, igual aparecen en la miniatura
    if (!this.opts.decor && this.thumbDecor) {
      ctx.save();
      ctx.scale(k, k);
      this.thumbDecor.draw(ctx, this.time);
      ctx.restore();
    }
    return new Promise(resolve => c.toBlob(b => resolve(b), 'image/jpeg', 0.8));
  }
  /** Capas para la miniatura cuando no se graban en vivo */
  thumbDecor: Decor | null = null;

  private buildVignette() {
    const { width: w, height: h } = this.opts;
    const g = this.ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    this.vignette = g;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    const v = this.video as VideoWithRvfc;
    const loop = () => {
      if (!this.running) return;
      this.draw();
      this.handle = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    };
    loop();
    // Si el WebView no avisa los cuadros nuevos (o se cortó la cadena), se sigue a mano
    this.watchdog = window.setInterval(() => {
      if (this.running && performance.now() - this.lastDraw > 400) {
        this.draw();
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(loop);
      }
    }, 250);
  }

  stop() {
    this.running = false;
    window.clearInterval(this.watchdog);
    const v = this.video as VideoWithRvfc;
    if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this.handle);
    cancelAnimationFrame(this.handle);
  }

  /** Empieza a guardar cuadros: se quedan los últimos `seconds` segundos. */
  startBuffer(seconds: number) {
    this.clearBuffer();
    this.gen++;
    this.bufferSeconds = seconds;
    this.bufferStart = performance.now();
    this.lastBufferAt = -1;
  }

  /** Deja de guardar y devuelve los cuadros (espera los que se estaban copiando). */
  async takeBuffer(): Promise<BufferedFrame[]> {
    this.bufferSeconds = 0;
    for (let i = 0; i < 50 && this.pending > 0; i++) await new Promise(r => setTimeout(r, 20));
    this.gen++;
    const frames = this.frames.sort((a, b) => a.t - b.t);
    this.frames = [];
    return frames;
  }

  clearBuffer() {
    this.bufferSeconds = 0;
    this.gen++;
    this.frames.forEach(f => f.bitmap.close());
    this.frames = [];
  }

  private draw() {
    const { video, ctx } = this;
    const { width: W, height: H, mirror, rotation, decor, accessory } = this.opts;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (this.paused || !vw || !vh || video.readyState < 2) return;
    this.lastDraw = performance.now();
    const rot = ((((Number(rotation) || 0) % 360) + 360) % 360);
    const sideways = rot === 90 || rot === 270;
    const rw = sideways ? vh : vw;
    const rh = sideways ? vw : vh;
    const scale = Math.max(W / rw, H / rh);
    const fx = videoFilter(this.opts.filter);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (mirror) ctx.scale(-1, 1);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.filter = fx.css || 'none';
    ctx.drawImage(video, (-vw * scale) / 2, (-vh * scale) / 2, vw * scale, vh * scale);
    ctx.restore();
    ctx.filter = 'none';

    if (fx.glow > 0) {
      const g = this.glowCanvas;
      this.glowCtx.drawImage(this.canvas, 0, 0, g.width, g.height);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Mezcla normal: suaviza la piel. "screen": el brillo de revista.
      ctx.globalAlpha = fx.glow;
      ctx.drawImage(g, 0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = fx.glow * 0.6;
      ctx.drawImage(g, 0, 0, W, H);
      ctx.restore();
    }
    if (fx.vignette && this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, W, H);
    }
    if (accessory && accessory !== 'none') this.drawAccessories(accessory);
    if (decor) decor.draw(ctx, this.time);

    if (this.bufferSeconds > 0) this.capture();
  }

  private drawAccessories(accessory: string) {
    const now = performance.now();
    // La búsqueda copia el cuadro al llamarla (antes de dibujar el accesorio)
    if (!this.detecting && now - this.lastDetect > 120) {
      this.detecting = true;
      this.lastDetect = now;
      detectFaces(this.canvas)
        .then(f => { this.faces = f; })
        .catch(() => { /* el detector todavía no está listo */ })
        .finally(() => { this.detecting = false; });
    }
    for (const f of this.faces) drawVideoAccessory(this.ctx, f, accessory);
  }

  private capture() {
    const now = performance.now();
    if (this.lastBufferAt >= 0 && now - this.lastBufferAt < 1000 / BUFFER_FPS - 2) return;
    this.lastBufferAt = now;
    const t = (now - this.bufferStart) / 1000;
    const { width: W, height: H } = this.opts;
    const k = Math.min(1, BUFFER_SHORT_SIDE / Math.min(W, H));
    this.pending++;
    const gen = this.gen;
    createImageBitmap(this.canvas, k < 1 ? { resizeWidth: Math.round(W * k), resizeHeight: Math.round(H * k), resizeQuality: 'medium' } : undefined)
      .then(bitmap => {
        if (gen !== this.gen) { bitmap.close(); return; }
        this.frames.push({ bitmap, t });
        // Se descartan los cuadros más viejos que la ventana
        const limit = t - this.bufferSeconds;
        while (this.frames.length && this.frames[0].t < limit) this.frames.shift()!.bitmap.close();
      })
      .catch(() => { /* cuadro perdido: no pasa nada */ })
      .finally(() => { this.pending--; });
  }
}

// ─── Marcos ────────────────────────────────────────────────────────────────

/** Marco "nombre del evento": franja abajo con el título y la fecha. */
/** Abre una imagen (Blob guardado en el equipo) para usarla de marco. */
export async function loadOverlayImage(blob: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}
