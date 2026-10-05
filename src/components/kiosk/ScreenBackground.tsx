import { AttractBackground } from '@/components/kiosk/AttractScreen';
import { getScreenBackground, type ScreenKey } from '@/lib/kioskMedia';

// Fondo configurable de una pantalla del kiosco (Ajustes → Fondos de pantallas).
export default function ScreenBackground({ screen }: { screen: ScreenKey }) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <AttractBackground splash={getScreenBackground(screen)} />
    </div>
  );
}
