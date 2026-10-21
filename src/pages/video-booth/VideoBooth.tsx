import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, BookHeart, Check, Gem, Home, Loader2, RefreshCw, Repeat, Rotate3d, RotateCcw, Settings, Snail, Square, Video,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { AIProcessing, CountdownRing } from '@/components/kiosk/KioskAnimations';
import PinDialog from '@/components/kiosk/PinDialog';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { openCameraStream, stopStream } from '@/lib/kioskCamera';
import { getScreenMedia } from '@/lib/kioskMedia';
import { getCameraSettings, getGeneralSettings } from '@/lib/kioskSettings';
import { guestVideoUrl } from '@/lib/kioskShare';
import { useShutter } from '@/lib/kioskShutter';
import { isDriveConfigured } from '@/lib/driveBackup';
import { Compositor, loadOverlayImage, titleOverlay } from '@/lib/videoBooth/compositor';
import { bufferSecondsFor, effectPlan, renderEffects } from '@/lib/videoBooth/effects';
import { audioContext, bitrateFor, ClipRecorder, decodeMusic, extensionFor, mixAudio, openMic, type AudioMix } from '@/lib/videoBooth/recorder';
import {
  DEFAULT_PROMPTS, enabledModes, getVideoSettings, modeConfig, outputSize,
  type VideoModeDef, type VideoModeKey,
} from '@/lib/videoBooth/settings';
import { saveVideoLocally, uploadVideoForShare, videoFileName } from '@/lib/videoBooth/storage';

// Cabina de video: el invitado elige la experiencia (video, boomerang, cámara lenta,
// 360, libro de firmas, glam), se graba con cuenta regresiva y se lleva el video
// con un QR. Mismo equipo, cámara, disparador Bluetooth y Drive que el kiosco de fotos.

type Step = 'splash' | 'modes' | 'prompt' | 'live' | 'countdown' | 'recording' | 'processing' | 'review' | 'result' | 'error';

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

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Result { blob: Blob; url: string; name: string }
type Qr = { state: 'off' } | { state: 'uploading' } | { state: 'done'; url: string } | { state: 'error'; message: string };

