// Acceso al puente nativo de la app TV Android (window.TvBridge).
//
// Android inyecta el objeto en TODOS los frames, incluidos los iframes de webs
// externas que muestra la TV. Por eso la app (desde la versión con
// getApiVersion) exige en cada llamada un token secreto que inyecta solo en el
// frame principal, y solo si la página es la nuestra: un iframe de otro origen
// no puede leerlo. Las apps viejas no lo conocen y se llaman como antes.

declare global {
    interface Window {
        TvBridge?: any;
        __tvBridgeToken?: string;
    }
}

const READY_EVENT = 'tvbridgeready';

// APK que exige token (expone getApiVersion, lo único que se llama sin token).
const requiresToken = () => typeof window.TvBridge?.getApiVersion === 'function';

export const hasTvBridgeMethod = (method: string) => typeof window.TvBridge?.[method] === 'function';

// true cuando ya se puede llamar al puente (con un APK nuevo, recién cuando la
// app inyectó el token: al terminar de cargar la página).
export const isTvBridgeReady = () => !!window.TvBridge && (!requiresToken() || !!window.__tvBridgeToken);

export function callTvBridge<T = unknown>(method: string, ...args: unknown[]): T | undefined {
    const bridge = window.TvBridge;
    if (!bridge || typeof bridge[method] !== 'function') return undefined;
    try {
        if (requiresToken()) {
            const token = window.__tvBridgeToken;
            if (!token) return undefined;
            return bridge[method](token, ...args);
        }
        return bridge[method](...args);
    } catch (e) {
        console.warn(`TvBridge.${method} falló`, e);
        return undefined;
    }
}

// Ejecuta cb cuando el puente está listo (enseguida si ya lo está). Devuelve
// la función para cancelar la espera.
export function onTvBridgeReady(cb: () => void): () => void {
    if (isTvBridgeReady()) {
        cb();
        return () => {};
    }
    const handler = () => cb();
    window.addEventListener(READY_EVENT, handler, { once: true });
    return () => window.removeEventListener(READY_EVENT, handler);
}

// ---------------------------------------------------------------------------
// Acciones de Android compartidas por la app TV (TvBridge) y la del kiosco
// (window.AndroidKiosk, app Capacitor). Prueban primero la de TV. Devuelven
// false si ninguna está disponible (por ejemplo, en un navegador).
// ---------------------------------------------------------------------------

const androidKiosk = () => (window as unknown as { AndroidKiosk?: Record<string, (() => void) | undefined> }).AndroidKiosk;

function runAndroidAction(tvMethods: string[], kioskMethods: string[]): boolean {
    for (const method of tvMethods) {
        if (hasTvBridgeMethod(method)) {
            callTvBridge(method);
            return true;
        }
    }
    const kiosk = androidKiosk();
    for (const method of kioskMethods) {
        const fn = kiosk?.[method];
        if (typeof fn === 'function') {
            fn.call(kiosk);
            return true;
        }
    }
    return false;
}

export const openWifiSettings = () =>
    runAndroidAction(['openWifiSettings', 'openSettings'], ['openWifiSettings', 'openSettings']);

export const openHomeSettings = () =>
    runAndroidAction(['openHomeSettings', 'openSettings'], ['openHomeSettings', 'openSettings']);

export const exitAndroidApp = () => runAndroidAction(['exitApp'], ['exitApp']);

// Versión del APK de la TV (la informa la telemetría nativa), o null.
export function getTvAppVersion(): string | null {
    const raw = callTvBridge<string>('getTelemetry');
    if (!raw) return null;
    try {
        return JSON.parse(raw).app_version || null;
    } catch {
        return null;
    }
}
