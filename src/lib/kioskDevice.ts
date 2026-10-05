import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '@/lib/supabase';
import { applyRemoteSettings, buildReport, getAppliedRev, type RemoteSettings } from '@/lib/kioskRemote';

// Identidad del equipo del kiosco (TV box). Como en Display Digital: el equipo
// genera un código de 6 caracteres, se registra solo con kiosk_device_checkin y
// desde el panel (/admin/kioscos) se vincula y se le asigna el evento.

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

const rpcCheckin = async (deviceCode: string, appVersion: string | null, linked: boolean) => {
  // Vinculado: informa sus ajustes y la última configuración del panel que aplicó
  const params: Record<string, unknown> = { p_code: deviceCode, p_app_version: appVersion };
  if (linked) {
    params.p_applied_rev = getAppliedRev();
    params.p_report = buildReport();
  }
  let { data, error } = await supabase.rpc('kiosk_device_checkin', params);
  // Base sin la migración de configuración remota: checkin simple
  if (error && linked && /p_applied_rev|p_report|function/i.test(error.message)) {
    ({ data, error } = await supabase.rpc('kiosk_device_checkin', { p_code: deviceCode, p_app_version: appVersion }));
  }
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
};

/** Registra el equipo si es nuevo, avisa que está vivo y devuelve su vinculación y evento. */
export const checkinDevice = async (appVersion?: string): Promise<KioskDeviceState> => {
  const deviceCode = getDeviceCode();
  const linked = getCachedDeviceState()?.pairingStatus === 'linked';
  let row = await rpcCheckin(deviceCode, appVersion ?? null, linked);
  // Cambios mandados desde el panel: se aplican y se informa enseguida
  if (row?.pairing_status === 'linked' && row.settings_rev) {
    try {
      if (await applyRemoteSettings(row.settings as RemoteSettings, Number(row.settings_rev))) {
        row = (await rpcCheckin(deviceCode, appVersion ?? null, true)) ?? row;
      }
    } catch (e) {
      console.warn('[kiosco] no se pudo aplicar la configuración del panel', e);
    }
  }
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

/**
 * Checkin cada minuto mientras el kiosco está abierto (el inicio /box ya lo hace
 * por su cuenta): así el panel lo ve en línea y le llegan los cambios.
 */
export const getAppVersion = async () => {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    return (await CapacitorApp.getInfo()).version;
  } catch {
    return undefined;
  }
};

let syncTimer = 0;
export const startDeviceSync = (appVersion: () => Promise<string | undefined> = getAppVersion) => {
  if (syncTimer) return () => {};
  const tick = async () => {
    if (getCachedDeviceState()?.pairingStatus !== 'linked') return;
    try { await checkinDevice(await appVersion()); } catch { /* sin internet: se reintenta */ }
  };
  syncTimer = window.setInterval(tick, 60000);
  void tick();
  return () => {
    window.clearInterval(syncTimer);
    syncTimer = 0;
  };
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
