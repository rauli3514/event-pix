import { useEffect, useRef } from 'react';
import { sendDeviceHeartbeat } from '@/lib/displayDeviceApi';
import { callTvBridge, hasTvBridgeMethod } from '@/lib/tvBridge';
import { getLiteSetting, isLiteNow } from '@/lib/tvPerformance';

// Un latido por minuto; el panel muestra "fuera de línea" tras 3 min sin latido.
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

// Último error de JavaScript del reproductor, para verlo desde el panel sin ir
// al local. Se guarda en localStorage: sobrevive a la recarga que suele seguir.
const WEB_ERROR_KEY = 'tv_last_web_error';

interface WebError { message: string; at: string }

function readLastWebError(): WebError | null {
    try {
        const raw = localStorage.getItem(WEB_ERROR_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function recordWebError(message: string) {
    try {
        const entry: WebError = { message: message.slice(0, 500), at: new Date().toISOString() };
        localStorage.setItem(WEB_ERROR_KEY, JSON.stringify(entry));
    } catch { /* sin almacenamiento */ }
}

export function useTelemetry(deviceCode: string | undefined) {
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const sendHeartbeat = async () => {
        if (!deviceCode) return;
        try {
            let telemetry: any = {};
            let appVersion = null;
            let androidVersion = null;
            
            if (hasTvBridgeMethod('getTelemetry')) {
                try {
                    // Si el puente todavía no está listo (recién cargó la página) se
                    // manda el latido igual, sin telemetría; el próximo la incluye.
                    const telemetryJson = callTvBridge<string>('getTelemetry');
                    const bridgeTelemetry = telemetryJson ? JSON.parse(telemetryJson) : {};
                    if (bridgeTelemetry.app_version) appVersion = bridgeTelemetry.app_version;
                    if (bridgeTelemetry.android_version) androidVersion = bridgeTelemetry.android_version;
                    telemetry = { ...bridgeTelemetry };
                } catch (e) {}
            } else {
                try {
                    const { Device } = await import('@capacitor/device');
                    const { App } = await import('@capacitor/app');
                    
                    const deviceInfo = await Device.getInfo();
                    const appInfo = await App.getInfo();
                    
                    appVersion = appInfo.version;
                    androidVersion = deviceInfo.osVersion;
                    
                    telemetry.model = deviceInfo.model;
                    telemetry.manufacturer = deviceInfo.manufacturer;
                    telemetry.platform = deviceInfo.platform;
                } catch (e) {
                    console.error("Error obteniendo telemetría nativa", e);
                }
            }

            // Estado del reproductor web (modo liviano, último error de JavaScript).
            telemetry.player = {
                lite: isLiteNow(),
                lite_setting: getLiteSetting(),
                last_web_error: readLastWebError(),
            };

            if ((window.performance as any).memory) {
                telemetry.jsHeapSizeLimit = (window.performance as any).memory.jsHeapSizeLimit;
                telemetry.totalJSHeapSize = (window.performance as any).memory.totalJSHeapSize;
                telemetry.usedJSHeapSize = (window.performance as any).memory.usedJSHeapSize;
            }

            await sendDeviceHeartbeat(deviceCode, {
                telemetry: Object.keys(telemetry).length > 0 ? telemetry : null,
                appVersion,
                androidVersion,
            });
        } catch (error) {}
    };

    useEffect(() => {
        const onError = (e: ErrorEvent) => {
            // Errores de recursos (imagen que no carga) no traen message: no interesan acá.
            if (e.message) recordWebError(`${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`);
        };
        const onRejection = (e: PromiseRejectionEvent) => {
            const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
            recordWebError(`Promesa rechazada: ${reason}`);
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);

    useEffect(() => {
        sendHeartbeat();
        heartbeatIntervalRef.current = setInterval(() => {
            sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);

        return () => {
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        };
    }, [deviceCode]);

    return { sendHeartbeat };
}
