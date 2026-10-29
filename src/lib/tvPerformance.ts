import { useEffect, useState } from 'react';
import { callTvBridge, hasTvBridgeMethod, isTvBridgeReady, onTvBridgeReady } from '@/lib/tvBridge';

// Modo liviano para equipos con poca memoria (TV boxes de 1 GB).
//
// En esos equipos tener varios videos cargados a la vez, webs embebidas
// corriendo de fondo y transiciones con desenfoque o 3D hace que todo ande
// lento. En modo liviano el reproductor:
// - mantiene montado solo lo que se ve (más imágenes, que son baratas);
// - usa siempre fundido corto en vez de las transiciones pesadas;
// - descarga el contenido de a un archivo por vez.
//
// "Automático" lo activa si el equipo tiene menos de LOW_MEMORY_MB de RAM.
// Se puede forzar desde el menú de la TV (5x ATRÁS → menú).

export type LiteSetting = 'auto' | 'on' | 'off';

const SETTING_KEY = 'tv_lite_mode';
const DETECTED_KEY = 'tv_lite_detected_mb';
const CHANGED_EVENT = 'tv_lite_changed';

// Los equipos de 1 GB informan ~950 MB y los de 1,5 GB ~1400 MB. Uno de 2 GB
// (~1900 MB) anda bien con el modo normal.
export const LOW_MEMORY_MB = 1600;

const storage = {
    get(key: string): string | null {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key: string, value: string) {
        try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
    },
};

export function getLiteSetting(): LiteSetting {
    const v = storage.get(SETTING_KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
}

export function setLiteSetting(value: LiteSetting) {
    storage.set(SETTING_KEY, value);
    window.dispatchEvent(new Event(CHANGED_EVENT));
}

// RAM total del equipo en MB, o null si no se sabe.
function readDeviceMemoryMb(): number | null {
    // App TV: la telemetría nativa trae la RAM real.
    if (hasTvBridgeMethod('getTelemetry')) {
        try {
            const raw = callTvBridge<string>('getTelemetry');
            const mb = raw ? Number(JSON.parse(raw)?.memory?.max_mb) : NaN;
            if (Number.isFinite(mb) && mb > 0) return mb;
        } catch { /* sigue con el navegador */ }
    }
    // Navegadores Chromium: valor aproximado en GB (0.25, 0.5, 1, 2, 4, 8).
    const gb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return typeof gb === 'number' && gb > 0 ? gb * 1024 : null;
}

function cachedMemoryMb(): number | null {
    const v = Number(storage.get(DETECTED_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
}

export function isLiteActive(setting: LiteSetting, memoryMb: number | null): boolean {
    if (setting === 'on') return true;
    if (setting === 'off') return false;
    return memoryMb !== null && memoryMb < LOW_MEMORY_MB;
}

// Para código fuera de React (descargas): ajuste guardado + última memoria detectada.
export function isLiteNow(): boolean {
    return isLiteActive(getLiteSetting(), cachedMemoryMb() ?? (isTvBridgeReady() ? readDeviceMemoryMb() : null));
}

export interface LiteMode {
    lite: boolean;
    setting: LiteSetting;
    memoryMb: number | null;
}

// Estado del modo liviano. Arranca con la memoria guardada en el arranque
// anterior (así el primer render ya sale liviano) y la confirma con el puente.
export function useLiteMode(): LiteMode {
    const [setting, setSetting] = useState<LiteSetting>(getLiteSetting);
    // Sin puente (navegador) deviceMemory está disponible enseguida.
    const [memoryMb, setMemoryMb] = useState<number | null>(
        () => cachedMemoryMb() ?? (window.TvBridge ? null : readDeviceMemoryMb())
    );

    useEffect(() => {
        const cancel = onTvBridgeReady(() => {
            const mb = readDeviceMemoryMb();
            if (mb !== null) {
                storage.set(DETECTED_KEY, String(Math.round(mb)));
                setMemoryMb(mb);
            }
        });
        const onChange = () => setSetting(getLiteSetting());
        window.addEventListener(CHANGED_EVENT, onChange);
        return () => {
            cancel();
            window.removeEventListener(CHANGED_EVENT, onChange);
        };
    }, []);

    return { lite: isLiteActive(setting, memoryMb), setting, memoryMb };
}

// Contenido barato de tener montado aunque no se vea (no decodifica ni corre código).
export const isCheapItem = (type: string | undefined) =>
    type === 'image' || type === 'image_ad' || type === 'text';
