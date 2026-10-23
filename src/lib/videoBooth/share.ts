import { getVideoSettings } from './settings';

// Enlaces de la página del invitado (en el sitio de EventPix).

export const DEFAULT_PUBLIC_SITE = 'https://app.event-pix.com.ar';

/** Sitio público: el de Ajustes, el de la compilación o el de EventPix. */
export const publicSiteUrl = () => {
  const configured = ((getVideoSettings().publicSiteUrl || '').trim()
    || ((import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) || '').trim()
    || DEFAULT_PUBLIC_SITE).replace(/\/+$/, '');
  return /^https?:\/\//.test(configured) ? configured : `https://${configured}`;
};

/** Imagen de Drive que se puede mostrar directo (archivo compartido con link). */
export const driveImageUrl = (id: string, width = 2000) => `https://lh3.googleusercontent.com/d/${id}=w${width}`;

export const guestVideoUrl = (driveId: string, title?: string) => {
  const params = new URLSearchParams({ d: driveId });
  if (title) params.set('t', title);
  return `${publicSiteUrl()}/clip?${params.toString()}`;
};
