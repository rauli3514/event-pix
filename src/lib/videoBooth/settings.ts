// Ajustes de la app EventPix Video. Quedan guardados en el equipo y se pueden
// cambiar desde el panel de la cabina (/admin/cabina-video).

const KEY = 'video_settings';

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
  /** Duración que se puede elegir (segundos) */
  minSeconds: number;
  maxSeconds: number;
  stepSeconds: number;
}

/** Rampa de velocidad: tramos hacia adelante y final con los cuadros guardados. */
export interface RampConfig {
  /** Tramos: hasta qué parte del clip (0 a 1) y a qué velocidad */
  segments: { until: number; speed: number }[];
  /** Final en reversa (y de nuevo adelante si se quiere) */
  tail: { enabled: boolean; seconds: number; speed: number; parts: ('rev' | 'fwd')[] };
}

/**
 * Ajustes de cada experiencia. Los opcionales que no se tocan usan los de
 * "General" (así, por ejemplo, una canción para todas y otra solo para el 360).
 */
export interface VideoModeConfig {
  enabled: boolean;
  /** Segundos de grabación (lo que dura frente a la cámara) */
  seconds: number;
  /** Filtro de color (ver VIDEO_FILTERS) */
  filter: string;
  /** Lleva música */
  music: boolean;
  /** Graba el sonido del ambiente (micrófono) */
  mic: boolean;
  /** Canción: un ID, 'random' (al azar) o 'guest' (la elige el invitado). Vacío = la de General */
  songId?: string;
  /** Marco propio de esta experiencia (vacío = el de General) */
  overlay?: 'none' | 'title' | 'custom';
  frameId?: string;
  frameChoice?: boolean;
  /** Animación: una, 'random' (una al azar de animationPool) o vacío = la de General */
  animation?: AnimationKey | 'random';
  /** Animaciones para "al azar" y para que el invitado elija en la pantalla */
  animationPool?: AnimationKey[];
  /** Accesorio en la cara: uno, 'random' o vacío = el de General */
  accessory?: string;
  /** El invitado puede cambiar la animación y el accesorio en la pantalla de la toma */
  fxChoice?: boolean;
  /** Cuenta regresiva propia (vacío = la de General) */
  countdown?: number;
  /** 360: rampa de velocidad */
  ramp?: RampConfig;
  /** Boomerang: vueltas y velocidad */
  loops?: number;
  speed?: number;
  /** Cámara lenta / glam: velocidad (0.25 a 1) */
  slowSpeed?: number;
  /** Fondo de las pantallas de esta experiencia (vacío = el de General) */
  background?: string;
  /** El invitado ve su video y elige quedárselo o repetir (vacío = como en General) */
  review?: boolean;
  /** Aura de neón / rayos alrededor de las personas (vacío = como en General) */
  aura?: string;
  auraColor?: string;
}

