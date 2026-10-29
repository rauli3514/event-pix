// Aviso urgente en las pantallas (tabla display_urgent_alerts).

export type UrgentAlertLayout = 'banner' | 'full';
export type UrgentAlertColor = 'red' | 'yellow' | 'blue' | 'green' | 'black';

export interface UrgentAlert {
    id: string;
    message: string;
    layout: UrgentAlertLayout;
    color: UrgentAlertColor;
    ends_at: string;
}

export const URGENT_ALERT_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
    red: { bg: '#dc2626', fg: '#ffffff', label: 'Rojo' },
    yellow: { bg: '#facc15', fg: '#111111', label: 'Amarillo' },
    blue: { bg: '#2563eb', fg: '#ffffff', label: 'Azul' },
    green: { bg: '#16a34a', fg: '#ffffff', label: 'Verde' },
    black: { bg: '#0a0a0a', fg: '#ffffff', label: 'Negro' },
};

// Pedido a la TV para que vuelva a consultar el aviso (lo manda el panel).
export const ALERT_REFRESH_EVENT = 'tv-alert-refresh';
