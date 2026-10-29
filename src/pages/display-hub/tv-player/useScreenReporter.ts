import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { SCREENSHOT_REQUEST_EVENT, captureTvScreen } from '@/lib/tvScreenshot';

const FIRST_REPORT_MS = 30 * 1000;
const REPORT_EVERY_MS = 5 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

// Manda al panel una foto de lo que se ve y qué elemento está pasando: al
// rato de arrancar, cada 5 minutos y cuando el panel la pide.
export function useScreenReporter(deviceCode: string | undefined, currentItem: AnyItem, active: boolean, lite: boolean) {
    const itemRef = useRef<AnyItem>(currentItem);
    useEffect(() => { itemRef.current = currentItem; }, [currentItem]);

    useEffect(() => {
        if (!deviceCode || !active) return;
        let busy = false;
        let lastAt = 0;

        const report = async () => {
            // Evita fotos pegadas (por ejemplo, dos pedidos seguidos del panel).
            if (busy || Date.now() - lastAt < 15_000) return;
            busy = true;
            try {
                const image = await captureTvScreen(lite ? 480 : 640);
                const item = itemRef.current;
                await supabase.rpc('display_device_screenshot', {
                    p_device_code: deviceCode,
                    p_image: image,
                    p_now_playing: item ? { name: String(item.content || item.title || '').slice(0, 120), type: item.type || null } : null,
                });
                lastAt = Date.now();
            } catch {
                // Sin internet o servidor sin la función todavía: se reintenta en la próxima.
            } finally {
                busy = false;
            }
        };

        const first = setTimeout(report, FIRST_REPORT_MS);
        const every = setInterval(report, REPORT_EVERY_MS);
        window.addEventListener(SCREENSHOT_REQUEST_EVENT, report);
        return () => {
            clearTimeout(first);
            clearInterval(every);
            window.removeEventListener(SCREENSHOT_REQUEST_EVENT, report);
        };
    }, [deviceCode, active, lite]);
}