export const VIDEO_MODES: VideoModeDef[] = [
  {
    key: 'clasico', label: 'Video', hint: 'Un clip con el marco del evento', effect: 'none', canStop: true,
    defaults: { enabled: true, seconds: 10, filter: 'none', music: false, mic: true },
    minSeconds: 3, maxSeconds: 60, stepSeconds: 1,
  },
  {
    key: 'boomerang', label: 'Boomerang', hint: 'Va y vuelve, en loop', effect: 'boomerang',
    defaults: { enabled: true, seconds: 2, filter: 'none', music: true, mic: false },
    minSeconds: 1, maxSeconds: 5, stepSeconds: 0.5,
  },
  {
    key: 'lenta', label: 'Cámara lenta', hint: 'Todo en slow motion', effect: 'slowmo',
    defaults: { enabled: true, seconds: 4, filter: 'none', music: true, mic: false },
    minSeconds: 2, maxSeconds: 15, stepSeconds: 1,
  },
  {
    key: '360', label: 'Plataforma 360', hint: 'Normal, lento, rápido y reversa', effect: 'ramp', canStop: true,
    defaults: { enabled: false, seconds: 8, filter: 'none', music: true, mic: false },
    minSeconds: 4, maxSeconds: 30, stepSeconds: 1,
  },
  {
    key: 'firmas', label: 'Libro de firmas', hint: 'Dejá un mensaje en video', effect: 'none', guestbook: true, canStop: true,
    defaults: { enabled: true, seconds: 30, filter: 'none', music: false, mic: true },
    minSeconds: 10, maxSeconds: 180, stepSeconds: 5,
  },
  {
    key: 'glam', label: 'Glam', hint: 'Blanco y negro de revista, en cámara lenta', effect: 'slowmo',
    defaults: { enabled: true, seconds: 4, filter: 'glam-bw', music: true, mic: false },
    minSeconds: 2, maxSeconds: 15, stepSeconds: 1,
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
  { value: 'cine', label: 'Cine', css: 'contrast(1.15) saturate(1.2) sepia(0.18) hue-rotate(-12deg)', glow: 0.1, vignette: true },
  { value: 'sueno', label: 'Soñado', css: 'brightness(1.12) saturate(1.1) contrast(0.95)', glow: 0.4 },
  { value: 'neon', label: 'Neón', css: 'saturate(2.2) contrast(1.2) hue-rotate(20deg)', glow: 0.2 },
  { value: 'retro', label: 'Retro', css: 'sepia(0.6) saturate(1.4) contrast(1.1) hue-rotate(-20deg)', glow: 0.08, vignette: true },
] as { value: string; label: string; css: string; glow: number; vignette?: boolean }[];
export const videoFilter = (value?: string) => VIDEO_FILTERS.find(f => f.value === value) ?? VIDEO_FILTERS[0];

/** Rampas de velocidad del 360 listas para usar (se pueden editar después). */
export const RAMP_PRESETS: { value: string; label: string; hint: string; ramp: RampConfig }[] = [
  {
    value: 'clasica', label: 'Clásica', hint: 'Normal → lento → rápido → reversa',
    ramp: { segments: [{ until: 0.35, speed: 1 }, { until: 0.75, speed: 0.5 }, { until: 1, speed: 2 }], tail: { enabled: true, seconds: 2, speed: 1.5, parts: ['rev'] } },
  },
  {
    value: 'epica', label: 'Épica', hint: 'Rápido → muy lento → rápido → reversa y vuelta',
    ramp: { segments: [{ until: 0.2, speed: 2 }, { until: 0.7, speed: 0.35 }, { until: 1, speed: 1.6 }], tail: { enabled: true, seconds: 2, speed: 2, parts: ['rev', 'fwd'] } },
  },
  {
    value: 'suave', label: 'Suave', hint: 'Todo en cámara lenta, sin reversa',
    ramp: { segments: [{ until: 1, speed: 0.6 }], tail: { enabled: false, seconds: 2, speed: 1, parts: ['rev'] } },
  },
  {
    value: 'drop', label: 'Drop', hint: 'Lento, de golpe rápido y reversa en cámara lenta',
    ramp: { segments: [{ until: 0.5, speed: 0.4 }, { until: 1, speed: 2.5 }], tail: { enabled: true, seconds: 2, speed: 0.6, parts: ['rev'] } },
  },
];
export type RampPreset = string;
export const SPEEDS = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3];
export const speedLabel = (v: number) => (v === 0.33 ? '⅓×' : v === 0.25 ? '¼×' : v === 0.5 ? '½×' : v === 0.75 ? '¾×' : `${v}×`);

export const DEFAULT_PROMPTS = [
  'Dejales un mensaje a los protagonistas de la noche',
  '¿Qué consejo les darías para los próximos años?',
  'Contá una anécdota que hayan vivido juntos',
  '¿Qué les deseás para este nuevo comienzo?',
  'Mandá un saludo con tu mejor paso de baile',
];

