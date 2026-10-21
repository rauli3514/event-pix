// Ajustes de la cabina de video. Quedan en el equipo (como los del kiosco de
// fotos): la cámara (cuál, espejo, giro, calidad) se comparte con el kiosco.

const KEY = 'kiosk_video_settings';

export type VideoModeKey = 'clasico' | 'boomerang' | 'lenta' | '360' | 'firmas' | 'glam';
export type Aspect = '9:16' | '16:9' | '1:1';
/** Cómo se procesa el clip después de grabarlo. */
export type VideoEffect = 'none' | 'boomerang' | 'slowmo' | 'ramp';

export interface VideoModeDef {
  key: VideoModeKey;
  label: string;
  hint: string;
  effect: VideoEffect;
  /** Pantalla previa con una pregunta y grabación con micrófono */
  guestbook?: boolean;
  /** Se puede cortar antes de tiempo con "Terminar" */
  canStop?: boolean;
  defaults: VideoModeConfig;
  /** Duraciones que se ofrecen en Ajustes */
  secondsOptions: number[];
}

export interface VideoModeConfig {
  enabled: boolean;
  /** Segundos de grabación (lo que dura frente a la cámara) */
  seconds: number;
  /** Filtro de color (ver VIDEO_FILTERS) */
  filter: string;
  /** Lleva la música cargada en Ajustes */
  music: boolean;
  /** Graba el sonido del ambiente (micrófono) */
  mic: boolean;
}

export const VIDEO_MODES: VideoModeDef[] = [
  {
    key: 'clasico', label: 'Video', hint: 'Un clip con el marco del evento', effect: 'none', canStop: true,
    defaults: { enabled: true, seconds: 10, filter: 'none', music: false, mic: true },
    secondsOptions: [5, 8, 10, 15, 20],
  },
  {
    key: 'boomerang', label: 'Boomerang', hint: 'Va y vuelve, en loop', effect: 'boomerang',
    defaults: { enabled: true, seconds: 2, filter: 'none', music: true, mic: false },
    secondsOptions: [1, 2, 3],
  },
  {
    key: 'lenta', label: 'Cámara lenta', hint: 'Todo en slow motion', effect: 'slowmo',
    defaults: { enabled: true, seconds: 4, filter: 'none', music: true, mic: false },
    secondsOptions: [3, 4, 5, 6, 8],
  },
  {
    key: '360', label: 'Plataforma 360', hint: 'Normal, lento, rápido y reversa', effect: 'ramp', canStop: true,
    defaults: { enabled: false, seconds: 8, filter: 'none', music: true, mic: false },
    secondsOptions: [6, 8, 10, 12, 15],
  },
  {
    key: 'firmas', label: 'Libro de firmas', hint: 'Dejá un mensaje en video', effect: 'none', guestbook: true, canStop: true,
    defaults: { enabled: true, seconds: 30, filter: 'none', music: false, mic: true },
    secondsOptions: [15, 30, 45, 60],
  },
  {
    key: 'glam', label: 'Glam', hint: 'Blanco y negro de revista, en cámara lenta', effect: 'slowmo',
    defaults: { enabled: true, seconds: 4, filter: 'glam-bw', music: true, mic: false },
    secondsOptions: [3, 4, 5, 6],
  },
];

/** Filtros de la cabina de video: los "glam" suavizan la piel con un brillo difuso. */
export const VIDEO_FILTERS = [
  { value: 'none', label: 'Normal', css: '', glow: 0 },
  { value: 'glam-bw', label: 'Glam B&N', css: 'grayscale(1) contrast(1.28) brightness(1.06)', glow: 0.32, vignette: true },
  { value: 'glam', label: 'Glam color', css: 'contrast(1.08) saturate(1.15) brightness(1.05)', glow: 0.28 },
  { value: 'bw', label: 'Blanco y negro', css: 'grayscale(1) contrast(1.1)', glow: 0 },
  { value: 'vintage', label: 'Vintage', css: 'sepia(0.45) contrast(1.05) saturate(0.85) brightness(1.05)', glow: 0.12, vignette: true },
  { value: 'warm', label: 'Cálido', css: 'sepia(0.2) saturate(1.3) hue-rotate(-8deg)', glow: 0 },
  { value: 'cold', label: 'Frío', css: 'saturate(1.1) hue-rotate(14deg) brightness(1.03)', glow: 0 },
  { value: 'pop', label: 'Pop', css: 'saturate(1.8) contrast(1.15)', glow: 0 },
] as { value: string; label: string; css: string; glow: number; vignette?: boolean }[];
export const videoFilter = (value?: string) => VIDEO_FILTERS.find(f => f.value === value) ?? VIDEO_FILTERS[0];

