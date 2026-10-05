import type { CSSProperties } from 'react';

// Estilos del nombre del evento en la bienvenida. Blanco por defecto: el color
// lo pone la animación de fondo.
export type NameStyle = 'white' | 'gold' | 'gradient' | 'neon';

export const NAME_STYLES: { value: NameStyle; label: string }[] = [
  { value: 'white', label: 'Blanco' },
  { value: 'gold', label: 'Dorado' },
  { value: 'neon', label: 'Neón' },
  { value: 'gradient', label: 'Colores' },
];

export const nameStyleProps = (style: NameStyle | undefined): { className: string; style?: CSSProperties } => {
  switch (style) {
    case 'gold':
      return {
        className: 'bg-gradient-to-b from-[#fff3c4] via-[#f5c542] to-[#b8860b] bg-clip-text text-transparent',
        style: { filter: 'drop-shadow(0 0.6vmin 1.6vmin rgba(0,0,0,0.6))' },
      };
    case 'gradient':
      return {
        className: 'bg-gradient-to-r from-[#ff2e93] via-[#ffd23f] to-[#00d4ff] bg-clip-text text-transparent',
        style: { filter: 'drop-shadow(0 0.6vmin 1.6vmin rgba(0,0,0,0.6))' },
      };
    case 'neon':
      return {
        className: 'text-white',
        style: { textShadow: '0 0 0.6vmin #fff, 0 0 2vmin #ff2e93, 0 0 4vmin #ff2e93, 0 0 8vmin #ff2e93' },
      };
    default:
      return { className: 'text-white', style: { textShadow: '0 0.6vmin 3vmin rgba(0,0,0,0.65)' } };
  }
};
