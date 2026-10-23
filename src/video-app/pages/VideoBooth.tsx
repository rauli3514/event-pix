import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, BookHeart, Check, CloudOff, Dices, Gem, LayoutGrid, Loader2, Lock, LockOpen, MessageCircle, Music, Play, RefreshCw, Repeat, Rotate3d,
  RotateCcw, Settings, Snail, Sparkles, Square, Video, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import ScreenBackground from '@/components/video-booth/ScreenBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { AIProcessing, CountdownRing } from '@/components/kiosk/KioskAnimations';
import PinDialog from '../PinDialog';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { getCameraSettings, openCameraStream, stopStream } from '@/lib/videoBooth/camera';
import { getMedia } from '@/lib/videoBooth/mediaStore';
import { guestVideoUrl } from '@/lib/videoBooth/share';
import { useShutter } from '@/lib/videoBooth/shutter';
import { isSupabaseConfigured } from '@/lib/supabase';
import { addPhoneToQueued, deliverVideo, galleryUrl, sendToPhones } from '@/lib/videoBooth/cloud';
import { DEFAULT_WA_PREFIX, fullPhone, sendVideoWhatsApp, validPhone } from '@/lib/videoBooth/whatsapp';
import { isDriveConfigured } from '@/lib/videoBooth/drive';
import { Compositor } from '@/lib/videoBooth/compositor';
import { bufferSecondsFor, effectPlan, renderEffects } from '@/lib/videoBooth/effects';
import { buildDecor, framePool, frameUrl, loadSong, pickSong, type DecorBundle } from '@/lib/videoBooth/media';
import { MotionDetector, watchMotion } from '@/lib/videoBooth/motion';
import { PreviewSampler } from '@/lib/videoBooth/preview';
import { audioContext, bitrateFor, ClipRecorder, extensionFor, mixAudio, openMic, type AudioMix } from '@/lib/videoBooth/recorder';
import {
  animationLabel, DEFAULT_PROMPTS, enabledModes, galleryCode, getVideoSettings, outputSize, resolveMode, songKey,
  type AnimationKey, type SongItem, type VideoModeDef, type VideoModeKey,
} from '@/lib/videoBooth/settings';
import { accessoryLabel, VIDEO_ACCESSORIES } from '@/lib/videoBooth/accessories';
import { UPDATE_EVENT, updateAvailable } from '@/lib/videoBooth/device';
import { eventFolder, saveVideoLocally, videoFileName } from '@/lib/videoBooth/storage';

// Cabina de video: el invitado elige la experiencia (video, boomerang, cámara lenta,
// 360, libro de firmas, glam), el marco y la canción si se lo permiten, se graba
// con cuenta regresiva (o sola, cuando gira la plataforma 360) y se lleva el video
// con un QR (al video o a la galería del evento). Funciona sin internet: el video
// queda en el equipo y se sube cuando vuelve.

type Step = 'splash' | 'modes' | 'prompt' | 'frame' | 'song' | 'live' | 'countdown' | 'recording' | 'ending' | 'processing' | 'review' | 'result' | 'error';
type PreStep = 'prompt' | 'frame' | 'song';

const ICONS: Record<VideoModeKey, LucideIcon> = {
  clasico: Video, boomerang: Repeat, lenta: Snail, '360': Rotate3d, firmas: BookHeart, glam: Gem,
};
const GRADIENTS: Record<VideoModeKey, [string, string]> = {
  clasico: ['from-[#00d4ff] via-[#2b8cff] to-[#5b3bff]', 'rgba(0,212,255,0.55)'],
  boomerang: ['from-[#ffd23f] via-[#ff9f1c] to-[#ff4d6d]', 'rgba(255,159,28,0.55)'],
  lenta: ['from-[#2ee6a6] via-[#00b3c7] to-[#2b6cff]', 'rgba(46,230,166,0.5)'],
  '360': ['from-[#ff2e93] via-[#c03bff] to-[#7b2ff7]', 'rgba(255,46,147,0.55)'],
  firmas: ['from-[#ff8a5b] via-[#ff4d6d] to-[#c03bff]', 'rgba(255,77,109,0.5)'],
  glam: ['from-[#e5e5e5] via-[#8a8a8a] to-[#1f1f1f]', 'rgba(255,255,255,0.35)'],
};

const btn = 'kiosk-glass rounded-full px-8 py-4 text-xl font-bold text-white flex items-center gap-3 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] hover:bg-white/15 transition-transform focus:scale-105';
const primaryBtn = 'rounded-full px-10 py-5 text-2xl font-black text-white flex items-center gap-3 bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_15px_40px_-10px_rgba(255,46,147,0.8)] focus:outline-none focus:ring-4 focus:ring-[#00d4ff] transition-transform focus:scale-105';

// Experiencia bloqueada (como las secciones del espejo): la cabina trabaja siempre
// en esa y para salir hay que tocar el candado y poner la clave.
const LOCK_KEY = 'video_lock';
const readLock = () => { try { return localStorage.getItem(LOCK_KEY) as VideoModeKey | null; } catch { return null; } };
const writeLock = (key: VideoModeKey | null) => {
  try { if (key) localStorage.setItem(LOCK_KEY, key); else localStorage.removeItem(LOCK_KEY); } catch { /* sin espacio */ }
};
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Result { blob: Blob; url: string; name: string; thumb: Blob | null; preview: Blob | null }
type Qr =
  | { state: 'off' }
  | { state: 'uploading' }
  | { state: 'ready'; video?: string; gallery?: string; queued?: boolean }
  | { state: 'error'; message: string };

