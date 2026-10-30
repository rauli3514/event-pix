import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SCREEN_QR_REFRESH_EVENT, parseScreenQr, type ScreenQr } from '@/lib/qr';

const POLL_MS = 2 * 60 * 1000;
const cacheKey = (code: string) => `screen_qr:${code}`;

function readCached(code?: string): ScreenQr | null {
    if (!code) return null;
    try {
        return parseScreenQr(JSON.parse(localStorage.getItem(cacheKey(code)) || 'null'));
    } catch {
        return null;
    }
}

// QR fijo de esta pantalla. Se lee aparte del resto de la configuración: si
// el servidor todavía no tiene la columna (falta el SQL), la TV sigue igual,
// sin QR. Se revisa cada 2 minutos y al instante cuando el panel avisa; sin
// internet queda el último conocido.
export function useScreenQr(deviceCode?: string): ScreenQr | null {
    const [qr, setQr] = useState<ScreenQr | null>(() => readCached(deviceCode));

    useEffect(() => {
        if (!deviceCode) return;
        let cancelled = false;
        const load = async () => {
            const { data, error } = await supabase
                .from('display_devices')
                .select('qr_overlay')
                .eq('device_id', deviceCode)
                .maybeSingle();
            if (cancelled || error || !data) return;
            const next = parseScreenQr((data as { qr_overlay?: unknown }).qr_overlay);
            setQr(next);
            try { localStorage.setItem(cacheKey(deviceCode), JSON.stringify(next)); } catch { /* sin espacio */ }
        };
        load();
        const poll = setInterval(load, POLL_MS);
        window.addEventListener(SCREEN_QR_REFRESH_EVENT, load);
        return () => {
            cancelled = true;
            clearInterval(poll);
            window.removeEventListener(SCREEN_QR_REFRESH_EVENT, load);
        };
    }, [deviceCode]);

    return qr;
}
