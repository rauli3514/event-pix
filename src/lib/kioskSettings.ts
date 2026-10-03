// Configuración del kiosco guardada en el equipo. Las claves son las mismas que
// ya usaban KioskAI y KioskManager, así el panel web y la TV box siguen compatibles.

const GENERAL_KEY = 'kiosk_general_settings';
const CAMERA_KEY = 'kiosk_camera_settings';
const FRAME_KEY = 'kiosk_frame_url';

export interface KioskGeneralSettings {
  /** Nombre del evento (ej. "15 de Pía"): se muestra en la bienvenida y va en los marcos */
  eventTitle?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  /** Animación de la pantalla "Toca para empezar": '1' | '2' | '3' | 'none' */
  splashVideo?: string;
  enableSelfie?: boolean;
  enableAI?: boolean;
  enableMundial?: boolean;
  enableCaricatura?: boolean;
  enableFiguritas?: boolean;
  showQr?: boolean;
  showPrintButton?: boolean;
  /** Segundos en la pantalla del resultado antes de volver solo al inicio (0 = no vuelve) */
  resultTimeout?: number;
  /** Segundos sin tocar nada en las pantallas de elección antes de volver al inicio (0 = nunca) */
  idleTimeout?: number;
  autoFullscreen?: boolean;
  /** Sin conexión: solo foto, marco, impresión y respaldo (sin IA, QR ni subidas) */
  offline?: boolean;
  /** Mostrar "Repetir foto" en la vista previa (por defecto sí) */
  allowRetake?: boolean;
  /** Ícono "Galería" en el inicio */
  enableGallery?: boolean;
  /** Carpeta del equipo donde se guardan las fotos (vacío = nombre del evento) */
  localFolder?: string;
  /** Texto chico del marco de vidrio (el grande es siempre eventTitle) */
  frameSubtitle?: string;
  [key: string]: unknown;
}

export interface KioskCameraSettings {
  deviceId?: string;
  deviceLabel?: string;
  mirror?: boolean;
  rotation?: number;
  /** Segundos de cuenta regresiva */
  timer?: number;
  [key: string]: unknown;
}

const readJson = <T>(key: string): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as T;
  } catch {
    return {} as T;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin espacio (p. ej. un marco muy pesado): se ignora
  }
};

export const getGeneralSettings = () => readJson<KioskGeneralSettings>(GENERAL_KEY);
export const saveGeneralSettings = (patch: Partial<KioskGeneralSettings>) => {
  const next = { ...getGeneralSettings(), ...patch };
  writeJson(GENERAL_KEY, next);
  return next;
};

export const getCameraSettings = () => readJson<KioskCameraSettings>(CAMERA_KEY);
export const saveCameraSettings = (patch: Partial<KioskCameraSettings>) => {
  const next = { ...getCameraSettings(), ...patch };
  writeJson(CAMERA_KEY, next);
  return next;
};

/** null = sin marco */
export const getFrameUrl = () => {
  try {
    const v = localStorage.getItem(FRAME_KEY);
    return !v || v === 'none' ? null : v;
  } catch {
    return null;
  }
};
export const saveFrameUrl = (url: string | null) => {
  try {
    localStorage.setItem(FRAME_KEY, url || 'none');
    window.dispatchEvent(new Event('kiosk-frame-changed'));
    return true;
  } catch {
    return false;
  }
};

export const SPLASH_VIDEOS = [
  { value: '1', label: 'Animación 1', src: '/kiosk-animacion1.mp4' },
  { value: '2', label: 'Animación 2', src: '/kiosk-animacion2.mp4' },
  { value: '3', label: 'Animación 3', src: '/kiosk-animacion3.mp4' },
  { value: 'none', label: 'Sin animación', src: '' },
];

export const splashVideoSrc = (value?: string) =>
  value === 'none' ? '' : (SPLASH_VIDEOS.find(v => v.value === value) ?? SPLASH_VIDEOS[0]).src;

export const BUILT_IN_FRAMES = [
  { label: 'Marco 1', url: '/kiosk-marco-1.png' },
  { label: 'Marco 2', url: '/kiosk-marco-2.png' },
  { label: 'Marco 3', url: '/kiosk-marco-4.png' },
  { label: 'Marco 4', url: '/kiosk-marco-5.png' },
  { label: 'Mundial', url: '/kiosk-marco-mundial.png' },
];

// Impresión: misma clave que leen KioskAI (triggerPrint) y KioskManager
const PRINT_KEY = 'kiosk_print_settings';

export interface KioskPrintSettings {
  nativePrinter?: import('@/lib/nativePrint').NativePrinter | null;
  selectedPrinter?: string;
  paper?: import('@/lib/nativePrint').PaperSize;
  borderless?: boolean;
  copies?: number;
  autoPrint?: boolean;
  imageAdjust?: 'cover' | 'contain' | 'fill';
  orientation?: 'portrait' | 'landscape';
  rotation?: number;
  [key: string]: unknown;
}

export const getPrintSettings = () => readJson<KioskPrintSettings>(PRINT_KEY);
export const savePrintSettings = (patch: Partial<KioskPrintSettings>) => {
  const next = { ...getPrintSettings(), ...patch };
  writeJson(PRINT_KEY, next);
  return next;
};

// Bloqueo de sección: con una sección bloqueada (p. ej. "Fotos") el invitado no
// puede volver al inicio; se desbloquea con la clave de Ajustes. Persiste al reiniciar.
const LOCK_KEY = 'kiosk_section_lock';

export const getSectionLock = () => {
  try {
    return localStorage.getItem(LOCK_KEY) || null;
  } catch {
    return null;
  }
};
export const setSectionLock = (modes: string | null) => {
  try {
    if (modes) localStorage.setItem(LOCK_KEY, modes);
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    // sin almacenamiento
  }
};
