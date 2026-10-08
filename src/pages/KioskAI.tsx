import { useState, useRef, useEffect, useCallback } from 'react'; // Kiosk AI Optimized Flow
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, Users, Sparkles, QrCode, Loader2, Images, Crown, Instagram, Palette, Sticker, Home, Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { printKioskPhoto } from '@/lib/kioskPrint';
import { StickerEditor } from '@/components/stickers/StickerEditor';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { openCameraStream, stopStream } from '@/lib/kioskCamera';
import { getFrameUrl, getSectionLock, setSectionLock } from '@/lib/kioskSettings';
import PinDialog from '@/components/kiosk/PinDialog';
import { backupPhoto, type SavedPhoto } from '@/lib/kioskStorage';
import { composePhotos, type PageOrientation } from '@/lib/photoLayout';
import { coverOptionsFrom, renderMagazineCover } from '@/lib/magazineCover';
import { applyFx, COLOR_FILTERS, type FxChoice } from '@/lib/faceFx';
import AttractScreen from '@/components/kiosk/AttractScreen';
import FrameChooser from '@/components/kiosk/FrameChooser';
import NextShot from '@/components/kiosk/NextShot';
import CameraVideo from '@/components/kiosk/CameraVideo';
import FilterCarousel from '@/components/kiosk/FilterCarousel';
import GuestNameScreen from '@/components/kiosk/GuestNameScreen';
import { isDriveConfigured, queueForDrive, startDriveSync, uploadForShare } from '@/lib/driveBackup';
import { guestPhotoUrl } from '@/lib/kioskShare';
import { getCachedDeviceState, getDeviceCode, getDeviceSecret, startDeviceSync } from '@/lib/kioskDevice';
import { REMOTE_APPLIED_EVENT } from '@/lib/kioskRemote';
import { guestFrameOptions, type FrameOption } from '@/lib/frameOptions';
import { motion } from 'framer-motion';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import WaitingGames from '@/components/kiosk/WaitingGames';
import { useShutter } from '@/lib/kioskShutter';
import { useCoverPreview } from '@/hooks/use-cover-preview';
import { getPageBackground, getScreenBackground } from '@/lib/kioskMedia';
import { AIProcessing, CameraFlash, CountdownRing } from '@/components/kiosk/KioskAnimations';
import { revealPhoto, useConfettiBurst } from '@/components/kiosk/kioskEffects';

// ---- Types ----
type Step =
  | 'photoGame'
  | 'splash'
  | 'modeSelect'
  | 'getReady'
  | 'lookCamera'
  | 'countdown'
  | 'nextShot'
  | 'guestName'
  | 'photoPreview'
  | 'frameSelect'
  | 'flashResult'
  | 'themeSelect'
  | 'mundialCountry'
  | 'processing'
  | 'stickerEditor'
  | 'result';

type Mode = 'selfie' | 'portada' | 'portadaIA' | 'retrato' | 'caricatura' | 'figuritas' | null;

// Portada Fashion con IA: si la temática 'cover' no está en la base, se usa este prompt
const PORTADA_IA_PROMPT = 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them for a high fashion magazine shoot: sophisticated designer outfits, styled hair, subtle glam makeup. Replace the background with a clean seamless studio backdrop in a soft neutral tone, professional beauty lighting, framed from the waist up with empty space above the heads. Relight the people to match the new scene (same light direction, color and warmth) and use a shallow depth of field with a softly blurred background, so the result looks like one real professional photo taken there, not a collage. Photorealistic, high detail. No text, no logos, no watermark.';

// ---- Figurita Mundial 2026: países con figurita diseñada ----
const FIGURITAS_COUNTRIES = [
  { id: 'argentina', name: 'Argentina', flag: '/flags/argentina.png' },
  { id: 'canada', name: 'Canadá', flag: '🇨🇦' },
  { id: 'corea del sur', name: 'Corea del Sur', flag: '/flags/corea.png' },
  { id: 'estados unidos', name: 'Estados Unidos', flag: '/flags/estados-unidos.png' },
  { id: 'mexico', name: 'México', flag: '/flags/mexico.png' },
  { id: 'sudafrica', name: 'Sudáfrica', flag: '🇿🇦' },
  { id: 'otros', name: 'Otros', flag: '🌍' }
];

// ---- Funny phrases for Selfie Grupal ----
const SELFIE_PHRASES = [
  "¡CHE, alguien pidió una foto tan fachera? ¡Porque acá ESTÁ!",
  "¡BOOM! Eso sí es una foto de campeonas y campeones.",
  "¡Ojo, que esta foto va a hacer historia!",
  "¡Sonrieron como si supieran que iban a quedar perfectos... y tenían razón!",
  "¡Esto no es una foto, esto es una OBRA DE ARTE!",
  "¡Paren todo! La mejor foto del evento acaba de tomarse.",
  "¿Estuvieron bebiendo? ¡Porque esas caras lo dicen todo! 🍻",
  "¡Esta foto está para el Instagram!",
  "¡Ni el fotógrafo profesional la sacaba tan bien!",
  "¡Esta va directo al cuadro del living!",
  "¡Atención! Nivel de facha: peligrosamente alto.",
  "¡Qué grupo! Esta foto ya es leyenda.",
];

// Pantalla "¡Boom! Estamos procesando tu foto": cuánto dura antes de mostrar la foto
const FLASH_RESULT_MS = 5000;

// ---- Corner decoration ----
const Corners = () => (
  <>
    <div className="absolute top-0 left-0 w-40 h-40 pointer-events-none" style={{
      background: 'linear-gradient(135deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(0 0, 100% 0, 0 100%)',
      opacity: 0.9
    }} />
    <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{
      background: 'linear-gradient(225deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
      opacity: 0.9
    }} />
    <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none" style={{
      background: 'linear-gradient(45deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
      opacity: 0.7
    }} />
    <div className="absolute bottom-0 right-0 w-32 h-32 pointer-events-none" style={{
      background: 'linear-gradient(315deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
      opacity: 0.7
    }} />
  </>
);

