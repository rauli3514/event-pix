import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { applyRemote, buildReport, getAppliedRev, type RemoteVideoSettings } from './remote';

// Identidad del equipo de la app EventPix Video. Genera su código de 6 caracteres
// y una clave secreta, se registra solo (video_device_checkin) y desde el panel de
// la cabina (/admin/cabina-video) se vincula y se configura. Todo separado del kiosco.

const CODE_KEY = 'video_device_code';
const SECRET_KEY = 'video_device_secret';
const STATE_KEY = 'video_device_state';
const PIN_KEY = 'video_pin';
const STANDALONE_KEY = 'video_standalone';
// Sin O/0 ni I/1 para que no se confundan al leerlo en la tele
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEFAULT_PIN = '1234';
export const DEVICE_EVENT = 'video-device-changed';

export interface VideoDeviceState {
  deviceCode: string;
  name: string | null;
  pairingStatus: 'pending' | 'linked';
}

const read = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
};

export const getDeviceCode = () => {
  let code = read(CODE_KEY);
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    write(CODE_KEY, code);
  }
  return code;
};

/** Clave secreta del equipo: la registra en su primer checkin y la manda en cada pedido. */
export const getDeviceSecret = () => {
  let secret = read(SECRET_KEY);
  if (!secret || secret.length < 32) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    secret = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    write(SECRET_KEY, secret);
  }
  return secret;
};

