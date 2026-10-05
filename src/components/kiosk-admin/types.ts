import type { RemoteSettings } from '@/lib/kioskRemote';

export interface KioskDeviceRow {
  id: string;
  device_code: string;
  name: string | null;
  pairing_status: 'pending' | 'linked';
  kiosk_event_id: string | null;
  app_version: string | null;
  last_seen: string | null;
  settings: RemoteSettings | null;
  settings_rev: number;
  applied_rev: number;
  reported: RemoteSettings | null;
  reported_at: string | null;
  /** Cliente dueño (créditos de IA) */
  account_id?: string | null;
}

export interface KioskAccountRow {
  id: string;
  name: string;
  contact: string | null;
  credits: number;
  created_at: string;
}

export interface KioskEventRow {
  id: string;
  name: string;
  event_date: string | null;
  created_at: string;
}

// El equipo vinculado avisa cada minuto
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
