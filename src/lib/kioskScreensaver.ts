import { getGeneralSettings } from '@/lib/kioskSettings';

// Ajustes del protector de pantalla del kiosco (ver components/kiosk/KioskScreensaver).

/** Evento para mostrar el protector ya (botón "Ver cómo queda" de Ajustes). */
export const SCREENSAVER_PREVIEW_EVENT = 'kiosk-screensaver-preview';
export const DEFAULT_SCREENSAVER_MINUTES = 5;

/** Minutos sin actividad para que aparezca; 0 = apagado. */
export const screensaverMinutes = () => {
  const g = getGeneralSettings();
  if (g.screensaver === false) return 0;
  const m = Number(g.screensaverMinutes);
  return Number.isFinite(m) && m > 0 ? m : DEFAULT_SCREENSAVER_MINUTES;
};
