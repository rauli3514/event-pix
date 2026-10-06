import { getGeneralSettings } from '@/lib/kioskSettings';

// Modo liviano (Ajustes → Equipo): para TV box con poca potencia. Saca el vidrio
// esmerilado (desenfoque), las sombras con filtro y las animaciones de fondo, y la
// cámara en "Automática" pasa a HD (720p). Se aplica con la clase "kiosk-lite" en <html>.

export const isLiteMode = () => getGeneralSettings().liteMode === true;

export const applyLiteMode = () => {
  document.documentElement.classList.toggle('kiosk-lite', isLiteMode());
};
