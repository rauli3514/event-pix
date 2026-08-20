import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useTelemetry(deviceCode: string | undefined) {
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const sendHeartbeat = async () => {
        if (!deviceCode) return;
        try {
            const { data: device } = await supabase
                .from('display_devices')
                .select('id')
                .eq('device_id', deviceCode)
                .single();
                
            if (device) {
                let telemetry: any = {};
                let appVersion = null;
                let androidVersion = null;
                
                if ((window as any).TvBridge && typeof (window as any).TvBridge.getTelemetry === 'function') {
                    try {
                        const telemetryJson = (window as any).TvBridge.getTelemetry();
                        const bridgeTelemetry = JSON.parse(telemetryJson);
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

                const updates: any = { 
                    last_seen: new Date().toISOString() 
                };
                
                if (Object.keys(telemetry).length > 0) updates.telemetry = telemetry;
                if (appVersion) updates.app_version = appVersion;
                if (androidVersion) updates.android_version = androidVersion;

                await supabase.from('display_devices').update(updates).eq('id', device.id);
            }
        } catch (error) {}
    };

    useEffect(() => {
        sendHeartbeat();
        // 3 minutos
        heartbeatIntervalRef.current = setInterval(() => {
            sendHeartbeat();
        }, 180 * 1000);

        return () => {
            if (heartbeatIntervalRef.current) clearTimeout(heartbeatIntervalRef.current);
        };
    }, [deviceCode]);

    return { sendHeartbeat };
}
