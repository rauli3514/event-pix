import { useEffect } from 'react';

// Las TV quedan días con la página abierta: cuando se publica una versión nueva
// seguirían con la vieja hasta que alguien las desenchufe. Cada 10 minutos se
// mira /version.json; si la versión publicada es otra, se recarga la página.
//
// La app tiene un service worker que guarda una copia: antes de recargar se le
// pide que se actualice, si no la recarga traería la copia vieja. Si después de
// 3 intentos sigue la versión vieja (por ejemplo, una caché del navegador), se
// deja de intentar hasta que se publique otra.

const CHECK_EVERY_MS = 10 * 60 * 1000;
const FIRST_CHECK_MS = 2 * 60 * 1000;
const ATTEMPTS_KEY = 'tv_update_attempts';
const MAX_ATTEMPTS = 3;

const currentBuild = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : '';

async function publishedBuild(): Promise<string | null> {
    try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data?.build === 'string' && data.build ? data.build : null;
    } catch {
        return null;
    }
}

function readAttempts(): { build: string; count: number } {
    try {
        const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || 'null');
        if (raw && typeof raw.build === 'string' && typeof raw.count === 'number') return raw;
    } catch { /* sin almacenamiento */ }
    return { build: '', count: 0 };
}

async function updateServiceWorker(): Promise<void> {
    try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) return;
        await reg.update();
        // El nuevo se activa solo (skipWaiting); se le da un momento.
        await new Promise(resolve => setTimeout(resolve, 8000));
    } catch { /* sin service worker */ }
}

export function useAppUpdate(enabled = true) {
    useEffect(() => {
        if (!enabled || !currentBuild || import.meta.env.DEV) return;
        let busy = false;

        const check = async () => {
            if (busy || !navigator.onLine) return;
            busy = true;
            try {
                const published = await publishedBuild();
                if (!published) return;
                if (published === currentBuild) {
                    try { localStorage.removeItem(ATTEMPTS_KEY); } catch { /* sin almacenamiento */ }
                    return;
                }
                const attempts = readAttempts();
                const count = attempts.build === published ? attempts.count : 0;
                if (count >= MAX_ATTEMPTS) return;
                try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ build: published, count: count + 1 })); } catch { /* sin almacenamiento */ }
                await updateServiceWorker();
                window.location.reload();
            } finally {
                busy = false;
            }
        };

        const first = setTimeout(check, FIRST_CHECK_MS);
        const every = setInterval(check, CHECK_EVERY_MS);
        return () => {
            clearTimeout(first);
            clearInterval(every);
        };
    }, [enabled]);
}
