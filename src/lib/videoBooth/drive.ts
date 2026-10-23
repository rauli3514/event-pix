import { getVideoSettings, saveVideoSettings } from './settings';

// Google Drive propio de la cabina de video (no el del kiosco). Usa el mismo
// Apps Script de EventPix (docs/kiosco-drive-apps-script.gs) publicado en la
// cuenta de Drive de la cabina: cada video queda en una carpeta por evento y,
// para el QR, compartido solo con el link.

/**
 * Script y carpeta incluidos al compilar la app (secretos de GitHub
 * VITE_VIDEO_DRIVE_SCRIPT_URL y VITE_VIDEO_DRIVE_FOLDER): así anda sin configurar
 * nada en el equipo. No van en el código porque el repositorio es público.
 */
export const DEFAULT_SCRIPT_URL = ((import.meta.env.VITE_VIDEO_DRIVE_SCRIPT_URL as string | undefined) || '').trim();
export const DEFAULT_FOLDER = ((import.meta.env.VITE_VIDEO_DRIVE_FOLDER as string | undefined) || '').trim();

export const folderIdFromLink = (link?: string) => {
  const s = (link || '').trim();
  if (!s) return '';
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/);
  return m ? m[1] : /^[\w-]{10,}$/.test(s) ? s : '';
};

export const driveConfig = () => {
  const s = getVideoSettings();
  const scriptUrl = (s.driveScriptUrl || '').trim() || DEFAULT_SCRIPT_URL;
  return {
    scriptUrl,
    // Con el script de la app, la carpeta de la app (si no se eligió otra)
    folderId: folderIdFromLink(s.driveFolderLink) || (scriptUrl === DEFAULT_SCRIPT_URL ? folderIdFromLink(DEFAULT_FOLDER) : ''),
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

/**
 * Sube un archivo grande (video) compartido con link, sin armar un texto gigante:
 * el pedido se arma con el base64 en partes (cada parte es múltiplo de 3 bytes,
 * así pegadas forman el base64 del archivo entero). Devuelve su ID de Drive.
 */
export async function uploadBlobForShare(blob: Blob, name: string, folder: string, type: string) {
  const { scriptUrl, folderId } = driveConfig();
  const CHUNK = 3 * 256 * 1024;
  const toBase64 = (part: Blob) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const u = r.result as string; resolve(u.slice(u.indexOf(',') + 1)); };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(part);
  });
  const head = JSON.stringify({ folderId, folder, name, type, share: true, data: '' }).slice(0, -2);
  const pieces: BlobPart[] = [head];
  for (let i = 0; i < blob.size; i += CHUNK) pieces.push(await toBase64(blob.slice(i, i + CHUNK)));
  pieces.push('"}');
  const body = new Blob(pieces, { type: 'text/plain;charset=utf-8' });
  pieces.length = 0;
  // text/plain: pedido "simple", sin consulta previa de CORS (Apps Script no la responde)
  const res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
  const json = await res.json().catch(() => null) as { ok?: boolean; error?: string; id?: string } | null;
  if (!json?.ok) throw new Error(json?.error || `Drive respondió ${res.status}`);
  if (!json.id) throw new Error('Drive no devolvió el archivo (actualizá el script)');
  return json.id;
}

/** Sube un archivo (data URL) compartido con link y devuelve su ID de Drive. */
export async function uploadForShare(dataUrl: string, name: string, folder: string, type: string) {
  const res = await post({ folderId: driveConfig().folderId, folder, name, type, share: true, data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
  if (!res.id) throw new Error('Drive no devolvió el archivo (actualizá el script)');
  return res.id;
}

export const saveDriveConfig = (scriptUrl: string, folderLink: string) =>
  saveVideoSettings({ driveScriptUrl: scriptUrl.trim(), driveFolderLink: folderLink.trim() });