export interface VideoBoothSettings {
  /** Nombre del evento: carpeta de los videos, marco y placa final */
  eventTitle?: string;
  /** Sin internet: no muestra QR ni WhatsApp (los videos quedan en el equipo) */
  offline?: boolean;
  /** Sitio de la página del invitado (vacío = el de EventPix) */
  publicSiteUrl?: string;
  /** Google Drive propio de la cabina: dirección del Apps Script y link de la carpeta */
  driveScriptUrl?: string;
  driveFolderLink?: string;
  modes?: Partial<Record<VideoModeKey, Partial<VideoModeConfig>>>;
  /** Forma del video: vertical (historias), horizontal o cuadrado */
  aspect?: Aspect;
  /** Lado corto del video en píxeles */
  resolution?: 720 | 1080;
  /** Segundos de cuenta regresiva antes de grabar */
  countdown?: number;
  /** Marco: ninguno, el nombre del evento o un PNG propio */
  overlay?: 'none' | 'title' | 'custom';
  /** Texto grande del marco (por defecto el nombre del evento) */
  overlayText?: string;
  /** Fecha del marco: la de hoy, la que se escribe o ninguna */
  overlayDateMode?: 'auto' | 'custom' | 'none';
  /** Fecha (o texto chico) escrita a mano, ej. "14 de diciembre de 2026" */
  overlayDate?: string;
  /** Nombre y fecha también encima del marco PNG */
  frameText?: boolean;
  /** Dónde van el nombre y la fecha */
  textPosition?: 'bottom' | 'top';
  textColor?: string;
  /** Tamaño del texto (1 = normal) */
  textScale?: number;
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
  /** Fondo de las pantallas: 'aurora' (el de siempre), uno de fábrica (t-…) o un fondo propio (ID) */
  background?: string;
  /** Fondos propios (imágenes o videos; el archivo está en el equipo: bgKey(id)) */
  backgrounds?: MediaItem[];
  /** Cuánto se oscurece un fondo propio para que se lean los textos (0 a 0.8) */
  backgroundDim?: number;
  /** Libro de firmas: título (por defecto "Libro de firmas") y un texto propio */
  guestbookTitle?: string;
  guestbookText?: string;
  /** Celular / tablet itinerante: cámara de adelante o de atrás (si no se eligió una en Ajustes del kiosco) */
  facing?: 'user' | 'environment';
  /** Pedir 60 cuadros por segundo para las cámaras lentas (si la cámara lo da) */
  highFps?: boolean;
  /** El invitado ve su video y elige entre quedárselo o repetir */
  review?: boolean;

  // ─── Marcos y capas ───
  /** Marcos PNG cargados (el archivo está en el equipo: frameKey(id)) */
  frames?: MediaItem[];
  /** Marco por defecto cuando overlay = 'custom' ('random' = uno al azar en cada video) */
  frameId?: string;
  /** El invitado elige el marco (si hay más de uno) */
  frameChoice?: boolean;
  /** Marcos para elegir o para "al azar" (vacío = los cargados; sin cargados, los de fábrica) */
  guestFrames?: string[];
  /** Animación encima del video */
  animation?: AnimationKey;
  /** Animación propia (video): mezcla "pantalla" para videos con fondo negro */
  animBlend?: 'screen' | 'normal';
  /** Accesorio que sigue la cara (los del kiosco de fotos) */
  accessory?: string;
  /** Aura de neón o rayos alrededor de las personas (ver AURA_STYLES) y su color */
  aura?: string;
  auraColor?: string;

  // ─── Marca ───
  showLogo?: boolean;
  logoPosition?: Corner;
  /** Ancho del logo (fracción del ancho del video) */
  logoSize?: number;
  logoOpacity?: number;
  /** Texto encima del video (ej. @tuempresa) */
  watermark?: string;
  watermarkPosition?: WatermarkPosition;
  /** Alto de la letra (fracción del lado corto del video) */
  watermarkSize?: number;
  watermarkOpacity?: number;
  /** Color de la marca (placa final, neón, franja del nombre) */
  brandColor?: string;
  /** Placa final con el logo y el nombre del evento */
  endCard?: boolean;
  endCardSeconds?: number;
  endCardText?: string;
  /** Con imagen propia de fondo (endCardKey): logo y textos encima o solo la imagen */
  endCardOverlay?: boolean;

  // ─── Efectos ───
  /** Acercamiento suave durante el video (modos con efectos) */
  zoomEffect?: boolean;
  /** Destello en cada cambio de velocidad (360) */
  flashEffect?: boolean;

  // ─── Música ───
  songs?: SongItem[];
  /** Una fija, una al azar o la elige el invitado */
  songMode?: 'fixed' | 'random' | 'guest';
  songId?: string;

  // ─── 360 por movimiento ───
  /** Empieza a grabar sola cuando la plataforma gira */
  autoStart360?: boolean;
  /** Corta sola cuando la plataforma para */
  autoStop360?: boolean;
  /** Nivel de movimiento que dispara (0–100, se calibra en Ajustes) */
  motionThreshold?: number;
  /** Después de cada video vuelve directo a esperar el próximo giro */
  continuous360?: boolean;

