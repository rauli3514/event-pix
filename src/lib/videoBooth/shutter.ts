import { useEffect, useRef } from 'react';

// Disparador Bluetooth (el botoncito "selfie remote"): se empareja como un teclado
// y manda Volumen +/- o la tecla Cámara. En la app, la actividad toma esas teclas
// (sin cambiar el volumen) y avisa con el evento "kiosk-shutter" (nombre del puente nativo).

interface ShutterBridge { setShutterCapture?: (on: boolean) => void }
const bridge = () => (window as unknown as { AndroidKiosk?: ShutterBridge }).AndroidKiosk;

const SHUTTER_KEYS = new Set(['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', 'Camera']);

/** Llama a onPress con cada apretada del disparador mientras enabled sea true. */
export function useShutter(onPress: () => void, enabled = true) {
  const ref = useRef(onPress);
  useEffect(() => { ref.current = onPress; });
  useEffect(() => {
    if (!enabled) return;
    try { bridge()?.setShutterCapture?.(true); } catch { /* sin puente */ }
    const fire = () => ref.current();
    const onKey = (e: KeyboardEvent) => {
      if (!SHUTTER_KEYS.has(e.key) || e.repeat) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener('kiosk-shutter', fire);
    window.addEventListener('keydown', onKey);
    return () => {
      try { bridge()?.setShutterCapture?.(false); } catch { /* sin puente */ }
      window.removeEventListener('kiosk-shutter', fire);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled]);
}
