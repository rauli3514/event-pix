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
  { id: 't-dorado', label: 'Dorado elegante', base: '#1c1307', blobs: ['rgba(230,180,60,0.85)', 'rgba(255,225,150,0.6)', 'rgba(170,110,30,0.8)', 'rgba(255,240,200,0.35)'] },
  { id: 't-boda', label: 'Boda (bordó y rosa)', base: '#2a0a16', blobs: ['rgba(200,30,80,0.8)', 'rgba(255,170,195,0.6)', 'rgba(140,15,55,0.85)', 'rgba(240,200,130,0.45)'] },
  { id: 't-quince', label: '15 años (rosa y lila)', base: '#2a0a24', blobs: ['rgba(255,60,170,0.8)', 'rgba(200,120,255,0.7)', 'rgba(255,150,205,0.6)', 'rgba(255,215,120,0.4)'] },
  { id: 't-fiesta', label: 'Fiesta (colores)', base: '#0e0b2a', blobs: ['rgba(255,210,63,0.75)', 'rgba(0,212,255,0.7)', 'rgba(255,46,147,0.8)', 'rgba(46,230,166,0.6)'] },
  { id: 't-azul', label: 'Empresa (azul)', base: '#06152e', blobs: ['rgba(40,120,255,0.8)', 'rgba(0,212,255,0.6)', 'rgba(30,70,180,0.85)', 'rgba(220,235,255,0.25)'] },
  { id: 't-verde', label: 'Natural (verde)', base: '#082018', blobs: ['rgba(46,200,120,0.75)', 'rgba(190,235,130,0.55)', 'rgba(15,120,90,0.8)', 'rgba(255,225,150,0.35)'] },
  { id: 't-noche', label: 'Noche (negro y plata)', base: '#050507', blobs: ['rgba(255,255,255,0.22)', 'rgba(150,150,175,0.35)', 'rgba(80,80,110,0.5)', 'rgba(255,255,255,0.14)'] },
];

export const themeBackground = (id?: string) => THEME_BACKGROUNDS.find(t => t.id === id);
export const bgKey = (id: string) => `video:bg:${id}`;

/** Opciones de fondo para elegir: el de siempre, los de fábrica y los propios. */
export const backgroundOptions = (s: Pick<VideoBoothSettings, 'backgrounds'>, own = s.backgrounds ?? []) => [
  { value: AURORA, label: 'El de siempre' },
  ...THEME_BACKGROUNDS.map(t => ({ value: t.id, label: t.label })),
  ...own.map(b => ({ value: b.id, label: b.name })),
];
