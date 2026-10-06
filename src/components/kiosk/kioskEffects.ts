import { useEffect } from 'react';
import confetti from 'canvas-confetti';

// Efectos del kiosco que no son componentes (hook y configuración de animación).

const BRAND_COLORS = ['#ff2e93', '#7b2ff7', '#00d4ff', '#ffd23f', '#ffffff'];

/** Estallido de confeti con los colores de la marca (una vez). */
export function useConfettiBurst(active: boolean) {
  useEffect(() => {
    if (!active || document.documentElement.classList.contains('kiosk-lite')) return;
    const shoot = (x: number, angle: number) => confetti({
      particleCount: 90, spread: 70, angle, origin: { x, y: 0.75 },
      colors: BRAND_COLORS, startVelocity: 55, scalar: 1.1, disableForReducedMotion: true,
    });
    shoot(0.1, 60);
    shoot(0.9, 120);
    const t = window.setTimeout(() => shoot(0.5, 90), 350);
    return () => window.clearTimeout(t);
  }, [active]);
}

/** Entrada de la foto final: gira, crece y pasa de borrosa a nítida. */
export const revealPhoto = {
  initial: { opacity: 0, scale: 0.8, rotate: -6, filter: 'blur(14px)' },
  animate: { opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' },
  transition: { type: 'spring' as const, stiffness: 120, damping: 14 },
};
