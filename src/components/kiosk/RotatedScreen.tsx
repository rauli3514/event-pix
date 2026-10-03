import { useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { applyScreenRotation, getScreenRotation, ROTATION_EVENT } from '@/lib/screenRotation';

// En la web (vista previa) la pantalla girada se simula con la misma página dentro
// de un iframe girado: adentro la ventana es vertical, así que todo se acomoda
// solo. En la app nativa gira el WebView (plugin KioskScreen) y esto no hace nada.

const inFrame = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const KIOSK_PATH = /^\/(box|kiosco)(\/|$)/;

export default function RotatedScreen({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [rotation, setRotation] = useState(getScreenRotation);

  useEffect(() => {
    // Al abrir la app se vuelve a aplicar (por si el WebView se recreó)
    if (!inFrame) applyScreenRotation();
    const update = () => setRotation(getScreenRotation());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'kiosk_general_settings') update();
    };
    window.addEventListener(ROTATION_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ROTATION_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const simulate = !Capacitor.isNativePlatform() && !inFrame && rotation !== 0 && KIOSK_PATH.test(location.pathname);
  if (!simulate) return <>{children}</>;

  const sideways = rotation === 90 || rotation === 270;
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <iframe
        title="Kiosco girado"
        src={location.pathname + location.search}
        allow="camera; microphone; fullscreen; autoplay"
        className="absolute border-0 bg-black"
        style={{
          width: sideways ? '100vh' : '100vw',
          height: sideways ? '100vw' : '100vh',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      />
    </div>
  );
}