export default function KioskAI() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const kioskEventId = searchParams.get('event');
  // Desde la app de la TV box: ?modes=selfie (Fotos) o ?modes=ai (Fotos IA), y ?home=1
  // muestra el botón para volver al inicio de la app
  const modesParam = searchParams.get('modes');
  const showHomeButton = searchParams.get('home') === '1';
  // "Fotos" = selfie y Portada Fashion (sin IA); "Fotos IA" = el resto
  const isPhotoMode = (m: Exclude<Mode, null>) => m === 'selfie' || m === 'portada';
  const isModeAllowed = (m: Exclude<Mode, null>) => {
    if (offlineMode && !isPhotoMode(m)) return false; // las experiencias IA necesitan internet
    return modesParam === 'selfie' ? isPhotoMode(m) : modesParam === 'ai' ? !isPhotoMode(m) : true;
  };

  const [step, setStep] = useState<Step>('splash');
  const [mode, setMode] = useState<Mode>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const capturedImageState = capturedImage;
  const [lastPublicUrl, setLastPublicUrl] = useState<string | null>(null);
  const [resultPhrase, setResultPhrase] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  // Foto IA lista mientras el invitado juega: se muestra al terminar el aviso de los juegos
  const [aiReadyStep, setAiReadyStep] = useState<Step | null>(null);
  // País de la Figurita Mundial 2026
  const [mundialCountry, setMundialCountry] = useState<any>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [themes, setThemes] = useState<any[]>([]);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  // Marcos para que elija el invitado (se fijan al entrar a la pantalla)
  const [frameChoices, setFrameChoices] = useState<FrameOption[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedAITheme, setSelectedAITheme] = useState<any>(null);



  // Control remoto de la TV box: las flechas recorren los botones de cada pantalla
  const bodyRef = useRef<HTMLElement>(document.body);
  const splashEnterRef = useRef(false);
  // Candado: bloquea esta sección (no se puede volver al inicio); se abre con la clave
  const [locked, setLocked] = useState(() => !!getSectionLock());
  const [unlockOpen, setUnlockOpen] = useState(false);
  // Toma original de la cámara, para respaldarla junto a la foto final
  const originalShotRef = useRef<string | null>(null);
  useRemoteFocus(bodyRef, [step], !unlockOpen);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cameraSettings = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_camera_settings') || '{}'); }
    catch { return {}; }
  })();

  const printerSettings = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); }
    catch { return {}; }
  })();

  const generalSettings = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_general_settings') || '{}'); }
    catch { return {}; }
  })();
  // Sin conexión: solo foto, marco, impresión y respaldo en el equipo (sin IA, QR ni subidas)
  const offlineMode = !!generalSettings.offline;

  // Fullscreen effect fallback
  useEffect(() => {
    if (generalSettings.autoFullscreen) {
      const enterFS = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      // We still keep the window listener as a backup, but the primary one is now the splash tap
      window.addEventListener('click', enterFS, { once: true });
    }
  }, []);

  // Auto-print effect
  useEffect(() => {
    if (step === 'result' && capturedImage && printerSettings.autoPrint) {
      triggerPrint(capturedImage);
    }
  }, [step]);

  // Checkin cada minuto (el panel lo ve en línea) y cambios mandados desde el panel:
  // los ajustes se leen en cada render, así que alcanza con volver a dibujar
  const [, setRemoteTick] = useState(0);
  useEffect(() => {
    const stop = startDeviceSync();
    const onApplied = () => setRemoteTick(t => t + 1);
    window.addEventListener(REMOTE_APPLIED_EVENT, onApplied);
    return () => {
      stop();
      window.removeEventListener(REMOTE_APPLIED_EVENT, onApplied);
    };
  }, []);

  // Load themes + frame
  useEffect(() => {
    // El marco es solo el elegido en Ajustes del equipo (sin elegir = sin marco).
    // Antes, sin elección, se usaba un kiosk_frame.png viejo de Supabase que no se veía en Ajustes.
    const loadFrame = () => setFrameUrl(getFrameUrl());

    loadFrame();
    window.addEventListener('kiosk-frame-changed', loadFrame);
    window.addEventListener('storage', (e) => {
      if (e.key === 'kiosk_frame_url') loadFrame();
    });

    (async () => {
      // Orden elegido en el panel (sort_order); bases viejas sin esa columna: por fecha
      let { data, error } = await supabase.from('ai_themes').select('*')
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (error) ({ data } = await supabase.from('ai_themes').select('*').order('created_at', { ascending: false }));
      if (data) setThemes(data);
    })();

    return () => {
      window.removeEventListener('kiosk-frame-changed', loadFrame);
    };
  }, []);

  // Camera management
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await openCameraStream(cameraSettings.deviceId);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load before playing to avoid AbortError
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.warn("Auto-play was prevented:", err);
          });
        };
      }
      setCameraReady(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : String(err));
    }
  };

  const stopCamera = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setCameraReady(false);
  };

  // La cámara queda prendida entre "Mirá a la cámara" y la cuenta regresiva
  const cameraActive = step === 'lookCamera' || step === 'countdown' || step === 'nextShot';
  useEffect(() => {
    if (cameraActive) startCamera();
    else stopCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive]);

  // El video se monta de nuevo en cada pantalla: se le vuelve a conectar la cámara
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step, cameraActive]);

  // "Mirá a la cámara" pasa a la cuenta regresiva recién cuando la cámara anda
  useEffect(() => {
    if (step === 'lookCamera' && cameraReady) {
      // Toma nueva (o "Repetir"): se descartan las fotos anteriores
      shotsRef.current = [];
      rawShotsRef.current = [];
      setShotCount(0);
      // Con efectos, el invitado los prueba en vivo y toca "¡Sacar foto!"; con el
      // disparador Bluetooth se espera el botón (o un toque)
      const auto = autoShootRef.current && !fxEnabled;
      autoShootRef.current = false;
      if ((fxEnabled || shutterMode) && !auto) return;
      const t = setTimeout(() => startCountdown(), auto ? 1200 : 2500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cameraReady]);

  useConfettiBurst(step === 'result');
  useEffect(() => { startDriveSync(); }, []);

  // Vuelve solo al inicio si nadie toca nada mientras ve su foto o la pantalla de
  // imprimir (Ajustes → Resultado y tiempos; 30 s si no se configuró)
  const resultTimeout = generalSettings.resultTimeout === undefined ? 30 : Number(generalSettings.resultTimeout) || 0;
  useEffect(() => {
    const photoSteps: Step[] = ['photoPreview', 'frameSelect', 'flashResult', 'result'];
    if (resultTimeout <= 0 || !photoSteps.includes(step)) return;
    let t = setTimeout(() => resetKiosk(), resultTimeout * 1000);
    const restart = () => {
      clearTimeout(t);
      t = setTimeout(() => resetKiosk(), resultTimeout * 1000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, restart));
    return () => {
      clearTimeout(t);
      events.forEach(e => window.removeEventListener(e, restart));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, resultTimeout]);

  // Sin actividad en las pantallas de elección, vuelve al inicio
  const idleTimeout = Number(generalSettings.idleTimeout) || 0;
  useEffect(() => {
    const idleSteps: Step[] = ['modeSelect', 'themeSelect', 'mundialCountry', 'lookCamera'];
    if (idleTimeout <= 0 || !idleSteps.includes(step)) return;
    let t = setTimeout(() => resetKiosk(), idleTimeout * 1000);
    const restart = () => {
      clearTimeout(t);
      t = setTimeout(() => resetKiosk(), idleTimeout * 1000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, restart));
    return () => {
      clearTimeout(t);
      events.forEach(e => window.removeEventListener(e, restart));
    };
  }, [step, idleTimeout]);

  // Go to mode after splash
  // Desde la bienvenida con un solo modo, la cuenta regresiva arranca sin otro toque
  const autoShootRef = useRef(false);
  const [autoShoot, setAutoShoot] = useState(false);
  const handleSplashTap = () => {
    if (generalSettings.autoFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    // Con un solo modo posible (p. ej. "Fotos" = selfie) se saltea la elección
    if (modesParam === 'selfie' && generalSettings.enablePortada !== true) {
      // Un solo paso: la cámara arranca la cuenta regresiva sola
      autoShootRef.current = true;
      setAutoShoot(true);
      handleModeSelect('selfie');
      return;
    }
    setStep('modeSelect');
  };

  const toggleLock = () => {
    if (locked) {
      setUnlockOpen(true);
      return;
    }
    setSectionLock(modesParam || 'all');
    setLocked(true);
    toast.success('Sección bloqueada. Para salir tocá el candado y poné la clave.');
  };

  const unlockDialog = unlockOpen && (
    <PinDialog
      title="Clave para desbloquear"
      onCancel={() => setUnlockOpen(false)}
      onSuccess={() => {
        setSectionLock(null);
        setLocked(false);
        setUnlockOpen(false);
      }}
    />
  );

  const homeButton = showHomeButton && (
    <div className="absolute top-6 left-6 z-30 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
      {!locked && (
        <button
          onClick={() => navigate('/box')}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-black/50 border border-white/20 text-white/80 hover:text-white hover:bg-black/70 focus:outline-none focus:ring-4 focus:ring-white/70"
        >
          <Home className="w-5 h-5" /> Inicio
        </button>
      )}
      <button
        onClick={toggleLock}
        aria-label={locked ? 'Desbloquear sección' : 'Bloquear sección'}
        className={`w-12 h-12 rounded-full flex items-center justify-center border focus:outline-none focus:ring-4 focus:ring-white/70 ${locked ? 'bg-black/30 border-white/10 text-white/40' : 'bg-black/50 border-white/20 text-white/80 hover:text-white'}`}
      >
        {locked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
      </button>
      {unlockDialog}
    </div>
  );


  const handleModeSelect = (m: Mode) => {
    setMode(m);
    setFx({});
    if (m === 'figuritas') {
      setStep('mundialCountry');
    } else {
      setStep('getReady');
      setTimeout(() => setStep('lookCamera'), 2500);
    }
  };
  
  const handleThemeConfirm = () => {
    if (selectedAITheme && capturedImage) {
      if (generalSettings.autoFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      runAI(capturedImage, selectedAITheme);
    }
  };

  // Countdown + capture
  const countdownTimerRef = useRef<number | null>(null);
  const startCountdown = () => {
    setAutoShoot(false);
    setStep('countdown');
    const timer = cameraSettings.timer || 5;
    // La foto se saca fuera del actualizador de estado: React puede ejecutarlo dos veces
    let left = timer;
    setCountdown(left);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(left);
      }
    }, 1000);
  };

  // Filtro de color y accesorio que elige el invitado después de la foto (Fotos y Portada)
  // Se elige en vivo antes de sacar la foto; la foto sale con el efecto aplicado
  const [fx, setFx] = useState<FxChoice>({});
  const fxRef = useRef<FxChoice>({});
  useEffect(() => { fxRef.current = fx; }, [fx]);
  const isFxActive = (c: FxChoice) => (!!c.filter && c.filter !== 'none') || (!!c.accessory && c.accessory !== 'none');
  // Efectos en vivo: solo filtros de color (los accesorios que siguen la cara no se usan)
  const fxEnabled = (mode === 'selfie' || mode === 'portada') && !!generalSettings.enableFilters;
  // Tarjetas de Portada Fashion: la tapa armada con los textos de portada cargados (como sale de verdad);
  // la de IA usa la muestra del panel (Temáticas IA) si hay una
  const coverCardOptions = coverOptionsFrom(generalSettings);
  const portadaCard = useCoverPreview('/modes/portada-foto.jpg', coverCardOptions);
  const portadaIACard = useCoverPreview(themes.find((t: any) => t.result_style === 'cover')?.preview_url || '/modes/portada-ia-foto.jpg', coverCardOptions);

  // Disparador Bluetooth: en "Mirá a la cámara" la foto arranca con el botón (o tocando la pantalla)
  const shutterMode = !!generalSettings.bluetoothShutter;
  useShutter(() => { if (cameraReady) startCountdown(); }, step === 'lookCamera' && (shutterMode || fxEnabled));
  // En la bienvenida el disparador hace lo mismo que tocar la pantalla
  useShutter(() => handleSplashTap(), step === 'splash' && shutterMode);
  // Tomas sin efecto, para el respaldo de originales
  const rawShotsRef = useRef<string[]>([]);

  // Varias fotos por toma (solo Fotos/selfie): Ajustes → Experiencias y marco → Diseño de la foto
  const shotsRef = useRef<string[]>([]);
  const [shotCount, setShotCount] = useState(0);
  const shotsWanted = () => (mode === 'selfie' ? Math.min(4, Math.max(1, Number(generalSettings.photoShots) || 1)) : 1);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const rot = ((Number(cameraSettings.rotation) || 0) % 360 + 360) % 360;
    // Con la cámara girada 90°/270° la foto queda vertical: se intercambian ancho y alto
    const sideways = rot === 90 || rot === 270;
    canvas.width = sideways ? vh : vw;
    canvas.height = sideways ? vw : vh;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (cameraSettings.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);

    // Play shutter sound
    try { new Audio('/kiosk-camera-sound.mp3').play(); } catch { /* sin sonido */ }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    rawShotsRef.current = [...rawShotsRef.current, dataUrl];
    shotsRef.current = [...shotsRef.current, dataUrl];
    setShotCount(shotsRef.current.length);
    if (shotsRef.current.length < shotsWanted()) {
      // Falta otra: pausa para prepararse (Ajustes → Diseño de la foto) y otra cuenta regresiva
      setTimeout(() => setStep('nextShot'), 700);
      return;
    }
    originalShotRef.current = dataUrl;
    const chosen = fxRef.current;
    if (fxEnabled && isFxActive(chosen)) {
      // Efecto elegido en vivo: se aplica a resolución completa a todas las tomas
      setStep('processing');
      Promise.all(shotsRef.current.map(src => applyFx(src, chosen)))
        .then(done => { shotsRef.current = done; })
        .catch(e => console.error('No se pudo aplicar el efecto', e))
        .finally(() => {
          setCapturedImage(shotsRef.current[0]);
          setStep('photoPreview');
        });
      return;
    }
    setCapturedImage(shotsRef.current[0]);
    // Always go to preview first — user can approve or retake
    setStep('photoPreview');
  };

  const savePhotoToAlbum = async (dataUrl: string): Promise<string | null> => {
    // Respaldo en el equipo (original + final), siempre: con o sin evento e internet
    let saved: SavedPhoto[] = [];
    try {
      saved = await backupPhoto(dataUrl, rawShotsRef.current.length ? rawShotsRef.current : originalShotRef.current, mode || 'foto');
    } catch (e) {
      console.error('No se pudo guardar la foto en el equipo', e);
      toast.error('No se pudo guardar la foto en el equipo');
    }
    lastSavedRef.current = saved;
    const url = await uploadForQr(dataUrl, saved);
    queueForDrive(saved); // el resto (originales, o la final si falló) se sube a Drive cuando hay internet
    return url;
  };

  // Sube la foto final para el QR. Si falla, se reintenta una vez sola y el motivo
  // queda a la vista (con un botón para reintentar) en vez de un aviso que se va.
  const lastSavedRef = useRef<SavedPhoto[]>([]);
  const [qrError, setQrError] = useState('');
  // El QR va solo por Drive: la opción de Supabase se sacó de Ajustes (el código queda por si vuelve)
  const useSupabaseQr = false;
  const uploadForQr = async (dataUrl: string, saved: SavedPhoto[]): Promise<string | null> => {
    const wantsQr = !offlineMode && generalSettings.showQr !== false;
    if (!wantsQr) return null;
    const attempt = async (): Promise<string> => {
      // QR con Drive (destino único): la foto final queda visible con el link
      if (!useSupabaseQr && isDriveConfigured()) {
        if (!saved[0]) throw new Error('La foto no se pudo guardar en el equipo');
        return `drive:${await uploadForShare(dataUrl, saved[0].name, saved[0].folder)}`;
      }
      // Supabase: solo si está activado en Compartir y nube (y el equipo tiene evento)
      if (!useSupabaseQr || !kioskEventId) throw new Error('El equipo no tiene a dónde subir la foto');
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `kiosk_sessions/${kioskEventId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
      await supabase.from('kiosk_photos').insert([{ kiosk_event_id: kioskEventId, image_url: publicUrl }]);
      return publicUrl;
    };
    setQrError('');
    for (let i = 0; i < 2; i++) {
      try {
        return await attempt();
      } catch (e) {
        console.error('QR: no se pudo subir la foto', e);
        if (i === 1) setQrError(!navigator.onLine ? 'Sin internet' : (e instanceof Error ? e.message : String(e)) || 'Error desconocido');
        else await new Promise(r => setTimeout(r, 2000));
      }
    }
    return null;
  };


  // Guarda y sube la foto final en segundo plano: el invitado ve su foto enseguida
  // y el QR aparece cuando termina la subida
  const photoSessionRef = useRef(0);
  const [uploading, setUploading] = useState(false);
  const finishPhoto = (finalImage: string) => {
    const session = ++photoSessionRef.current;
    setCapturedImage(finalImage);
    setLastPublicUrl(null);
    setUploading(true);
    savePhotoToAlbum(finalImage).then(url => {
      if (photoSessionRef.current !== session) return;
      setLastPublicUrl(url);
      setUploading(false);
    });
  };
  const retryQr = () => {
    if (!capturedImage || uploading) return;
    const session = photoSessionRef.current;
    setUploading(true);
    uploadForQr(capturedImage, lastSavedRef.current).then(url => {
      if (photoSessionRef.current !== session) return;
      setLastPublicUrl(url);
      setUploading(false);
    });
  };

  // Mientras trabaja la IA hay un juego: la foto lista pasa por el aviso "¡Tu foto está lista!"
  const revealAI = (next: Step) => setAiReadyStep(next);
  // Fotos: si está activado, un juego de un minuto antes del resultado
  const toFlashResult = () => setStep(generalSettings.photoGame === true ? 'photoGame' : 'flashResult');
  const continueFromGames = useCallback(() => {
    setAiReadyStep(ready => {
      if (ready) setStep(ready);
      return null;
    });
  }, []);

  const runAI = async (imageDataUrl: string, theme: any) => {
    if (isAIGenerating) return;
    setIsAIGenerating(true);
    setAiReadyStep(null);
    setStep('processing');
    try {
      // 1. Subir a Storage para tener un link (necesario para este modelo de IA)
      const blob = await (await fetch(imageDataUrl)).blob();
      const fileName = `kiosk_raw/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error('Error subiendo foto base');

      // 2. Generar un link "VIP" (Signed URL) para que la IA pueda entrar aunque el balde sea privado
      const { data: signedData, error: signedError } = await supabase.storage.from('photos').createSignedUrl(fileName, 300);
      if (signedError) throw new Error('Error generando link para IA');

      const publicUrl = signedData.signedUrl;

      // Build prompt based on mode
      const prompt = theme?.prompt || '';
      
      // Llamada unificada a la Edge Function. El equipo paga con los créditos de su cliente
      const requestBody: any = { imageUrl: publicUrl };
      if (getCachedDeviceState()?.pairingStatus === 'linked') {
        requestBody.device = { code: getDeviceCode(), secret: getDeviceSecret() };
      }
      if (mode === 'figuritas') {
        requestBody.action = 'remove_bg';
      } else {
        requestBody.prompt = prompt;
      }

      const { data, error: functionError } = await supabase.functions.invoke('generate-ai-photo', {
        body: requestBody
      });

      // Sin créditos / sin cliente: se avisa y se vuelve al menú (la cabina clásica sigue)
      if (data?.code && data.code !== 'credit_error') {
        toast.error(data.code === 'no_credits' ? 'Se terminaron los créditos de IA. ¡Probá con Fotos!' : data.error, { duration: 7000 });
        setStep('modeSelect');
        return;
      }
      if (functionError || !data?.success) throw new Error(functionError?.message || data?.error || 'Error iniciando IA');

      let currentPrediction = data.prediction;
      
      // 2. Polling desde el frontend (infalible contra timeouts, aumentado a 150s)
      let attempts = 0;
      while (currentPrediction.status !== 'succeeded' && currentPrediction.status !== 'failed' && attempts < 60) {
        await new Promise(r => setTimeout(r, 2500));
        const { data: pollData } = await supabase.functions.invoke('generate-ai-photo', {
          body: { predictionId: currentPrediction.id }
        });
        if (pollData?.success) {
          currentPrediction = pollData.prediction;
        }
        attempts++;
      }

      if (currentPrediction.status !== 'succeeded') {
        throw new Error('La IA no pudo completar la imagen a tiempo.');
      }

      const outputUrl = Array.isArray(currentPrediction.output) ? currentPrediction.output[0] : currentPrediction.output;

      if (mode === 'figuritas') {
        setCapturedImage(outputUrl);
        revealAI('stickerEditor');
        setIsAIGenerating(false);
        return;
      }

      let finalImage: string;
      if (theme?.result_style === 'cover') {
        // Portada Fashion IA: la foto de la IA va dentro de la tapa de revista
        finalImage = await renderMagazineCover(outputUrl, coverOptionsFrom(generalSettings, guestNameRef.current || undefined));
      } else {
        finalImage = await mergeImages(outputUrl, frameUrl);
      }

      setCapturedImage(finalImage);
      const url = await savePhotoToAlbum(finalImage);
      setLastPublicUrl(url);
      revealAI('result');
    } catch (e: any) {
      console.error(e);
      // Sin saldo o sin servicio de IA: mensaje para el invitado y vuelta al menú
      if (/credit|billing|payment|insufficient|quota|402|429/i.test(String(e?.message || ''))) {
        toast.error('La magia con IA no está disponible en este momento. ¡Probá con Fotos!', { duration: 6000 });
        setStep('modeSelect');
        return;
      }
      toast.error(e.message || 'Error al procesar la foto');
      if (mode === 'figuritas') {
        setStep('modeSelect'); // Volver al inicio si falla la figurita
      } else {
        setStep(mode === 'portadaIA' ? 'modeSelect' : 'themeSelect');
      }
    } finally {
      setIsAIGenerating(false);
    }
  };

  const mergeImages = async (base: string, frame: string | null): Promise<string> => {
    // Hoja final: vertical u horizontal según la foto, con una o varias fotos.
    // El marco lleva siempre el nombre del evento de "Pantalla de inicio", nunca el del equipo.
    const multi = mode === 'selfie' && shotsRef.current.length > 1;
    return composePhotos(multi ? shotsRef.current : [base], {
      frame,
      orientation: (generalSettings.photoOrientation as PageOrientation) || 'auto',
      strips: !!generalSettings.photoStrips,
      photoFit: generalSettings.photoFit === 'fill' ? 'fill' : 'full',
      title: generalSettings.eventTitle || undefined,
      subtitle: generalSettings.frameSubtitle || undefined,
      guestName: mode === 'selfie' ? guestNameRef.current || undefined : undefined,
      // Fondo de la hoja subido en Ajustes (detrás de las fotos)
      background: generalSettings.pageBackground ? await getPageBackground() : null,
    });
  };

  const triggerPrint = (imageUrl: string) => printKioskPhoto(imageUrl);

  // Nombre que escribió el invitado (va en la foto); ref para usarlo enseguida al armarla
  const guestNameRef = useRef('');

  // Fotos (selfie): elegir marco si está habilitado, o armar la hoja directamente
  const continueSelfie = async (photo?: string) => {
    const capturedImage = photo ?? capturedImageState;
    if (!capturedImage) return;
    if (mode === 'portada') {
      // Portada Fashion: la foto como tapa de revista con los textos de Ajustes
      setStep('processing');
      setResultPhrase('¡Sos la tapa del momento! 📸✨');
      let cover = capturedImage;
      try {
        cover = await renderMagazineCover(capturedImage, coverOptionsFrom(generalSettings, guestNameRef.current || undefined));
      } catch (e) {
        console.error('No se pudo armar la portada', e);
      }
      finishPhoto(cover);
      toFlashResult();
      return;
    }
    const choices = guestFrameOptions();
    if (choices.length > 1) {
      setFrameChoices(choices);
      setStep('frameSelect');
      return;
    }
    setStep('processing'); // Show a brief processing state while merging
    setResultPhrase(SELFIE_PHRASES[Math.floor(Math.random() * SELFIE_PHRASES.length)]);
    let finalImage = capturedImage;
    try {
      finalImage = await mergeImages(capturedImage, frameUrl);
    } catch (e) {
      console.error("Error applying frame to selfie:", e);
    }
    finishPhoto(finalImage);
    toFlashResult();
  };

  const resetKiosk = () => {
    photoSessionRef.current++;
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    setUploading(false);
    setLastPublicUrl(null);
    setAiReadyStep(null);
    setStep('splash');
    setMode(null);
    setCapturedImage(null);
    setMundialCountry(null);
    setSelectedAITheme(null);
    autoShootRef.current = false;
    setAutoShoot(false);
  };

  // ─── SCREENS ────────────────────────────────────────────────

  // Vista previa: "¡Me gusta!" sigue con la foto (nombre, IA o foto final)
  const approvePhoto = async () => {
    if (!capturedImage) return;
    const photo = capturedImage;
    // Si es caricatura mundialista, lanzamos la IA directamente con el prompt especial
    if (mode === 'caricatura') {
      // Prompt de la base (editable en el panel → Temáticas IA) o el de respaldo
      const specialTheme = themes.find((t: any) => t.result_style === 'caricatura') ?? {
        name: 'Caricatura con Messi',
        prompt: 'Turn this photo into a semi-realistic 3D caricature portrait. IDENTITY IS THE TOP PRIORITY: every person from the photo must be instantly recognizable as themselves. Keep each face exactly as in the photo: same face shape and proportions, same eyes and eye shape, eyebrows, nose, mouth and smile, same skin tone, same hairline and hairstyle, same beard or facial hair, same glasses if they wear them, same age and body type. Only a very light, friendly caricature exaggeration (slightly bigger head and smile); do not change their features, do not make them look younger, thinner or like a generic cartoon character, no oversized eyes. Keep everyone from the photo and add Lionel Messi standing right next to them, hugging and celebrating together, also as a recognizable semi-realistic 3D caricature. Everyone wears the Argentina national team jersey with white and sky-blue vertical stripes. Medium shot from the waist up, faces large and in sharp focus, centered. Background: a blurred packed stadium at night with golden confetti; no other people in the foreground. Bright, joyful, high detail. No text, no logos, no watermark.'
      };
      runAI(capturedImage, specialTheme);
      return;
    }

    if (mode === 'portada' || mode === 'portadaIA') {
      // La tapa siempre pide el nombre de la estrella (se puede saltear)
      guestNameRef.current = '';
      setStep('guestName');
      return;
    }
    if (mode === 'selfie') {
      // Nombre del invitado antes de armar la foto (Ajustes → Experiencias y marco)
      guestNameRef.current = '';
      if (generalSettings.askGuestName) {
        setStep('guestName');
        return;
      }
      await continueSelfie(photo);
    } else if (mode === 'retrato') {
      setStep('themeSelect');
    } else if (mode === 'figuritas') {
      runAI(capturedImage, null);
    }
  };

  // Sin "Repetir foto" la vista previa no tiene nada que elegir: se sigue sola
  const autoApprovedRef = useRef<string | null>(null);
  useEffect(() => {
    if (step !== 'photoPreview' || generalSettings.allowRetake !== false || !capturedImage) return;
    if (autoApprovedRef.current === capturedImage) return;
    autoApprovedRef.current = capturedImage;
    void approvePhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, capturedImage]);

  // "Procesando tu foto": pasa sola a la foto final (o tocando)
  useEffect(() => {
    if (step !== 'flashResult') return;
    const t = setTimeout(() => setStep('result'), FLASH_RESULT_MS);
    return () => clearTimeout(t);
  }, [step]);

  if (step === 'splash') return (
    <div
      className="kiosk-root outline-none"
      onClick={handleSplashTap}
      data-remote="Tocá para empezar" data-remote-noimg
      // OK del control remoto = tocar la pantalla
      tabIndex={0}
      data-autofocus
      // Al soltar OK: con keydown, la pulsación de la misma tecla caía en el botón
      // que quedaba enfocado en la pantalla siguiente (p. ej. "Inicio"). Solo si OK
      // se apretó acá: al entrar desde el inicio con OK, la tecla se suelta ya en esta pantalla.
      onKeyDown={(e) => { if (e.key === 'Enter') splashEnterRef.current = true; }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget && splashEnterRef.current) handleSplashTap();
        splashEnterRef.current = false;
      }}
      style={{ cursor: 'pointer' }}
    >
      {homeButton}
      {showHomeButton && generalSettings.splashGallery !== false && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const params = new URLSearchParams({ back: `${location.pathname}${location.search}` });
            if (modesParam === 'selfie' || modesParam === 'ai') params.set('kind', modesParam);
            navigate(`/box/galeria?${params.toString()}`);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          className="absolute top-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full bg-black/50 border border-white/20 text-white/80 hover:text-white hover:bg-black/70 focus:outline-none focus:ring-4 focus:ring-white/70"
        >
          <Images className="w-5 h-5" /> Galería
        </button>
      )}
      <AttractScreen
        splash={getScreenBackground('splash')}
        eventTitle={generalSettings.eventTitle}
        welcomeTitle={generalSettings.welcomeTitle}
        subtitle={generalSettings.welcomeSubtitle}
        nameStyle={generalSettings.nameStyle}
      />
    </div>
  );

  if (step === 'modeSelect') return (
    <div className="kiosk-root">
      {homeButton}
      <ScreenBackground screen="modes" />
      <Corners />
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6 px-8 pt-10">
        <h2 className="carlmarx-bold text-[clamp(2rem,5vw,4rem)] text-white text-center">¿Cómo querés tu foto?</h2>
        <div className="flex flex-wrap justify-center content-start gap-5 w-full max-w-5xl overflow-y-auto max-h-[74vh] p-4">

          {[
            // Retrato Mágico es el modo estrella: va primero y destacado
            { mode: 'retrato' as Exclude<Mode, null>, on: generalSettings.enableAI !== false, title: 'Retrato Mágico', text: 'Elegí un estilo (realeza, pirata, vikingo…) y la IA te transforma.', img: '/modes/retrato.jpg', icon: Sparkles, color: '#a78bfa', ai: true, featured: true },
            { mode: 'selfie' as Exclude<Mode, null>, on: generalSettings.enableSelfie !== false, title: 'Selfie Grupal', text: 'Una foto con amigos o familia, con marco decorativo.', img: '/modes/selfie.jpg', icon: Users, color: '#22d3ee', ai: false },
            { mode: 'portada' as Exclude<Mode, null>, on: generalSettings.enablePortada === true, title: 'Portada Fashion', text: '¡Sé la tapa de la revista! Tu foto real con tu nombre y titulares.', img: portadaCard || '/modes/portada.jpg', icon: Crown, color: '#f472b6', ai: false, cover: true },
            { mode: 'portadaIA' as Exclude<Mode, null>, on: generalSettings.enablePortadaAI !== false, title: 'Portada Fashion IA', text: 'La IA te viste de modelo y salís en la tapa de revista con tu nombre.', img: portadaIACard || '/modes/portada-ia.jpg', icon: Crown, color: '#e879f9', ai: true, cover: true },
            { mode: 'caricatura' as Exclude<Mode, null>, on: generalSettings.enableCaricatura !== false, title: 'Caricatura con Messi', text: '¡Festejá con Messi! Tu caricatura con la camiseta argentina.', img: themes.find((t: any) => t.result_style === 'caricatura')?.preview_url || '/modes/caricatura.jpg', icon: Palette, color: '#fb923c', ai: true },
            { mode: 'figuritas' as Exclude<Mode, null>, on: generalSettings.enableFiguritas !== false, title: 'Figurita Mundial 2026', text: 'Tu figurita del álbum con tu cara, tu país, posición y datos.', img: '/modes/figurita.jpg', icon: Sticker, color: '#2dd4bf', ai: true },
          ].filter(m => m.on && isModeAllowed(m.mode)).map(m => (
            <button key={m.mode} data-autofocus data-remote={m.title} data-remote-sub={m.text}
              data-remote-featured={'featured' in m && m.featured ? '' : undefined} onClick={() => handleModeSelect(m.mode)}
              className="relative group flex flex-col w-full md:w-[calc((100%-2.5rem)/3)] portrait:!w-[calc((100%-1.25rem)/2)] rounded-2xl overflow-hidden border-2 kiosk-glass text-left hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 transition-all"
              style={{ borderColor: m.color, ...('featured' in m && m.featured ? { boxShadow: `0 0 0 2px ${m.color}, 0 0 45px -4px ${m.color}` } : {}) }}>
              <div className="relative w-full aspect-[16/10] bg-black/40 overflow-hidden">
                {'featured' in m && m.featured && (
                  <span className="absolute top-2 left-2 z-10 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#ffd23f] to-[#ff9f1c] text-black shadow-lg">⭐ El favorito</span>
                )}
                <img src={m.img} alt="" loading="lazy" className={`absolute inset-0 w-full h-full object-cover ${m.cover ? 'object-top' : 'object-center'}`} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                <span className={`absolute bottom-2 right-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg ${m.ai ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-white' : 'bg-white/90 text-black'}`}>
                  {m.ai ? '✨ Con IA' : 'Foto real'}
                </span>
                <m.icon className="absolute bottom-2 left-3 w-9 h-9 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" style={{ color: m.color }} />
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-3">
                <span className="carlmarx-bold text-xl uppercase tracking-wider" style={{ color: m.color }}>{m.title}</span>
                <p className="text-white/75 text-sm leading-snug">{m.text}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (step === 'getReady') return (
    <div className="kiosk-root" data-remote-watch="¡Preparate! Mirá la pantalla grande">
      <ScreenBackground screen="getReady" />
      <Corners />
      <div className="relative z-10 flex items-center justify-center h-full">
        <h1 className="carlmarx-bold text-[clamp(4rem,10vw,8rem)] text-white text-center animate-fade-in">
          Vamos a<br /><span className="text-violet-400">Empezar</span>
        </h1>
      </div>
    </div>
  );

  if (cameraActive && cameraError) return (
    <div className="kiosk-root">
      <AuroraBackground />
      <Corners />
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8 px-10 text-center">
        <h2 className="carlmarx-bold text-white text-5xl">No encontramos la cámara</h2>
        <p className="text-white/70 text-2xl max-w-3xl">{cameraError}</p>
        <div className="flex gap-6">
          <button data-autofocus onClick={() => startCamera()}
            className="px-10 py-5 rounded-3xl bg-violet-600 hover:bg-violet-500 text-white text-2xl font-bold focus:outline-none focus:ring-8 focus:ring-white/70">
            Reintentar
          </button>
          <button onClick={() => (showHomeButton && !locked ? navigate('/box') : resetKiosk())}
            className="px-10 py-5 rounded-3xl bg-white/10 hover:bg-white/20 text-white text-2xl font-bold focus:outline-none focus:ring-8 focus:ring-white/70">
            Volver
          </button>
        </div>
      </div>
    </div>
  );

  // Efectos en vivo: el invitado prueba filtro y accesorio mirándose y toca "¡Sacar foto!"
  if (step === 'lookCamera' && fxEnabled) {
    const filters = COLOR_FILTERS.filter(f => f.value === 'none' || (generalSettings.filters ?? COLOR_FILTERS.map(x => x.value)).includes(f.value));
    // Solo filtros de color: se cambian con las flechas de los costados (o el control)
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-black" />
        <CameraVideo videoRef={videoRef} mirror={!!cameraSettings.mirror} rotation={Number(cameraSettings.rotation) || 0} filter={fx.filter} />
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />
        <p className="absolute top-8 inset-x-0 z-10 text-center carlmarx-bold text-white text-[clamp(1.6rem,3.6vmin,2.8rem)] drop-shadow-lg">
          Elegí tu filtro con las flechas y tocá <span className="text-[#ff7ac0]">¡Sacar foto!</span>
        </p>
        <FilterCarousel filters={filters} value={fx.filter ?? 'none'} onChange={filter => setFx(v => ({ ...v, filter }))} />
        <div className="absolute bottom-[6vmin] portrait:bottom-[32vh] inset-x-0 z-20 flex justify-center">
          <button data-autofocus onClick={startCountdown} disabled={!cameraReady}
            className="px-12 py-4 rounded-full carlmarx-bold text-white text-[clamp(1.6rem,3.5vmin,2rem)] disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-white/80"
            style={{ background: 'linear-gradient(135deg,#ff2e93,#7b2ff7)', boxShadow: '0 0 40px rgba(255,46,147,0.55)' }}>
            📸 ¡Sacar foto!
          </button>
        </div>
      </div>
    );
  }

  if (step === 'lookCamera') {
    return (
      <div className="kiosk-root" onClick={shutterMode && cameraReady ? startCountdown : undefined}
        data-remote={shutterMode && cameraReady ? '📸 Sacar foto' : undefined}
        data-remote-noimg data-remote-watch="¡Mirá a la cámara! 📸">
        <AuroraBackground />
        <Corners />
        <CameraVideo videoRef={videoRef} mirror={!!cameraSettings.mirror} rotation={Number(cameraSettings.rotation) || 0} />
        <div className="absolute inset-0 bg-black/40 z-0" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
          <p className="carlmarx-regular text-white/60 text-2xl uppercase tracking-widest">
            {mode === 'selfie' ? '📸 Selfie Grupal' : mode === 'portada' ? '👑 Portada Fashion' : mode === 'portadaIA' ? '👑 Portada Fashion IA' : mode === 'retrato' ? '✨ Retrato Mágico' : mode === 'caricatura' ? '🎨 Caricatura con Messi' : '⚽ Figurita Mundial 2026'}
          </p>
          <h1 className="carlmarx-bold text-7xl text-white text-center uppercase tracking-widest">
            ¡Mirá a la<br /><span className="text-violet-400">Cámara! 📸</span>
          </h1>
          {/* Con la cuenta regresiva automática (un solo toque desde la bienvenida) no se pide el botón */}
          {shutterMode && !autoShoot && (
            <p className="carlmarx-bold text-white text-[clamp(1.4rem,4vmin,3rem)] text-center animate-pulse">
              {cameraReady ? 'Cuando estén listos, apretá el disparador 📲 (o tocá la pantalla)' : 'Preparando la cámara…'}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'countdown') return (
    <div className="kiosk-root" data-remote-watch="¡Sonrían a la cámara! 📸">
      <div className="absolute inset-0 bg-black" />
      <CameraVideo videoRef={videoRef} mirror={!!cameraSettings.mirror} rotation={Number(cameraSettings.rotation) || 0}
        filter={fxEnabled ? fx.filter : undefined} />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex items-center justify-center h-full">
        <CountdownRing value={countdown} total={cameraSettings.timer || 5} />
      </div>
      {shotsWanted() > 1 && (
        <div className="absolute top-8 inset-x-0 z-20 flex justify-center">
          <span className="kiosk-glass rounded-full px-8 py-3 carlmarx-bold text-white text-3xl">
            Foto {Math.min(shotCount + 1, shotsWanted())} de {shotsWanted()}
          </span>
        </div>
      )}
      <Corners />
    </div>
  );

  // ── PHOTO PREVIEW — approve or retake ───────────────────────
  if (step === 'guestName') return (
    <GuestNameScreen
      photo={capturedImage}
      onDone={(name) => {
        guestNameRef.current = name;
        if (mode === 'portadaIA') {
          // La temática de tapa de la base (editable en el panel) o el prompt de respaldo
          const coverTheme = themes.find((t: any) => t.result_style === 'cover')
            ?? { name: 'Portada Fashion IA', prompt: PORTADA_IA_PROMPT, result_style: 'cover' };
          if (capturedImage) runAI(capturedImage, coverTheme);
          return;
        }
        void continueSelfie();
      }}
    />
  );

  if (step === 'nextShot') return (
    <NextShot
      shots={shotsRef.current}
      total={shotsWanted()}
      seconds={Math.max(3, Number(generalSettings.shotPause) || 10)}
      videoRef={videoRef}
      mirror={!!cameraSettings.mirror}
      rotation={Number(cameraSettings.rotation) || 0}
      onReady={startCountdown}
    />
  );

  if (step === 'photoPreview') {
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-black" />
        <Corners />
        {/* La foto tal cual se guarda (el espejo ya está aplicado al sacarla) */}
        {capturedImage && shotsRef.current.length <= 1 && (
          <motion.div className="absolute inset-0" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
            <img src={capturedImage} alt="preview" data-remote-image className="absolute inset-0 w-full h-full object-contain" />
          </motion.div>
        )}
        {shotsRef.current.length > 1 && (
          <div className="absolute inset-0 pb-40 pt-10 px-10 flex items-center justify-center gap-6">
            {shotsRef.current.map((src, i) => (
              <motion.img key={i} src={src} alt={`Foto ${i + 1}`}
                className="min-w-0 max-h-full rounded-2xl shadow-2xl object-contain"
                style={{ maxWidth: `${92 / shotsRef.current.length}%` }}
                initial={{ opacity: 0, y: 40, rotate: (i - 1) * 3 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 160, damping: 18 }} />
            ))}
          </div>
        )}
        <CameraFlash key={capturedImage ?? 'flash'} />
        {/* Gradient bottom overlay for buttons */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute bottom-0 portrait:bottom-[30vh] inset-x-0 flex items-end justify-center gap-6 p-8 z-10">
          {generalSettings.allowRetake !== false && (
          <button onClick={() => setStep('lookCamera')}
            className="flex-1 max-w-xs py-5 rounded-2xl border-2 border-white/30 bg-black/60 carlmarx-bold text-white text-2xl backdrop-blur hover:border-white/60 transition-all focus:outline-none focus:ring-4 focus:ring-white/80">
            ↩ Repetir foto
          </button>
          )}
          <button data-autofocus data-remote-primary onClick={approvePhoto}
            className="flex-1 max-w-xs py-5 rounded-2xl carlmarx-bold text-white text-2xl transition-all focus:outline-none focus:ring-4 focus:ring-white/80"
            style={{ background: 'linear-gradient(135deg,#ff2e93,#7b2ff7)', boxShadow: '0 0 40px rgba(255,46,147,0.5)' }}>
            ¡Me gusta! →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'frameSelect' && capturedImage) return (
    <FrameChooser
      photo={capturedImage}
      options={frameChoices}
      // Arranca en el marco que está elegido en Ajustes
      initialIndex={Math.max(0, frameChoices.findIndex(o => o.url === frameUrl))}
      merge={mergeImages}
      onConfirm={async (finalImage) => {
        setResultPhrase(SELFIE_PHRASES[Math.floor(Math.random() * SELFIE_PHRASES.length)]);
        finishPhoto(finalImage);
        toFlashResult();
      }}
    />
  );

  if (step === 'photoGame') return (
    <div className="kiosk-root">
      <ScreenBackground screen="processing" />
      <WaitingGames title="¡Tu foto ya casi está!" seconds={60} onContinue={() => setStep('flashResult')} />
    </div>
  );

  if (step === 'flashResult') return (
    <div className="kiosk-root" data-remote="Ver mi foto →" data-remote-noimg data-remote-watch={resultPhrase} onClick={() => setStep('result')}>
      <ScreenBackground screen="reveal" />
      <Corners />
      {capturedImage && (
        <img src={capturedImage} alt="captured" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-12 text-center gap-8">
        <p className="carlmarx-bold text-[clamp(2.8rem,8vmin,6.5rem)] text-white leading-tight" style={{ textShadow: '0 0 40px rgba(255,255,255,0.4)' }}>
          {resultPhrase}
        </p>
        <div className="flex flex-col items-center gap-3 mt-4">
          <p className="carlmarx-regular text-white/80 text-[clamp(1.6rem,4.5vmin,3rem)] animate-pulse">Estamos procesando tu foto…</p>
          <div className="w-[min(70vw,28rem)] h-3 rounded-full bg-white/15 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]"
              initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: FLASH_RESULT_MS / 1000, ease: 'linear' }} />
          </div>
        </div>
      </div>
    </div>
  );
  // ── MUNDIAL / FIGURITAS: Country Selection ──────────────────────────────
  if (step === 'mundialCountry') {
    const listToRender = FIGURITAS_COUNTRIES;
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#040c1a 0%,#0a1628 100%)' }} />
        <Corners />
        <div className="relative z-10 flex flex-col items-center h-full py-10 px-8 gap-6 overflow-auto">
          <div>
            <p className="carlmarx-regular text-green-400 text-center text-xl tracking-widest uppercase">
              ⚽ Figurita Mundial 2026
            </p>
            <h2 className="carlmarx-bold text-white text-center text-[clamp(2rem,4vw,3.5rem)]">¿De qué país jugás?</h2>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4 w-full max-w-5xl">
            {listToRender.map(c => (
              <button key={c.id} onClick={() => { 
                  setMundialCountry(c as any); 
 
                  setStep('lookCamera');
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-white/10 bg-white/5 hover:border-green-400 hover:bg-green-400/10 transition-all group">
                {c.flag.startsWith('/') ? (
                  <img src={c.flag} alt={c.name} className="w-14 h-10 object-cover rounded shadow-lg group-hover:scale-110 transition-transform" />
                ) : (
                  <span className="text-4xl group-hover:scale-110 transition-transform">{c.flag}</span>
                )}
                <span className="carlmarx-regular text-white text-xs text-center leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
          <button onClick={resetKiosk}
            className="mt-auto px-8 py-4 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold tracking-widest transition-all">
            VOLVER
          </button>
        </div>
      </div>
    );
  }

  if (step === 'themeSelect') {
    const CATEGORY_LABELS: Record<string, string> = {
      deportes: '⚽ Deportes', fantasia: '🏰 Fantasía', epocas: '🕰️ Épocas',
      arte: '🎨 Arte y animación', animacion: '🎬 Animación', moda: '👗 Moda', scifi: '🤖 Sci-Fi', aventura: '🌿 Aventura',
    };
    // Las experiencias especiales (tapa, caricatura, figurita) tienen su propio botón
    const grouped = themes.filter((t: any) => !t.result_style).reduce((acc: Record<string, any[]>, t: any) => {
      const cat = t.category || 'otros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(t);
      return acc;
    }, {});

    return (
      <div className="kiosk-root">
        <ScreenBackground screen="modes" />
        <Corners />
        <div className="relative z-10 flex flex-col h-full overflow-auto">
          {/* Header */}
          <div className="text-center pt-10 pb-4 shrink-0">
            <p className="carlmarx-regular text-violet-400 text-xl uppercase tracking-widest">✨ Retrato Mágico</p>
            <h2 className="carlmarx-bold text-white text-[clamp(2rem,4vw,3.5rem)]">¿Cuál es tu estilo?</h2>
          </div>

          {/* Scrollable grid */}
          <div className="flex-1 overflow-auto px-8 pb-10">
            {themes.length === 0 && (
              <p className="text-slate-400 text-center py-20 text-xl">No hay temáticas configuradas aún.</p>
            )}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-8">
                <p className="carlmarx-bold text-slate-400 text-lg uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {(items as any[]).map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedAITheme(t)}
                      data-remote={t.name} data-remote-selected={selectedAITheme?.id === t.id ? '' : undefined}
                      className={`relative rounded-2xl overflow-hidden border-2 transition-all group bg-slate-900 ${isAIGenerating ? 'opacity-50 cursor-not-allowed' : (selectedAITheme?.id === t.id ? 'border-violet-400 scale-[1.03] ring-4 ring-violet-500/20' : 'border-violet-800/40 hover:border-violet-400')}`}
                      style={{ aspectRatio: '3/4' }}
                    >
                      {t.preview_url
                        ? <img src={t.preview_url} alt={t.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="absolute inset-0 flex items-center justify-center text-5xl">{t.emoji || '🎨'}</div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      {/* max_people badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 rounded-full px-2 py-0.5 text-white/80 text-xs">
                        {Array.from({ length: t.max_people || 1 }).map((_, i) => <span key={i}>👤</span>)}
                      </div>
                      {t.emoji && <div className="absolute top-2 right-2 text-xl">{t.emoji}</div>}
                      <div className="absolute bottom-0 inset-x-0 p-3">
                        <span className="carlmarx-bold text-white text-base leading-tight">{t.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* BOTÓN DE CONFIRMACIÓN FLOTANTE */}
        {selectedAITheme && !isAIGenerating && (
          <div className="fixed bottom-12 portrait:bottom-[32vh] left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-8 duration-300">
            <button 
              onClick={handleThemeConfirm}
              className="bg-gradient-to-r from-violet-600 to-pink-600 text-white px-12 py-6 rounded-3xl carlmarx-bold text-3xl shadow-[0_10px_50px_rgba(139,92,246,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
            >
              ¡Elegir {selectedAITheme.name}! <Sparkles className="w-8 h-8" />
            </button>
            <button 
              onClick={() => setSelectedAITheme(null)}
              className="absolute -top-4 -right-4 bg-white text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg carlmarx-bold border-2 border-slate-200"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'processing') return (
    <div className="kiosk-root" data-remote-watch="Estamos creando tu foto… ¡mirá la pantalla grande!">
      <ScreenBackground screen="processing" />
      <Corners />
      {capturedImage && <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover opacity-10 blur-md grayscale" />}
      {isAIGenerating || aiReadyStep ? (
        <WaitingGames title="Creando magia" ready={!!aiReadyStep} onContinue={continueFromGames} />
      ) : (
        <AIProcessing
          title={mode === 'selfie' ? 'Preparando tu foto' : 'Creando magia'}
          subtitle={mode === 'selfie' ? 'Aplicando los últimos retoques…' : undefined}
        />
      )}
    </div>
  );

  if (step === 'result') {
    const printerCfg = (() => { try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); } catch { return {}; } })();
    const igCfg = (() => { try { return JSON.parse(localStorage.getItem('kiosk_ig_settings') || '{}'); } catch { return {}; } })();
    const showPrint = generalSettings.showPrintButton !== false && printerCfg.autoPrint !== false;
    // QR solo con internet y con el equipo asignado a un evento (las fotos se suben ahí)
    const showQrBlock = generalSettings.showQr !== false && !offlineMode && (useSupabaseQr ? !!kioskEventId : isDriveConfigured());
    // The QR points directly to the photo for downloading
    // El QR abre la página del invitado (bajar / compartir por WhatsApp o Instagram)
    const qrUrl = lastPublicUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=8&data=${encodeURIComponent(guestPhotoUrl(lastPublicUrl, generalSettings.eventTitle || undefined))}&bgcolor=ffffff&color=000000`
      : null;

    return (
      <div className="kiosk-root">
        <ScreenBackground screen="result" />
        <Corners />
        
        <div className="relative z-10 flex flex-col md:flex-row portrait:!flex-col h-full items-center justify-center portrait:justify-start portrait:pt-[8vh] gap-6 md:gap-12 portrait:!gap-6 p-6 animate-in fade-in zoom-in duration-500 overflow-y-auto">
          {/* Photo Preview - ACHICADO PARA QUE ENTREN BOTONES */}
          {/* Se adapta a la hoja: vertical u horizontal */}
          <div className="relative flex-shrink-0 rounded-[2rem] overflow-hidden shadow-[0_0_80px_rgba(139,92,246,0.3)] border border-violet-500/30 group">
            {capturedImage && <motion.img key={capturedImage} src={capturedImage} alt="result" data-remote-image className="block w-auto h-auto max-h-[45vh] md:max-h-[70vh] portrait:!max-h-[36vh] max-w-[90vw] md:max-w-[55vw] portrait:!max-w-[80vw]" {...revealPhoto} />}
          </div>

          {/* Actions Column */}
          <div className="flex flex-col gap-3 md:gap-6 w-full max-w-sm">
            <div className="space-y-1 mb-2 text-center md:text-left">
              <p className="carlmarx-regular text-violet-400 text-lg uppercase tracking-[0.2em]">¡Listo!</p>
              <h2 className="carlmarx-bold text-white text-3xl md:text-4xl leading-none">Llevate tu recuerdo</h2>
            </div>

            <button onClick={resetKiosk}
              className="group relative py-6 px-8 bg-slate-900/80 hover:bg-slate-800 text-white rounded-3xl carlmarx-bold text-2xl transition-all border border-white/10 hover:border-white/20 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 via-violet-600/10 to-violet-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              Terminar
            </button>

            {showPrint && (
              <button onClick={() => triggerPrint(capturedImage!)}
                className="py-6 px-8 bg-slate-800/80 hover:bg-slate-700 text-white rounded-3xl carlmarx-bold text-2xl flex items-center justify-center gap-4 border border-white/10 transition-all hover:scale-[1.02]">
                <Printer className="w-7 h-7 text-violet-400" /> Imprimir
              </button>
            )}

            {/* QR a la vista: el invitado lo escanea y se lleva la foto al celular */}
            {showQrBlock && (
              <div className="flex items-center gap-5 rounded-3xl bg-white/95 p-4 shadow-[0_10px_40px_rgba(139,92,246,0.35)]">
                {/* Grande: se escanea desde un paso de distancia */}
                <div className="w-[clamp(9rem,26vmin,17rem)] h-[clamp(9rem,26vmin,17rem)] shrink-0 rounded-2xl bg-white flex items-center justify-center overflow-hidden">
                  {qrUrl ? (
                    <motion.img src={qrUrl} alt="QR para descargar la foto" className="w-full h-full"
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} />
                  ) : uploading ? (
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                  ) : (
                    <QrCode className="w-12 h-12 text-slate-300" />
                  )}
                </div>
                <div className="text-slate-900">
                  <p className="carlmarx-bold text-[clamp(1.5rem,3.6vmin,2.4rem)] leading-tight">{qrUrl ? 'Escaneá y llevátela' : uploading ? 'Preparando tu QR…' : 'QR no disponible'}</p>
                  <p className="text-slate-500 text-[clamp(0.9rem,2vmin,1.2rem)] mt-1 max-w-[16rem]">{qrUrl ? 'Bajala al celular y compartila por WhatsApp o Instagram' : uploading ? 'Un segundo' : 'La foto quedó guardada en el equipo'}</p>
                  {!qrUrl && !uploading && (
                    <>
                      {qrError && <p className="text-red-600 text-xs mt-1 max-w-[16rem] break-words">{qrError}</p>}
                      <button onClick={retryQr} className="mt-2 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-bold">Reintentar</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* En la TV box compartir desde el equipo no le sirve al invitado: usa el QR */}
            {!offlineMode && !showHomeButton && (
            <button onClick={async () => {
              if (!navigator.share) { toast.info("Guardá la foto con un toque largo"); return; }
              try {
                const res = await fetch(capturedImage!);
                const blob = await res.blob();
                const file = new File([blob], 'foto-kiosco.jpg', { type: 'image/jpeg' });
                await navigator.share({ title: 'Mi foto del evento', files: [file] });
              } catch { toast.info("Guardá la foto con un toque largo"); }
            }}
              className="py-7 px-8 bg-gradient-to-br from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white rounded-[2rem] carlmarx-bold text-2xl flex items-center justify-center gap-4 shadow-[0_10px_40px_rgba(139,92,246,0.4)] transition-all hover:scale-[1.05] active:scale-95">
              <Instagram className="w-8 h-8" /> Compartir
            </button>
            )}
          </div>
        </div>

        {/* QR MODAL */}
        {showQrModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" data-remote="Cerrar" onClick={() => setShowQrModal(false)} />
            <div className="relative bg-white rounded-[3rem] p-12 flex flex-col items-center gap-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="text-center space-y-2">
                <h3 className="carlmarx-bold text-slate-900 text-3xl">Descargá tu foto</h3>
                <p className="text-slate-500 text-lg">Escaneá para bajarla a tu celular</p>
              </div>
              
              <div className="p-4 bg-white rounded-3xl border-8 border-slate-100 shadow-inner">
                <img src={qrUrl!} alt="QR" className="w-64 h-64" />
              </div>

              {igCfg.hashtag && (
                <div className="bg-violet-50 px-6 py-3 rounded-full border border-violet-100">
                  <p className="text-violet-600 font-bold text-xl">#{igCfg.hashtag.replace(/^#/, '')}</p>
                </div>
              )}

              <button 
                onClick={() => setShowQrModal(false)}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl carlmarx-bold text-xl hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'stickerEditor') {
    return (
      <div className="kiosk-root overflow-auto bg-black pt-[5vh]">
        <StickerEditor 
          userPhotoUrl={capturedImage} 
          countryFolder={mundialCountry?.id || 'argentina'}
          onSave={async (url) => {
             setStep('processing');
             const publicUrl = await savePhotoToAlbum(url);
             setLastPublicUrl(publicUrl);
             setCapturedImage(url);
             setStep('result');
          }} 
          onCancel={resetKiosk} 
        />
      </div>
    );
  }

  return null;
}
