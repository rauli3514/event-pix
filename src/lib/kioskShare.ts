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

export const guestPhotoUrl = (photoUrl: string, title?: string) => {
  const base = publicSiteUrl();
  if (!base) return photoUrl;
  const params = new URLSearchParams({ u: photoUrl });
  if (title) params.set('t', title);
  return `${base}/foto?${params.toString()}`;
};