/** Rampas de velocidad del 360 (como las de las apps de plataformas giratorias). */
export const RAMP_PRESETS = [
  { value: 'clasica', label: 'Clásica', hint: 'Normal → lento → rápido → reversa' },
  { value: 'epica', label: 'Épica', hint: 'Rápido → muy lento → rápido → reversa' },
  { value: 'suave', label: 'Suave', hint: 'Todo en cámara lenta, sin reversa' },
] as const;
export type RampPreset = typeof RAMP_PRESETS[number]['value'];

export const DEFAULT_PROMPTS = [
  'Dejales un mensaje a los protagonistas de la noche',
  '¿Qué consejo les darías para los próximos años?',
  'Contá una anécdota que hayan vivido juntos',
  '¿Qué les deseás para este nuevo comienzo?',
  'Mandá un saludo con tu mejor paso de baile',
];

export interface VideoBoothSettings {
  modes?: Partial<Record<VideoModeKey, Partial<VideoModeConfig>>>;
  /** Forma del video: vertical (historias), horizontal o cuadrado */
  aspect?: Aspect;
  /** Lado corto del video en píxeles */
  resolution?: 720 | 1080;
  /** Segundos de cuenta regresiva antes de grabar */
  countdown?: number;
  /** Marco: ninguno, el nombre del evento o un PNG propio */
  overlay?: 'none' | 'title' | 'custom';
  /** Texto del marco "nombre del evento" (por defecto el título del evento) */
  overlayText?: string;
  /** Volumen de la música (0 a 1) */
  musicVolume?: number;
  /** Velocidad de la cámara lenta */
  slowSpeed?: number;
  rampPreset?: RampPreset;
  /** Veces que va y vuelve el boomerang */
  boomerangLoops?: number;
  /** Preguntas del libro de firmas (una al azar por invitado) */
  prompts?: string[];
  /** Mostrar QR para bajar el video */
  showQr?: boolean;
  /** Segundos que queda el resultado en pantalla */
  resultSeconds?: number;
  /** Texto grande de la pantalla de inicio */
  title?: string;
  /** Celular / tablet itinerante: cámara de adelante o de atrás (si no se eligió una en Ajustes del kiosco) */
  facing?: 'user' | 'environment';
  /** Pedir 60 cuadros por segundo para las cámaras lentas (si la cámara lo da) */
  highFps?: boolean;
  /** El invitado ve su video y elige entre quedárselo o repetir */
  review?: boolean;
}

export const getVideoSettings = (): VideoBoothSettings => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as VideoBoothSettings;
  } catch {
    return {};
  }
};

export const saveVideoSettings = (patch: Partial<VideoBoothSettings>) => {
  const next = { ...getVideoSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* sin espacio */ }
  window.dispatchEvent(new Event('video-settings-changed'));
  return next;
};

export const modeConfig = (key: VideoModeKey, s: VideoBoothSettings = getVideoSettings()): VideoModeConfig => {
  const def = VIDEO_MODES.find(m => m.key === key)!;
  return { ...def.defaults, ...(s.modes?.[key] ?? {}) };
};

export const saveModeConfig = (key: VideoModeKey, patch: Partial<VideoModeConfig>) => {
  const s = getVideoSettings();
  return saveVideoSettings({ modes: { ...(s.modes ?? {}), [key]: { ...(s.modes?.[key] ?? {}), ...patch } } });
};

export const enabledModes = (s: VideoBoothSettings = getVideoSettings()) =>
  VIDEO_MODES.filter(m => modeConfig(m.key, s).enabled);

/** Tamaño del video en píxeles según forma y resolución. */
export const outputSize = (s: VideoBoothSettings = getVideoSettings()) => {
  const short = s.resolution ?? 720;
  const long = Math.round((short * 16) / 9 / 2) * 2;
  switch (s.aspect ?? '9:16') {
    case '16:9': return { width: long, height: short };
    case '1:1': return { width: short, height: short };
    default: return { width: short, height: long };
  }
};
