import { useState } from 'react';
import { CampaignItem } from '@/types/display';

// Tiempo máximo por archivo. Si una descarga se traba, la pantalla no puede
// quedarse en negro esperando: se sigue y el archivo carga al reproducirse.
const IMAGE_TIMEOUT_MS = 20 * 1000;
const VIDEO_TIMEOUT_MS = 90 * 1000;

export function useCacheManager() {
    const [preloadProgress, setPreloadProgress] = useState<{ current: number, total: number } | null>(null);

    const preloadAssets = async (itemsToPreload: CampaignItem[]) => {
        const assets = itemsToPreload.filter(item => (item.type as string) === 'image' || (item.type as string) === 'video');
        if (assets.length === 0) return true;

        setPreloadProgress({ current: 0, total: assets.length });

        let loadedCount = 0;
        const promises = assets.map(item => {
            return new Promise<void>((resolve) => {
                let settled = false;
                let timer: ReturnType<typeof setTimeout> | undefined;
                const done = () => {
                    if (settled) return;
                    settled = true;
                    if (timer) clearTimeout(timer);
                    loadedCount++;
                    setPreloadProgress({ current: loadedCount, total: assets.length });
                    resolve();
                };

                if ((item.type as string) === 'image' && item.url) {
                    const img = new Image();
                    timer = setTimeout(() => { img.src = ''; done(); }, IMAGE_TIMEOUT_MS);
                    img.onload = done;
                    img.onerror = done;
                    img.src = item.url;
                } else if ((item.type as string) === 'video' && item.url) {
                    const req = new XMLHttpRequest();
                    req.open('GET', item.url, true);
                    req.responseType = 'blob';
                    req.timeout = VIDEO_TIMEOUT_MS;
                    req.onload = done;
                    req.onerror = done;
                    req.ontimeout = done;
                    req.onabort = done;
                    req.send();
                } else {
                    done();
                }
            });
        });

        await Promise.all(promises);
        setPreloadProgress(null);
        return true;
    };

    return { preloadAssets, preloadProgress };
}