export default function VideoBooth() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getVideoSettings);
  const modes = useMemo(() => enabledModes(settings), [settings]);
  const size = useMemo(() => outputSize(settings), [settings]);

  const [step, setStep] = useState<Step>('splash');
  const [mode, setMode] = useState<VideoModeDef | null>(null);
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [qr, setQr] = useState<Qr>({ state: 'off' });
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [motionLevel, setMotionLevel] = useState(0);
  const [frameThumbs, setFrameThumbs] = useState<{ id: string; name: string; url: string }[]>([]);
  const [previewSong, setPreviewSong] = useState<string | null>(null);
  // Experiencia en la que se queda la cabina (la última elegida) y la bloqueada
  const [lockKey, setLockKey] = useState<VideoModeKey | null>(readLock);
  const [stickyKey, setStickyKey] = useState<VideoModeKey | null>(readLock);
  const [unlockOpen, setUnlockOpen] = useState(false);
  // Animación y accesorio de esta toma (el invitado los puede cambiar en la pantalla)
  const [fx, setFx] = useState<{ animation: AnimationKey; accessory: string }>({ animation: 'none', accessory: 'none' });
  const [fxOpen, setFxOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(updateAvailable);

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const musicRef = useRef<AudioBuffer | null>(null);
  const songRef = useRef<SongItem | null>(null);
  const decorRef = useRef<DecorBundle | null>(null);
  const recorderRef = useRef<ClipRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const mixRef = useRef<AudioMix | null>(null);
  const motionRef = useRef<MotionDetector | null>(null);
  const thumbRef = useRef<Blob | null>(null);
  // Vista previa animada para la pantalla de la galería
  const samplerRef = useRef<PreviewSampler | null>(null);
  const samplerTimerRef = useRef(0);
  const tickRef = useRef(0);
  const recStartRef = useRef(0);
  const finishingRef = useRef(false);
  const resultRef = useRef<Result | null>(null);
  const modeRef = useRef<VideoModeDef | null>(null);
  const queueRef = useRef<PreStep[]>([]);
  const chosenFrameRef = useRef<string | null>(null);
  const chosenSongRef = useRef<string | null>(null);
  const accessoryRef = useRef('none');
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const reload = () => setSettings(getVideoSettings());
    window.addEventListener('video-settings-changed', reload);
    const onUpdate = () => setHasUpdate(updateAvailable());
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener('video-settings-changed', reload);
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, []);

  // La experiencia fija solo vale si sigue activada
  const homeMode = useMemo(() => {
    const key = lockKey ?? stickyKey;
    return modes.find(m => m.key === key) ?? (modes.length === 1 ? modes[0] : null);
  }, [modes, lockKey, stickyKey]);
  const locked = !!lockKey && homeMode?.key === lockKey;


  // ─── Cámara ──────────────────────────────────────────────────────
  const stopMotion = useCallback(() => {
    motionRef.current?.stop();
    motionRef.current = null;
  }, []);

  const closeCamera = useCallback(() => {
    stopMotion();
    window.clearInterval(samplerTimerRef.current);
    compositorRef.current?.stop();
    compositorRef.current?.clearBuffer();
    compositorRef.current?.canvas.remove();
    compositorRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    stopStream(micRef.current);
    micRef.current = null;
    setCameraReady(false);
  }, [stopMotion]);

  const disposeDecor = () => {
    decorRef.current?.dispose();
    decorRef.current = null;
  };

  const openCamera = useCallback(async (m: VideoModeDef) => {
    const cam = getCameraSettings();
    const rm = resolveMode(m.key, settings);
    const cfg = rm.cfg;
    const wantsFps = m.effect !== 'none' && settings.highFps !== false ? 60 : 30;
    const stream = await openCameraStream({ fps: wantsFps, facingMode: settings.facing });
    streamRef.current = stream;
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play().catch(() => {});
    const decor = decorRef.current?.decor ?? null;
    // Sin efectos las capas se graban en vivo; con efectos se agregan al armar el video
    const comp = new Compositor(video, {
      width: size.width, height: size.height,
      mirror: !!cam.mirror, rotation: Number(cam.rotation) || 0,
      filter: cfg.filter, accessory: accessoryRef.current,
      decor: m.effect === 'none' ? decor : null,
    });
    comp.thumbDecor = decor;
    comp.canvas.className = 'w-full h-full object-contain';
    previewRef.current?.replaceChildren(comp.canvas);
    comp.start();
    compositorRef.current = comp;
    if (cfg.mic) {
      try {
        micRef.current = await openMic();
      } catch (e) {
        toast.warning(e instanceof Error ? e.message : 'Sin micrófono: el video sale sin sonido');
      }
    }
    setCameraReady(true);
  }, [settings, size]);

  useEffect(() => () => {
    window.clearInterval(tickRef.current);
    mixRef.current?.stop();
    closeCamera();
    decorRef.current?.dispose();
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
  }, [closeCamera]);

  // Capas en la vista previa cuando no se graban en vivo (modos con efectos)
  const cameraSteps: Step[] = ['live', 'countdown', 'recording'];
  const showCamera = cameraSteps.includes(step) || step === 'ending';
  useEffect(() => {
    const canvas = layerRef.current;
    const decor = decorRef.current?.decor;
    if (!showCamera || !mode || mode.effect === 'none' || !canvas || !decor || !decor.hasLayers) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;
    const t0 = performance.now();
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      decor.draw(ctx, (performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [showCamera, mode, size, cameraReady]);

  // ─── Flujo ───────────────────────────────────────────────────────
  const goSplash = useCallback(() => {
    window.clearInterval(tickRef.current);
    closeCamera();
    disposeDecor();
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    setResult(null);
    setQr({ state: 'off' });
    setWaOpen(false);
    pendingPhonesRef.current = [];
    setMode(null);
    setCount(null);
    setProgress(0);
    setError('');
    setFxOpen(false);
    setStep('splash');
  }, [closeCamera]);

  const enterLive = useCallback(async (m: VideoModeDef) => {
    setStep('live');
    try {
      const rm = resolveMode(m.key, settings);
      // Al azar: una animación y un accesorio distintos en cada video
      const animation = rm.animation === 'random' ? pick(rm.animationPool) : rm.animation;
      const accessory = rm.accessory === 'random' ? pick(VIDEO_ACCESSORIES).value : rm.accessory;
      accessoryRef.current = accessory;
      setFx({ animation, accessory });
      setFxOpen(false);
      disposeDecor();
      decorRef.current = await buildDecor(settings, size, {
        frameId: chosenFrameRef.current ?? rm.frameId, eventTitle: settings.eventTitle, overlay: rm.overlay, animation,
      });
      songRef.current = rm.cfg.music ? pickSong(settings, chosenSongRef.current, rm) : null;
      musicRef.current = await loadSong(songRef.current);
      await openCamera(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }, [settings, size, openCamera]);

  /** Siguiente pantalla previa (pregunta, marco, canción) o la cámara. */
  const nextPre = useCallback((m: VideoModeDef) => {
    const next = queueRef.current.shift();
    if (next) setStep(next);
    else void enterLive(m);
  }, [enterLive]);

  const chooseMode = useCallback((m: VideoModeDef) => {
    audioContext(); // con el toque: Android deja usar el audio
    setMode(m);
    modeRef.current = m;
    setStickyKey(m.key);
    chosenFrameRef.current = null;
    chosenSongRef.current = null;
    const rm = resolveMode(m.key, settings);
    const queue: PreStep[] = [];
    if (m.guestbook) {
      const list = (settings.prompts?.filter(p => p.trim()) ?? []);
      const pool = list.length ? list : DEFAULT_PROMPTS;
      setPrompt(pool[Math.floor(Math.random() * pool.length)]);
      queue.push('prompt');
    }
    if (rm.overlay === 'custom' && rm.frameChoice && framePool(settings).length > 1) queue.push('frame');
    if (rm.cfg.music && rm.songMode === 'guest' && (settings.songs?.length ?? 0) > 1) queue.push('song');
    queueRef.current = queue;
    nextPre(m);
  }, [settings, nextPre]);

  // Con una experiencia elegida (o bloqueada) se entra directo a esa
  const start = useCallback(() => {
    audioContext();
    if (homeMode) chooseMode(homeMode);
    else setStep('modes');
  }, [homeMode, chooseMode]);

  const changeMode = () => {
    if (locked) return;
    setStickyKey(null);
    setStep('modes');
  };

  const toggleLock = () => {
    if (locked) { setUnlockOpen(true); return; }
    if (!homeMode) return;
    writeLock(homeMode.key);
    setLockKey(homeMode.key);
    toast.success(`Bloqueada en "${homeMode.label}". Para salir tocá el candado y poné la clave.`);
  };

  // Cambiar la animación o el accesorio en la pantalla de la toma
  const changeFx = (patch: Partial<{ animation: AnimationKey; accessory: string }>) => {
    if (patch.animation !== undefined) decorRef.current?.decor.setAnimation(patch.animation);
    if (patch.accessory !== undefined) {
      accessoryRef.current = patch.accessory;
      compositorRef.current?.update({ accessory: patch.accessory });
    }
    setFx(f => ({ ...f, ...patch }));
  };

  // Después del video: otra vez al inicio, o (360 continuo) directo a esperar el próximo giro
  const reset = useCallback(() => {
    const m = modeRef.current;
    if (m?.key === '360' && settings.continuous360) {
      window.clearInterval(tickRef.current);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
      setResult(null);
      setQr({ state: 'off' });
      setWaOpen(false);
      pendingPhonesRef.current = [];
      setProgress(0);
      chooseMode(m);
      return;
    }
    goSplash();
  }, [settings.continuous360, chooseMode, goSplash]);

  // Marcos para elegir
  useEffect(() => {
    if (step !== 'frame') return;
    let alive = true;
    const urls: string[] = [];
    void Promise.all(framePool(settings).map(async f => ({ ...f, url: await frameUrl(f.id, size) }))).then(list => {
      const ok = list.filter((f): f is { id: string; name: string; url: string } => !!f.url);
      urls.push(...ok.map(f => f.url).filter(u => u.startsWith('blob:')));
      if (alive) setFrameThumbs(ok);
      else urls.forEach(u => URL.revokeObjectURL(u));
    });
    return () => {
      alive = false;
      urls.forEach(u => URL.revokeObjectURL(u));
      setFrameThumbs([]);
    };
  }, [step, settings, size]);

  const chooseFrame = (id: string) => {
    chosenFrameRef.current = id;
    if (mode) nextPre(mode);
  };

  // Canciones para elegir: al tocar una suena un pedacito
  const playPreview = async (song: SongItem) => {
    setPreviewSong(song.id);
    const rec = await getMedia(songKey(song.id)).catch(() => null);
    const audio = audioRef.current;
    if (!rec || !audio) return;
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(rec.blob);
    audio.currentTime = song.start ?? 0;
    void audio.play().catch(() => {});
  };
  const stopPreview = () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); if (audio.src) URL.revokeObjectURL(audio.src); audio.removeAttribute('src'); }
  };
  const chooseSong = () => {
    stopPreview();
    chosenSongRef.current = previewSong;
    if (mode) nextPre(mode);
  };

  const finishRecording = useCallback(async () => {
    if (finishingRef.current || !mode) return;
    finishingRef.current = true;
    window.clearInterval(tickRef.current);
    stopMotion();
    const rec = recorderRef.current;
    const comp = compositorRef.current;
    const actual = Math.max(0.5, (performance.now() - recStartRef.current) / 1000);
    const decor = decorRef.current?.decor ?? null;
    const endSeconds = settings.endCard && decor ? settings.endCardSeconds ?? 2.5 : 0;
    try {
      if (!rec || !comp) throw new Error('La grabación no arrancó');
      // Sin efectos, la placa final se graba en vivo (sin el micrófono)
      if (mode.effect === 'none' && endSeconds && decor) {
        setStep('ending');
        mixRef.current?.muteMic();
        await comp.playEndCard(decor, endSeconds);
      }
      const raw = await rec.stop();
      window.clearInterval(samplerTimerRef.current);
      mixRef.current?.stop();
      mixRef.current = null;
      recStreamRef.current?.getTracks().forEach(t => t.stop());
      const frames = await comp.takeBuffer();
      if (!thumbRef.current) thumbRef.current = await comp.snapshot().catch(() => null);
      closeCamera();
      setProgress(0);
      setStep('processing');

      const rm = resolveMode(mode.key, settings);
      const cfg = rm.cfg;
      const plan = effectPlan(rm, actual);
      let blob = raw;
      let mime = rec.mime;
      if (plan) {
        // Con efectos, la vista previa sale del video final
        const sampler = new PreviewSampler(size.width, size.height);
        let timed = false;
        samplerRef.current = sampler;
        try {
          const out = await renderEffects({
            source: raw, frames, plan, width: size.width, height: size.height,
            music: cfg.music ? musicRef.current : null, musicVolume: settings.musicVolume, musicStart: songRef.current?.start,
            decor, endCard: endSeconds, zoom: settings.zoomEffect, flash: settings.flashEffect && mode.effect === 'ramp',
            onProgress: setProgress,
            onFrame: (canvas, t, total) => {
              if (!timed) { sampler.setDuration(total); timed = true; }
              sampler.sample(canvas, t);
            },
          });
          blob = out.blob;
          mime = out.mime;
        } finally {
          frames.forEach(f => f.bitmap.close());
        }
      }
      if (!blob.size) throw new Error('El video salió vacío. Probá de nuevo.');
      const name = videoFileName(mode.key, extensionFor(mime || blob.type));
      const preview = await samplerRef.current?.toBlob().catch(() => null) ?? null;
      samplerRef.current = null;
      const res: Result = { blob, url: URL.createObjectURL(blob), name, thumb: thumbRef.current, preview };
      setResult(res);
      // Respaldo en el equipo, siempre
      saveVideoLocally(blob, name).catch(e => {
        console.error('[video] no se pudo guardar', e);
        toast.error('No se pudo guardar el video en el equipo');
      });
      setStep(rm.review ? 'review' : 'result');
    } catch (e) {
      closeCamera();
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    } finally {
      recorderRef.current = null;
      finishingRef.current = false;
    }
  }, [mode, settings, size, closeCamera, stopMotion]);

  const startRecording = useCallback(() => {
    const comp = compositorRef.current;
    if (!comp || !mode) return;
    const rm = resolveMode(mode.key, settings);
    const cfg = rm.cfg;
    const planned = cfg.seconds;
    const buffer = bufferSecondsFor(rm, planned);
    if (buffer) comp.startBuffer(buffer);
    const fps = Math.min(60, Math.round(streamRef.current?.getVideoTracks()[0]?.getSettings().frameRate || 30));
    const stream = comp.canvas.captureStream(fps);
    recStreamRef.current = stream;
    const endSeconds = settings.endCard && decorRef.current ? settings.endCardSeconds ?? 2.5 : 0;
    // Sin efectos, el audio (música y/o micrófono) se graba en vivo
    if (mode.effect === 'none') {
      const mix = mixAudio({
        music: cfg.music ? musicRef.current : null, musicVolume: settings.musicVolume, offset: songRef.current?.start,
        duration: planned + endSeconds, mic: cfg.mic ? micRef.current : null,
      });
      if (mix) { stream.addTrack(mix.track); mixRef.current = mix; }
    }
    // Con efectos este clip es intermedio: se graba con más calidad
    const rec = new ClipRecorder(stream, { bitrate: mode.effect === 'none' ? bitrateFor(size.width, size.height, planned + endSeconds) : 12_000_000 });
    rec.start();
    const startedAt = performance.now();
    recStartRef.current = startedAt;
    recorderRef.current = rec;
    thumbRef.current = null;
    // Sin efectos, la vista previa se toma mientras se graba (con la placa final)
    window.clearInterval(samplerTimerRef.current);
    samplerRef.current = null;
    if (mode.effect === 'none') {
      const sampler = new PreviewSampler(size.width, size.height);
      sampler.setDuration(planned + endSeconds);
      samplerRef.current = sampler;
      samplerTimerRef.current = window.setInterval(() => sampler.sample(comp.canvas, (performance.now() - startedAt) / 1000), 100);
    }
    // Miniatura para la galería: un cuadro al rato de empezar
    window.setTimeout(() => {
      if (recorderRef.current === rec) void comp.snapshot().then(b => { if (b) thumbRef.current = b; });
    }, Math.min(1500, planned * 400));
    setElapsed(0);
    setStep('recording');
    tickRef.current = window.setInterval(() => {
      const s = (performance.now() - startedAt) / 1000;
      setElapsed(s);
      if (s >= planned) void finishRecording();
    }, 100);
  }, [mode, settings, size, finishRecording]);

  const startCountdown = useCallback(() => {
    if (!cameraReady || step !== 'live' || !mode) return;
    stopMotion();
    setFxOpen(false);
    const total = Math.max(0, resolveMode(mode.key, settings).countdown);
    if (!total) { startRecording(); return; }
    setStep('countdown');
    setCount(total);
    let n = total;
    const t = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(t);
        setCount(null);
        startRecording();
      } else setCount(n);
    }, 1000);
    tickRef.current = t;
  }, [cameraReady, step, mode, settings, startRecording, stopMotion]);

  // ─── 360: arranque y corte por movimiento ───────────────────────
  const autoStart = mode?.key === '360' && !!settings.autoStart360;
  const autoStop = mode?.key === '360' && !!settings.autoStop360;
  const threshold = settings.motionThreshold ?? 14;
  useEffect(() => {
    if (!cameraReady || (step !== 'live' && step !== 'recording')) return;
    if (step === 'live' && !autoStart) return;
    if (step === 'recording' && !autoStop) return;
    const video = videoRef.current;
    if (!video) return;
    const detector = new MotionDetector(video);
    detector.start();
    motionRef.current = detector;
    // Al grabar se espera un poco antes de mirar si paró (arranca girando despacio)
    const delay = step === 'recording' ? 2500 : 600;
    let cancel = () => {};
    const timer = window.setTimeout(() => {
      cancel = watchMotion(detector, {
        threshold: step === 'live' ? threshold : threshold * 0.7,
        when: step === 'live' ? 'above' : 'below',
        holdMs: step === 'live' ? 400 : 1200,
        onLevel: setMotionLevel,
        // Girando: graba ya, sin cuenta regresiva (la plataforma no espera)
        onTrigger: () => (step === 'live' ? startRecording() : void finishRecording()),
      });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancel();
      detector.stop();
      if (motionRef.current === detector) motionRef.current = null;
    };
  }, [cameraReady, step, autoStart, autoStop, threshold, startRecording, finishRecording]);

  // ─── Entrega ─────────────────────────────────────────────────────
  // Estado de la subida, para el envío por WhatsApp
  const driveIdRef = useRef<string | null>(null);
  const uploadingRef = useRef(false);
  const queuedRef = useRef(false);
  const pendingPhonesRef = useRef<string[]>([]);
  const [waOpen, setWaOpen] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  const [waStatus, setWaStatus] = useState<{ state: 'idle' | 'sending' | 'waiting' | 'sent' | 'queued' | 'error'; message?: string }>({ state: 'idle' });
  useRemoteFocus(rootRef, [step, qr.state, frameThumbs.length, waOpen, waStatus.state, fxOpen, homeMode?.key], !pinOpen && !unlockOpen);
  const waPrefix = settings.whatsappPrefix || DEFAULT_WA_PREFIX;
  const whatsappOn = !!settings.whatsappEnabled && isSupabaseConfigured && isDriveConfigured();

  const deliver = useCallback(async (res: Result) => {
    const showQr = settings.showQr !== false;
    const delivery = settings.delivery ?? 'video';
    const code = isSupabaseConfigured ? galleryCode() : '';
    const gallery = code && delivery !== 'video' ? galleryUrl(code) : undefined;
    const title = settings.eventTitle || settings.title || undefined;
    const mode = modeRef.current?.key ?? 'video';
    driveIdRef.current = null;
    queuedRef.current = false;
    uploadingRef.current = true;
    setQr(showQr ? { state: 'uploading' } : { state: 'off' });
    try {
      const driveId = await deliverVideo({
        name: res.name, folder: eventFolder(), blob: res.blob, thumb: res.thumb, preview: res.preview,
        title, mode, gallery: code, created: Date.now(),
      });
      uploadingRef.current = false;
      // WhatsApp pedidos mientras se subía
      const phones = pendingPhonesRef.current.splice(0);
      if (driveId) {
        driveIdRef.current = driveId;
        if (phones.length) {
          const failed = await sendToPhones({ title, gallery: code, mode }, driveId, phones);
          setWaStatus(failed.length ? { state: 'error', message: 'No se pudo mandar el WhatsApp' } : { state: 'sent' });
        }
      } else {
        queuedRef.current = true;
        for (const phone of phones) await addPhoneToQueued(res.name, phone);
        if (phones.length) setWaStatus({ state: 'queued' });
      }
      if (!showQr) return;
      if (driveId) {
        setQr({ state: 'ready', video: delivery !== 'gallery' ? guestVideoUrl(driveId, settings.eventTitle || undefined) : undefined, gallery });
      } else if (code) {
        // Sin internet: la galería ya tiene dirección; el video aparece cuando se suba
        setQr({ state: 'ready', gallery: galleryUrl(code), queued: true });
      } else {
        setQr({ state: 'error', message: navigator.onLine ? 'Falta configurar Google Drive' : 'Sin internet' });
      }
    } catch (e) {
      uploadingRef.current = false;
      if (showQr) setQr({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [settings.showQr, settings.delivery, settings.title, settings.eventTitle]);

  const openWhatsApp = () => {
    setWaNumber('');
    setWaStatus({ state: 'idle' });
    setWaOpen(true);
  };

  const submitWhatsApp = async () => {
    const res = resultRef.current;
    const phone = fullPhone(waPrefix, waNumber);
    if (!res || !validPhone(phone)) { setWaStatus({ state: 'error', message: 'Revisá el número' }); return; }
    const title = settings.eventTitle || settings.title || undefined;
    if (driveIdRef.current) {
      setWaStatus({ state: 'sending' });
      try {
        await sendVideoWhatsApp({ phone, driveId: driveIdRef.current, title, gallery: settings.galleryCode, mode: modeRef.current?.key });
        setWaStatus({ state: 'sent' });
      } catch (e) {
        setWaStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    } else if (uploadingRef.current) {
      pendingPhonesRef.current.push(phone);
      setWaStatus({ state: 'waiting' });
    } else if (queuedRef.current && await addPhoneToQueued(res.name, phone)) {
      setWaStatus({ state: 'queued' });
    } else {
      setWaStatus({ state: 'error', message: 'El video no se pudo subir' });
    }
  };

  // Con el mensaje mandado (o en camino), el teclado se cierra solo
  useEffect(() => {
    if (!waOpen || !['sent', 'queued', 'waiting'].includes(waStatus.state)) return;
    const t = window.setTimeout(() => setWaOpen(false), 3500);
    return () => window.clearTimeout(t);
  }, [waOpen, waStatus.state]);

  const accept = useCallback(() => {
    const res = resultRef.current;
    if (!res) return;
    setStep('result');
    void deliver(res);
  }, [deliver]);

  // Sin revisión: el resultado sale directo (y se entrega)
  useEffect(() => {
    if (step === 'result' && qr.state === 'off' && resultRef.current && modeRef.current && !resolveMode(modeRef.current.key, settings).review) void deliver(resultRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const retake = useCallback(() => {
    if (!mode) return;
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    setResult(null);
    void enterLive(mode);
  }, [mode, enterLive]);

  // El resultado vuelve solo (no mientras se sube el video)
  useEffect(() => {
    if (step !== 'result' || qr.state === 'uploading' || waOpen) return;
    const t = window.setTimeout(reset, (settings.resultSeconds ?? 45) * 1000);
    return () => window.clearTimeout(t);
  }, [step, qr.state, waOpen, settings.resultSeconds, reset]);
  // Revisión sin respuesta: se queda con el video
  useEffect(() => {
    if (step !== 'review') return;
    const t = window.setTimeout(accept, 25000);
    return () => window.clearTimeout(t);
  }, [step, accept]);

  // Disparador Bluetooth: avanza en cada pantalla
  useShutter(() => {
    if (step === 'splash') start();
    else if (step === 'prompt' && mode) nextPre(mode);
    else if (step === 'frame' && frameThumbs[0]) chooseFrame(chosenFrameRef.current ?? frameThumbs[0].id);
    else if (step === 'song' && mode) chooseSong();
    else if (step === 'live') { if (!fxOpen) startCountdown(); }
    else if (step === 'recording' && mode?.canStop) void finishRecording();
    else if (step === 'review') accept();
    else if (step === 'result' && !waOpen) reset();
  }, !pinOpen && !unlockOpen);

  // ─── Pantallas ───────────────────────────────────────────────────
  const rmode = mode ? resolveMode(mode.key, settings) : null;
  // Inicio: el de la experiencia fija; elegir experiencia: el de General
  const bgMode = step === 'splash' ? homeMode : step === 'modes' ? null : mode;
  const screenBackground = bgMode ? resolveMode(bgMode.key, settings).background : settings.background || 'aurora';
  const cfg = rmode?.cfg ?? null;
  // Controles: abajo con la pantalla vertical; al costado con la horizontal (no tapan el marco)
  const side = 'absolute bottom-[6vmin] inset-x-0 landscape:inset-x-auto landscape:bottom-auto landscape:top-1/2 landscape:-translate-y-1/2 landscape:right-[4vmin]';
  const meter = (
    <div className="kiosk-glass rounded-2xl px-6 py-4 w-[min(22rem,80vw)] space-y-2">
      <p className="text-lg font-bold flex items-center gap-2"><Rotate3d className="w-5 h-5 text-[#00d4ff]" /> Esperando que gire la plataforma…</p>
      <div className="relative h-3 rounded-full bg-white/15 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00d4ff] to-[#ff2e93] transition-[width] duration-150" style={{ width: `${Math.min(100, motionLevel * 1.5)}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${Math.min(100, threshold * 1.5)}%` }} />
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="kiosk-root relative min-h-screen h-screen overflow-hidden text-white bg-[#07051a]">
      {/* La cámara se monta siempre (para no perder el video entre pantallas) */}
      <div className={showCamera ? 'absolute inset-0' : 'hidden'}>
        <div className="absolute inset-0 bg-black" />
        {/* El video de la cámara queda debajo: el canvas (lo que se graba) lo tapa */}
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
        <div ref={previewRef} className="absolute inset-0" />
        <canvas ref={layerRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      </div>
      <audio ref={audioRef} className="hidden" />

      {/* Fondo de las pantallas: el de la experiencia (o el de General) */}
      {!showCamera && <ScreenBackground value={screenBackground} dim={settings.backgroundDim} />}

      {step === 'splash' && (
        <div className="absolute inset-0">
          <button onClick={start} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-10 focus:outline-none" data-autofocus>
            <EventPixLogo size={64} subtitle="Cabina de video" />
            {homeMode && (() => {
              const Icon = ICONS[homeMode.key];
              const [gradient] = GRADIENTS[homeMode.key];
              return (
                <span className="flex items-center gap-4 -mb-4">
                  <span className={`w-16 h-16 rounded-[25%] bg-gradient-to-br ${gradient} flex items-center justify-center shadow-xl`}>
                    <Icon className="w-9 h-9 text-white" strokeWidth={1.7} />
                  </span>
                  <span className="text-[clamp(1.4rem,4vmin,2.4rem)] font-black">{homeMode.label}</span>
                </span>
              );
            })()}
            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              className="carlmarx-bold text-center text-[clamp(3rem,9vmin,7.5rem)] leading-tight px-8"
            >
              {settings.title || settings.eventTitle || '¡Grabá tu video!'}
            </motion.h1>
            <motion.span
              animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}
              className="rounded-full px-12 py-6 text-[clamp(1.5rem,4vmin,2.5rem)] font-black bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_20px_60px_-15px_rgba(255,46,147,0.9)] flex items-center gap-4"
            >
              <Video className="w-10 h-10" /> Tocá para empezar
            </motion.span>
            {!modes.length && <p className="text-amber-200 text-xl">No hay experiencias activadas: entrá a Ajustes.</p>}
          </button>
          <div className="absolute top-6 right-6 flex gap-3 z-10">
            {homeMode && (
              <button onClick={toggleLock} className={`${btn} ${locked ? 'opacity-50' : ''}`} aria-label={locked ? 'Desbloquear experiencia' : 'Bloquear en esta experiencia'}>
                {locked ? <Lock className="w-6 h-6" /> : <LockOpen className="w-6 h-6" />}
              </button>
            )}
            <button onClick={() => setPinOpen(true)} className={`${btn} relative`} aria-label={hasUpdate ? 'Ajustes (hay una versión nueva)' : 'Ajustes'}>
              <Settings className="w-6 h-6" />
              {hasUpdate && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff2e93] ring-2 ring-[#07051a]" />}
            </button>
          </div>
          {homeMode && !locked && modes.length > 1 && (
            <div className="absolute bottom-6 inset-x-0 flex justify-center z-10">
              <button onClick={changeMode} className={btn}><LayoutGrid className="w-6 h-6" /> Cambiar experiencia</button>
            </div>
          )}
        </div>
      )}

      {step === 'modes' && (
        <div className="absolute inset-0 flex flex-col">
          <header className="relative flex items-center justify-between px-[5vmin] pt-[4vmin]">
            <button onClick={goSplash} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
            <h2 className="carlmarx-bold text-[clamp(2rem,6vmin,4.5rem)]">¿Qué video hacemos?</h2>
            <span className="w-32" />
          </header>
          <main className="relative flex-1 flex items-center justify-center px-[4vmin]">
            <div className="flex flex-wrap justify-center gap-[4vmin] max-w-[90vw]">
              {modes.map((m, i) => {
                const Icon = ICONS[m.key];
                const [gradient, glow] = GRADIENTS[m.key];
                return (
                  <motion.button
                    key={m.key}
                    data-autofocus={i === 0 ? true : undefined}
                    onClick={() => chooseMode(m)}
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.07, type: 'spring', stiffness: 140, damping: 15 }}
                    className="group flex flex-col items-center gap-[2vmin] rounded-[3rem] p-[1.2vmin] focus:outline-none"
                  >
                    <span
                      className={`relative w-[min(13rem,20vmin)] h-[min(13rem,20vmin)] portrait:w-[28vmin] portrait:h-[28vmin] rounded-[25%] bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform group-hover:scale-105 group-focus:scale-110 group-focus:-translate-y-2`}
                      style={{ boxShadow: `0 30px 70px -20px ${glow}, inset 0 2px 0 rgba(255,255,255,0.45)` }}
                    >
                      <span className="absolute inset-x-[9%] top-[6%] h-1/2 rounded-[20%] bg-gradient-to-b from-white/45 to-transparent" />
                      <span className="absolute inset-0 rounded-[25%] ring-0 group-focus:ring-[6px] ring-white/90 transition-all" />
                      <Icon className="relative w-1/2 h-1/2 text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]" strokeWidth={1.6} />
                    </span>
                    <span className="text-center max-w-[30vmin]">
                      <span className="block text-[clamp(1.3rem,3.6vmin,2rem)] font-black leading-tight">{m.label}</span>
                      <span className="block text-[clamp(0.85rem,2vmin,1.05rem)] text-white/65 mt-1">{m.hint}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </main>
        </div>
      )}

      {step === 'prompt' && mode && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-[6vmin] text-center">
          <BookHeart className="relative w-24 h-24 text-[#ff8a5b] drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]" strokeWidth={1.4} />
          <p className="relative text-white/80 text-2xl uppercase tracking-[0.3em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">{settings.guestbookTitle?.trim() || 'Libro de firmas'}</p>
          {settings.guestbookText?.trim() && (
            <p className="relative text-[clamp(1.3rem,3.6vmin,2.4rem)] font-semibold max-w-4xl -mt-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">{settings.guestbookText}</p>
          )}
          <motion.h2 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative carlmarx-bold text-[clamp(2.2rem,7vmin,5.5rem)] leading-tight max-w-5xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]">
            {prompt}
          </motion.h2>
          <p className="relative text-white/80 text-2xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">Tenés hasta {fmt(cfg?.seconds ?? 30)} para tu mensaje. Podés terminar antes.</p>
          <div className="relative flex gap-5">
            <button onClick={goSplash} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
            <button onClick={() => nextPre(mode)} className={primaryBtn} data-autofocus><Video className="w-8 h-8" /> Grabar mensaje</button>
          </div>
        </div>
      )}

      {step === 'frame' && (
        <div className="absolute inset-0 flex flex-col">
          <header className="relative flex items-center justify-between px-[5vmin] pt-[4vmin]">
            <button onClick={goSplash} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
            <h2 className="carlmarx-bold text-[clamp(2rem,6vmin,4.5rem)]">Elegí tu marco</h2>
            <span className="w-32" />
          </header>
          <main className="relative flex-1 flex items-center justify-center px-[4vmin]">
            {!frameThumbs.length ? <Loader2 className="w-14 h-14 animate-spin text-[#00d4ff]" /> : (
              <div className="flex flex-wrap justify-center gap-[3vmin]">
                {frameThumbs.map((f, i) => (
                  <motion.button key={f.id} onClick={() => chooseFrame(f.id)} data-autofocus={i === 0 ? true : undefined}
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="rounded-3xl p-2 bg-white/5 focus:outline-none focus:ring-[6px] focus:ring-white/90 focus:scale-105 transition-transform">
                    <span className="block rounded-2xl overflow-hidden bg-gradient-to-br from-[#2b2350] to-[#0d0a24]"
                      style={{ aspectRatio: `${size.width} / ${size.height}`, height: 'min(46vh, 38vmin)' }}>
                      <img src={f.url} alt={f.name} className="w-full h-full object-fill" />
                    </span>
                    <span className="block mt-2 text-lg font-bold">{f.name}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {step === 'song' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-[5vmin]">
          <h2 className="relative carlmarx-bold text-[clamp(2rem,6vmin,4.5rem)]">Elegí la música</h2>
          <div className="relative grid gap-3 w-[min(40rem,90vw)] max-h-[55vh] overflow-y-auto p-1">
            {(settings.songs ?? []).map((sg, i) => (
              <button key={sg.id} onClick={() => void playPreview(sg)} data-autofocus={i === 0 ? true : undefined}
                className={`flex items-center gap-4 rounded-2xl px-6 py-4 text-left text-xl font-bold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${previewSong === sg.id ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'kiosk-glass'}`}>
                {previewSong === sg.id ? <Music className="w-7 h-7 animate-pulse" /> : <Play className="w-7 h-7" />}
                <span className="truncate">{sg.name}</span>
              </button>
            ))}
          </div>
          <div className="relative flex gap-5">
            <button onClick={() => { stopPreview(); goSplash(); }} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
            <button onClick={chooseSong} disabled={!previewSong} className={`${primaryBtn} disabled:opacity-40`}><Check className="w-8 h-8" /> Usar esta</button>
          </div>
        </div>
      )}

      {showCamera && mode && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Arriba: experiencia y, en el libro de firmas, la pregunta */}
          <div className="absolute top-6 inset-x-0 flex flex-col items-center gap-3 px-6">
            {step !== 'ending' && <span className="kiosk-glass rounded-full px-7 py-3 text-2xl font-black">{mode.label}</span>}
            {mode.guestbook && prompt && step !== 'ending' && <p className="kiosk-glass rounded-3xl px-8 py-4 text-2xl font-semibold text-center max-w-4xl">{prompt}</p>}
          </div>

          {step === 'live' && fxOpen && rmode && (
            <div className="absolute inset-x-0 bottom-0 pointer-events-auto bg-black/65 backdrop-blur-md rounded-t-[2rem] px-[4vmin] pt-5 pb-[4vmin] space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-black flex items-center gap-2"><Sparkles className="w-6 h-6 text-[#ffd23f]" /> Elegí tu efecto</h3>
                <div className="flex gap-3">
                  <button onClick={() => changeFx({ animation: pick(rmode.animationPool), accessory: pick(VIDEO_ACCESSORIES).value })} className={btn}>
                    <Dices className="w-6 h-6" /> Sorpresa
                  </button>
                  <button onClick={() => setFxOpen(false)} className={primaryBtn} data-autofocus><Check className="w-7 h-7" /> Listo</button>
                </div>
              </div>
              <FxRow
                title="Animación" value={fx.animation}
                options={['none', ...rmode.animationPool.filter(a => a !== 'custom' || fx.animation === 'custom')].map(v => ({ value: v, label: animationLabel(v) }))}
                onPick={v => changeFx({ animation: v as AnimationKey })}
              />
              <FxRow
                title="Accesorio" value={fx.accessory}
                options={[{ value: 'none', label: 'Sin accesorio' }, ...VIDEO_ACCESSORIES.map(a => ({ value: a.value, label: accessoryLabel(a.value) }))]}
                onPick={v => changeFx({ accessory: v })}
              />
            </div>
          )}

          {step === 'live' && !fxOpen && (
            <div className={`${side} flex flex-col items-center gap-5 pointer-events-auto`}>
              {mode.key === '360' && (autoStart && cameraReady ? meter
                : <p className="kiosk-glass rounded-2xl px-6 py-3 text-xl max-w-xs text-center">Subite a la plataforma. Cuando estés listo, ¡a grabar!</p>)}
              <div className="flex items-center gap-5 landscape:flex-col-reverse">
                <button onClick={goSplash} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
                {rmode?.fxChoice && cameraReady && (
                  <button onClick={() => setFxOpen(true)} className={btn}><Sparkles className="w-6 h-6" /> Efectos</button>
                )}
                <button onClick={startCountdown} disabled={!cameraReady} className={`${primaryBtn} disabled:opacity-50`} data-autofocus>
                  {cameraReady ? <span className="w-7 h-7 rounded-full bg-red-500 ring-4 ring-white" /> : <Loader2 className="w-7 h-7 animate-spin" />}
                  {cameraReady ? 'Grabar' : 'Abriendo cámara…'}
                </button>
              </div>
            </div>
          )}

          {step === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <CountdownRing value={count} total={rmode?.countdown ?? 3} />
            </div>
          )}

          {step === 'recording' && cfg && (
            <>
              <div className="absolute top-6 left-6 flex items-center gap-3 kiosk-glass rounded-full px-6 py-3">
                <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 rounded-full bg-red-500" />
                <span className="text-2xl font-black tabular-nums">REC {fmt(elapsed)}</span>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-3 bg-white/15">
                <div className="h-full bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] transition-[width] duration-100" style={{ width: `${Math.min(100, (elapsed / cfg.seconds) * 100)}%` }} />
              </div>
              <div className={`${side} flex flex-col items-center gap-4 pointer-events-auto`}>
                <span className="carlmarx-bold text-[clamp(3rem,10vmin,7rem)] tabular-nums drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                  {Math.max(0, Math.ceil(cfg.seconds - elapsed))}
                </span>
                {mode.canStop && (
                  <button onClick={() => void finishRecording()} className={btn} data-autofocus>
                    <Square className="w-6 h-6 fill-current" /> Terminar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="absolute inset-0">
          <AIProcessing title="Armando tu video" subtitle={progress > 0 ? `${Math.round(progress * 100)}%` : 'Un momento…'} />
        </div>
      )}

      {(step === 'review' || step === 'result') && result && (
        <div className="absolute inset-0 flex items-center justify-center gap-[5vmin] p-[5vmin] portrait:flex-col">
          <motion.video
            key={result.url}
            src={result.url} autoPlay loop playsInline muted={!cfg?.mic}
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            className="relative max-h-[78vh] max-w-[min(55vw,100%)] portrait:max-w-[86vw] portrait:max-h-[48vh] rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-4 ring-white/20 bg-black"
          />
          {step === 'review' ? (
            <div className="relative flex flex-col items-center gap-6">
              <h2 className="carlmarx-bold text-[clamp(2.5rem,7vmin,5rem)] text-center">¿Te gusta?</h2>
              <button onClick={accept} className={primaryBtn} data-autofocus><Check className="w-8 h-8" /> ¡Me encanta!</button>
              <button onClick={retake} className={btn}><RotateCcw className="w-6 h-6" /> Repetir</button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-5 max-w-xl text-center">
              {qr.state === 'ready' && (
                <>
                  <h2 className="carlmarx-bold text-[clamp(2rem,5.5vmin,4rem)] leading-tight">Escaneá y llevátelo</h2>
                  <div className="flex flex-wrap justify-center gap-5">
                    {qr.video && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-white p-4 rounded-[1.5rem] shadow-2xl"><QRCodeSVG value={qr.video} size={qr.gallery ? 190 : 250} level="M" /></div>
                        {qr.gallery && <span className="text-lg font-bold">Tu video</span>}
                      </div>
                    )}
                    {qr.gallery && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-white p-4 rounded-[1.5rem] shadow-2xl"><QRCodeSVG value={qr.gallery} size={qr.video ? 190 : 250} level="M" /></div>
                        <span className="text-lg font-bold">Galería del evento</span>
                      </div>
                    )}
                  </div>
                  {qr.queued
                    ? <p className="text-amber-100 text-lg flex items-center gap-2"><CloudOff className="w-5 h-5 shrink-0" /> Sin internet: tu video aparece en la galería apenas vuelva la conexión.</p>
                    : <p className="text-white/70 text-lg">Bajalo o compartilo por WhatsApp e Instagram</p>}
                </>
              )}
              {qr.state === 'uploading' && (
                <>
                  <Loader2 className="w-20 h-20 animate-spin text-[#00d4ff]" />
                  <h2 className="carlmarx-bold text-[clamp(2rem,5vmin,3.5rem)]">Preparando tu QR…</h2>
                </>
              )}
              {qr.state === 'error' && (
                <>
                  <h2 className="carlmarx-bold text-[clamp(2rem,5vmin,3.5rem)]">¡Quedó guardado!</h2>
                  <p className="text-amber-200 text-lg">No se pudo generar el QR: {qr.message}</p>
                  <button onClick={() => void deliver(result)} className={btn}><RefreshCw className="w-6 h-6" /> Reintentar</button>
                </>
              )}
              {qr.state === 'off' && <h2 className="carlmarx-bold text-[clamp(2.5rem,6vmin,4.5rem)]">¡Quedó genial!</h2>}
              {whatsappOn && (waStatus.state === 'sent' || waStatus.state === 'queued' || waStatus.state === 'waiting') && !waOpen && (
                <p className="text-[#7dffb3] text-lg font-semibold">{waStatus.state === 'sent' ? '¡Listo! Te lo mandamos por WhatsApp' : 'Te llega por WhatsApp apenas se suba'}</p>
              )}
              <div className="flex flex-wrap justify-center gap-4">
                {whatsappOn && (
                  <button onClick={openWhatsApp} className="rounded-full px-8 py-4 text-xl font-bold flex items-center gap-3 bg-[#25D366] text-[#05300f] hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] transition-transform focus:scale-105">
                    <MessageCircle className="w-7 h-7" /> Enviar por WhatsApp
                  </button>
                )}
                <button onClick={reset} className={primaryBtn} data-autofocus={qr.state !== 'error' ? true : undefined}><Check className="w-8 h-8" /> Listo</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-10 text-center">
          <h2 className="relative carlmarx-bold text-5xl">Algo falló</h2>
          <p className="relative text-xl text-white/80 max-w-3xl">{error}</p>
          <button onClick={goSplash} className={`relative ${primaryBtn}`} data-autofocus><RotateCcw className="w-7 h-7" /> Volver al inicio</button>
        </div>
      )}

      {waOpen && step === 'result' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="kiosk-glass rounded-[2.5rem] p-8 w-[min(30rem,94vw)] flex flex-col items-center gap-5 text-center">
            <h2 className="text-3xl font-black flex items-center gap-3"><MessageCircle className="w-8 h-8 text-[#25D366]" /> Tu WhatsApp</h2>
            <p className="text-white/70">Código de área sin el 0 y número sin el 15</p>
            <div className="w-full rounded-2xl bg-black/40 border border-white/20 px-5 py-4 text-3xl font-mono tracking-wider tabular-nums min-h-[4.5rem] flex items-center justify-center gap-2">
              <span className="text-white/50">+{waPrefix}</span>
              <span>{waNumber || <span className="text-white/30">11 2345 6789</span>}</span>
            </div>
            {waStatus.state === 'idle' || waStatus.state === 'error' ? (
              <>
                <div className="grid grid-cols-3 gap-3 w-full">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d, i) => (
                    <button key={d} onClick={() => setWaNumber(n => (n + d).slice(0, 13))} data-autofocus={i === 0 ? true : undefined}
                      className="h-16 rounded-2xl bg-white/10 text-3xl font-bold hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">{d}</button>
                  ))}
                  <button onClick={() => setWaNumber(n => n.slice(0, -1))} className="h-16 rounded-2xl bg-white/10 text-xl font-bold hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">Borrar</button>
                  <button onClick={() => setWaNumber(n => (n + '0').slice(0, 13))} className="h-16 rounded-2xl bg-white/10 text-3xl font-bold hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">0</button>
                  <button onClick={() => void submitWhatsApp()} disabled={waNumber.length < 6}
                    className="h-16 rounded-2xl bg-[#25D366] text-[#05300f] text-xl font-black disabled:opacity-40 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">Enviar</button>
                </div>
                {waStatus.state === 'error' && <p className="text-amber-200">{waStatus.message}</p>}
                <p className="text-white/45 text-sm">Usamos tu número solo para mandarte el video.</p>
                <button onClick={() => setWaOpen(false)} className={btn}><ArrowLeft className="w-6 h-6" /> Cancelar</button>
              </>
            ) : waStatus.state === 'sending' ? (
              <Loader2 className="w-16 h-16 animate-spin text-[#25D366]" />
            ) : (
              <>
                <Check className="w-16 h-16 text-[#25D366]" />
                <p className="text-2xl font-bold">{waStatus.state === 'sent' ? '¡Enviado! Revisá tu WhatsApp' : waStatus.state === 'waiting' ? 'Te lo mandamos apenas termine de subirse' : 'Sin internet: te llega apenas vuelva la conexión'}</p>
              </>
            )}
          </div>
        </div>
      )}

      {pinOpen && <PinDialog onCancel={() => setPinOpen(false)} onSuccess={() => navigate('/ajustes')} />}
      {unlockOpen && (
        <PinDialog
          title="Clave para desbloquear"
          onCancel={() => setUnlockOpen(false)}
          onSuccess={() => {
            writeLock(null);
            setLockKey(null);
            setUnlockOpen(false);
            toast.success('Desbloqueada: ya se puede cambiar de experiencia');
          }}
        />
      )}
    </div>
  );
}

/** Fila de opciones de la pantalla de la toma (se recorre con el control remoto). */
function FxRow({ title, value, options, onPick }: { title: string; value: string; options: { value: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-white/60 text-sm font-bold uppercase tracking-[0.2em]">{title}</p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {options.map(o => (
          <button key={o.value} onClick={() => onPick(o.value)}
            className={`shrink-0 rounded-full px-5 py-3 text-lg font-bold whitespace-nowrap focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${value === o.value ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10 hover:bg-white/20'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
