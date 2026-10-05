import { AttractBackground } from '@/components/kiosk/AttractScreen';
import { KioskBrandBadge } from '@/components/kiosk/brand/EventPixLogo';
import { getScreenBackground, type ScreenKey } from '@/lib/kioskMedia';

// Fondo configurable de una pantalla del kiosco (Ajustes → Fondos de pantallas),
// con el logo del kiosco arriba al centro.
export default function ScreenBackground({ screen, brand = true }: { screen: ScreenKey; brand?: boolean }) {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <AttractBackground splash={getScreenBackground(screen)} />
      </div>
      {brand && <KioskBrandBadge />}
    </>
  );
}
