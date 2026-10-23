import type { BufferedFrame } from './compositor';
import type { Decor } from './decor';
import { bitrateFor, ClipRecorder, mixAudio } from './recorder';
import type { RampPreset, VideoBoothSettings, VideoEffect } from './settings';

// Efectos después de grabar: cámara lenta, rampas de velocidad (360), reversa y
// boomerang. El clip grabado se reproduce una sola vez hacia adelante cambiando
// la velocidad (sin saltos, que en los videos recién grabados no son confiables)
// y la reversa sale de los últimos cuadros guardados en memoria durante la toma.
// Todo se dibuja en un canvas que se vuelve a grabar, con la música de fondo.

/** Tramo hacia adelante: hasta el segundo `until` del clip, a velocidad `speed`. */
export interface Segment { until: number; speed: number }
/** Final con los cuadros guardados: reversa ('rev') y/o de nuevo adelante ('fwd'). */
export interface Tail { parts: ('rev' | 'fwd')[]; speed: number; seconds: number }
export interface EffectPlan { segments: Segment[]; tail: Tail | null }

const RAMPS: Record<RampPreset, { segments: [number, number][]; tail: Omit<Tail, 'seconds'> | null }> = {
  // [hasta (fracción del clip), velocidad]
  clasica: { segments: [[0.35, 1], [0.75, 0.5], [1, 2]], tail: { parts: ['rev'], speed: 1.5 } },
  epica: { segments: [[0.2, 2], [0.7, 0.35], [1, 1.6]], tail: { parts: ['rev', 'fwd'], speed: 2 } },
  suave: { segments: [[1, 0.6]], tail: null },
};

/** Segundos de cuadros a guardar en memoria mientras se graba (0 = ninguno). */
export function bufferSecondsFor(effect: VideoEffect, seconds: number, s: VideoBoothSettings) {
  if (effect === 'boomerang') return seconds + 0.5;
  if (effect === 'ramp' && RAMPS[s.rampPreset ?? 'clasica'].tail) return Math.min(2, seconds * 0.3);
  return 0;
}

/** Plan de efectos para un clip que duró `actual` segundos (null = queda como se grabó). */
export function effectPlan(effect: VideoEffect, actual: number, s: VideoBoothSettings): EffectPlan | null {
  switch (effect) {
    case 'slowmo':
      return { segments: [{ until: actual, speed: s.slowSpeed ?? 0.5 }], tail: null };
    case 'boomerang': {
      const loops = Math.max(1, Math.min(6, s.boomerangLoops ?? 3));
      const parts: ('rev' | 'fwd')[] = [];
      for (let i = 0; i < loops * 2 - 1; i++) parts.push(i % 2 === 0 ? 'rev' : 'fwd');
      return { segments: [{ until: actual, speed: 1 }], tail: { parts, speed: 1, seconds: actual } };
    }
    case 'ramp': {
      const r = RAMPS[s.rampPreset ?? 'clasica'];
      return {
        segments: r.segments.map(([f, speed]) => ({ until: actual * f, speed })),
        tail: r.tail ? { ...r.tail, seconds: Math.min(2, actual * 0.3) } : null,
      };
    }
    default:
      return null;
  }
}

/** Cuánto dura el video final. */
export function planDuration(plan: EffectPlan, frames: BufferedFrame[] = []) {
  let total = 0;
  let from = 0;
  for (const seg of plan.segments) {
    total += Math.max(0, seg.until - from) / seg.speed;
    from = seg.until;
  }
  if (plan.tail && frames.length > 1) {
    const span = frames[frames.length - 1].t - frames[0].t;
    total += (plan.tail.parts.length * span) / plan.tail.speed;
  }
  return total;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));

export interface RenderExtras {
  /** Capas encima del video (marco, animación, logo) */
  decor?: Decor | null;
  /** Segundos de placa final (0 = sin placa) */
  endCard?: number;
  /** Acercamiento suave a lo largo del video */
  zoom?: boolean;
  /** Destello en cada cambio de velocidad */
  flash?: boolean;
}

/**
 * Arma el video final a 30 cuadros por segundo: en cada cuadro dibuja el cuadro
 * del clip que corresponde (adelante con su velocidad, o de la reversa), el zoom,
 * las capas y el destello; al final, la placa.
 */