export const getCachedDeviceState = (): VideoDeviceState | null => {
  try {
    const raw = read(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getPin = () => read(PIN_KEY) || DEFAULT_PIN;
export const setPin = (pin: string) => write(PIN_KEY, pin);

/** Se usa sin panel (sin vincular): no vuelve a mostrar la pantalla del código. */
export const isStandalone = () => read(STANDALONE_KEY) === '1';
export const setStandalone = (on: boolean) => write(STANDALONE_KEY, on ? '1' : '0');

export const getAppVersion = async () => {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    return (await CapacitorApp.getInfo()).version;
  } catch {
    return undefined;
  }
};

const rpcCheckin = async (linked: boolean) => {
  const { data, error } = await supabase.rpc('video_device_checkin', {
    p_code: getDeviceCode(),
    p_secret: getDeviceSecret(),
    p_app_version: (await getAppVersion()) ?? null,
    p_applied_rev: linked ? getAppliedRev() : null,
    p_report: linked ? buildReport() : null,
  });
  if (error) {
    throw new Error(/function|schema cache/i.test(error.message)
      ? 'Falta correr en Supabase la migración de la cabina de video'
      : error.message);
  }
  return (Array.isArray(data) ? data[0] : data) as {
    name: string | null; pairing_status: string; settings: RemoteVideoSettings | null; settings_rev: number | null;
    /** Sin la migración de licencias no vienen (todo como cliente) */
    license?: 'demo' | 'full'; license_until?: string | null;
  } | null;
};

/** Avisa que está vivo, aplica lo que mandó el panel y devuelve el estado. */
export async function checkinDevice(): Promise<VideoDeviceState> {
  if (!isSupabaseConfigured) throw new Error('Esta app no tiene el servidor configurado');
  const linked = getCachedDeviceState()?.pairingStatus === 'linked';
  let row = await rpcCheckin(linked);
  if (row?.pairing_status === 'linked' && row.settings_rev) {
    try {
      if (await applyRemote(row.settings, Number(row.settings_rev))) row = (await rpcCheckin(true)) ?? row;
    } catch (e) {
      console.warn('[video] no se pudo aplicar la configuración del panel', e);
    }
  }
  saveLicense(row ? row.license ?? 'full' : 'demo', row?.license_until ?? null);
  const state: VideoDeviceState = {
    deviceCode: getDeviceCode(),
    name: row?.name ?? null,
    pairingStatus: row?.pairing_status === 'linked' ? 'linked' : 'pending',
  };
  write(STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(DEVICE_EVENT));
  return state;
}

let syncTimer = 0;
/** Checkin cada minuto (cada 10 s mientras espera que lo vinculen). */
export function startDeviceSync() {
  if (syncTimer || !isSupabaseConfigured) return;
  const tick = async () => {
    try { await checkinDevice(); } catch { /* sin internet: se reintenta */ }
    const linked = getCachedDeviceState()?.pairingStatus === 'linked';
    // Esperando que lo vinculen: más seguido; vinculado o usado sin panel: cada minuto
    syncTimer = window.setTimeout(tick, linked || isStandalone() ? 60000 : 10000);
  };
  syncTimer = window.setTimeout(tick, 0);
}

// ─── Actualización de la app ─────────────────────────────────────────
// El workflow "APK de EventPix Video" publica cada versión en la release
// video-latest. La app la busca, la descarga, verifica su huella y abre el
// instalador de Android (hay que tocar "Instalar": Android no deja que una app
// se instale sola). El estado llega como evento 'kioskupdate' (puente nativo).

interface UpdateBridge {
  canSelfUpdate?: () => boolean;
  checkForUpdate?: () => void;
  startUpdate?: () => void;
  canInstallUpdates?: () => boolean;
  openInstallPermission?: () => void;
}
const updateBridge = () => (window as unknown as { AndroidKiosk?: UpdateBridge }).AndroidKiosk;

export const UPDATE_EVENT = 'kioskupdate';
export interface AppVersion { code: number; name: string }
export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'up_to_date' | 'downloading' | 'installing' | 'confirm' | 'error';
  current?: AppVersion;
  latest?: AppVersion;
  progress?: number;
  message?: string;
}

export const canSelfUpdate = () => {
  try { return !!updateBridge()?.canSelfUpdate?.(); } catch { return false; }
};
export const checkForUpdate = () => updateBridge()?.checkForUpdate?.();
export const startUpdate = () => updateBridge()?.startUpdate?.();
/** Si Android ya deja que la app instale su actualización (null = no se sabe). */
export const canInstallUpdates = (): boolean | null => {
  const b = updateBridge();
  if (!b?.canInstallUpdates) return null;
  try { return !!b.canInstallUpdates(); } catch { return null; }
};
export const openInstallPermission = () => updateBridge()?.openInstallPermission?.();

let lastStatus: UpdateStatus = { state: 'idle' };
export const getUpdateStatus = () => lastStatus;
/** Hay una versión nueva esperando (para el aviso en el engranaje). */
export const updateAvailable = () => lastStatus.state === 'available' || lastStatus.state === 'confirm';

let updateStarted = false;
/**
 * Busca versiones nuevas al abrir la app y cada 6 horas. Con "actualizar sola"
 * (por defecto sí), si la encuentra en los primeros minutos después de abrir la
 * app (cuando se prende el equipo, antes del evento) la instala sola; durante el
 * evento solo avisa, para no tapar la pantalla de los invitados.
 */
export function startAutoUpdate(autoInstall: () => boolean) {
  if (updateStarted || !canSelfUpdate()) return;
  updateStarted = true;
  const openedAt = Date.now();
  let triggered = false;
  window.addEventListener(UPDATE_EVENT, (e: Event) => {
    lastStatus = { ...lastStatus, progress: undefined, message: undefined, ...(e as CustomEvent<UpdateStatus>).detail };
    if (lastStatus.state === 'available' && !triggered && autoInstall() && Date.now() - openedAt < 10 * 60 * 1000) {
      triggered = true;
      startUpdate();
    }
  });
  window.setTimeout(checkForUpdate, 20000);
  window.setInterval(checkForUpdate, 6 * 60 * 60 * 1000);
}

// ─── Licencia ────────────────────────────────────────────────────────
// La decide el servidor (panel → Equipos → Licencia) y llega en cada checkin.
// DEMO: todo funciona pero los videos salen con la marca "DEMO". Sin internet,
// una licencia de cliente sigue valiendo LICENSE_GRACE_DAYS desde el último checkin.

const LICENSE_KEY = 'video_license';
export const LICENSE_EVENT = 'video-license-changed';
const LICENSE_GRACE_DAYS = 21;
/** WhatsApp de EventPix para pedir la licencia */
export const LICENSE_WHATSAPP = '5493624547382';

export interface LicenseState { license: 'demo' | 'full'; until: string | null; checkedAt: number }

export const getLicense = (): LicenseState | null => {
  try {
    const saved = JSON.parse(read(LICENSE_KEY) || 'null') as LicenseState | null;
    if (saved) return saved;
  } catch { /* se rehace */ }
  // Equipos que ya andaban antes de las licencias (son de EventPix): siguen sin
  // marca hasta su próximo checkin, aunque se actualicen sin internet
  if (getCachedDeviceState()) {
    const seeded: LicenseState = { license: 'full', until: null, checkedAt: Date.now() };
    write(LICENSE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return null;
};

function saveLicense(license: 'demo' | 'full', until: string | null) {
  const prev = getLicense();
  write(LICENSE_KEY, JSON.stringify({ license, until, checkedAt: Date.now() } satisfies LicenseState));
  if (prev?.license !== license || prev?.until !== until) window.dispatchEvent(new Event(LICENSE_EVENT));
}

/** Si los videos salen sin la marca DEMO. */
export function isLicensed(): boolean {
  if (!isSupabaseConfigured) return true;
  const l = getLicense();
  if (!l || l.license !== 'full') return false;
  if (l.until && Date.parse(l.until) < Date.now()) return false;
  return Date.now() - l.checkedAt < LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

/** Enlace de WhatsApp para pedir la licencia con el código del equipo. */
export const licenseWhatsAppUrl = () => `https://wa.me/${LICENSE_WHATSAPP}?text=${encodeURIComponent(
  `Hola! Quiero activar la licencia de EventPix Video. Código del equipo: ${getDeviceCode()}`,
)}`;
