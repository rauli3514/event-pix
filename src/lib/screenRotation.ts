import { Capacitor, registerPlugin } from '@capacitor/core';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';

// Tele colgada en vertical (o dada vuelta): la TV box manda siempre la imagen
// apaisada, así que se gira la app entera. En la app nativa se gira el WebView
// (los toques y vh/vw quedan bien); en la web, la página se muestra dentro de un
// iframe girado (ver RotatedScreen).

export type ScreenRotation = 0 | 90 | 180 | 270;

export const SCREEN_ROTATIONS: { value: ScreenRotation; label: string; hint: string }[] = [
  { value: 0, label: 'Horizontal', hint: 'Tele normal' },
  { value: 90, label: 'Vertical ↻', hint: 'Girada a la derecha' },
  { value: 270, label: 'Vertical ↺', hint: 'Girada a la izquierda' },
  { value: 180, label: 'Dada vuelta', hint: 'Cabeza abajo' },
];

const KioskScreen = registerPlugin<{ setRotation(o: { degrees: number }): Promise<{ degrees: number }> }>('KioskScreen');

export const ROTATION_EVENT = 'kiosk-rotation-changed';

export const getScreenRotation = (): ScreenRotation => {
  const v = Number(getGeneralSettings().screenRotation) || 0;
  return v === 90 || v === 180 || v === 270 ? v : 0;
};

/**
 * Con la tele vertical, el WebView queda angosto (en el Tanix ~720 puntos por la
 * densidad de pantalla) y las pantallas pensadas para más ancho se salían de los
 * costados. En la app nativa, vertical usa un ancho de diseño fijo de 1080 puntos
 * y Android lo escala para que entre (MainActivity activa el "viewport ancho").
 */
const PORTRAIT_DESIGN_WIDTH = 1080;
export const applyViewport = (degrees: ScreenRotation = getScreenRotation()) => {
  if (!Capacitor.isNativePlatform()) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const sideways = degrees === 90 || degrees === 270;
  meta.setAttribute('content', sideways
    ? `width=${PORTRAIT_DESIGN_WIDTH}`
    : 'width=device-width, initial-scale=1.0');
};

/** Gira la app nativa; en la web solo avisa a RotatedScreen. */
export const applyScreenRotation = async (degrees: ScreenRotation = getScreenRotation()) => {
  applyViewport(degrees);
  if (Capacitor.isNativePlatform()) {
    try {
      await KioskScreen.setRotation({ degrees });
    } catch {
      // APK viejo sin el plugin: queda sin girar
    }
  }
  window.dispatchEvent(new Event(ROTATION_EVENT));
};

export const setScreenRotation = (degrees: ScreenRotation) => {
  saveGeneralSettings({ screenRotation: degrees });
  return applyScreenRotation(degrees);
};

const ARROWS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

/**
 * Con la pantalla girada, "arriba" en el control es otra dirección en la página.
 * Devuelve la flecha equivalente dentro de la página girada.
 */
export const rotateArrowKey = (key: string, degrees: ScreenRotation = getScreenRotation()) => {
  const i = ARROWS.indexOf(key);
  if (i < 0 || !degrees) return key;
  return ARROWS[(i - degrees / 90 + 4) % 4];
};
