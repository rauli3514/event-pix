import {
  getCameraSettings, getFrameUrl, getGeneralSettings, getPrintSettings,
  saveCameraSettings, saveFrameUrl, saveGeneralSettings, savePrintSettings,
} from '@/lib/kioskSettings';
import { applyScreenRotation } from '@/lib/screenRotation';

// Configuración a distancia: el panel admin guarda en kiosk_devices.settings los
// ajustes que quiere cambiar y el equipo los aplica en el próximo checkin (cada
// minuto). El equipo también informa sus ajustes actuales para verlos en el panel.
// Solo viajan ajustes de texto/opciones; los videos y fondos siguen siendo locales.

export interface RemoteSettings {
  general?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  print?: Record<string, unknown>;
  /** Marco: null = sin marco, 'glass:<estilo>', un marco incluido (/kiosk-marco-1.png) o una URL https del PNG */
  frame?: string | null;
}

/** Ajustes de Ajustes del equipo que se pueden manejar desde el panel. */
export const REMOTE_GENERAL_KEYS = [
  'eventTitle', 'welcomeSubtitle', 'frameSubtitle', 'nameStyle', 'splashVideo',
  'enableSelfie', 'enablePortada', 'enablePortadaAI', 'enableAI', 'enableMundial', 'enableCaricatura', 'enableFiguritas',
  'photoShots', 'shotPause', 'photoOrientation', 'photoStrips', 'askGuestName', 'guestFrameChoice',
  'showQr', 'showPrintButton', 'allowRetake', 'enableGallery', 'splashGallery',
  'resultTimeout', 'idleTimeout', 'screensaver', 'screensaverMinutes', 'enableFilters', 'photoGame', 'triviaQuestions', 'enableVip', 'vipTitle', 'vipSubtitle', 'vipVideo', 'vipResultSeconds', 'vipAfterPartyTime', 'enableAccessories', 'offline', 'screenRotation',
  'portadaTitle', 'portadaIssue', 'portadaHeadlines', 'portadaStarLabel', 'portadaBadge', 'portadaColor',
] as const;
export const REMOTE_CAMERA_KEYS = ['timer', 'mirror', 'rotation', 'quality'] as const;
export const REMOTE_PRINT_KEYS = ['autoPrint', 'copies', 'borderless', 'bleed'] as const;

const pick = (src: Record<string, unknown>, keys: readonly string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
};

/** Ajustes actuales del equipo, para mostrarlos en el panel. */
export function buildReport(): RemoteSettings {
  const frame = getFrameUrl();
  return {
    general: pick(getGeneralSettings(), REMOTE_GENERAL_KEYS),
    camera: pick(getCameraSettings(), REMOTE_CAMERA_KEYS),
    print: pick(getPrintSettings(), REMOTE_PRINT_KEYS),
    // Un PNG subido en el equipo es una data URL enorme: se informa solo que es propio
    frame: frame?.startsWith('data:') ? 'custom' : frame,
  };
}

const APPLIED_KEY = 'kiosk_remote_applied_rev';
export const REMOTE_APPLIED_EVENT = 'kiosk-remote-applied';

export const getAppliedRev = () => {
  try { return Number(localStorage.getItem(APPLIED_KEY)) || 0; } catch { return 0; }
};
const setAppliedRev = (rev: number) => {
  try { localStorage.setItem(APPLIED_KEY, String(rev)); } catch { /* sin almacenamiento */ }
};

/** Descarga un marco del panel y lo deja guardado en el equipo (así anda sin internet). */
async function downloadFrame(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo bajar el marco (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el marco'));
    reader.readAsDataURL(blob);
  });
}

/** Aplica lo que mandó el panel. Devuelve true si cambió algo. */
export async function applyRemoteSettings(settings: RemoteSettings | null | undefined, rev: number) {
  if (!rev || rev <= getAppliedRev() || !settings) return false;
  const general = pick(settings.general ?? {}, REMOTE_GENERAL_KEYS);
  const camera = pick(settings.camera ?? {}, REMOTE_CAMERA_KEYS);
  const print = pick(settings.print ?? {}, REMOTE_PRINT_KEYS);
  const rotationBefore = getGeneralSettings().screenRotation;

  if (Object.keys(general).length) saveGeneralSettings(general);
  if (Object.keys(camera).length) saveCameraSettings(camera);
  if (Object.keys(print).length) savePrintSettings(print);

  if (settings.frame !== undefined && settings.frame !== 'custom') {
    const frame = settings.frame;
    if (frame && /^https?:\/\//.test(frame)) {
      // Si no se puede bajar, se reintenta en el próximo checkin (no se marca como aplicado)
      saveFrameUrl(await downloadFrame(frame));
    } else {
      saveFrameUrl(frame || null);
    }
  }

  if (general.screenRotation !== undefined && general.screenRotation !== rotationBefore) await applyScreenRotation();
  setAppliedRev(rev);
  window.dispatchEvent(new Event(REMOTE_APPLIED_EVENT));
  return true;
}