  // ─── Entrega ───
  /** Qué abre el QR: el video, la galería del evento o los dos */
  delivery?: 'video' | 'gallery' | 'both';
  /** Código de la galería online del evento */
  galleryCode?: string;
  /** Nombre del evento con el que se creó ese código (si cambia el evento, galería nueva) */
  galleryEvent?: string;
  /** La app busca e instala sola las versiones nuevas */
  autoUpdate?: boolean;
  /** Galería: los videos aparecen solos ('post', se pueden ocultar después) o después de aprobarlos ('pre') */
  galleryModeration?: 'post' | 'pre';
  /** Botón "Enviar por WhatsApp" en el resultado */
  whatsappEnabled?: boolean;
  /** Código de país (y 9 para celulares de Argentina) que va antes del número */
  whatsappPrefix?: string;
}

export interface MediaItem { id: string; name: string }
export interface SongItem extends MediaItem { /** Segundo de la canción donde empieza */ start?: number }
export type Corner = 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'center';
/** 'tile' = repetida en diagonal por toda la pantalla */
export type WatermarkPosition = Corner | 'tile';

export const ANIMATIONS = [
  { value: 'none', label: 'Sin animación' },
  { value: 'confeti', label: 'Confeti' },
  { value: 'brillos', label: 'Brillos' },
  { value: 'corazones', label: 'Corazones' },
  { value: 'burbujas', label: 'Burbujas' },
  { value: 'nieve', label: 'Nieve' },
  { value: 'neon', label: 'Borde neón' },
  { value: 'globos', label: 'Globos' },
  { value: 'fuegos', label: 'Fuegos artificiales' },
  { value: 'petalos', label: 'Pétalos' },
  { value: 'luces', label: 'Luces bokeh' },
  { value: 'dorado', label: 'Polvo dorado' },
  { value: 'emojis', label: 'Emojis' },
  { value: 'notas', label: 'Notas musicales' },
  { value: 'custom', label: 'Video propio' },
] as const;
export type AnimationKey = typeof ANIMATIONS[number]['value'];
/** Animaciones dibujadas por la app (las que entran en "al azar" y en el selector de la toma) */
export const BUILT_IN_ANIMATIONS = ANIMATIONS.map(a => a.value).filter(v => v !== 'none' && v !== 'custom') as AnimationKey[];
export const animationLabel = (v?: string) => ANIMATIONS.find(a => a.value === v)?.label ?? 'Sin animación';

export const CORNERS: { value: Corner; label: string }[] = [
  { value: 'tl', label: 'Arriba izquierda' }, { value: 'top', label: 'Arriba al centro' }, { value: 'tr', label: 'Arriba derecha' },
  { value: 'bl', label: 'Abajo izquierda' }, { value: 'bottom', label: 'Abajo al centro' }, { value: 'br', label: 'Abajo derecha' },
  { value: 'center', label: 'En el medio' },
];
export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [...CORNERS, { value: 'tile', label: 'Repetida en toda la pantalla' }];
export const WATERMARK_SIZES = [
  { value: 0.035, label: 'Chica' }, { value: 0.06, label: 'Mediana' }, { value: 0.1, label: 'Grande' }, { value: 0.16, label: 'Muy grande' }, { value: 0.24, label: 'Gigante' },
];
export const LOGO_SIZES = [0.15, 0.22, 0.35, 0.5, 0.7, 0.9];
export const TEXT_SCALES = [{ value: 0.8, label: 'Chico' }, { value: 1, label: 'Normal' }, { value: 1.3, label: 'Grande' }, { value: 1.7, label: 'Muy grande' }];

/** Fecha que va en el marco según Ajustes ('' = sin fecha). */
export const overlayDateText = (s: VideoBoothSettings) => {
  const mode = s.overlayDateMode ?? 'auto';
  if (mode === 'none') return '';
  if (mode === 'custom') return (s.overlayDate || '').trim();
  return new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Archivos guardados en el equipo (mediaStore.ts)
export const frameKey = (id: string) => `video:frame:${id}`;
export const songKey = (id: string) => `video:song:${id}`;
export const LOGO_KEY = 'video:logo';
export const ANIM_KEY = 'video:anim';
export const END_KEY = 'video:endcard';
export const newMediaId = () => Math.random().toString(36).slice(2, 10);

/** Texto sin acentos ni símbolos, para direcciones (ej. "Boda Sofi & Juan" → "boda-sofi-juan"). */
export const slugify = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28).replace(/-+$/, '');

