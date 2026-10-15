import { useEffect, useState } from 'react';
import { callTvBridge, hasTvBridgeMethod } from '@/lib/tvBridge';

// Actualización de la app TV desde la propia TV (AppUpdater.kt). La app avisa
// el progreso con el evento 'tvupdate'.

export type TvUpdateState =
    | 'idle'
    | 'checking'
    | 'up_to_date'
    | 'available'
    | 'downloading'
    | 'installing'
    | 'confirm'
    | 'error';

export interface TvUpdateStatus {
    state: TvUpdateState;
    current?: { code: number; name: string };
    latest?: { code: number; name: string };
    progress?: number;
    message?: string;
}

// Release fija que publica el workflow "APK de la TV".
export const TV_RELEASE_API = 'https://api.github.com/repos/rauli3514/event-pix/releases/tags/tv-latest';

export const supportsTvUpdate = () => hasTvBridgeMethod('startUpdate');
export const checkTvUpdate = () => callTvBridge('checkForUpdate');
export const startTvUpdate = () => callTvBridge('startUpdate');

export function useTvUpdateStatus(): TvUpdateStatus {
    const [status, setStatus] = useState<TvUpdateStatus>({ state: 'idle' });
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<TvUpdateStatus>).detail;
            if (!detail?.state) return;
            // Los eventos de progreso no traen versiones: se conservan las anteriores.
            setStatus(prev => ({ ...prev, ...detail }));
        };
        window.addEventListener('tvupdate', handler);
        return () => window.removeEventListener('tvupdate', handler);
    }, []);
    return status;
}

// Última versión publicada, para el panel. La API de GitHub admite CORS; el
// título de la release es "App TV <versión>" y el código va en las notas.
export interface PublishedTvVersion {
    versionName: string;
    versionCode: number | null;
}

export async function fetchPublishedTvVersion(): Promise<PublishedTvVersion | null> {
    try {
        const res = await fetch(TV_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) return null;
        const release = await res.json();
        const name = String(release.name || '').replace(/^App TV\s*/i, '').trim();
        const codeMatch = String(release.body || '').match(/versionCode\s+(\d+)/);
        if (!name) return null;
        return { versionName: name, versionCode: codeMatch ? parseInt(codeMatch[1], 10) : null };
    } catch {
        return null;
    }
}
