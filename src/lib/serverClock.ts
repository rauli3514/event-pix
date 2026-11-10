import { supabase } from '@/lib/supabase';

// Hora del servidor para las pantallas sincronizadas (Espejo y Olas).
//
// Cada TV calcula qué mostrar a partir de la hora. Si una TV tiene el reloj
// corrido unos segundos, iría desfasada; por eso se mide la diferencia contra
// el servidor (función display_server_time) y se corrige. Si la función no
// existe todavía o no hay internet, se usa el reloj de la TV.

let skewMs = 0;
let inflight: Promise<void> | null = null;

export const SERVER_CLOCK_SYNCED_EVENT = 'display-server-clock-synced';

export const serverNow = () => Date.now() + skewMs;

export function syncServerClock(): Promise<void> {
    if (inflight) return inflight;
    inflight = (async () => {
        // Tres mediciones; vale la de respuesta más rápida (la más precisa).
        let best: { rtt: number; skew: number } | null = null;
        for (let i = 0; i < 3; i++) {
            const t0 = Date.now();
            const { data, error } = await supabase.rpc('display_server_time');
            const t1 = Date.now();
            if (error || !data) break;
            const server = new Date(data as string).getTime();
            if (!Number.isFinite(server)) break;
            const rtt = t1 - t0;
            const skew = server - (t0 + t1) / 2;
            if (!best || rtt < best.rtt) best = { rtt, skew };
        }
        if (best) {
            skewMs = best.skew;
            window.dispatchEvent(new Event(SERVER_CLOCK_SYNCED_EVENT));
        }
    })()
        .catch(() => { /* sin servidor: queda el reloj de la TV */ })
        .finally(() => { inflight = null; });
    return inflight;
}
