import type { VideoBoothSettings } from './settings';

// Fondos de las pantallas de la cabina (inicio, pregunta del libro de firmas,
// marcos, resultado). De fábrica: manchas de color que se mueven, como el fondo
// de siempre, en distintos estilos de evento. También imágenes o videos propios
// (Biblioteca), guardados en el equipo como bgKey(id).

export interface ThemeBackground {
  id: string;
  label: string;
  /** Color de fondo */
  base: string;
  /** Cuatro manchas de color (rgba) */
  blobs: [string, string, string, string];
}

export const AURORA = 'aurora';

export const THEME_BACKGROUNDS: ThemeBackground[] = [
  { id: 't-dorado', label: 'Dorado elegante', base: '#0b0805', blobs: ['rgba(212,175,55,0.45)', 'rgba(247,227,161,0.28)', 'rgba(160,110,30,0.4)', 'rgba(255,255,255,0.12)'] },
  { id: 't-boda', label: 'Boda (bordó y rosa)', base: '#14060b', blobs: ['rgba(170,20,60,0.5)', 'rgba(255,170,190,0.32)', 'rgba(110,10,40,0.55)', 'rgba(230,190,120,0.25)'] },
  { id: 't-quince', label: '15 años (rosa y lila)', base: '#1a0616', blobs: ['rgba(255,60,170,0.5)', 'rgba(200,120,255,0.4)', 'rgba(255,150,200,0.35)', 'rgba(255,215,120,0.25)'] },
  { id: 't-fiesta', label: 'Fiesta (colores)', base: '#07061a', blobs: ['rgba(255,210,63,0.45)', 'rgba(0,212,255,0.45)', 'rgba(255,46,147,0.5)', 'rgba(46,230,166,0.35)'] },
  { id: 't-azul', label: 'Empresa (azul)', base: '#020b1a', blobs: ['rgba(30,110,255,0.5)', 'rgba(0,212,255,0.35)', 'rgba(20,60,160,0.55)', 'rgba(255,255,255,0.1)'] },
  { id: 't-verde', label: 'Natural (verde)', base: '#04110b', blobs: ['rgba(46,200,120,0.42)', 'rgba(180,230,120,0.3)', 'rgba(10,110,80,0.5)', 'rgba(255,220,150,0.2)'] },
  { id: 't-noche', label: 'Noche (negro)', base: '#030303', blobs: ['rgba(255,255,255,0.1)', 'rgba(120,120,140,0.18)', 'rgba(60,60,80,0.3)', 'rgba(255,255,255,0.06)'] },
];

export const themeBackground = (id?: string) => THEME_BACKGROUNDS.find(t => t.id === id);
export const bgKey = (id: string) => `video:bg:${id}`;

/** Opciones de fondo para elegir: el de siempre, los de fábrica y los propios. */
export const backgroundOptions = (s: Pick<VideoBoothSettings, 'backgrounds'>, own = s.backgrounds ?? []) => [
  { value: AURORA, label: 'El de siempre' },
  ...THEME_BACKGROUNDS.map(t => ({ value: t.id, label: t.label })),
  ...own.map(b => ({ value: b.id, label: b.name })),
];
