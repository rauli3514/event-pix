// Configuración del kiosco guardada en el equipo. Las claves son las mismas que
// ya usaban KioskAI y KioskManager, así el panel web y la TV box siguen compatibles.

const GENERAL_KEY = 'kiosk_general_settings';
const CAMERA_KEY = 'kiosk_camera_settings';
const FRAME_KEY = 'kiosk_frame_url';

/** Pregunta de la trivia de la fiesta (Ajustes → Experiencias). answer = índice de la correcta. */
export interface TriviaQuestion { q: string; options: string[]; answer: number }

/** Preguntas de la trivia completas (pregunta, al menos 2 opciones y la correcta marcada). */
export const validTrivia = (list: TriviaQuestion[] | undefined) =>
  (list ?? []).filter(q => q.q?.trim() && (q.options ?? []).filter(o => o?.trim()).length >= 2 && q.options[q.answer]?.trim());

export interface KioskGeneralSettings {
  /** Nombre del evento (ej. "15 de Pía"): se muestra en la bienvenida y va en los marcos */
  eventTitle?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  /** Animación de la pantalla "Toca para empezar": una de SPLASH_STYLES o un video '1' | '2' | '3' | 'none' */
  splashVideo?: string;
  /** Color del nombre del evento en la bienvenida (ver NAME_STYLES) */
  nameStyle?: 'white' | 'gold' | 'gradient' | 'neon';
  /** Diseño de la hoja (experiencia Fotos): 'auto' | 'portrait' | 'landscape' */
  photoOrientation?: 'auto' | 'portrait' | 'landscape';
  /** Fotos por toma (1 a 4) */
  photoShots?: number;
  /** Segundos de pausa entre fotos de una toma múltiple (por defecto 10) */
  shotPause?: number;
  /** Tira doble (dos tiras iguales para cortar al medio) */
  photoStrips?: boolean;
  /** Hay una imagen de fondo para la hoja impresa (guardada en el equipo) */
  pageBackground?: boolean;
  /** Subir también a Supabase para el QR (si no, el QR usa Drive) */
  cloudSupabase?: boolean;
  /** Pedir el nombre del invitado para ponerlo en la foto */
  askGuestName?: boolean;
  /** Filtros de color para elegir después de la foto */
  enableFilters?: boolean;
  /** Filtros habilitados (valores de COLOR_FILTERS) */
  filters?: string[];
  /** Accesorios que siguen la cara */
  enableAccessories?: boolean;
  /** Accesorios habilitados (incluidos o 'custom:<id>') */
  accessories?: string[];
  /** Accesorios PNG subidos (la imagen queda en el equipo) */
  customAccessories?: { id: string; name: string; anchor: 'eyes' | 'head' | 'mouth'; scale: number }[];
  /** Fondo de cada pantalla (ver kioskMedia.ts) */
  screenBackgrounds?: Record<string, string>;
  /** Rotación de la pantalla en grados (tele colgada en vertical) */
  screenRotation?: number;
  /** El invitado elige el marco después de la foto */
  guestFrameChoice?: boolean;
  /** Marcos que puede elegir el invitado (valores como en kiosk_frame_url) */
  guestFrames?: string[];
  enableSelfie?: boolean;
  enableAI?: boolean;
  enableMundial?: boolean;
  enableCaricatura?: boolean;
  enableFiguritas?: boolean;
  /** Portada Fashion (tapa de revista, sin IA): aparece en "Fotos" */
  enablePortada?: boolean;
  /** Portada Fashion con IA (en Fotos IA, gasta un crédito): por defecto sí */
  enablePortadaAI?: boolean;
  portadaTitle?: string;
  portadaIssue?: string;
  /** Titulares, uno por línea */
  portadaHeadlines?: string;
  portadaStarLabel?: string;
  portadaBadge?: string;
  portadaColor?: 'white' | 'black' | 'red' | 'gold' | 'pink';
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
  /** Botón "Galería" en la bienvenida de cada sección (por defecto sí) */
  splashGallery?: boolean;
  /** Ícono "Galería" en el inicio */
  enableGallery?: boolean;
  /** Carpeta del equipo donde se guardan las fotos (vacío = nombre del evento) */
  localFolder?: string;
  /** Fotos: un juego al azar durante un minuto antes del resultado (con la IA siempre hay juego) */
  photoGame?: boolean;
  /** Preguntas de la trivia de la fiesta (sobre los novios, la quinceañera…) */
  triviaQuestions?: TriviaQuestion[];
  /** Ingreso VIP: ícono en el inicio y pantalla "Buscá tu mesa" (Ajustes → Ingreso VIP) */
  enableVip?: boolean;
  vipTitle?: string;
  vipSubtitle?: string;
  /** Mostrar el video de bienvenida antes de la mesa (si hay uno cargado; por defecto sí) */
  vipVideo?: boolean;
  /** Segundos que se muestra la mesa antes de volver (por defecto 15) */
  vipResultSeconds?: number;
  /** Hora de ingreso de la trasnoche (ej. "02:00") */
  vipAfterPartyTime?: string;
  /** Disparador Bluetooth: la foto espera el botón (o un toque) en vez de arrancar sola */
  bluetoothShutter?: boolean;
  /** Modo liviano para equipos con poca potencia (ver liteMode.ts) */
  liteMode?: boolean;
  /** Protector de pantalla con el logo animado (por defecto sí) */
  screensaver?: boolean;
  /** Minutos sin tocar nada para que aparezca el protector (por defecto 5) */
  screensaverMinutes?: number;
  /** Texto chico del marco de vidrio (el grande es siempre eventTitle) */
  frameSubtitle?: string;
  [key: string]: unknown;
}

export interface KioskCameraSettings {
  deviceId?: string;
  deviceLabel?: string;
  mirror?: boolean;
  rotation?: number;
  /** Resolución pedida a la webcam ('auto' = la más alta que dé) */
  quality?: 'auto' | '1080' | '720' | '480';
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

// Bienvenida: animaciones propias (hechas en código, livianas para la TV box) y los videos de antes
export const SPLASH_STYLES = [
  { value: 'polaroids', label: 'Lluvia de fotos' },
  { value: 'flash', label: 'Flash de cámara' },
  { value: 'neon', label: 'Neón' },
  { value: 'fiesta', label: 'Fiesta' },
] as const;

export const SPLASH_VIDEOS = [
  { value: '1', label: 'Video 1', src: '/kiosk-animacion1.mp4' },
  { value: '2', label: 'Video 2', src: '/kiosk-animacion2.mp4' },
  { value: '3', label: 'Video 3', src: '/kiosk-animacion3.mp4' },
  { value: 'none', label: 'Sin animación', src: '' },
];

export const DEFAULT_SPLASH = 'polaroids';
export const splashStyleOf = (value?: string) => value || DEFAULT_SPLASH;
export const isAnimatedSplash = (value?: string) => SPLASH_STYLES.some(s => s.value === splashStyleOf(value));

export const splashVideoSrc = (value?: string) =>
  SPLASH_VIDEOS.find(v => v.value === splashStyleOf(value))?.src ?? '';

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
  /** % de agrandado para tapar la franja blanca sin bordes */
  bleed?: number;
  printFormat?: 'auto' | 'jpeg' | 'pwg';
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
