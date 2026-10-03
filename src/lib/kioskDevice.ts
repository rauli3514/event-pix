import { supabase } from '@/lib/supabase';

// Identidad del equipo del kiosco (TV box). Como en Display Digital: el equipo
// genera un código de 6 caracteres, se registra solo con kiosk_device_checkin y
// desde el panel (Kiosco IA → Equipos) se vincula y se le asigna el evento.

const CODE_KEY = 'kiosk_device_code';
const STATE_KEY = 'kiosk_device_state';
const PIN_KEY = 'kiosk_box_pin';
const VIP_APP_KEY = 'kiosk_box_vip_app';
// Sin O/0 ni I/1 para que no se confundan al leerlo en la tele
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEFAULT_PIN = '1234';

export interface KioskDeviceState {
  deviceCode: string;
  name: string | null;
  pairingStatus: 'pending' | 'linked';
  kioskEventId: string | null;
  eventName: string | null;
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

/** Último estado conocido, para arrancar sin internet. */
export const getCachedDeviceState = (): KioskDeviceState | null => {
  try {
    const raw = read(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Registra el equipo si es nuevo, avisa que está vivo y devuelve su vinculación y evento. */
export const checkinDevice = async (appVersion?: string): Promise<KioskDeviceState> => {
  const deviceCode = getDeviceCode();
  const { data, error } = await supabase.rpc('kiosk_device_checkin', {
    p_code: deviceCode,
    p_app_version: appVersion ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const state: KioskDeviceState = {
    deviceCode,
    name: row?.name ?? null,
    pairingStatus: row?.pairing_status === 'linked' ? 'linked' : 'pending',
    kioskEventId: row?.kiosk_event_id ?? null,
    eventName: row?.event_name ?? null,
  };
  write(STATE_KEY, JSON.stringify(state));
  return state;
};

export const getBoxPin = () => read(PIN_KEY) || DEFAULT_PIN;
export const setBoxPin = (pin: string) => write(PIN_KEY, pin);

/** Paquete Android de la app de Ingreso VIP que abre el ícono del inicio. */
export const getVipAppPackage = () => read(VIP_APP_KEY) || '';
export const setVipAppPackage = (pkg: string) => write(VIP_APP_KEY, pkg);

// Puente nativo de MainActivity (window.AndroidKiosk)
interface AndroidKioskBridge {
  openWifiSettings?: () => void;
  openSettings?: () => void;
  openApp?: (packageName: string) => boolean;
  listApps?: () => string;
}

const bridge = () => (window as unknown as { AndroidKiosk?: AndroidKioskBridge }).AndroidKiosk;

export const openWifiSettings = () => {
  const b = bridge();
  if (b?.openWifiSettings) b.openWifiSettings();
  else b?.openSettings?.();
};

export const openAndroidApp = (packageName: string) => !!bridge()?.openApp?.(packageName);

export interface InstalledApp {
  label: string;
  packageName: string;
}

export const listInstalledApps = (): InstalledApp[] => {
  try {
    const raw = bridge()?.listApps?.();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
