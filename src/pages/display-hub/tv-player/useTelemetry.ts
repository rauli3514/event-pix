import { useEffect, useRef } from 'react';
import { sendDeviceHeartbeat } from '@/lib/displayDeviceApi';
import { callTvBridge, hasTvBridgeMethod } from '@/lib/tvBridge';

// Un latido por minuto; el panel muestra "fuera de línea" tras 3 min sin latido.
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

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
