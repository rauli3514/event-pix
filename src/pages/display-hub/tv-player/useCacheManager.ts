import { useState } from 'react';
import { CampaignItem } from '@/types/display';
import { isLiteNow } from '@/lib/tvPerformance';

// Tiempo máximo por archivo. Si una descarga se traba, la pantalla no puede
// quedarse en negro esperando: se sigue y el archivo carga al reproducirse.
const IMAGE_TIMEOUT_MS = 20 * 1000;
const VIDEO_TIMEOUT_MS = 90 * 1000;

// Descargas simultáneas (para toda la app, no por llamada). Antes se bajaban
// todas a la vez: en un equipo de 1 GB eso saturaba la red y la memoria.
const CONCURRENCY = 3;
const CONCURRENCY_LITE = 1;

function preloadImage(url: string): Promise<boolean> {
    return new Promise(resolve => {
        const img = new Image();
        const timer = setTimeout(() => { img.src = ''; resolve(false); }, IMAGE_TIMEOUT_MS);
        img.onload = () => { clearTimeout(timer); resolve(true); };
        img.onerror = () => { clearTimeout(timer); resolve(false); };
        img.src = url;
    });
}

// Baja el video para que quede en la caché HTTP. Se lee por partes y se
// descarta cada una: así no queda el archivo entero en memoria.
async function preloadVideo(url: string): Promise<boolean> {
    const canStream = typeof fetch === 'function' && typeof AbortController === 'function' &&
        typeof ReadableStream === 'function' && 'getReader' in ReadableStream.prototype;

    if (!canStream) {
        return new Promise<boolean>(resolve => {
            const req = new XMLHttpRequest();
            req.open('GET', url, true);
            req.responseType = 'arraybuffer';
            req.timeout = VIDEO_TIMEOUT_MS;
            req.onload = () => resolve(req.status >= 200 && req.status < 300);
            req.onerror = req.ontimeout = req.onabort = () => resolve(false);
            req.send();
        });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIDEO_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        const reader = res.body?.getReader();
        if (!reader) return res.ok;
        for (;;) {
            const { done } = await reader.read();
            if (done) break;
        }
        return res.ok;
    } catch {
        // Red caída o tiempo agotado: el video se carga al reproducirse.
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// Cola única de descargas. Si el contenido cambia varias veces seguidas (al
// editar en el panel llega un aviso por cada guardado), las llamadas nuevas
// reutilizan las descargas en curso en vez de empezar todo de nuevo, y lo que
// ya se bajó no se vuelve a bajar.
const downloaded = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
const queue: Array<() => void> = [];
let active = 0;

function pump() {
    const limit = isLiteNow() ? CONCURRENCY_LITE : CONCURRENCY;
    while (active < limit && queue.length > 0) queue.shift()!();
}

function download(url: string, kind: 'image' | 'video'): Promise<void> {
    if (downloaded.has(url)) return Promise.resolve();
    const existing = inFlight.get(url);
    if (existing) return existing;

    const promise = new Promise<void>(resolve => {
        queue.push(async () => {
            active++;
            let ok = false;
            try {
                ok = await (kind === 'image' ? preloadImage(url) : preloadVideo(url));
            } finally {
                active--;
                if (ok) downloaded.add(url);
                inFlight.delete(url);
                resolve();
                pump();
            }
        });
        pump();
    });
    inFlight.set(url, promise);
    return promise;
}

export function useCacheManager() {
    const [preloadProgress, setPreloadProgress] = useState<{ current: number, total: number } | null>(null);

    // Descarga el contenido antes de mostrarlo, esperando como mucho maxWaitMs:
    // pasado ese tiempo se muestra igual y lo que falta sigue bajando de fondo
    // (o se carga al reproducirse). Antes se esperaba a que bajara todo, y en
    // un equipo lento un cambio de contenido podía tardar minutos en verse.
    const preloadAssets = async (itemsToPreload: CampaignItem[], maxWaitMs: number) => {
        const assets = itemsToPreload.filter(item =>
            ((item.type as string) === 'image' || (item.type as string) === 'video') && item.url
        );
        const pending = assets.filter(item => !downloaded.has(item.url!));
        if (pending.length === 0) return true;

        let loadedCount = 0;
        let waiting = true;
        setPreloadProgress({ current: 0, total: pending.length });

        const all = Promise.all(pending.map(item =>
            download(item.url!, (item.type as string) === 'image' ? 'image' : 'video').then(() => {
                loadedCount++;
                if (waiting) setPreloadProgress({ current: loadedCount, total: pending.length });
            })
        ));

        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<void>(resolve => { timer = setTimeout(resolve, maxWaitMs); });
        await Promise.race([all, deadline]);
        clearTimeout(timer);
        waiting = false;

        setPreloadProgress(null);
        return true;
    };

    return { preloadAssets, preloadProgress };
}
