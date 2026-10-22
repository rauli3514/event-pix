import { isLiteMode } from '@/lib/liteMode';
import { getCameraSettings, type KioskCameraSettings } from '@/lib/kioskSettings';

// Cámara del kiosco (webcam USB en la TV box). Lo usan el kiosco y Ajustes.

type Quality = NonNullable<KioskCameraSettings['quality']>;
const QUALITY: Record<Quality, MediaTrackConstraints> = {
  auto: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  // Algunas webcams (p. ej. Logitech C920) en la TV box bajan la resolución para
  // dar 30 cuadros: pidiendo un mínimo se fuerza la imagen nítida
  '1080': { width: { min: 1280, ideal: 1920 }, height: { min: 720, ideal: 1080 } },
  '720': { width: { min: 1280, ideal: 1280 }, height: { min: 720, ideal: 720 } },
  '480': { width: { ideal: 640 }, height: { ideal: 480 } },
};

export interface CameraOption {
  deviceId: string;
  label: string;
}

const describeCameraError = (err: unknown) => {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'La app no tiene permiso para usar la cámara. Aceptá el permiso o activalo en Ajustes de Android → Apps → EventPix Kiosco → Permisos.';
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
 * Abre la cámara elegida y, si no está o no da esa calidad, prueba con cualquier
 * cámara: primero en alta resolución y después en la que dé. Las webcams USB
 * baratas no siempre llegan a 1280×720.
 */
export async function openCameraStream(deviceId?: string, quality: Quality = getCameraSettings().quality ?? 'auto'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este equipo no permite usar la cámara desde la app.');
  }
  // Modo liviano: en "Automática" se pide HD (720p), que le cuesta menos a la TV box
  if (quality === 'auto' && isLiteMode()) quality = '720';
  const wanted = QUALITY[quality] ?? QUALITY.auto;
  const hd = QUALITY.auto;
  const attempts: (MediaTrackConstraints | true)[] = [];
  if (deviceId && deviceId !== 'default') {
    attempts.push({ ...wanted, deviceId: { exact: deviceId } });
    if (wanted !== hd) attempts.push({ ...hd, deviceId: { exact: deviceId } });
  }
  attempts.push(hd, true);

  let lastError: unknown;
  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      await applyFocus(stream).catch(() => { /* la cámara no lo permite */ });
      return stream;
    } catch (err) {
      lastError = err;
      // Sin permiso no tiene sentido seguir probando
      if ((err as { name?: string })?.name === 'NotAllowedError') break;
    }
  }
  throw new Error(describeCameraError(lastError));
}

/** Resolución y cuadros por segundo que realmente da la cámara (para Ajustes). */
export function describeStream(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0];
  if (!track) return null;
  const s = track.getSettings();
  const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities;
  return {
    width: s.width ?? 0,
    height: s.height ?? 0,
    fps: s.frameRate ? Math.round(s.frameRate) : 0,
    maxWidth: caps.width?.max ?? 0,
    maxHeight: caps.height?.max ?? 0,
  };
}

/** Cámaras conectadas. Los nombres solo aparecen después de dar el permiso. */
export async function listCameras(): Promise<CameraOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter(d => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }));
}

export const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach(t => t.stop());

// ─── Enfoque ─────────────────────────────────────────────────────────────────
// Las webcams con autoenfoque (p. ej. C920) "buscan" con poca luz y la foto sale
// desenfocada. Si la cámara lo permite, se fija el enfoque (lejos o a mano).

interface FocusCaps { focusMode?: string[]; focusDistance?: { min: number; max: number; step?: number } }

/** Qué deja hacer la cámara con el enfoque (null = nada: lo maneja sola). */
export function focusSupport(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as FocusCaps;
  const manual = !!caps.focusMode?.includes('manual') && !!caps.focusDistance;
  return manual || caps.focusMode?.length ? { manual, modes: caps.focusMode ?? [] } : null;
}

/** Aplica el enfoque elegido en Ajustes → Cámara. */
export async function applyFocus(stream: MediaStream, settings: KioskCameraSettings = getCameraSettings()) {
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as FocusCaps;
  if (!track || !caps.focusMode?.length) return false;
  const focus = settings.focus ?? 'auto';
  if (focus === 'auto') {
    if (!caps.focusMode.includes('continuous')) return false;
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    return true;
  }
  if (!caps.focusMode.includes('manual') || !caps.focusDistance) return false;
  const { min, max } = caps.focusDistance;
  const pos = focus === 'far' ? 1 : Math.min(1, Math.max(0, Number(settings.focusPos ?? 0.8)));
  await track.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: min + (max - min) * pos } as MediaTrackConstraintSet] });
  return true;
}
