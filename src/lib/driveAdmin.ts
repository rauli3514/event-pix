import { supabase } from '@/lib/supabase';

// Panel admin → Google Drive, a través de la función drive-admin de Supabase.
// La dirección del Apps Script y la clave (ADMIN_KEY) están guardadas allá como
// secrets, una sola vez para toda la app: el panel no las pide ni las ve.
// Ver supabase/functions/drive-admin y docs/kiosco-drive-apps-script.gs.

// La versión anterior guardaba la clave en el navegador: se borra.
try { localStorage.removeItem('eventpix_drive_admin'); } catch { /* sin almacenamiento */ }

export interface DriveFolder { id: string; name: string; url: string; count: number; updated: number }
export interface DrivePhoto { id: string; name: string; size: number; created: number; url: string; thumb: string | null }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('drive-admin', { body });
  if (error) {
    // La función responde { ok:false, error } también con códigos 401/403/500
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error || 'No se pudo conectar con Drive (¿está publicada la función drive-admin?)');
  }
  const json = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!json?.ok) throw new Error(json?.error || 'Drive no respondió');
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

export interface DriveImportResult { folderUrl: string; saved: number; skipped: number; failed: string[]; shared: boolean }

/** Guarda archivos (por link público) y textos en la carpeta del evento. Ver importAlbum en el script. */
export const importToDrive = (body: {
  event_id: string;
  folder: string;
  files: { url: string; name: string }[];
  texts?: { name: string; content: string }[];
  shareFolder?: boolean;
}) => call<DriveImportResult>({ action: 'import', ...body });
