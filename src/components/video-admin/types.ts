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
  /** Licencia (con la migración 20261026000000_video_licenses.sql) */
  license?: 'demo' | 'full';
  license_until?: string | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  license_plan?: string | null;
  license_notes?: string | null;
}

/** ¿El equipo tiene licencia de cliente vigente? */
export const licenseOk = (d: VideoDeviceRow, now = Date.now()) =>
  d.license === 'full' && (!d.license_until || new Date(d.license_until).getTime() > now);

// El equipo avisa cada minuto
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
