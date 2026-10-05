import { useEffect, useRef } from 'react';

// Disparador Bluetooth (el botoncito "selfie remote"): se empareja con la TV box
// como un teclado y manda Volumen +/- o la tecla Cámara. En la app, MainActivity
// toma esas teclas (sin cambiar el volumen) y avisa con el evento "kiosk-shutter".
// En la web también se escuchan las teclas, por si el navegador las deja pasar.

interface ShutterBridge { setShutterCapture?: (on: boolean) => void }
const bridge = () => (window as unknown as { AndroidKiosk?: ShutterBridge }).AndroidKiosk;

const SHUTTER_KEYS = new Set(['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', 'Camera']);

/** Llama a onPress con cada apretada del disparador mientras enabled sea true. */
export function useShutter(onPress: () => void, enabled = true) {
  const ref = useRef(onPress);
  useEffect(() => { ref.current = onPress; });
  useEffect(() => {
    if (!enabled) return;
    try { bridge()?.setShutterCapture?.(true); } catch { /* APK viejo */ }
    const fire = () => ref.current();
    const onKey = (e: KeyboardEvent) => {
      if (!SHUTTER_KEYS.has(e.key) || e.repeat) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener('kiosk-shutter', fire);
    window.addEventListener('keydown', onKey);
    return () => {
      try { bridge()?.setShutterCapture?.(false); } catch { /* APK viejo */ }
      window.removeEventListener('kiosk-shutter', fire);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled]);
}
