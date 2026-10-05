import { DEFAULT_DRIVE_SCRIPT_URL, folderIdFromLink } from '@/lib/driveBackup';

// Panel admin → fotos del kiosco en Google Drive, a través del mismo Apps Script
// que usan los equipos (acciones protegidas con ADMIN_KEY, ver docs/kiosco-drive-apps-script.gs).
// La clave y la carpeta quedan guardadas solo en esta computadora.

const CONFIG_KEY = 'eventpix_drive_admin';

export interface DriveAdminConfig {
  adminKey: string;
  /** Link de la carpeta principal (vacío = "EventPix Kiosco" en Mi unidad) */
  folderLink: string;
  /** Otro script (vacío = el de la app) */
  scriptUrl: string;
}

export const getDriveAdminConfig = (): DriveAdminConfig => {
  try {
    return { adminKey: '', folderLink: '', scriptUrl: '', ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') };
  } catch {
    return { adminKey: '', folderLink: '', scriptUrl: '' };
  }
};

export const saveDriveAdminConfig = (config: DriveAdminConfig) => {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* sin almacenamiento */ }
};

export interface DriveFolder { id: string; name: string; url: string; count: number; updated: number }
export interface DrivePhoto { id: string; name: string; size: number; created: number; url: string; thumb: string | null }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const cfg = getDriveAdminConfig();
  const url = cfg.scriptUrl.trim() || DEFAULT_DRIVE_SCRIPT_URL;
  if (!url) throw new Error('Esta versión no tiene el script de Drive (VITE_KIOSK_DRIVE_SCRIPT_URL)');
  if (!cfg.adminKey) throw new Error('Cargá la clave del panel (ADMIN_KEY del script)');
  // text/plain: pedido simple, sin consulta previa de CORS (Apps Script no la responde)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, adminKey: cfg.adminKey, folderId: folderIdFromLink(cfg.folderLink) }),
  });
  const json = await res.json().catch(() => null) as ({ ok?: boolean; error?: string } & T) | null;
  if (!json?.ok) throw new Error(json?.error || `Drive respondió ${res.status}`);
  return json;
}

export const listDriveFolders = () =>
  call<{ root: string; rootUrl: string; folders: DriveFolder[] }>({ action: 'folders' });

export const listDrivePhotos = (folder: string, offset = 0, limit = 40) =>
  call<{ total: number; photos: DrivePhoto[] }>({ action: 'photos', folder, offset, limit });

export const deleteDrivePhotos = (ids: string[]) => call<{ deleted: number }>({ action: 'delete', ids });

export const deleteDriveFolder = (folder: string) => call<object>({ action: 'deleteFolder', folder });

/** Descarga directa (con la sesión de Google del navegador). */
export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;
