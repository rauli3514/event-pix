import { useEffect, type RefObject } from 'react';
import { rotateArrowKey } from '@/lib/screenRotation';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]';

/**
 * Navegación con el control remoto de la TV box: las flechas mueven el foco entre
 * los elementos del contenedor (OK/Enter ya activa el botón enfocado).
 * Izquierda/arriba = anterior, derecha/abajo = siguiente.
 */
export function useRemoteFocus(container: RefObject<HTMLElement | null>, deps: unknown[] = [], enabled = true) {
  useEffect(() => {
    const root = container.current;
    if (!root || !enabled) return;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Al cambiar de pantalla el foco queda en <body>: se enfoca el elemento marcado
    // con data-autofocus o el primero
    const current = document.activeElement;
    if (!current || current === document.body || !root.contains(current)) {
      (root.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0])?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      // Con la tele girada, la flecha del control se traduce a la dirección en la página
      const key = rotateArrowKey(e.key);
      const delta = key === 'ArrowRight' || key === 'ArrowDown' ? 1
        : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
      if (!delta) return;
      // Dentro de un campo de texto las flechas mueven el cursor
      const active = document.activeElement as HTMLElement | null;
      if (active?.tagName === 'INPUT' && (key === 'ArrowLeft' || key === 'ArrowRight')) return;
      const list = items();
      if (!list.length) return;
      const index = active ? list.indexOf(active) : -1;
      const next = list[(index + delta + list.length) % list.length];
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, enabled, ...deps]);
}
