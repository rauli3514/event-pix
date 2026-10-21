import type { BufferedFrame } from './compositor';
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

export async function renderEffects(opts: {
  source: Blob;
  frames: BufferedFrame[];
  plan: EffectPlan;
  width: number;
  height: number;
  music?: AudioBuffer | null;
  musicVolume?: number;
  onProgress?: (p: number) => void;
}): Promise<{ blob: Blob; mime: string }> {
  const { width: W, height: H, plan, frames } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const tailFrames = plan.tail ? frames : [];
  const total = planDuration(plan, tailFrames);
  const stream = canvas.captureStream(30);
  const mix = opts.music ? mixAudio({ music: opts.music, musicVolume: opts.musicVolume, duration: total }) : null;
  if (mix) stream.addTrack(mix.track);
  const rec = new ClipRecorder(stream, { bitrate: bitrateFor(W, H, total) });

  const startedAt = performance.now();
  const progress = window.setInterval(() => opts.onProgress?.(Math.min(0.99, (performance.now() - startedAt) / 1000 / Math.max(0.1, total))), 200);
  const url = URL.createObjectURL(opts.source);
  let video: HTMLVideoElement | null = null;
  try {
    // Primer cuadro antes de arrancar: el video no empieza en negro
    video = await loadVideo(url);
    ctx.drawImage(video, 0, 0, W, H);
    rec.start();
    await playForward(video, ctx, W, H, plan.segments);

    if (plan.tail && tailFrames.length > 1) {
      const { parts, speed } = plan.tail;
      let clock = performance.now();
      for (const part of parts) {
        const list = part === 'rev' ? [...tailFrames].reverse() : tailFrames;
        for (let i = 0; i < list.length; i++) {
          ctx.drawImage(list[i].bitmap, 0, 0, W, H);
          const next = list[i + 1];
          const dt = next ? Math.abs(next.t - list[i].t) : 1 / 30;
          clock += (Math.min(0.2, Math.max(1 / 120, dt)) / speed) * 1000;
          await sleep(clock - performance.now());
        }
      }
    }
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

/** Reproduce el clip una vez, cambiando la velocidad en cada tramo, y dibuja cada cuadro nuevo. */
function playForward(video: HTMLVideoElement, ctx: CanvasRenderingContext2D, W: number, H: number, segments: Segment[]) {
  return new Promise<void>(resolve => {
    if (!segments.length) { resolve(); return; }
    const end = segments[segments.length - 1].until;
    let idx = 0;
    let finished = false;
    let last = -1;
    let raf = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      video.pause();
      resolve();
    };
    // Por si el video no avisa que terminó (algunos WebView con WebM recién grabados)
    const expected = segments.reduce((acc, s, i) => acc + (s.until - (i ? segments[i - 1].until : 0)) / s.speed, 0);
    const safety = window.setTimeout(finish, (expected * 1.6 + 5) * 1000);
    const tick = () => {
      if (finished) return;
      const t = video.currentTime;
      if (t !== last) {
        last = t;
        ctx.drawImage(video, 0, 0, W, H);
        while (idx < segments.length - 1 && t >= segments[idx].until) {
          idx++;
          video.playbackRate = segments[idx].speed;
        }
        if (t >= end - 0.02) { finish(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    video.onended = finish;
    video.playbackRate = segments[0].speed;
    video.play().then(() => { raf = requestAnimationFrame(tick); }).catch(finish);
  });
}
