import { useState, useRef, useEffect } from 'react'; // Kiosk AI Optimized Flow
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, Users, Sparkles, Trophy, QrCode, Loader2, Images, Crown, Instagram, Palette, Sticker, Home, Lock, LockOpen } from 'lucide-react';
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
import { applyFx, BUILT_IN_ACCESSORIES, COLOR_FILTERS, type FxChoice } from '@/lib/faceFx';
import AttractScreen from '@/components/kiosk/AttractScreen';
import FrameChooser from '@/components/kiosk/FrameChooser';
import NextShot from '@/components/kiosk/NextShot';
import CameraVideo from '@/components/kiosk/CameraVideo';
import GuestNameScreen from '@/components/kiosk/GuestNameScreen';
import { isDriveConfigured, queueForDrive, startDriveSync, uploadForShare } from '@/lib/driveBackup';
import { guestPhotoUrl } from '@/lib/kioskShare';
import { guestFrameOptions, type FrameOption } from '@/lib/frameOptions';
import { motion } from 'framer-motion';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import { getPageBackground, getScreenBackground } from '@/lib/kioskMedia';
import { AIProcessing, CameraFlash, CountdownRing } from '@/components/kiosk/KioskAnimations';
import { revealPhoto, useConfettiBurst } from '@/components/kiosk/kioskEffects';

// ---- Types ----
type Step =
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
  | 'mundialInfo'
  | 'processing'
  | 'stickerEditor'
  | 'result';

type Mode = 'selfie' | 'portada' | 'retrato' | 'mundial' | 'caricatura' | 'figuritas' | null;

// ---- Mundial Data ----
const COUNTRIES = [
  { id: 'argentina', name: 'Argentina', flag: '/flags/argentina.png', jersey: 'white and light blue vertical stripes Adidas Argentina AFA national team jersey with three gold stars' },
  { id: 'brasil',    name: 'Brasil',    flag: '/flags/brasil.png',    jersey: 'yellow Adidas Brazil CBF national team jersey with green collar' },
  { id: 'uruguay',   name: 'Uruguay',   flag: '/flags/uruguay.png',   jersey: 'light blue Puma Uruguay AUF national team jersey' },
  { id: 'chile',     name: 'Chile',     flag: '/flags/chile.png',     jersey: 'red Nike Chile FEF national team jersey' },
  { id: 'mexico',    name: 'México',    flag: '/flags/mexico.png',    jersey: 'green Adidas Mexico FMF national team jersey' },
  { id: 'espana',    name: 'España',    flag: '/flags/espana.png',    jersey: 'red Adidas Spain RFEF national team jersey' },
  { id: 'portugal',  name: 'Portugal',  flag: '/flags/portugal.png',  jersey: 'dark red Nike Portugal FPF national team jersey' },
  { id: 'venezuela', name: 'Venezuela', flag: '/flags/venezuela.png', jersey: 'red and black Hummel Venezuela FVF national team jersey' },
  { id: 'estados-unidos', name: 'USA',  flag: '/flags/estados-unidos.png', jersey: 'white Nike USA USMNT national team jersey with red and blue details' },
  { id: 'corea',     name: 'Corea',     flag: '/flags/corea.png',     jersey: 'red Nike South Korea KFA national team jersey' },
  { id: 'japon',     name: 'Japón',     flag: '/flags/japon.png',     jersey: 'blue Adidas Japan JFA national team jersey' },
  { id: 'marruecos', name: 'Marruecos', flag: '/flags/marruecos.png', jersey: 'red Puma Morocco FRMF national team jersey' },
  { id: 'croacia',   name: 'Croacia',   flag: '/flags/croacia.png',   jersey: 'white with red checkered pattern Nike Croatia HNS national team jersey' },
  { id: 'gana',      name: 'Ghana',     flag: '/flags/gana.png',      jersey: 'white Nike Ghana GFA national team jersey' },
];

const FIGURITAS_COUNTRIES = [
  { id: 'argentina', name: 'Argentina', flag: '/flags/argentina.png' },
  { id: 'canada', name: 'Canadá', flag: '🇨🇦' },
  { id: 'corea del sur', name: 'Corea del Sur', flag: '/flags/corea.png' },
  { id: 'estados unidos', name: 'Estados Unidos', flag: '/flags/estados-unidos.png' },
  { id: 'mexico', name: 'México', flag: '/flags/mexico.png' },
  { id: 'sudafrica', name: 'Sudáfrica', flag: '🇿🇦' },
  { id: 'otros', name: 'Otros', flag: '🌍' }
];

