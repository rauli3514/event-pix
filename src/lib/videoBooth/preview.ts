// Vista previa animada de cada video para la pantalla de la galería: 24 cuadros
// del video terminado en una sola imagen (6 × 4). Se sube a Drive como la
// miniatura (las imágenes de Drive se ven siempre; los videos de Drive no siempre
// se pueden reproducir en otra página) y la pantalla la anima cuadro por cuadro.

export const PREVIEW_COLS = 6;
export const PREVIEW_ROWS = 4;
export const PREVIEW_FRAMES = PREVIEW_COLS * PREVIEW_ROWS;
/** Lado largo de cada cuadro */
const FRAME_LONG = 400;

export class PreviewSampler {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private fw: number;
  private fh: number;
  private count = 0;
  private every = 0.25;

  constructor(width: number, height: number) {
    const k = FRAME_LONG / Math.max(width, height);
    this.fw = Math.round(width * k);
    this.fh = Math.round(height * k);
    this.canvas.width = this.fw * PREVIEW_COLS;
    this.canvas.height = this.fh * PREVIEW_ROWS;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  /** Cuánto dura lo que se va a muestrear (reparte los 24 cuadros). */
  setDuration(seconds: number) {
    this.every = Math.max(0.05, seconds / PREVIEW_FRAMES);
  }

  get frames() { return this.count; }

  /** Guarda un cuadro si ya toca (t = segundos desde que empezó). */
  sample(source: CanvasImageSource, t: number) {
    if (this.count >= PREVIEW_FRAMES || t < this.count * this.every) return;
    this.draw(source, this.count++);
  }

  private draw(source: CanvasImageSource, i: number) {
    const x = (i % PREVIEW_COLS) * this.fw;
    const y = Math.floor(i / PREVIEW_COLS) * this.fh;
    try { this.ctx.drawImage(source, x, y, this.fw, this.fh); } catch { /* cuadro sin datos */ }
  }

  /** La imagen terminada (null si casi no hay cuadros). Si faltan, repite los que hay. */
  async toBlob(): Promise<Blob | null> {
    const n = this.count;
    if (n < 4) return null;
    for (let i = n; i < PREVIEW_FRAMES; i++) {
      const src = i % n;
      this.ctx.drawImage(this.canvas,
        (src % PREVIEW_COLS) * this.fw, Math.floor(src / PREVIEW_COLS) * this.fh, this.fw, this.fh,
        (i % PREVIEW_COLS) * this.fw, Math.floor(i / PREVIEW_COLS) * this.fh, this.fw, this.fh);
    }
    return new Promise(resolve => this.canvas.toBlob(b => resolve(b), 'image/jpeg', 0.78));
  }
}
