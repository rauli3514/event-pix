// De dónde sale cada video en la TV.
//
// La app Android guarda los videos en el equipo y se los da al navegador
// desde el disco (MediaCache). En navegadores internos viejos (Android 7,
// WebView de antes de 2020) eso puede fallar justo con los videos: se queda
// en negro con el ícono de video. Por eso:
//   - en navegadores viejos, los videos se piden por internet (como antes);
//   - en el resto, si un video falla o no arranca, se reintenta por internet
//     y se recuerda para las próximas vueltas.
// La dirección "por internet" es la misma con un parámetro de más: la caché
// del equipo no la reconoce y la deja pasar a la red.

const NETWORK_PARAM = 'edm_net=1';
const STORAGE_KEY = 'video_network_urls';
const MAX_REMEMBERED = 200;

export function networkVideoUrl(url: string): string {
    if (!url || url.includes(NETWORK_PARAM)) return url;
    const [base, hash] = url.split('#');
    return `${base}${base.includes('?') ? '&' : '?'}${NETWORK_PARAM}${hash ? `#${hash}` : ''}`;
}

export const isNetworkVideoUrl = (url: string) => url.includes(NETWORK_PARAM);

// Versión de Android y del navegador interno, según el user agent.
export function webViewInfo(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): { android: number | null; chrome: number | null } {
    const android = ua.match(/Android (\d+)/);
    const chrome = ua.match(/Chrome\/(\d+)/);
    return { android: android ? Number(android[1]) : null, chrome: chrome ? Number(chrome[1]) : null };
}

// ¿Navegador viejo, en el que conviene no usar la caché del equipo para videos?
export function isOldWebView(ua?: string): boolean {
    const { android, chrome } = webViewInfo(ua);
    if (android === null) return false; // no es Android (vista previa del panel)
    return android < 8 || (chrome !== null && chrome < 80);
}

function remembered(): Set<string> {
    try {
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return new Set(Array.isArray(list) ? list : []);
    } catch {
        return new Set();
    }
}

export function rememberNetworkVideo(url: string) {
    try {
        const list = [...remembered()].filter(u => u !== url);
        list.push(url);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_REMEMBERED)));
    } catch {
        // sin almacenamiento: vale solo hasta reiniciar
    }
}

// Dirección con la que arranca un video.
export function initialVideoUrl(url: string): string {
    if (!url) return url;
    return isOldWebView() || remembered().has(url) ? networkVideoUrl(url) : url;
}

// La foto de la pantalla en Android 7 dibuja toda la vista (no hay copia de
// la imagen como desde Android 8): en equipos chicos puede trabar el video.
export function canCaptureScreen(ua?: string): boolean {
    const { android } = webViewInfo(ua);
    return android === null || android >= 8;
}
