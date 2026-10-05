import { BUILT_IN_FRAMES, getFrameUrl, getGeneralSettings } from '@/lib/kioskSettings';
import { GLASS_PREFIX, GLASS_STYLES } from '@/lib/glassFrame';

// Marcos que el invitado puede elegir. Se guardan por clave ('none', 'glass:aurora',
// la ruta del PNG o 'custom' = el marco subido en Ajustes).

export interface FrameOption {
  key: string;
  label: string;
  /** Lo que se pasa a mergeImages (null = sin marco) */
  url: string | null;
}

export const isCustomFrame = (url: string | null) =>
  !!url && !url.startsWith(GLASS_PREFIX) && !BUILT_IN_FRAMES.some(f => f.url === url);

export function allFrameOptions(): FrameOption[] {
  const current = getFrameUrl();
  return [
    ...GLASS_STYLES.map(s => ({ key: `${GLASS_PREFIX}${s.value}`, label: s.label, url: `${GLASS_PREFIX}${s.value}` })),
    ...BUILT_IN_FRAMES.map(f => ({ key: f.url, label: f.label, url: f.url })),
    ...(isCustomFrame(current) ? [{ key: 'custom', label: 'Mi marco', url: current }] : []),
    { key: 'none', label: 'Sin marco', url: null },
  ];
}

const keyOf = (url: string | null) => (url === null ? 'none' : isCustomFrame(url) ? 'custom' : url);

/** Opciones para el invitado: las habilitadas en Ajustes, empezando por el marco principal. */
export function guestFrameOptions(): FrameOption[] {
  const settings = getGeneralSettings();
  if (!settings.guestFrameChoice) return [];
  const enabled = new Set(settings.guestFrames ?? []);
  const mainKey = keyOf(getFrameUrl());
  enabled.add(mainKey);
  const all = allFrameOptions().filter(o => enabled.has(o.key));
  return [...all.filter(o => o.key === mainKey), ...all.filter(o => o.key !== mainKey)];
}
