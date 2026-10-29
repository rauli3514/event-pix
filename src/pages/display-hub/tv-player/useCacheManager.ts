import { useState } from 'react';
import { CampaignItem } from '@/types/display';
import { isLiteNow } from '@/lib/tvPerformance';

// Tiempo máximo por archivo. Si una descarga se traba, la pantalla no puede
// quedarse en negro esperando: se sigue y el archivo carga al reproducirse.
const IMAGE_TIMEOUT_MS = 20 * 1000;
const VIDEO_TIMEOUT_MS = 90 * 1000;

// Descargas simultáneas. Antes se bajaban todas a la vez: en un equipo de
// 1 GB eso saturaba la red y la memoria justo al arrancar.
const CONCURRENCY = 3;
const CONCURRENCY_LITE = 1;

function preloadImage(url: string): Promise<void> {
    return new Promise(resolve => {
        const img = new Image();
        const timer = setTimeout(() => { img.src = ''; resolve(); }, IMAGE_TIMEOUT_MS);
        const done = () => { clearTimeout(timer); resolve(); };
        img.onload = done;
        img.onerror = done;
        img.src = url;
    });
}

// Baja el video para que quede en la caché HTTP. Se lee por partes y se
// descarta cada una: así no queda el archivo entero en memoria (antes se
// guardaba como Blob completo, decenas de MB por video).
async function preloadVideo(url: string): Promise<void> {
    const canStream = typeof fetch === 'function' && typeof AbortController === 'function' &&
        typeof ReadableStream === 'function' && 'getReader' in ReadableStream.prototype;

    if (!canStream) {
        await new Promise<void>(resolve => {
            const req = new XMLHttpRequest();
            req.open('GET', url, true);
            req.responseType = 'arraybuffer';
            req.timeout = VIDEO_TIMEOUT_MS;
            req.onload = req.onerror = req.ontimeout = req.onabort = () => resolve();
            req.send();
        });
        return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIDEO_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        const reader = res.body?.getReader();
        if (!reader) return;
        for (;;) {
            const { done } = await reader.read();
            if (done) break;
        }
    } catch {
        // Red caída o tiempo agotado: el video se carga al reproducirse.
    } finally {
        clearTimeout(timer);
    }
}

export function useCacheManager() {
    const [preloadProgress, setPreloadProgress] = useState<{ current: number, total: number } | null>(null);

    const preloadAssets = async (itemsToPreload: CampaignItem[]) => {
        const assets = itemsToPreload.filter(item =>
            ((item.type as string) === 'image' || (item.type as string) === 'video') && item.url
        );
        if (assets.length === 0) return true;

        setPreloadProgress({ current: 0, total: assets.length });

        let loadedCount = 0;
        let next = 0;
        const worker = async () => {
            while (next < assets.length) {
                const item = assets[next++];
                if ((item.type as string) === 'image') await preloadImage(item.url!);
                else await preloadVideo(item.url!);
                loadedCount++;
                setPreloadProgress({ current: loadedCount, total: assets.length });
            }
        };

        const workers = Math.min(isLiteNow() ? CONCURRENCY_LITE : CONCURRENCY, assets.length);
        await Promise.all(Array.from({ length: workers }, worker));
        setPreloadProgress(null);
        return true;
    };

    return { preloadAssets, preloadProgress };
}
