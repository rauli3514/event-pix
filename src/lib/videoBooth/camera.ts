// Cámara de la app EventPix Video: webcam USB en la TV box, o la cámara del
// celular/tablet (adelante o atrás). Ajustes propios, separados del kiosco.

const KEY = 'video_camera';

export interface VideoCameraSettings {
  deviceId?: string;
  deviceLabel?: string;
  mirror?: boolean;
  /** Giro de la imagen (cámara montada de costado) */
  rotation?: number;
  quality?: 'auto' | '1080' | '720' | '480';
  focus?: 'auto' | 'far';
}

export const getCameraSettings = (): VideoCameraSettings => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as VideoCameraSettings; } catch { return {}; }
};
export const saveCameraSettings = (patch: Partial<VideoCameraSettings>) => {
  const next = { ...getCameraSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin espacio */ }
  return next;
};

type Quality = NonNullable<VideoCameraSettings['quality']>;
const QUALITY: Record<Quality, MediaTrackConstraints> = {
  auto: { width: { ideal: 1920 }, height: { ideal: 1080 } },
  '1080': { width: { min: 1280, ideal: 1920 }, height: { min: 720, ideal: 1080 } },
  '720': { width: { min: 1280, ideal: 1280 }, height: { min: 720, ideal: 720 } },
  '480': { width: { ideal: 640 }, height: { ideal: 480 } },
};

export interface CameraOption { deviceId: string; label: string }

const describeCameraError = (err: unknown) => {
  switch ((err as { name?: string })?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'La app no tiene permiso para usar la cámara. Aceptá el permiso o activalo en Ajustes de Android → Apps → EventPix Video → Permisos.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró ninguna cámara. Conectá la webcam USB y probá de nuevo.';
    case 'NotReadableError':
    case 'AbortError':
      return 'La cámara está ocupada por otra app o se desconectó. Desenchufala, volvé a enchufarla y probá de nuevo.';
    default:
      return `No se pudo abrir la cámara${err instanceof Error && err.message ? ` (${err.message})` : ''}.`;
  }
};

/**
 * Abre la cámara elegida y, si no está o no da esa calidad, prueba con cualquiera.
 * fps: cuadros por segundo pedidos (60 para cámara lenta). facingMode: en celular.
 */
export async function openCameraStream(opts: { fps?: number; facingMode?: 'user' | 'environment' } = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este equipo no permite usar la cámara desde la app.');
  const cam = getCameraSettings();
  const more: MediaTrackConstraints = {
    frameRate: { ideal: opts.fps ?? 30 },
    ...(opts.facingMode && !cam.deviceId ? { facingMode: { ideal: opts.facingMode } } : {}),
  };
  const wanted = { ...QUALITY[cam.quality ?? 'auto'], ...more };
  const hd = { ...QUALITY.auto, ...more };
  const attempts: (MediaTrackConstraints | true)[] = [];
  if (cam.deviceId) {
    attempts.push({ ...wanted, deviceId: { exact: cam.deviceId } });
    if ((cam.quality ?? 'auto') !== 'auto') attempts.push({ ...hd, deviceId: { exact: cam.deviceId } });
  }
  attempts.push(wanted, hd, true);
  let lastError: unknown;
  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      if (cam.focus === 'far') await fixFocusFar(stream).catch(() => {});
      return stream;
    } catch (err) {
      lastError = err;
      if ((err as { name?: string })?.name === 'NotAllowedError') break;
    }
  }
  throw new Error(describeCameraError(lastError));
}

/** Enfoque fijo lejos (las webcams con autoenfoque "buscan" con poca luz). */
async function fixFocusFar(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[]; focusDistance?: { max: number } };
  if (!track || !caps.focusMode?.includes('manual') || !caps.focusDistance) return;
  await track.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: caps.focusDistance.max } as MediaTrackConstraintSet] });
}

/** Resolución y cuadros por segundo que realmente da la cámara. */
export function describeStream(stream: MediaStream | null) {
  const s = stream?.getVideoTracks()[0]?.getSettings();
  if (!s) return null;
  return { width: s.width ?? 0, height: s.height ?? 0, fps: s.frameRate ? Math.round(s.frameRate) : 0 };
}

/** Cámaras conectadas. Los nombres solo aparecen después de dar el permiso. */
export async function listCameras(): Promise<CameraOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }));
}

export const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach(t => t.stop());
