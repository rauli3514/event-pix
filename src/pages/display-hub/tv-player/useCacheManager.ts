import { useState } from 'react';
import { CampaignItem } from '@/types/display';

export function useCacheManager() {
    const [preloadProgress, setPreloadProgress] = useState<{ current: number, total: number } | null>(null);

    const preloadAssets = async (itemsToPreload: CampaignItem[]) => {
        const assets = itemsToPreload.filter(item => (item.type as string) === 'image' || (item.type as string) === 'video');
        if (assets.length === 0) return true;

        setPreloadProgress({ current: 0, total: assets.length });

        let loadedCount = 0;
        const promises = assets.map(item => {
            return new Promise<void>((resolve) => {
                if ((item.type as string) === 'image' && item.url) {
                    const img = new Image();
                    img.onload = () => { loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve(); };
                    img.onerror = () => { loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve(); };
                    img.src = item.url;
                } else if ((item.type as string) === 'video' && item.url) {
                    const req = new XMLHttpRequest();
                    req.open('GET', item.url, true);
                    req.responseType = 'blob';
                    req.onload = function() {
                        loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve();
                    };
                    req.onerror = function() {
                        loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve();
                    };
                    req.send();
                } else {
                    loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve();
                }
            });
        });

        await Promise.all(promises);
        setPreloadProgress(null);
        return true;
    };

    return { preloadAssets, preloadProgress };
}
