import type { CSSProperties } from 'react';

// Color de acento del evento (Diseño → Color del evento). Lo usan el muro y la
// página del invitado: botón principal, aviso "¡estás en pantalla!", mensajes,
// collage, etc. Sin color elegido se ve el violeta de siempre.

export const DEFAULT_ACCENT = '#8b5cf6';

export const ACCENT_PRESETS: { name: string; color: string }[] = [
    { name: 'Violeta', color: '#8b5cf6' },
    { name: 'Dorado', color: '#d4af37' },
    { name: 'Rosa', color: '#ec4899' },
    { name: 'Rosa pastel', color: '#e8b4b8' },
    { name: 'Neón', color: '#22d3ee' },
    { name: 'Azul', color: '#3b82f6' },
    { name: 'Verde', color: '#10b981' },
    { name: 'Naranja', color: '#f59e0b' },
    { name: 'Rojo', color: '#ef4444' },
    { name: 'Plata', color: '#d1d5db' },
];

const toRgb = (hex: string): [number, number, number] | null => {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** El color guardado si es válido; si no, null (se usa el violeta de siempre). */
export const validAccent = (hex?: string | null) => (hex && toRgb(hex) ? hex.toLowerCase() : null);

/** Mezcla con blanco (amount > 0) o con negro (amount < 0). */
export const shade = (hex: string, amount: number) => {
    const rgb = toRgb(hex);
    if (!rgb) return hex;
    const target = amount > 0 ? 255 : 0;
    const a = Math.abs(amount);
    return toHex(rgb.map((v) => v + (target - v) * a));
};

export const withAlpha = (hex: string, alpha: number) => {
    const rgb = toRgb(hex);
    return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : hex;
};

/** Colores claros (dorado, neón, plata) llevan texto oscuro encima. */
export const isLight = (hex: string) => {
    const rgb = toRgb(hex);
    if (!rgb) return false;
    const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
};

/** Texto legible sobre el color */
export const onAccent = (hex: string) => (isLight(hex) ? '#111827' : '#ffffff');

/**
 * Fondo degradado para botones y avisos. Devuelve undefined sin color propio:
 * así queda el degradado violeta de las clases de Tailwind.
 */
export const accentGradient = (hex?: string | null): CSSProperties | undefined => {
    const c = validAccent(hex);
    if (!c) return undefined;
    return {
        backgroundImage: `linear-gradient(90deg, ${shade(c, 0.12)}, ${c}, ${shade(c, -0.3)})`,
        color: onAccent(c),
    };
};

/** Variables CSS para usar en clases: text-[var(--accent)], bg-[var(--accent-soft)], etc. */
export const accentVars = (hex?: string | null): CSSProperties => {
    const c = validAccent(hex) || DEFAULT_ACCENT;
    // En el muro el acento se usa como texto sobre fondo oscuro: los muy oscuros se aclaran
    const onDark = isLight(c) ? c : shade(c, 0.25);
    return {
        '--accent': c,
        '--accent-text': onDark,
        '--accent-soft': withAlpha(c, 0.22),
        '--accent-fg': onAccent(c),
    } as CSSProperties;
};
