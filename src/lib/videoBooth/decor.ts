import type { AnimationKey, Corner } from './settings';

// Capas que van encima del video: marco PNG, animación (confeti, brillos…, o un
// video propio), logo, marca de agua y la placa final. Todo se dibuja en función
// del tiempo `t` (segundos), así sale igual en vivo y al armar los efectos.

export interface DecorOptions {
  width: number;
  height: number;
  frame?: CanvasImageSource | null;
  animation?: AnimationKey;
  /** Video propio para la animación (ya cargado y en loop) */
  animVideo?: HTMLVideoElement | null;
  animBlend?: 'screen' | 'normal';
  logo?: CanvasImageSource | null;
  logoPosition?: Corner;
  logoSize?: number;
  logoOpacity?: number;
  watermark?: string;
  watermarkPosition?: Corner;
  brandColor?: string;
  /** Placa final */
  title?: string;
  endText?: string;
}

const COLORS = ['#ff2e93', '#ffd23f', '#00d4ff', '#7b2ff7', '#2ee6a6', '#ffffff', '#ff8a5b'];

/** Número pseudoaleatorio estable para la partícula i (el mismo en cada cuadro). */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const imageSize = (img: CanvasImageSource) => {
  const anyImg = img as { naturalWidth?: number; videoWidth?: number; width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength; naturalHeight?: number; videoHeight?: number };
  const w = anyImg.naturalWidth || anyImg.videoWidth || (typeof anyImg.width === 'number' ? anyImg.width : 0);
  const h = anyImg.naturalHeight || anyImg.videoHeight || (typeof anyImg.height === 'number' ? anyImg.height : 0);
  return { w: w || 1, h: h || 1 };
};

export class Decor {
  private o: DecorOptions;
  private count: number;

  constructor(opts: DecorOptions) {
    this.o = opts;
    this.count = Math.round(28 + (opts.width * opts.height) / 60000);
  }

  get hasLayers() {
    const o = this.o;
    return !!(o.frame || (o.animation && o.animation !== 'none') || o.logo || o.watermark);
  }

  /** Dibuja todas las capas para el segundo `t`. */
  draw(ctx: CanvasRenderingContext2D, t: number) {
    const { width: W, height: H } = this.o;
    ctx.save();
    this.drawAnimation(ctx, t);
    if (this.o.frame) ctx.drawImage(this.o.frame, 0, 0, W, H);
    if (this.o.logo) this.drawLogo(ctx);
    if (this.o.watermark) this.drawWatermark(ctx);
    ctx.restore();
  }

