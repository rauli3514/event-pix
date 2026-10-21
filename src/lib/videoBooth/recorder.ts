// Grabación del video (MediaRecorder) y la música de fondo (Web Audio).

/**
 * Formato del video. Se prefiere MP4 (H.264): lo reproducen todos los celulares,
 * incluido iPhone, y WhatsApp/Instagram lo aceptan. Si el equipo no graba MP4,
 * queda WebM (anda en Android y computadoras, no en iPhone).
 */
export function pickMime(withAudio: boolean): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = withAudio
    ? ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

export const isMp4 = (mime: string) => mime.startsWith('video/mp4');
export const extensionFor = (mime: string) => (isMp4(mime) ? 'mp4' : 'webm');
export const baseMime = (mime: string) => mime.split(';')[0] || 'video/webm';

/** Qué formato sale en este equipo (para mostrar en Ajustes). */
export const recordingSupport = () => {
  if (typeof MediaRecorder === 'undefined') return { ok: false, format: 'Este equipo no puede grabar video' };
  const mime = pickMime(true) || pickMime(false);
  return { ok: !!mime, mp4: isMp4(mime), format: mime ? (isMp4(mime) ? 'MP4 (H.264)' : 'WebM') : 'ninguno' };
};

/**
 * Bits por segundo según el tamaño y lo que dura: alta calidad, pero sin pasar
 * de ~35 MB (lo que se sube a Drive para el QR tiene que ser liviano).
 */
export function bitrateFor(width: number, height: number, seconds: number) {
  const base = width * height >= 1920 * 1080 * 0.9 ? 9_000_000 : 5_500_000;
  return Math.max(1_500_000, Math.min(base, Math.floor((35e6 * 8) / Math.max(1, seconds))));
}

export class ClipRecorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  readonly mime: string;

  constructor(stream: MediaStream, opts: { mime?: string; bitrate: number }) {
    const hasAudio = stream.getAudioTracks().length > 0;
    this.mime = opts.mime ?? pickMime(hasAudio);
    this.recorder = new MediaRecorder(stream, {
      ...(this.mime ? { mimeType: this.mime } : {}),
      videoBitsPerSecond: opts.bitrate,
      ...(hasAudio ? { audioBitsPerSecond: 128_000 } : {}),
    });
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
  }

  start() {
    this.recorder.start(1000);
  }

  get recording() { return this.recorder.state === 'recording'; }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const done = () => resolve(new Blob(this.chunks, { type: baseMime(this.recorder.mimeType || this.mime) }));
      if (this.recorder.state === 'inactive') { done(); return; }
      this.recorder.onstop = done;
      this.recorder.onerror = e => reject((e as unknown as { error?: Error }).error ?? new Error('Falló la grabación'));
      try { this.recorder.requestData(); } catch { /* ya terminó */ }
      this.recorder.stop();
    });
  }
}

// ─── Audio ────────────────────────────────────────────────────────────────

let sharedCtx: AudioContext | null = null;

/** Contexto de audio compartido. Conviene crearlo con un toque (Android lo pide). */
export function audioContext() {
  if (!sharedCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === 'suspended') void sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

const decoded = new Map<Blob, Promise<AudioBuffer>>();
/** Decodifica la música una sola vez por archivo. */
export function decodeMusic(blob: Blob) {
  const ctx = audioContext();
  if (!ctx) return Promise.reject(new Error('Sin audio'));
  let p = decoded.get(blob);
  if (!p) {
    p = blob.arrayBuffer().then(buf => ctx.decodeAudioData(buf));
    decoded.set(blob, p);
    p.catch(() => decoded.delete(blob));
  }
  return p;
}

export interface AudioMix {
  track: MediaStreamTrack;
  /** Corta el micrófono (placa final) y deja la música */
  muteMic: () => void;
  stop: () => void;
}

/**
 * Mezcla para grabar (no suena por los parlantes): música desde el principio,
 * con desvanecido al final, y/o el micrófono.
 */
export function mixAudio(opts: { music?: AudioBuffer | null; musicVolume?: number; duration?: number; mic?: MediaStream | null; /** Segundo de la canción donde empieza */ offset?: number }): AudioMix | null {
  const ctx = audioContext();
  if (!ctx || (!opts.music && !opts.mic)) return null;
  const dest = ctx.createMediaStreamDestination();
  const nodes: AudioNode[] = [];
  let micStream: MediaStreamAudioSourceNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  if (opts.music) {
    source = ctx.createBufferSource();
    source.buffer = opts.music;
    source.loop = true;
    const gain = ctx.createGain();
    const vol = Math.max(0, Math.min(1, opts.musicVolume ?? 0.8)) * (opts.mic ? 0.35 : 1);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.15);
    if (opts.duration && opts.duration > 1.5) {
      gain.gain.setValueAtTime(vol, t0 + opts.duration - 1.2);
      gain.gain.linearRampToValueAtTime(0, t0 + opts.duration);
    }
    source.connect(gain).connect(dest);
    nodes.push(gain);
    const offset = Math.max(0, opts.offset ?? 0);
    source.start(0, opts.music.duration > 0 ? offset % opts.music.duration : 0);
  }
  if (opts.mic) {
    micStream = ctx.createMediaStreamSource(opts.mic);
    micStream.connect(dest);
    nodes.push(micStream);
  }
  const track = dest.stream.getAudioTracks()[0];
  return {
    track,
    muteMic: () => { try { micStream?.disconnect(); } catch { /* ya estaba */ } },
    stop: () => {
      try { source?.stop(); } catch { /* ya paró */ }
      nodes.forEach(n => n.disconnect());
      track.stop();
    },
  };
}

/** Micrófono para el libro de firmas (con supresión de eco y ruido). */
export async function openMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw new Error(name === 'NotAllowedError'
      ? 'La app no tiene permiso para usar el micrófono'
      : 'No se encontró un micrófono (la webcam suele traer uno)');
  }
}
