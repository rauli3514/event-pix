import type { RemoteVideoSettings } from '@/lib/videoBooth/remote';

export interface VideoDeviceRow {
  id: string;
  device_code: string;
  name: string | null;
  pairing_status: 'pending' | 'linked';
  app_version: string | null;
  last_seen: string | null;
  settings: RemoteVideoSettings | null;
  settings_rev: number;
  applied_rev: number;
  reported: RemoteVideoSettings | null;
  reported_at: string | null;
  created_at: string;
}

// El equipo avisa cada minuto
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