export async function renderEffects(opts: {
  source: Blob;
  frames: BufferedFrame[];
  plan: EffectPlan;
  width: number;
  height: number;
  music?: AudioBuffer | null;
  musicVolume?: number;
  musicStart?: number;
  onProgress?: (p: number) => void;
} & RenderExtras): Promise<{ blob: Blob; mime: string }> {
  const { width: W, height: H, plan, frames, decor } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const tailFrames = plan.tail ? frames : [];
  const endSeconds = decor && opts.endCard ? opts.endCard : 0;
  const main = planDuration(plan, tailFrames);
  const total = main + endSeconds;
  const stream = canvas.captureStream(30);
  const mix = opts.music ? mixAudio({ music: opts.music, musicVolume: opts.musicVolume, duration: total, offset: opts.musicStart }) : null;
  if (mix) stream.addTrack(mix.track);
  const rec = new ClipRecorder(stream, { bitrate: bitrateFor(W, H, total) });

  // Secuencia de la reversa: [cuadro, momento en que termina] (segundos desde que empieza)
  const tail: { frame: BufferedFrame; until: number }[] = [];
  if (plan.tail && tailFrames.length > 1) {
    let acc = 0;
    for (const part of plan.tail.parts) {
      const list = part === 'rev' ? [...tailFrames].reverse() : tailFrames;
      for (let i = 0; i < list.length; i++) {
        const next = list[i + 1];
        const dt = next ? Math.abs(next.t - list[i].t) : 1 / 30;
        acc += Math.min(0.2, Math.max(1 / 120, dt)) / plan.tail.speed;
        tail.push({ frame: list[i], until: acc });
      }
    }
  }

  const url = URL.createObjectURL(opts.source);
  let video: HTMLVideoElement | null = null;
  const startedAt = performance.now();
  const progress = window.setInterval(() => opts.onProgress?.(Math.min(0.99, (performance.now() - startedAt) / 1000 / Math.max(0.1, total))), 200);
  try {
    video = await loadVideo(url);
    const v = video;
    const segments = plan.segments;
    const end = segments.length ? segments[segments.length - 1].until : 0;

    // Dibuja una fuente con el zoom del momento
    const paint = (src: CanvasImageSource, t: number) => {
      const z = opts.zoom ? 1 + 0.12 * Math.min(1, t / Math.max(1, main)) : 1;
      if (z === 1) { ctx.drawImage(src, 0, 0, W, H); return; }
      const w = W * z;
      const h = H * z;
      ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
    };
    let flashAt = -10;
    const paintTop = (t: number) => {
      decor?.draw(ctx, t);
      const f = t - flashAt;
      if (opts.flash && f >= 0 && f < 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - f / 0.3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    paint(v, 0);
    paintTop(0);
    rec.start();
    const clock0 = performance.now();
    const now = () => (performance.now() - clock0) / 1000;

    await new Promise<void>(resolve => {
      let phase: 'forward' | 'tail' | 'end' = segments.length ? 'forward' : 'tail';
      let idx = 0;
      let forwardEnd = 0;
      let tailIdx = 0;
      let done = false;
      let lastPaint = -1;
      const finishForward = () => {
        if (phase !== 'forward') return;
        v.pause();
        forwardEnd = now();
        phase = tail.length ? 'tail' : 'end';
      };
      // Por si el video no avisa que terminó (algunos WebView con WebM recién grabados)
      const expected = segments.reduce((acc, sg, i) => acc + (sg.until - (i ? segments[i - 1].until : 0)) / sg.speed, 0);
      const safety = window.setTimeout(finishForward, (expected * 1.6 + 5) * 1000);
      v.onended = finishForward;
      const tick = () => {
        if (done) return;
        const t = now();
        if (phase === 'forward') {
          const ct = v.currentTime;
          while (idx < segments.length - 1 && ct >= segments[idx].until) {
            idx++;
            v.playbackRate = segments[idx].speed;
            flashAt = t;
          }
          if (ct >= end - 0.02) finishForward();
        }
        if (phase === 'tail') {
          const tt = t - forwardEnd;
          while (tailIdx < tail.length - 1 && tt >= tail[tailIdx].until) tailIdx++;
          if (tt >= tail[tail.length - 1].until) { phase = 'end'; forwardEnd = t; }
        }
        // 30 cuadros por segundo
        if (t - lastPaint >= 1 / 31) {
          lastPaint = t;
          if (phase === 'forward') { paint(v, t); paintTop(t); }
          else if (phase === 'tail' && tail.length) { paint(tail[tailIdx].frame.bitmap, t); paintTop(t); }
          else if (phase === 'end') {
            const te = t - forwardEnd;
            if (endSeconds && decor) decor.drawEndCard(ctx, Math.min(te, endSeconds), endSeconds);
            if (te >= endSeconds) {
              done = true;
              window.clearTimeout(safety);
              resolve();
              return;
            }
          }
        }
        requestAnimationFrame(tick);
      };
      if (segments.length) {
        v.playbackRate = segments[0].speed;
        v.play().then(() => requestAnimationFrame(tick)).catch(() => { finishForward(); requestAnimationFrame(tick); });
      } else requestAnimationFrame(tick);
    });
    await sleep(120);
    const blob = await rec.stop();
    opts.onProgress?.(1);
    return { blob, mime: rec.mime };
  } finally {
    window.clearInterval(progress);
    video?.remove();
    URL.revokeObjectURL(url);
    mix?.stop();
    stream.getTracks().forEach(t => t.stop());
  }
}

function loadVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // En la página (casi invisible): algunos WebView no decodifican videos sueltos
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
    document.body.appendChild(video);
    const fail = () => { window.clearTimeout(timer); video.remove(); reject(new Error('No se pudo abrir el video grabado')); };
    const timer = window.setTimeout(fail, 10000);
    video.onloadeddata = () => { window.clearTimeout(timer); resolve(video); };
    video.onerror = fail;
    video.src = url;
  });
}