/**
 * Código nuevo para la galería online: el nombre del evento y 4 letras al azar
 * (ej. "boda-sofi-juan-k7m2"), así se reconoce fácil y no se adivina.
 */
export const newGalleryCode = (eventTitle?: string) => {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const rnd = (n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => abc[x % abc.length]).join('');
  const base = slugify(eventTitle || '');
  return base ? `${base}-${rnd(4)}` : rnd(8);
};

/** Código de la galería del evento: se crea solo y cambia cuando cambia el nombre del evento. */
export const galleryCode = () => {
  const s = getVideoSettings();
  const event = (s.eventTitle || '').trim();
  if (s.galleryCode && (s.galleryEvent ?? '') === event) return s.galleryCode;
  const code = newGalleryCode(event);
  saveVideoSettings({ galleryCode: code, galleryEvent: event });
  return code;
};

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

/** Todo lo que usa una experiencia, con lo de General donde la experiencia no tiene algo propio. */
export interface ResolvedMode {
  def: VideoModeDef;
  cfg: VideoModeConfig;
  songMode: 'fixed' | 'random' | 'guest';
  songId?: string;
  overlay: 'none' | 'title' | 'custom';
  frameId?: string;
  frameChoice: boolean;
  /** 'random' = se elige una de animationPool en cada video */
  animation: AnimationKey | 'random';
  animationPool: AnimationKey[];
  accessory: string;
  fxChoice: boolean;
  countdown: number;
  ramp: RampConfig;
  loops: number;
  speed: number;
  slowSpeed: number;
  background: string;
  review: boolean;
  aura: string;
  auraColor: string;
}

export function resolveMode(key: VideoModeKey, s: VideoBoothSettings = getVideoSettings()): ResolvedMode {
  const def = VIDEO_MODES.find(m => m.key === key)!;
  const cfg = modeConfig(key, s);
  const song = cfg.songId || '';
  const legacyRamp = RAMP_PRESETS.find(r => r.value === s.rampPreset)?.ramp;
  return {
    def, cfg,
    songMode: song === 'random' ? 'random' : song === 'guest' ? 'guest' : song ? 'fixed' : (s.songMode ?? 'fixed'),
    songId: song && song !== 'random' && song !== 'guest' ? song : s.songId,
    overlay: cfg.overlay ?? s.overlay ?? 'none',
    frameId: cfg.frameId ?? s.frameId,
    frameChoice: cfg.frameChoice ?? !!s.frameChoice,
    animation: cfg.animation ?? s.animation ?? 'none',
    animationPool: cfg.animationPool?.length ? cfg.animationPool : BUILT_IN_ANIMATIONS,
    accessory: cfg.accessory ?? s.accessory ?? 'none',
    fxChoice: !!cfg.fxChoice,
    countdown: cfg.countdown ?? s.countdown ?? 3,
    ramp: cfg.ramp ?? legacyRamp ?? RAMP_PRESETS[0].ramp,
    loops: Math.max(1, Math.min(8, cfg.loops ?? s.boomerangLoops ?? 3)),
    speed: cfg.speed ?? 1,
    slowSpeed: cfg.slowSpeed ?? s.slowSpeed ?? 0.5,
    background: cfg.background || s.background || 'aurora',
    review: cfg.review ?? s.review !== false,
    aura: cfg.aura ?? s.aura ?? 'none',
    auraColor: cfg.auraColor ?? s.auraColor ?? '#00e5ff',
  };
}

/** Duración del video final (aproximada) para mostrar en Ajustes. */
export function estimateDuration(r: ResolvedMode, seconds = r.cfg.seconds) {
  if (r.def.effect === 'none') return seconds;
  if (r.def.effect === 'slowmo') return seconds / r.slowSpeed;
  if (r.def.effect === 'boomerang') return (seconds * r.loops * 2) / r.speed;
  let total = 0;
  let from = 0;
  for (const seg of r.ramp.segments) { total += ((seg.until - from) * seconds) / seg.speed; from = seg.until; }
  if (r.ramp.tail.enabled) total += (Math.min(r.ramp.tail.seconds, seconds) * r.ramp.tail.parts.length) / r.ramp.tail.speed;
  return total;
}

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