export default function VideoBooth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromHome = params.get('home') === '1';
  const [settings, setSettings] = useState(getVideoSettings);
  const general = useMemo(() => getGeneralSettings(), []);
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

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const musicRef = useRef<AudioBuffer | null>(null);
  const overlayRef = useRef<CanvasImageSource | null>(null);
  const recorderRef = useRef<ClipRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const mixRef = useRef<AudioMix | null>(null);
  const tickRef = useRef(0);
  const recStartRef = useRef(0);
  const finishingRef = useRef(false);
  const resultRef = useRef<Result | null>(null);
  useEffect(() => { resultRef.current = result; }, [result]);

  useEffect(() => {
    const reload = () => setSettings(getVideoSettings());
    window.addEventListener('video-settings-changed', reload);
    return () => window.removeEventListener('video-settings-changed', reload);
  }, []);

  useRemoteFocus(rootRef, [step, qr.state], !pinOpen);

  // ─── Cámara ──────────────────────────────────────────────────────
  const closeCamera = useCallback(() => {
    compositorRef.current?.stop();
    compositorRef.current?.clearBuffer();
    compositorRef.current?.canvas.remove();
    compositorRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    stopStream(micRef.current);
    micRef.current = null;
    setCameraReady(false);
  }, []);

  const openCamera = useCallback(async (m: VideoModeDef) => {
    const cam = getCameraSettings();
    const cfg = modeConfig(m.key, settings);
    const wantsFps = m.effect !== 'none' && settings.highFps !== false ? 60 : 30;
    const stream = await openCameraStream(cam.deviceId, cam.quality ?? 'auto', {
      fps: wantsFps,
      facingMode: cam.deviceId ? undefined : settings.facing,
    });
    streamRef.current = stream;
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play().catch(() => {});
    const comp = new Compositor(video, {
      width: size.width, height: size.height,
      mirror: !!cam.mirror, rotation: Number(cam.rotation) || 0,
      filter: cfg.filter, overlay: overlayRef.current,
    });
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

  // Si el canvas de la vista previa se desmontó (cambio de pantalla), se vuelve a poner
  useEffect(() => {
    const comp = compositorRef.current;
    if (comp && previewRef.current && comp.canvas.parentElement !== previewRef.current) previewRef.current.replaceChildren(comp.canvas);
  });

  useEffect(() => () => {
    window.clearInterval(tickRef.current);
    mixRef.current?.stop();
    closeCamera();
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
  }, [closeCamera]);

  // ─── Flujo ───────────────────────────────────────────────────────
  const reset = useCallback(() => {
    window.clearInterval(tickRef.current);
    closeCamera();
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    setResult(null);
    setQr({ state: 'off' });
    setMode(null);
    setCount(null);
    setProgress(0);
    setError('');
    setStep('splash');
  }, [closeCamera]);

  const prepareMode = useCallback(async (m: VideoModeDef) => {
    const cfg = modeConfig(m.key, settings);
    // Marco y música se preparan antes de abrir la cámara
    overlayRef.current = null;
    if (settings.overlay === 'title') {
      overlayRef.current = titleOverlay(size.width, size.height, settings.overlayText || general.eventTitle || 'EventPix');
    } else if (settings.overlay === 'custom') {
      const rec = await getScreenMedia('video:overlay').catch(() => null);
      if (rec) overlayRef.current = await loadOverlayImage(rec.blob);
    }
    musicRef.current = null;
    if (cfg.music) {
      const rec = await getScreenMedia('video:music').catch(() => null);
      if (rec) musicRef.current = await decodeMusic(rec.blob).catch(() => null);
    }
  }, [settings, size, general.eventTitle]);

  const chooseMode = useCallback(async (m: VideoModeDef) => {
    audioContext(); // con el toque: Android deja usar el audio
    setMode(m);
    if (m.guestbook) {
      const list = (settings.prompts?.filter(p => p.trim()) ?? []);
      const pool = list.length ? list : DEFAULT_PROMPTS;
      setPrompt(pool[Math.floor(Math.random() * pool.length)]);
      setStep('prompt');
      void prepareMode(m);
      return;
    }
    setStep('live');
    try {
      await prepareMode(m);
      await openCamera(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }, [settings.prompts, prepareMode, openCamera]);

  const startFromPrompt = async () => {
    if (!mode) return;
    setStep('live');
    try {
      await prepareMode(mode);
      await openCamera(mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  };

  const start = useCallback(() => {
    audioContext();
    if (modes.length === 1) void chooseMode(modes[0]);
    else setStep('modes');
  }, [modes, chooseMode]);

  const finishRecording = useCallback(async () => {
    if (finishingRef.current || !mode) return;
    finishingRef.current = true;
    window.clearInterval(tickRef.current);
    const rec = recorderRef.current;
    const comp = compositorRef.current;
    const actual = Math.max(0.5, (performance.now() - recStartRef.current) / 1000);
    try {
      if (!rec || !comp) throw new Error('La grabación no arrancó');
      const raw = await rec.stop();
      mixRef.current?.stop();
      mixRef.current = null;
      recStreamRef.current?.getTracks().forEach(t => t.stop());
      const frames = await comp.takeBuffer();
      closeCamera();
      setProgress(0);
      setStep('processing');

      const cfg = modeConfig(mode.key, settings);
      const plan = effectPlan(mode.effect, actual, settings);
      let blob = raw;
      let mime = rec.mime;
      if (plan) {
        try {
          const out = await renderEffects({
            source: raw, frames, plan, width: size.width, height: size.height,
            music: cfg.music ? musicRef.current : null, musicVolume: settings.musicVolume,
            onProgress: setProgress,
          });
          blob = out.blob;
          mime = out.mime;
        } finally {
          frames.forEach(f => f.bitmap.close());
        }
      }
      if (!blob.size) throw new Error('El video salió vacío. Probá de nuevo.');
      const name = videoFileName(mode.key, extensionFor(mime || blob.type));
      const res = { blob, url: URL.createObjectURL(blob), name };
      setResult(res);
      // Respaldo en el equipo, siempre
      saveVideoLocally(blob, name).catch(e => {
        console.error('[video] no se pudo guardar', e);
        toast.error('No se pudo guardar el video en el equipo');
      });
      setStep(settings.review === false ? 'result' : 'review');
    } catch (e) {
      closeCamera();
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    } finally {
      recorderRef.current = null;
      finishingRef.current = false;
    }
  }, [mode, settings, size, closeCamera]);

  const startRecording = useCallback(() => {
    const comp = compositorRef.current;
    if (!comp || !mode) return;
    const cfg = modeConfig(mode.key, settings);
    const planned = cfg.seconds;
    const buffer = bufferSecondsFor(mode.effect, planned, settings);
    if (buffer) comp.startBuffer(buffer);
    const fps = Math.min(60, Math.round(streamRef.current?.getVideoTracks()[0]?.getSettings().frameRate || 30));
    const stream = comp.canvas.captureStream(fps);
    recStreamRef.current = stream;
    // Sin efectos, el audio (música y/o micrófono) se graba en vivo
    if (mode.effect === 'none') {
      const mix = mixAudio({ music: cfg.music ? musicRef.current : null, musicVolume: settings.musicVolume, duration: planned, mic: cfg.mic ? micRef.current : null });
      if (mix) { stream.addTrack(mix.track); mixRef.current = mix; }
    }
    // Con efectos este clip es intermedio: se graba con más calidad
    const rec = new ClipRecorder(stream, { bitrate: mode.effect === 'none' ? bitrateFor(size.width, size.height, planned) : 12_000_000 });
    rec.start();
    const startedAt = performance.now();
    recStartRef.current = startedAt;
    recorderRef.current = rec;
    setElapsed(0);
    setStep('recording');
    tickRef.current = window.setInterval(() => {
      const s = (performance.now() - startedAt) / 1000;
      setElapsed(s);
      if (s >= planned) void finishRecording();
    }, 100);
  }, [mode, settings, size, finishRecording]);

  const startCountdown = useCallback(() => {
    if (!cameraReady || step !== 'live') return;
    const total = Math.max(0, settings.countdown ?? 3);
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
  }, [cameraReady, step, settings.countdown, startRecording]);

  const uploadQr = useCallback(async (res: Result) => {
    if (settings.showQr === false || !isDriveConfigured() || general.offline) { setQr({ state: 'off' }); return; }
    if (!navigator.onLine) { setQr({ state: 'error', message: 'Sin internet' }); return; }
    setQr({ state: 'uploading' });
    try {
      const id = await uploadVideoForShare(res.blob, res.name);
      setQr({ state: 'done', url: guestVideoUrl(id, general.eventTitle || undefined) });
    } catch (e) {
      setQr({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [settings.showQr, general.offline, general.eventTitle]);

  const accept = useCallback(() => {
    const res = resultRef.current;
    if (!res) return;
    setStep('result');
    void uploadQr(res);
  }, [uploadQr]);

  // Sin revisión: el resultado sale directo (y se sube para el QR)
  useEffect(() => {
    if (step === 'result' && qr.state === 'off' && resultRef.current && settings.review === false) void uploadQr(resultRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const retake = useCallback(() => {
    if (!mode) return;
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    setResult(null);
    void chooseMode(mode);
  }, [mode, chooseMode]);

  // El resultado vuelve solo al inicio (no mientras se sube el video)
  useEffect(() => {
    if (step !== 'result' || qr.state === 'uploading') return;
    const t = window.setTimeout(reset, (settings.resultSeconds ?? 45) * 1000);
    return () => window.clearTimeout(t);
  }, [step, qr.state, settings.resultSeconds, reset]);
  // Revisión sin respuesta: se queda con el video
  useEffect(() => {
    if (step !== 'review') return;
    const t = window.setTimeout(accept, 25000);
    return () => window.clearTimeout(t);
  }, [step, accept]);

  // Disparador Bluetooth: avanza en cada pantalla
  useShutter(() => {
    if (step === 'splash') start();
    else if (step === 'prompt') void startFromPrompt();
    else if (step === 'live') startCountdown();
    else if (step === 'recording' && mode?.canStop) void finishRecording();
    else if (step === 'review') accept();
    else if (step === 'result') reset();
  }, !pinOpen);

  // ─── Pantallas ───────────────────────────────────────────────────
  const cameraLayer = (
    <>
      <div className="absolute inset-0 bg-black" />
      {/* El video de la cámara queda debajo: el canvas (lo que se graba) lo tapa */}
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
      <div ref={previewRef} className="absolute inset-0" />
    </>
  );
  const cameraSteps: Step[] = ['live', 'countdown', 'recording'];
  const showCamera = cameraSteps.includes(step);
  const cfg = mode ? modeConfig(mode.key, settings) : null;
  // Controles: abajo con la pantalla vertical; al costado con la horizontal (no tapan el marco)
  const side = 'absolute bottom-[6vmin] inset-x-0 landscape:inset-x-auto landscape:bottom-auto landscape:top-1/2 landscape:-translate-y-1/2 landscape:right-[4vmin]';

  return (
    <div ref={rootRef} className="kiosk-root relative min-h-screen h-screen overflow-hidden text-white bg-[#07051a]">
      {/* La cámara se monta siempre (para no perder el video entre pantallas) */}
      <div className={showCamera ? 'absolute inset-0' : 'hidden'}>{cameraLayer}</div>

      {step === 'splash' && (
        <div className="absolute inset-0">
          <AuroraBackground />
          <button onClick={start} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-10 focus:outline-none" data-autofocus>
            <EventPixLogo size={64} subtitle="Cabina de video" />
            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              className="carlmarx-bold text-center text-[clamp(3rem,9vmin,7.5rem)] leading-tight px-8"
            >
              {settings.title || general.eventTitle || '¡Grabá tu video!'}
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
            {fromHome && <button onClick={() => navigate('/box')} className={btn} aria-label="Inicio"><Home className="w-6 h-6" /></button>}
            <button onClick={() => setPinOpen(true)} className={btn} aria-label="Ajustes"><Settings className="w-6 h-6" /></button>
          </div>
        </div>
      )}

      {step === 'modes' && (
        <div className="absolute inset-0 flex flex-col">
          <AuroraBackground />
          <header className="relative flex items-center justify-between px-[5vmin] pt-[4vmin]">
            <button onClick={reset} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
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
                    onClick={() => void chooseMode(m)}
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

      {step === 'prompt' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-[6vmin] text-center">
          <AuroraBackground />
          <BookHeart className="relative w-24 h-24 text-[#ff8a5b]" strokeWidth={1.4} />
          <p className="relative text-white/70 text-2xl uppercase tracking-[0.3em]">Libro de firmas</p>
          <motion.h2 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative carlmarx-bold text-[clamp(2.2rem,7vmin,5.5rem)] leading-tight max-w-5xl">
            {prompt}
          </motion.h2>
          <p className="relative text-white/70 text-2xl">Tenés hasta {fmt(cfg?.seconds ?? 30)} para tu mensaje. Podés terminar antes.</p>
          <div className="relative flex gap-5">
            <button onClick={reset} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
            <button onClick={() => void startFromPrompt()} className={primaryBtn} data-autofocus><Video className="w-8 h-8" /> Grabar mensaje</button>
          </div>
        </div>
      )}

      {showCamera && mode && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Arriba: experiencia y, en el libro de firmas, la pregunta */}
          <div className="absolute top-6 inset-x-0 flex flex-col items-center gap-3 px-6">
            <span className="kiosk-glass rounded-full px-7 py-3 text-2xl font-black">{mode.label}</span>
            {mode.guestbook && prompt && <p className="kiosk-glass rounded-3xl px-8 py-4 text-2xl font-semibold text-center max-w-4xl">{prompt}</p>}
          </div>

          {step === 'live' && (
            <div className={`${side} flex flex-col items-center gap-5 pointer-events-auto`}>
              {mode.key === '360' && <p className="kiosk-glass rounded-2xl px-6 py-3 text-xl max-w-xs text-center">Subite a la plataforma. Cuando estés listo, ¡a grabar!</p>}
              <div className="flex items-center gap-5 landscape:flex-col-reverse">
                <button onClick={reset} className={btn}><ArrowLeft className="w-6 h-6" /> Volver</button>
                <button onClick={startCountdown} disabled={!cameraReady} className={`${primaryBtn} disabled:opacity-50`} data-autofocus>
                  {cameraReady ? <span className="w-7 h-7 rounded-full bg-red-500 ring-4 ring-white" /> : <Loader2 className="w-7 h-7 animate-spin" />}
                  {cameraReady ? 'Grabar' : 'Abriendo cámara…'}
                </button>
              </div>
            </div>
          )}

          {step === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <CountdownRing value={count} total={settings.countdown ?? 3} />
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
          <AuroraBackground />
          <AIProcessing title="Armando tu video" subtitle={progress > 0 ? `${Math.round(progress * 100)}%` : 'Un momento…'} />
        </div>
      )}

      {(step === 'review' || step === 'result') && result && (
        <div className="absolute inset-0 flex items-center justify-center gap-[5vmin] p-[5vmin] portrait:flex-col">
          <AuroraBackground />
          <motion.video
            key={result.url}
            src={result.url} autoPlay loop playsInline muted={!cfg?.mic}
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            className="relative max-h-[78vh] max-w-[min(60vw,100%)] portrait:max-w-[86vw] portrait:max-h-[52vh] rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-4 ring-white/20 bg-black"
          />
          {step === 'review' ? (
            <div className="relative flex flex-col items-center gap-6">
              <h2 className="carlmarx-bold text-[clamp(2.5rem,7vmin,5rem)] text-center">¿Te gusta?</h2>
              <button onClick={accept} className={primaryBtn} data-autofocus><Check className="w-8 h-8" /> ¡Me encanta!</button>
              <button onClick={retake} className={btn}><RotateCcw className="w-6 h-6" /> Repetir</button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-6 max-w-md text-center">
              {qr.state === 'done' && (
                <>
                  <h2 className="carlmarx-bold text-[clamp(2rem,5.5vmin,4rem)] leading-tight">Escaneá y llevátelo</h2>
                  <div className="bg-white p-5 rounded-[2rem] shadow-2xl">
                    <QRCodeSVG value={qr.url} size={260} level="M" />
                  </div>
                  <p className="text-white/70 text-lg">Bajalo o compartilo por WhatsApp e Instagram</p>
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
                  <button onClick={() => void uploadQr(result)} className={btn}><RefreshCw className="w-6 h-6" /> Reintentar</button>
                </>
              )}
              {qr.state === 'off' && <h2 className="carlmarx-bold text-[clamp(2.5rem,6vmin,4.5rem)]">¡Quedó genial!</h2>}
              <button onClick={reset} className={primaryBtn} data-autofocus={qr.state !== 'error' ? true : undefined}><Check className="w-8 h-8" /> Listo</button>
            </div>
          )}
        </div>
      )}

      {step === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-10 text-center">
          <AuroraBackground />
          <h2 className="relative carlmarx-bold text-5xl">Algo falló</h2>
          <p className="relative text-xl text-white/80 max-w-3xl">{error}</p>
          <button onClick={reset} className={`relative ${primaryBtn}`} data-autofocus><RotateCcw className="w-7 h-7" /> Volver al inicio</button>
        </div>
      )}

      {pinOpen && <PinDialog onCancel={() => setPinOpen(false)} onSuccess={() => navigate('/video/ajustes')} />}
    </div>
  );
}
