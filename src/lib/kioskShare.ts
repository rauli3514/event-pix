import { getGeneralSettings } from '@/lib/kioskSettings';

// A dónde lleva el QR del kiosco: a la página /foto del sitio (con botones para
// bajar y compartir) o, si no hay una dirección pública, directo a la imagen.

/** Dirección pública del sitio (Ajustes → Compartir y nube, o la de esta página si es pública). */
export const publicSiteUrl = () => {
  const configured = ((getGeneralSettings().publicSiteUrl as string) || '').trim().replace(/\/+$/, '');
  if (configured) return /^https?:\/\//.test(configured) ? configured : `https://${configured}`;
  const { protocol, hostname, origin } = window.location;
  // En la app (https://localhost) o en desarrollo no hay una dirección que sirva desde un celular
  if (protocol !== 'https:' || hostname === 'localhost' || hostname.endsWith('.local')) return '';
  return origin;
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
