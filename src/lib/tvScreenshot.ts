import { callTvBridge, hasTvBridgeMethod } from '@/lib/tvBridge';

// Código de la pantalla que está corriendo el reproductor (lo fija la TV al
// arrancar). Fuera de la TV es null.
let currentDeviceCode: string | null = null;
export const setTvDeviceCode = (code: string | null) => { currentDeviceCode = code; };
export const getTvDeviceCode = () => currentDeviceCode;

// Evento que pide una foto ya (lo dispara un pedido del panel).
export const SCREENSHOT_REQUEST_EVENT = 'tv-screenshot-request';

// Foto de lo que se ve (JPEG en base64) usando la app Android. null si la app
// es vieja o no se pudo.
export function captureTvScreen(maxWidth = 640, timeoutMs = 8000): Promise<string | null> {
    if (!hasTvBridgeMethod('requestScreenshot')) return Promise.resolve(null);
    const id = Math.random().toString(36).slice(2);
    return new Promise(resolve => {
        const finish = (image: string | null) => {
            clearTimeout(timer);
            window.removeEventListener('tvscreenshot', onShot);
            resolve(image);
        };
        const onShot = (event: Event) => {
            const detail = (event as CustomEvent<{ id?: string; image?: string | null }>).detail;
            if (detail?.id !== id) return;
            finish(typeof detail.image === 'string' && detail.image ? detail.image : null);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        window.addEventListener('tvscreenshot', onShot);
        callTvBridge('requestScreenshot', id, maxWidth);
    });
}
