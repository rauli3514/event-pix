import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ALERT_REFRESH_EVENT, type UrgentAlert } from '@/lib/urgentAlerts';

const POLL_MS = 30 * 1000;
const cacheKey = (code: string) => `urgent_alert:${code}`;

const stillActive = (alert: UrgentAlert | null) => !!alert && new Date(alert.ends_at).getTime() > Date.now();

function readCached(code?: string): UrgentAlert | null {
    if (!code) return null;
    try {
        const alert = JSON.parse(localStorage.getItem(cacheKey(code)) || 'null') as UrgentAlert | null;
        return stillActive(alert) ? alert : null;
    } catch {
        return null;
    }
}

// Aviso urgente que tiene que mostrar esta TV. Se consulta cada 30 s y al
// instante cuando el panel avisa. Sin internet sigue el último conocido hasta
// su hora de fin.
export function useUrgentAlert(deviceCode?: string): UrgentAlert | null {
    const [alert, setAlert] = useState<UrgentAlert | null>(() => readCached(deviceCode));

    useEffect(() => {
        if (!deviceCode) return;
        let cancelled = false;

        const load = async () => {
            const { data, error } = await supabase.rpc('display_device_active_alert', { p_device_code: deviceCode });
            if (cancelled || error) return; // sin internet o sin la función: se queda con el último
            const next = (data || null) as UrgentAlert | null;
            setAlert(stillActive(next) ? next : null);
            try { localStorage.setItem(cacheKey(deviceCode), JSON.stringify(next)); } catch { /* sin espacio */ }
        };

        // Se saca solo a la hora de fin, aunque no haya internet.
        const expire = () => setAlert(current => (stillActive(current) ? current : null));

        load();
        const poll = setInterval(load, POLL_MS);
        const expiry = setInterval(expire, 5000);
        window.addEventListener(ALERT_REFRESH_EVENT, load);
        return () => {
            cancelled = true;
            clearInterval(poll);
            clearInterval(expiry);
            window.removeEventListener(ALERT_REFRESH_EVENT, load);
        };
    }, [deviceCode]);

    return alert;
}
