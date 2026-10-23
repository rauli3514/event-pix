import { getVideoSettings, saveVideoSettings } from './settings';

// Google Drive propio de la cabina de video (no el del kiosco). Usa el mismo
// Apps Script de EventPix (docs/kiosco-drive-apps-script.gs) publicado en la
// cuenta de Drive de la cabina: cada video queda en una carpeta por evento y,
// para el QR, compartido solo con el link.

/** Script incluido al compilar la app (secreto VITE_VIDEO_DRIVE_SCRIPT_URL). */
export const DEFAULT_SCRIPT_URL = ((import.meta.env.VITE_VIDEO_DRIVE_SCRIPT_URL as string | undefined) || '').trim();

export const folderIdFromLink = (link?: string) => {
  const s = (link || '').trim();
  if (!s) return '';
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/);
  return m ? m[1] : /^[\w-]{10,}$/.test(s) ? s : '';
};

export const driveConfig = () => {
  const s = getVideoSettings();
  return {
    scriptUrl: (s.driveScriptUrl || '').trim() || DEFAULT_SCRIPT_URL,
    folderId: folderIdFromLink(s.driveFolderLink),
  };
};

/** Con el script de la app alcanza (carpeta por defecto); con uno propio hace falta la carpeta. */
export const isDriveConfigured = () => {
  const c = driveConfig();
  return !!c.scriptUrl && (!!c.folderId || c.scriptUrl === DEFAULT_SCRIPT_URL);
};

async function post(body: Record<string, unknown>) {
  const { scriptUrl } = driveConfig();
  // text/plain: pedido "simple", sin consulta previa de CORS (Apps Script no la responde)
  const res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null) as { ok?: boolean; error?: string; id?: string; folder?: string; eventUrl?: string } | null;
  if (!json?.ok) throw new Error(json?.error || `Drive respondió ${res.status}`);
  return json;
}

/** Prueba la conexión: devuelve el nombre de la carpeta principal. */
export async function testDrive(folder: string) {
  if (!isDriveConfigured()) throw new Error('Falta la dirección del script o el link de la carpeta');
  const res = await post({ test: true, folderId: driveConfig().folderId, folder });
  return res.folder || '';
}

/** Sube un archivo (data URL) compartido con link y devuelve su ID de Drive. */
export async function uploadForShare(dataUrl: string, name: string, folder: string, type: string) {
  const res = await post({ folderId: driveConfig().folderId, folder, name, type, share: true, data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
  if (!res.id) throw new Error('Drive no devolvió el archivo (actualizá el script)');
  return res.id;
}

export const saveDriveConfig = (scriptUrl: string, folderLink: string) =>
  saveVideoSettings({ driveScriptUrl: scriptUrl.trim(), driveFolderLink: folderLink.trim() });
