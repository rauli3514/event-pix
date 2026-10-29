// Pantallas caídas: vinculadas que no mandan latido hace más de DOWN_AFTER_MS.
//
// La TV manda un latido por minuto y el panel la muestra "fuera de línea" a
// los 3 minutos. Para avisar se espera más (10 min) así un corte breve de
// Wi-Fi o un reinicio no generan alertas.

export const DOWN_AFTER_MS = 10 * 60 * 1000;
// Una pantalla apagada hace más de una semana no es una caída: quedó fuera de
// uso. No se avisa (en la lista sigue apareciendo como fuera de línea).
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface AlertDevice {
    id: string;
    name?: string | null;
    device_id?: string | null;
    pairing_status?: string | null;
    last_seen?: string | null;
    commerce_id?: string | null;
    commerce?: { name?: string | null } | null;
}

export interface DownScreen {
    id: string;
    name: string;
    commerceName: string | null;
    lastSeen: Date;
    downForMs: number;
}

export function findDownScreens(devices: AlertDevice[] | null | undefined, now: number = Date.now()): DownScreen[] {
    return (devices || [])
        .filter(d => d.pairing_status === 'linked' && d.last_seen)
        .map(d => {
            const lastSeen = new Date(d.last_seen as string);
            return {
                id: d.id,
                name: d.name || (d.device_id ? `Pantalla ${d.device_id}` : 'Pantalla'),
                commerceName: d.commerce?.name || null,
                lastSeen,
                downForMs: now - lastSeen.getTime(),
            };
        })
        .filter(s => Number.isFinite(s.downForMs) && s.downForMs > DOWN_AFTER_MS && s.downForMs < STALE_AFTER_MS)
        .sort((a, b) => a.downForMs - b.downForMs);
}

// "hace 25 min", "hace 3 h", "hace 2 días".
export function formatDownFor(ms: number): string {
    const min = Math.floor(ms / 60000);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} días`;
}

// Clave del conjunto de pantallas caídas: si cambia (cae otra), la alerta
// vuelve a mostrarse aunque se haya ocultado.
export const downScreensKey = (screens: DownScreen[]) => screens.map(s => s.id).sort().join(',');
