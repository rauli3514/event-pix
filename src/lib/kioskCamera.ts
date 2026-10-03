// Cámara del kiosco (webcam USB en la TV box). Lo usan el kiosco y Ajustes.

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
export async function openCameraStream(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este equipo no permite usar la cámara desde la app.');
  }
  const hd: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
  const attempts: (MediaTrackConstraints | true)[] = [];
  if (deviceId && deviceId !== 'default') attempts.push({ ...hd, deviceId: { exact: deviceId } });
  attempts.push(hd, true);

  let lastError: unknown;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (err) {
      lastError = err;
      // Sin permiso no tiene sentido seguir probando
      if ((err as { name?: string })?.name === 'NotAllowedError') break;
    }
  }
  throw new Error(describeCameraError(lastError));
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