  // ─── Animaciones ─────────────────────────────────────────────────
  private drawAnimation(ctx: CanvasRenderingContext2D, t: number) {
    const { width: W, height: H, animation } = this.o;
    if (!animation || animation === 'none') return;
    const unit = Math.min(W, H) / 100;
    if (animation === 'custom') {
      const v = this.o.animVideo;
      if (v && v.readyState >= 2) {
        ctx.save();
        if (this.o.animBlend !== 'normal') ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(v, 0, 0, W, H);
        ctx.restore();
      }
      return;
    }
    if (animation === 'neon') {
      const color = this.o.brandColor || '#ff2e93';
      const pulse = 0.55 + 0.45 * Math.sin(t * 4);
      const inset = unit * 2.5;
      ctx.save();
      ctx.lineWidth = unit * 1.2;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = unit * (4 + 6 * pulse);
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      const r = unit * 6;
      ctx.beginPath();
      ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, r);
      ctx.stroke();
      // Un brillo que recorre el borde
      const per = 2 * (W + H - inset * 4);
      const pos = ((t * 0.35) % 1) * per;
      const pt = this.borderPoint(pos, inset, W, H);
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = unit * 8;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, unit * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    for (let i = 0; i < this.count; i++) {
      const x0 = rnd(i, 1);
      const speed = 0.06 + rnd(i, 2) * 0.12;
      const phase = rnd(i, 3);
      const size = unit * (0.8 + rnd(i, 4) * 1.6);
      switch (animation) {
        case 'confeti': {
          const y = ((phase + t * speed * 1.4) % 1.1) - 0.05;
          const x = x0 + Math.sin(t * 2 + i) * 0.02;
          ctx.save();
          ctx.translate(x * W, y * H);
          ctx.rotate(t * (2 + rnd(i, 5) * 4) + i);
          ctx.fillStyle = COLORS[i % COLORS.length];
          ctx.globalAlpha = 0.9;
          ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
          ctx.restore();
          break;
        }
        case 'brillos': {
          // Brillan mejor en los bordes: no tapan la cara
          const edge = i % 2 === 0 ? rnd(i, 6) * 0.22 : 0.78 + rnd(i, 6) * 0.22;
          const x = i % 4 < 2 ? edge : x0;
          const y = i % 4 < 2 ? rnd(i, 7) : edge;
          const a = Math.max(0, Math.sin(t * (2 + rnd(i, 8) * 3) + phase * 6.28));
          this.star(ctx, x * W, y * H, size * 1.6 * a, a);
          break;
        }
        case 'corazones': {
          const y = 1.05 - ((phase + t * speed) % 1.15);
          const x = x0 + Math.sin(t * 1.5 + i) * 0.03;
          ctx.globalAlpha = 0.85 * Math.min(1, y * 3);
          this.heart(ctx, x * W, y * H, size * 1.4, i % 3 === 0 ? '#ffffff' : i % 2 ? '#ff2e93' : '#ff4d6d');
          break;
        }
        case 'burbujas': {
          const y = 1.05 - ((phase + t * speed * 0.8) % 1.15);
          const x = x0 + Math.sin(t + i) * 0.025;
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = unit * 0.25;
          ctx.beginPath();
          ctx.arc(x * W, y * H, size * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x * W - size * 0.7, y * H - size * 0.7, size * 0.45, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'nieve': {
          const y = ((phase + t * speed * 0.7) % 1.1) - 0.05;
          const x = x0 + Math.sin(t * 0.8 + i) * 0.03;
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x * W, y * H, size * 0.7, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
  }

  private borderPoint(pos: number, inset: number, W: number, H: number) {
    const w = W - inset * 2;
    const h = H - inset * 2;
    if (pos < w) return { x: inset + pos, y: inset };
    pos -= w;
    if (pos < h) return { x: W - inset, y: inset + pos };
    pos -= h;
    if (pos < w) return { x: W - inset - pos, y: H - inset };
    pos -= w;
    return { x: inset, y: H - inset - pos };
  }

  private star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
    if (r <= 0.5) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff6c2';
    ctx.shadowBlur = r * 2;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 === 0 ? r : r * 0.22;
      const a = (k * Math.PI) / 4;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.2, y - s * 0.5, x - s * 0.4, y - s * 1.3, x, y - s * 0.55);
    ctx.bezierCurveTo(x + s * 0.4, y - s * 1.3, x + s * 1.2, y - s * 0.5, x, y + s * 0.35);
    ctx.fill();
  }

  // ─── Marca ───────────────────────────────────────────────────────
  private place(pos: Corner, w: number, h: number) {
    const { width: W, height: H } = this.o;
    const m = Math.min(W, H) * 0.04;
    const x = pos === 'tl' || pos === 'bl' ? m : pos === 'tr' || pos === 'br' ? W - w - m : (W - w) / 2;
    const y = pos === 'tl' || pos === 'tr' || pos === 'top' ? m : H - h - m;
    return { x, y };
  }

  private drawLogo(ctx: CanvasRenderingContext2D) {
    const logo = this.o.logo!;
    const { w: lw, h: lh } = imageSize(logo);
    const w = this.o.width * Math.max(0.05, Math.min(0.6, this.o.logoSize ?? 0.22));
    const h = (w * lh) / lw;
    const { x, y } = this.place(this.o.logoPosition ?? 'tr', w, h);
    ctx.save();
    ctx.globalAlpha = this.o.logoOpacity ?? 0.9;
    ctx.drawImage(logo, x, y, w, h);
    ctx.restore();
  }

  private drawWatermark(ctx: CanvasRenderingContext2D) {
    const text = this.o.watermark!;
    const size = Math.round(Math.min(this.o.width, this.o.height) * 0.035);
    ctx.save();
    ctx.font = `700 ${size}px 'Montserrat', sans-serif`;
    const w = ctx.measureText(text).width;
    const { x, y } = this.place(this.o.watermarkPosition ?? 'bl', w, size);
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.4;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ─── Placa final ─────────────────────────────────────────────────
  /** Placa final: `t` va de 0 a `duration` segundos. */
  drawEndCard(ctx: CanvasRenderingContext2D, t: number, duration: number) {
    const { width: W, height: H } = this.o;
    const color = this.o.brandColor || '#7b2ff7';
    const fade = Math.min(1, t / 0.35);
    ctx.save();
    ctx.globalAlpha = fade;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#07051a');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Brillos de fondo
    for (let i = 0; i < 18; i++) {
      const a = Math.max(0, Math.sin(t * 3 + i));
      this.star(ctx, rnd(i, 1) * W, rnd(i, 2) * H, Math.min(W, H) * 0.012 * a, a * fade);
    }
    const ease = 1 - Math.pow(1 - Math.min(1, t / 0.8), 3);
    let y = H * 0.38;
    if (this.o.logo) {
      const { w: lw, h: lh } = imageSize(this.o.logo);
      const w = Math.min(W * 0.55, (H * 0.25 * lw) / lh) * (0.85 + 0.15 * ease);
      const h = (w * lh) / lw;
      ctx.drawImage(this.o.logo, (W - w) / 2, y - h / 2, w, h);
      y += h / 2 + H * 0.06;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    if (this.o.title) {
      let size = Math.round(Math.min(W, H) * 0.085);
      ctx.font = `800 ${size}px 'CarlMarx', 'Montserrat', sans-serif`;
      while (ctx.measureText(this.o.title).width > W * 0.86 && size > 12) {
        size -= 2;
        ctx.font = `800 ${size}px 'CarlMarx', 'Montserrat', sans-serif`;
      }
      ctx.globalAlpha = fade * ease;
      ctx.fillText(this.o.title, W / 2, y + size * 0.4);
      y += size * 1.2;
    }
    if (this.o.endText) {
      const size = Math.round(Math.min(W, H) * 0.04);
      ctx.font = `600 ${size}px 'Montserrat', sans-serif`;
      ctx.globalAlpha = fade * Math.min(1, Math.max(0, (t - 0.4) / 0.5));
      ctx.fillText(this.o.endText, W / 2, y + size);
    }
    // Se apaga al final
    if (t > duration - 0.3) {
      ctx.globalAlpha = Math.min(1, (t - (duration - 0.3)) / 0.3) * 0.6;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}

/** Carga un video propio para la animación (en loop, sin sonido). */
export function loadAnimVideo(blob: Blob): Promise<HTMLVideoElement | null> {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
    document.body.appendChild(v);
    const timer = window.setTimeout(() => resolve(null), 8000);
    v.onloadeddata = () => { window.clearTimeout(timer); void v.play().catch(() => {}); resolve(v); };
    v.onerror = () => { window.clearTimeout(timer); v.remove(); resolve(null); };
    v.src = URL.createObjectURL(blob);
  });
}

export function disposeAnimVideo(v: HTMLVideoElement | null | undefined) {
  if (!v) return;
  v.pause();
  URL.revokeObjectURL(v.src);
  v.remove();
}
