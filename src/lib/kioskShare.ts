import { getGeneralSettings } from '@/lib/kioskSettings';

// A dónde lleva el QR del kiosco: a la página /foto del sitio, con la foto, botones
// para bajarla y compartirla y el contacto de EventPix.

/** Sitio de EventPix: la página del invitado vive acá si no se configuró otra. */
export const DEFAULT_PUBLIC_SITE = 'https://app.event-pix.com.ar';

/**
 * Dirección pública del sitio para la página del invitado: la de Ajustes → Compartir
 * y nube, o VITE_PUBLIC_SITE_URL al compilar, o la de EventPix. No se usa la de la
 * página actual: en la app del equipo no es una dirección pública y los links de
 * prueba de Vercel piden iniciar sesión. (Antes, sin dirección, el QR abría la foto
 * directo en Google Drive, que en celulares sin la app pide iniciar sesión.)
 */
export const publicSiteUrl = () => {
  const configured = (((getGeneralSettings().publicSiteUrl as string) || '').trim()
    || ((import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || '').trim()
    || DEFAULT_PUBLIC_SITE).replace(/\/+$/, '');
  return /^https?:\/\//.test(configured) ? configured : `https://${configured}`;
};

/** Foto en Drive: 'drive:<id>' (lo que devuelve la subida para el QR). */
export const driveIdOf = (ref: string) => (ref.startsWith('drive:') ? ref.slice(6) : null);
/** Imagen de Drive que se puede mostrar directo (archivo compartido con link). */
export const driveImageUrl = (id: string, width = 2000) => `https://lh3.googleusercontent.com/d/${id}=w${width}`;

export const guestPhotoUrl = (photoRef: string, title?: string) => {
  const driveId = driveIdOf(photoRef);
  const base = publicSiteUrl();
  if (!base) return driveId ? `https://drive.google.com/file/d/${driveId}/view` : photoRef;
  const params = new URLSearchParams(driveId ? { d: driveId } : { u: photoRef });
  if (title) params.set('t', title);
  return `${base}/foto?${params.toString()}`;
};