const POSITIONS = [
  'Delantero', 'Centrocampista', 'Defensa', 'Arquero',
  'Extremo', 'Mediapunta', 'Lateral', 'Líbero',
];

// ---- Funny phrases for Selfie Grupal ----
const SELFIE_PHRASES = [
  "¡CHE, alguien pidió una foto tan fachera? ¡Porque acá ESTÁ!",
  "¡BOOM! Eso sí es una foto de campeonas y campeones.",
  "¡Ojo, que esta foto va a hacer historia!",
  "¡Sonrieron como si supieran que iban a quedar perfectos... y tenían razón!",
  "¡Esto no es una foto, esto es una OBRA DE ARTE!",
  "¡Paren todo! La mejor foto del evento acaba de tomarse.",
];

// ---- On-screen keyboard ----
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
  ['ESPACIO'],
];
interface VKProps { value: string; onChange: (v: string) => void; onClose: () => void; }
const VirtualKeyboard = ({ value, onChange, onClose }: VKProps) => {
  const press = (key: string) => {
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === 'ESPACIO') { if (value.length < 24) onChange(value + ' '); return; }
    if (value.length < 24) onChange(value + key);
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-[#0a0f1a]/95 border-t border-white/10 p-4 pb-6 backdrop-blur">
      <div className="flex justify-between items-center mb-3">
        <p className="carlmarx-bold text-white text-2xl tracking-wider">{value || <span className="text-white/30">RAUL GUTIERREZ</span>}</p>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg carlmarx-regular px-4 py-2 border border-white/20 rounded-xl">Listo ✓</button>
      </div>
      {KB_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1.5 mb-1.5">
          {row.map(k => (
            <button
              key={k}
              onPointerDown={e => { e.preventDefault(); press(k); }}
              className={`carlmarx-bold text-white rounded-xl border border-white/20 bg-white/10 active:bg-white/30 transition-colors flex items-center justify-center select-none
                ${ k === 'ESPACIO' ? 'text-base px-16 py-4 flex-1 max-w-xs' : k === '⌫' ? 'text-xl px-4 py-4 bg-red-900/40 border-red-700/40' : 'text-xl w-12 h-12' }`}
            >
              {k === 'ESPACIO' ? '— ESPACIO —' : k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

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
  // Mundial state
  const [mundialCountry, setMundialCountry] = useState<any>(null);
  const [mundialName, setMundialName] = useState('');
  const [mundialPosition, setMundialPosition] = useState('');
  const [mundialGender, setMundialGender] = useState<'M' | 'F'>('M');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
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
      const { data } = await supabase.from('ai_themes').select('*').order('created_at', { ascending: false });
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
      // Con efectos, el invitado los prueba en vivo y toca "¡Sacar foto!"
      if (fxEnabled) return;
      const t = setTimeout(() => startCountdown(), 2500);
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
    const idleSteps: Step[] = ['modeSelect', 'themeSelect', 'mundialCountry', 'mundialInfo', 'lookCamera'];
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
  const handleSplashTap = () => {
    if (generalSettings.autoFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    // Con un solo modo posible (p. ej. "Fotos" = selfie) se saltea la elección
    if (modesParam === 'selfie' && generalSettings.enablePortada !== true) {
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
    if (m === 'mundial' || m === 'figuritas') {
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
  const fxEnabled = (mode === 'selfie' || mode === 'portada') && !!(generalSettings.enableFilters || generalSettings.enableAccessories);
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
    const wantsQr = !offlineMode && generalSettings.showQr !== false;

    // QR con Drive (destino único): se sube ya la foto final y queda visible con el link
    let driveRef: string | null = null;
    if (wantsQr && !generalSettings.cloudSupabase && isDriveConfigured() && saved[0]) {
      try {
        driveRef = `drive:${await uploadForShare(dataUrl, saved[0].name, saved[0].folder)}`;
      } catch (e) {
        console.error(e);
        toast.error('No se pudo subir la foto a Drive: el QR no va a estar disponible');
      }
    }
    queueForDrive(saved); // el resto (originales, o la final si falló) se sube a Drive cuando hay internet
    if (driveRef || !wantsQr) return driveRef;

    // Supabase: solo si está activado en Compartir y nube (y el equipo tiene evento)
    if (!generalSettings.cloudSupabase || !kioskEventId) return null;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `kiosk_sessions/${kioskEventId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
      await supabase.from('kiosk_photos').insert([{ kiosk_event_id: kioskEventId, image_url: publicUrl }]);
      return publicUrl;
    } catch (e) { 
      console.error(e);
      toast.error('No se pudo subir la foto: el QR no va a estar disponible');
      return null;
    }
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

  const runAI = async (imageDataUrl: string, theme: any) => {
    if (isAIGenerating) return;
    setIsAIGenerating(true);
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
      let prompt = theme?.prompt || '';
      
      // Si es modo mundial, generamos un retrato profesional del jugador (sin Messi)
      if (mode === 'mundial' && mundialCountry) {
        const isCaricature = theme?.name?.toLowerCase().includes('caricatura') || prompt.toLowerCase().includes('caricatura');
        const genderLabel = mundialGender === 'F' ? 'female' : 'male';
        const playerLabel = mundialGender === 'F' ? 'football player' : 'football star';

        if (isCaricature) {
          prompt = `3D digital illustration, Pixar style caricature of the subject as a professional ${genderLabel} ${playerLabel}. \
The subject is wearing the ${mundialCountry.name} official jersey. \
Smiling at the camera in a professional football stadium at night. \
Ultra detailed facial features, volumetric lighting, cinematic composition. \
The subject must perfectly match the facial features and gender of the reference image.`;
        } else {
          prompt = `Photorealistic official FIFA World Cup 2026 player portrait of the subject as a ${genderLabel} ${playerLabel}. \
The subject is wearing the ${mundialCountry.name} official jersey. \
Dramatic professional stadium lighting with bright floodlights bokeh in background. \
High-end sports photography, 8k, cinematic, extremely detailed face, looking at camera. \
The subject must perfectly match the facial features and gender of the reference image.`;
        }
      }
      // Llamada unificada a la Edge Function
      const requestBody: any = { imageUrl: publicUrl };
      if (mode === 'figuritas') {
        requestBody.action = 'remove_bg';
      } else {
        requestBody.prompt = prompt;
      }

      const { data, error: functionError } = await supabase.functions.invoke('generate-ai-photo', {
        body: requestBody
      });

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
        setStep('stickerEditor');
        setIsAIGenerating(false);
        return;
      }

      let finalImage: string;
      if (mode === 'mundial') {
        finalImage = await buildMundialCard(outputUrl);
      } else {
        finalImage = await mergeImages(outputUrl, frameUrl);
      }

      setCapturedImage(finalImage);
      const url = await savePhotoToAlbum(finalImage);
      setLastPublicUrl(url);
      setStep('result');
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
        setStep(mode === 'mundial' ? 'mundialInfo' : 'themeSelect');
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
      title: generalSettings.eventTitle || undefined,
      subtitle: generalSettings.frameSubtitle || undefined,
      guestName: mode === 'selfie' ? guestNameRef.current || undefined : undefined,
      // Fondo de la hoja subido en Ajustes (detrás de las fotos)
      background: generalSettings.pageBackground ? await getPageBackground() : null,
    });
  };

  // Build World Cup player card on canvas
  const buildMundialCard = (portraitUrl: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const W = 800, H = 1140;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      const portrait = new Image(); portrait.crossOrigin = 'anonymous';
      portrait.onload = () => {
        // 1 — Portrait fills FULL canvas using cover-crop logic
        const pA = portrait.width / portrait.height;
        const cA = W / H;
        let sx, sy, sw, sh;

        if (pA > cA) {
          // La foto es más ancha que el marco (recortamos los lados)
          sw = portrait.height * cA;
          sh = portrait.height;
          sx = (portrait.width - sw) / 2;
          sy = 0;
        } else {
          // La foto es más alta que el marco (recortamos arriba/abajo)
          sw = portrait.width;
          sh = portrait.width / cA;
          sx = 0;
          sy = (portrait.height - sh) / 6; // Menos recorte arriba para ver más ambiente
        }
        
        // Dibujamos con un margen interno sutil para "zoom out"
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,W,H);
        ctx.drawImage(portrait, sx, sy, sw, sh, 0, 0, W, H);

        // 2 — Frame overlay (marco3mundial) at full canvas size
        const frame = new Image(); frame.crossOrigin = 'anonymous';
        frame.onload = () => {
          ctx.drawImage(frame, 0, 0, W, H);

          // 3 — Subtle localized gradient only behind text (top-left corner)
          const B = 48;
          const tX = B + 14;  // text X — just inside frame border
          const tY = B + 14;  // text Y — just inside frame border

          const nameText = (mundialName || 'JUGADOR').toUpperCase();
          const posText  = (mundialPosition || '').toUpperCase();

          // Measure widths so gradient only covers text area
          ctx.font = `bold 62px 'CarlMarx', Impact, sans-serif`;
          const nameW = ctx.measureText(nameText).width;
          ctx.font = `bold 32px 'CarlMarx', Impact, sans-serif`;
          const posW  = ctx.measureText(posText).width;
          const bgW = Math.max(nameW, posW) + 32;
          const bgH = 110;

          const bgGrad = ctx.createLinearGradient(tX, tY, tX + bgW, tY);
          bgGrad.addColorStop(0,   'rgba(0,0,0,0.78)');
          bgGrad.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(tX - 8, tY, bgW + 20, bgH);

          // 4 — Player name
          ctx.font = `bold 62px 'CarlMarx', Impact, sans-serif`;
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
          ctx.fillText(nameText, tX, tY + 62);

          // 5 — Position
          ctx.font = `bold 32px 'CarlMarx', Impact, sans-serif`;
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(posText, tX, tY + 100);
          ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

          // 6 — Country flag (top-right inside header)
          const finish = (flagSrc?: string) => {
            if (!flagSrc) { resolve(canvas.toDataURL('image/jpeg', 0.96)); return; }
            const fi = new Image(); fi.crossOrigin = 'anonymous';
            fi.onload = () => {
              const fW = 92, fH = 62;
              const fX = W - B - fW - 10;   // right side, inside frame border
              const fY = B + 14;             // same top margin as text
              ctx.shadowBlur = 0;
              ctx.drawImage(fi, fX, fY, fW, fH);
              resolve(canvas.toDataURL('image/jpeg', 0.96));
            };
            fi.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.96));
            fi.src = flagSrc;
          };
          finish(mundialCountry?.flag);
        };
        frame.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.96));
        if (frameUrl === 'none') {
          resolve(canvas.toDataURL('image/jpeg', 0.9));
          return;
        }
        frame.src = frameUrl || '/kiosk-marco-mundial.png';
      };
      portrait.onerror = reject;
      portrait.src = portraitUrl;
    });

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
      setStep('flashResult');
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
    setStep('flashResult');
  };

  const resetKiosk = () => {
    photoSessionRef.current++;
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    setUploading(false);
    setLastPublicUrl(null);
    setStep('splash');
    setMode(null);
    setCapturedImage(null);
    setMundialCountry(null);
    setMundialName('');
    setMundialPosition('');
    setSelectedAITheme(null);
  };

  // ─── SCREENS ────────────────────────────────────────────────

  if (step === 'splash') return (
    <div
      className="kiosk-root outline-none"
      onClick={handleSplashTap}
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
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-12 px-8">
        <h2 className="carlmarx-bold text-[clamp(2rem,5vw,4rem)] text-white text-center">¿Cómo querés tu foto?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl overflow-y-auto max-h-[70vh] p-4">

          {/* SELFIE GRUPAL */}
          {(generalSettings.enableSelfie !== false && isModeAllowed('selfie')) && (
            <button data-autofocus onClick={() => handleModeSelect('selfie')}
              className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-cyan-400 kiosk-glass hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 hover:bg-cyan-400/10 transition-all">
              <Users className="w-16 h-16 text-cyan-400" />
              <span className="carlmarx-bold text-cyan-400 text-2xl uppercase tracking-wider">Selfie Grupal</span>
              <p className="text-white/70 text-sm text-center">Una foto con amigos o familia.<br />Podés ponerle un marco decorativo.</p>
            </button>
          )}

          {/* PORTADA FASHION (tapa de revista, sin IA) */}
          {(generalSettings.enablePortada === true && isModeAllowed('portada')) && (
            <button data-autofocus onClick={() => handleModeSelect('portada')}
              className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-pink-400 kiosk-glass hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 hover:bg-pink-400/10 transition-all">
              <Crown className="w-16 h-16 text-pink-400" />
              <span className="carlmarx-bold text-pink-400 text-2xl uppercase tracking-wider">Portada Fashion</span>
              <p className="text-white/70 text-sm text-center">¡Sé la tapa de la revista!<br />Con tu nombre y titulares de la fiesta.</p>
            </button>
          )}

          {/* RETRATO MÁGICO */}
          {(generalSettings.enableAI !== false && isModeAllowed('retrato')) && (
            <button data-autofocus onClick={() => handleModeSelect('retrato')}
              className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-violet-400 kiosk-glass hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 hover:bg-violet-400/10 transition-all">
              <Sparkles className="w-16 h-16 text-violet-400" />
              <span className="carlmarx-bold text-violet-400 text-2xl uppercase tracking-wider">Retrato Mágico</span>
              <p className="text-white/70 text-sm text-center">Una foto de vos solo.<br />Elegí entre muchos estilos de retrato.</p>
            </button>
          )}

          {/* MUNDIAL */}
          {(generalSettings.enableMundial !== false && isModeAllowed('mundial')) && (
            <button data-autofocus onClick={() => handleModeSelect('mundial')}
              className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-green-400 kiosk-glass hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 hover:bg-green-400/10 transition-all">
              <Trophy className="w-16 h-16 text-green-400" />
              <span className="carlmarx-bold text-green-400 text-2xl uppercase tracking-wider">Mundial 2026</span>
              <p className="text-white/70 text-sm text-center">¡Convertite en una estrella del fútbol!<br />Tu carta de jugador con nombre y posición.</p>
            </button>
          )}
          {/* CARICATURA MUNDIAL */}
          {(generalSettings.enableCaricatura !== false && isModeAllowed('caricatura')) && (
            <button data-autofocus onClick={() => handleModeSelect('caricatura')}
              className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-orange-400 kiosk-glass hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 hover:bg-orange-400/10 transition-all">
              <Palette className="w-16 h-16 text-orange-400" />
              <span className="carlmarx-bold text-orange-400 text-2xl uppercase tracking-wider">Caricatura Mundial</span>
              <p className="text-white/70 text-sm text-center">¡Tu caricatura del Mundial!<br />Transformate en dibujo con tu nombre.</p>
            </button>
          )}

          {/* FIGURITAS */}
          {generalSettings.enableFiguritas !== false && isModeAllowed('figuritas') && (
          <button data-autofocus onClick={() => handleModeSelect('figuritas')}
            className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-teal-400 kiosk-glass hover:scale-[1.03] focus:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-white/80 hover:bg-teal-400/10 transition-all">
            <Sticker className="w-16 h-16 text-teal-400" />
            <span className="carlmarx-bold text-teal-400 text-2xl uppercase tracking-wider">Hacer Figurita</span>
            <p className="text-white/70 text-sm text-center">¡Crea tu propia carta oficial!<br />Quita el fondo y personalízala.</p>
          </button>
          )}
        </div>
      </div>
    </div>
  );

  if (step === 'getReady') return (
    <div className="kiosk-root">
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
    const customs = (generalSettings.customAccessories ?? []) as { id: string; name: string }[];
    const accs = [
      { value: 'none', label: 'Sin accesorio' },
      ...BUILT_IN_ACCESSORIES.filter(a => (generalSettings.accessories ?? BUILT_IN_ACCESSORIES.map(x => x.value)).includes(a.value)),
      ...customs.filter(c => (generalSettings.accessories ?? [`custom:${c.id}`]).includes(`custom:${c.id}`)).map(c => ({ value: `custom:${c.id}`, label: c.name })),
    ];
    const chip = (on: boolean) => `px-4 py-2 rounded-full text-[clamp(0.95rem,2.2vmin,1.15rem)] font-semibold border focus:outline-none focus:ring-4 focus:ring-white/80 ${on ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] border-transparent text-white' : 'bg-black/55 border-white/25 text-white/85 backdrop-blur'}`;
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-black" />
        <CameraVideo videoRef={videoRef} mirror={!!cameraSettings.mirror} rotation={Number(cameraSettings.rotation) || 0}
          filter={fx.filter} accessory={generalSettings.enableAccessories ? fx.accessory : undefined} />
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-72 bg-gradient-to-t from-black/85 to-transparent" />
        <p className="absolute top-8 inset-x-0 z-10 text-center carlmarx-bold text-white text-[clamp(1.8rem,4vmin,3rem)] drop-shadow-lg">
          Elegí tu efecto y tocá <span className="text-[#ff7ac0]">¡Sacar foto!</span>
        </p>
        <div className="absolute bottom-6 inset-x-0 z-20 flex flex-col items-center gap-2.5 px-4 max-h-[60%] overflow-y-auto">
          {generalSettings.enableFilters && (
            <div className="flex flex-wrap justify-center gap-2 max-w-full">
              {filters.map(f => (
                <button key={f.value} onClick={() => setFx(v => ({ ...v, filter: f.value }))} className={chip((fx.filter ?? 'none') === f.value)}>{f.label}</button>
              ))}
            </div>
          )}
          {generalSettings.enableAccessories && (
            <div className="flex flex-wrap justify-center gap-2 max-w-full">
              {accs.map(a => (
                <button key={a.value} onClick={() => setFx(v => ({ ...v, accessory: a.value }))} className={chip((fx.accessory ?? 'none') === a.value)}>{a.label}</button>
              ))}
            </div>
          )}
          <button data-autofocus onClick={startCountdown} disabled={!cameraReady}
            className="mt-2 shrink-0 px-12 py-4 rounded-full carlmarx-bold text-white text-[clamp(1.6rem,3.5vmin,2rem)] disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-white/80"
            style={{ background: 'linear-gradient(135deg,#ff2e93,#7b2ff7)', boxShadow: '0 0 40px rgba(255,46,147,0.55)' }}>
            📸 ¡Sacar foto!
          </button>
        </div>
      </div>
    );
  }

  if (step === 'lookCamera') {
    return (
      <div className="kiosk-root">
        <AuroraBackground />
        <Corners />
        <CameraVideo videoRef={videoRef} mirror={!!cameraSettings.mirror} rotation={Number(cameraSettings.rotation) || 0} />
        <div className="absolute inset-0 bg-black/40 z-0" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
          <p className="carlmarx-regular text-white/60 text-2xl uppercase tracking-widest">
            {mode === 'selfie' ? '📸 Selfie Grupal' : mode === 'portada' ? '👑 Portada Fashion' : mode === 'retrato' ? '✨ Retrato Mágico' : '⚽ Mundial 2026'}
          </p>
          <h1 className="carlmarx-bold text-7xl text-white text-center uppercase tracking-widest">
            ¡Mirá a la<br /><span className="text-violet-400">Cámara! 📸</span>
          </h1>
        </div>
      </div>
    );
  }

  if (step === 'countdown') return (
    <div className="kiosk-root">
      <div className="absolute inset-0 bg-black" />
      <CameraVideo videoRef={videoRef} mirror={!!cameraSettings.mirror} rotation={Number(cameraSettings.rotation) || 0}
        filter={fxEnabled ? fx.filter : undefined} accessory={fxEnabled && generalSettings.enableAccessories ? fx.accessory : undefined} />
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
    const goNext = async () => {
      if (!capturedImage) return;
      const photo = capturedImage;
      // Si es caricatura mundialista, lanzamos la IA directamente con el prompt especial
      if (mode === 'caricatura') {
        const specialTheme = {
          name: 'Caricatura Mundialista',
          prompt: 'A professional digital caricature of the person standing next to Lionel Messi, both wearing Argentina national team jerseys, celebrating a goal in a crowded stadium, gold confetti in the air, joyful expression, vibrant colors, artistic caricature style'
        };
        runAI(capturedImage, specialTheme);
        return;
      }

      if (mode === 'portada') {
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
      } else if (mode === 'mundial') {
        setStep('mundialCountry');
      } else if (mode === 'figuritas') {
        runAI(capturedImage, null);
      }
    };
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-black" />
        <Corners />
        {/* La foto tal cual se guarda (el espejo ya está aplicado al sacarla) */}
        {capturedImage && shotsRef.current.length <= 1 && (
          <motion.div className="absolute inset-0" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
            <img src={capturedImage} alt="preview" className="absolute inset-0 w-full h-full object-contain" />
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
        <div className="absolute bottom-0 inset-x-0 flex items-end justify-center gap-6 p-8 z-10">
          {generalSettings.allowRetake !== false && (
          <button onClick={() => setStep('lookCamera')}
            className="flex-1 max-w-xs py-5 rounded-2xl border-2 border-white/30 bg-black/60 carlmarx-bold text-white text-2xl backdrop-blur hover:border-white/60 transition-all focus:outline-none focus:ring-4 focus:ring-white/80">
            ↩ Repetir foto
          </button>
          )}
          <button data-autofocus onClick={goNext}
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
        setStep('flashResult');
      }}
    />
  );

  if (step === 'flashResult') return (
    <div className="kiosk-root" onClick={() => setStep('result')}>
      <ScreenBackground screen="reveal" />
      <Corners />
      {capturedImage && (
        <img src={capturedImage} alt="captured" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-12 text-center gap-8">
        <p className="carlmarx-bold text-[clamp(2.5rem,5vw,4rem)] text-white leading-tight" style={{ textShadow: '0 0 40px rgba(255,255,255,0.4)' }}>
          {resultPhrase}
        </p>
        <p className="carlmarx-regular text-white/60 text-2xl animate-pulse mt-4">Toca para ver tu foto →</p>
      </div>
    </div>
  );
  // ── MUNDIAL / FIGURITAS: Country Selection ──────────────────────────────
  if (step === 'mundialCountry') {
    const listToRender = mode === 'figuritas' ? FIGURITAS_COUNTRIES : COUNTRIES;
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#040c1a 0%,#0a1628 100%)' }} />
        <Corners />
        <div className="relative z-10 flex flex-col items-center h-full py-10 px-8 gap-6 overflow-auto">
          <div>
            <p className="carlmarx-regular text-green-400 text-center text-xl tracking-widest uppercase">
              {mode === 'figuritas' ? '🌍 Tus Figuritas' : '⚽ Mundial 2026'}
            </p>
            <h2 className="carlmarx-bold text-white text-center text-[clamp(2rem,4vw,3.5rem)]">¿De qué país jugás?</h2>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4 w-full max-w-5xl">
            {listToRender.map(c => (
              <button key={c.id} onClick={() => { 
                  setMundialCountry(c as any); 
                  if (mode === 'figuritas') setStep('lookCamera');
                  else setStep('mundialInfo'); 
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

  // ── MUNDIAL: Player Name + Position ─────────────────────────
  if (step === 'mundialInfo') return (
    <div className="kiosk-root">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#040c1a 0%,#0a1628 100%)' }} />
      <img src="/kiosk-fondo-cancha.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
      <Corners />
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8 px-8 max-w-2xl mx-auto">
        {/* Flag + country */}
        {mundialCountry && (
          <div className="flex items-center gap-4">
            <img src={mundialCountry.flag} alt={mundialCountry.name} className="w-20 h-14 object-cover rounded-lg shadow-xl border-2 border-white/20" />
            <p className="carlmarx-bold text-white text-3xl">{mundialCountry.name}</p>
          </div>
        )}

        {/* Name input — teclado virtual */}
        <div className="w-full space-y-2">
          <label className="carlmarx-regular text-white/60 text-lg uppercase tracking-widest">Tu nombre en la tarjeta</label>
          <div
            onClick={() => setShowKeyboard(true)}
            className={`w-full bg-white/10 border-2 rounded-2xl px-6 py-4 text-3xl carlmarx-bold uppercase cursor-pointer transition-colors ${showKeyboard ? 'border-green-400' : 'border-white/20'}`}
            style={{ fontFamily: "'CarlMarx', Impact, sans-serif", color: mundialName ? '#fff' : 'rgba(255,255,255,0.2)', minHeight: 72 }}
          >
            {mundialName || 'RAUL GUTIERREZ'}
          </div>
        </div>

        {showKeyboard && (
          <VirtualKeyboard
            value={mundialName}
            onChange={setMundialName}
            onClose={() => setShowKeyboard(false)}
          />
        )}

        {/* Gender selector */}
        <div className="w-full space-y-2">
          <label className="carlmarx-regular text-white/60 text-lg uppercase tracking-widest">Género</label>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMundialGender('M')}
              className={`py-4 rounded-xl border-2 carlmarx-bold text-xl uppercase transition-all flex items-center justify-center gap-3 ${mundialGender === 'M' ? 'border-blue-400 bg-blue-400/20 text-blue-300' : 'border-white/20 bg-white/5 text-white'}`}>
              <span>👨</span> Jugador
            </button>
            <button onClick={() => setMundialGender('F')}
              className={`py-4 rounded-xl border-2 carlmarx-bold text-xl uppercase transition-all flex items-center justify-center gap-3 ${mundialGender === 'F' ? 'border-pink-400 bg-pink-400/20 text-pink-300' : 'border-white/20 bg-white/5 text-white'}`}>
              <span>👩</span> Jugadora
            </button>
          </div>
        </div>

        {/* Position selector */}
        <div className="w-full space-y-2">
          <label className="carlmarx-regular text-white/60 text-lg uppercase tracking-widest">Tu posición</label>
          <div className="grid grid-cols-4 gap-3">
            {POSITIONS.map(p => (
              <button key={p} onClick={() => setMundialPosition(p)}
                className={`py-3 px-2 rounded-xl border-2 carlmarx-bold text-base uppercase transition-all ${mundialPosition === p ? 'border-green-400 bg-green-400/20 text-green-300' : 'border-white/20 bg-white/5 text-white hover:border-white/40'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            if (!mundialName.trim()) { toast.error('Ingresá tu nombre'); return; }
            if (!mundialPosition) { toast.error('Elegí tu posición'); return; }
            
            const mundialTheme = {
              name: 'Carta Mundialista',
              prompt: `Professional digital caricature of ${mundialName} as a football player for ${mundialCountry?.name || 'Argentina'}, in the position of ${mundialPosition}, standing next to Lionel Messi in a World Cup celebration, vibrant stadium background, 8k resolution`
            };
            runAI(capturedImage!, mundialTheme);
          }}
          className="w-full py-6 rounded-2xl carlmarx-bold text-2xl text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 0 40px rgba(22,163,74,0.4)' }}
        >
          ⚽ ¡Generar mi carta de jugador!
        </button>

        <button onClick={() => setStep('mundialCountry')} className="text-white/40 text-lg carlmarx-regular hover:text-white/70 transition-colors">
          ← Cambiar país
        </button>
      </div>
    </div>
  );

  if (step === 'themeSelect') {
    const CATEGORY_LABELS: Record<string, string> = {
      deportes: '⚽ Deportes', fantasia: '🏰 Fantasía', epocas: '🕰️ Épocas',
      animacion: '🎬 Animación', moda: '👗 Moda', scifi: '🤖 Sci-Fi', aventura: '🌿 Aventura',
    };
    const grouped = themes.reduce((acc: Record<string, any[]>, t: any) => {
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
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-8 duration-300">
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
    <div className="kiosk-root">
      <ScreenBackground screen="processing" />
      <Corners />
      {capturedImage && <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover opacity-10 blur-md grayscale" />}
      <AIProcessing
        title={mode === 'selfie' ? 'Preparando tu foto' : 'Creando magia'}
        subtitle={mode === 'selfie' ? 'Aplicando los últimos retoques…' : undefined}
      />
    </div>
  );

  if (step === 'result') {
    const printerCfg = (() => { try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); } catch { return {}; } })();
    const igCfg = (() => { try { return JSON.parse(localStorage.getItem('kiosk_ig_settings') || '{}'); } catch { return {}; } })();
    const showPrint = generalSettings.showPrintButton !== false && printerCfg.autoPrint !== false;
    // QR solo con internet y con el equipo asignado a un evento (las fotos se suben ahí)
    const showQrBlock = generalSettings.showQr !== false && !offlineMode && (generalSettings.cloudSupabase ? !!kioskEventId : isDriveConfigured());
    // The QR points directly to the photo for downloading
    // El QR abre la página del invitado (bajar / compartir por WhatsApp o Instagram)
    const qrUrl = lastPublicUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=8&data=${encodeURIComponent(guestPhotoUrl(lastPublicUrl, generalSettings.eventTitle || undefined))}&bgcolor=ffffff&color=000000`
      : null;

    return (
      <div className="kiosk-root">
        <ScreenBackground screen="result" />
        <Corners />
        
        <div className="relative z-10 flex flex-col md:flex-row h-full items-center justify-center gap-6 md:gap-12 p-6 animate-in fade-in zoom-in duration-500 overflow-y-auto">
          {/* Photo Preview - ACHICADO PARA QUE ENTREN BOTONES */}
          {/* Se adapta a la hoja: vertical u horizontal */}
          <div className="relative flex-shrink-0 rounded-[2rem] overflow-hidden shadow-[0_0_80px_rgba(139,92,246,0.3)] border border-violet-500/30 group">
            {capturedImage && <motion.img key={capturedImage} src={capturedImage} alt="result" className="block w-auto h-auto max-h-[45vh] md:max-h-[70vh] max-w-[90vw] md:max-w-[55vw]" {...revealPhoto} />}
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
                <div className="w-36 h-36 shrink-0 rounded-2xl bg-white flex items-center justify-center overflow-hidden">
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
                  <p className="carlmarx-bold text-2xl leading-tight">{qrUrl ? 'Escaneá y llevátela' : uploading ? 'Preparando tu QR…' : 'QR no disponible'}</p>
                  <p className="text-slate-500 text-sm mt-1">{qrUrl ? 'Bajala al celular y compartila por WhatsApp o Instagram' : uploading ? 'Un segundo' : 'La foto quedó guardada en el equipo'}</p>
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
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowQrModal(false)} />
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
