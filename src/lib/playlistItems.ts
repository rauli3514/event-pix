import type { DisplayCampaignV2, DisplayMedia, UniversalElement } from '@/types/display';

// Utilidades compartidas para leer y armar playlists (items_json de
// display_campaigns). Hay dos formatos: el viejo (array de items) y el 2.0
// (zones[0].playlist), que es el que guardan el editor y el panel.

export const DEFAULT_ITEM_DURATION = 10;

// Convierte cualquier formato al 2.0.
export function toPlaylistV2(data: unknown): DisplayCampaignV2 {
    const raw = data as { version?: string } | unknown[] | null;
    if (raw && !Array.isArray(raw) && raw.version === '2.0') return raw as DisplayCampaignV2;

    const items = Array.isArray(raw) ? raw : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playlist: UniversalElement[] = items.map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        type: item.type === 'image_ad' ? 'image' : (item.type === 'video' ? 'video' : 'url'),
        url: item.imageUrl || item.url,
        content: item.title || 'Migrado',
        metadata: item.metadata || {},
        duration: item.duration || DEFAULT_ITEM_DURATION,
        transition: 'fade',
        fitMode: 'contain',
    }));

    return {
        version: '2.0',
        settings: {
            orientation: 'landscape',
            background: { type: 'color', value: '#050505' },
            shuffle: false,
            transition: 'fade',
            defaultDuration: DEFAULT_ITEM_DURATION,
        },
        zones: [{
            id: 'main',
            name: 'Principal',
            width: '100%', height: '100%', top: 0, left: 0, zIndex: 1,
            playlist,
        }],
    } as DisplayCampaignV2;
}

// Items de la playlist principal, en cualquier formato.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function playlistItems(data: unknown): any[] {
    if (Array.isArray(data)) return data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v2 = data as { version?: string; zones?: { playlist?: any[] }[] } | null;
    if (v2?.version === '2.0') return v2.zones?.[0]?.playlist || [];
    return [];
}

// Un archivo de la biblioteca como item de playlist. Las webs se guardan como
// 'url', que es lo que entiende el reproductor.
// Los videos arrancan con su duración real (se ven enteros, una vez); si no se
// conoce, con la duración por defecto.
export function mediaToPlaylistItem(media: DisplayMedia, settings?: { defaultDuration?: number; transition?: string }) {
    const real = videoSeconds({ type: media.type, metadata: media.metadata });
    return {
        id: crypto.randomUUID(),
        type: media.type === 'web' ? 'url' : media.type,
        url: media.url,
        content: media.name,
        metadata: media.metadata || {},
        duration: real ? Math.max(1, Math.floor(real)) : settings?.defaultDuration || DEFAULT_ITEM_DURATION,
        transition: settings?.transition || 'fade',
        fitMode: 'contain',
        source_id: media.id,
    } as unknown as UniversalElement;
}

// La playlist con los archivos agregados al final.
export function appendMediaToPlaylist(data: unknown, media: DisplayMedia[]): DisplayCampaignV2 {
    const v2 = toPlaylistV2(data);
    const zones = [...v2.zones];
    const main = zones[0];
    const added = media.map(m => mediaToPlaylistItem(m, v2.settings));
    zones[0] = { ...main, playlist: [...(main?.playlist || []), ...added] };
    return { ...v2, zones };
}

// ¿Este item de playlist es este archivo de la biblioteca?
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const itemIsMedia = (item: any, media: DisplayMedia) =>
    item?.source_id === media.id || (!!media.url && (item?.url === media.url || item?.imageUrl === media.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

export const isVideoItem = (item: AnyItem) => item?.type === 'video' || item?.type === 'video_ad';

// Duración real de un video (la guarda el análisis al subirlo), o null.
export function videoSeconds(item: AnyItem): number | null {
    if (!isVideoItem(item)) return null;
    const real = Number(item?.metadata?.video?.duration_sec);
    return Number.isFinite(real) && real > 0 ? real : null;
}

// Cuánto está en pantalla un item. Para los videos la duración es un mínimo:
// se ven enteros y, si son más cortos, se repiten hasta cumplirla.
export function itemSeconds(item: AnyItem): { seconds: number; exact: boolean } {
    const set = Number(item?.duration) || 0;
    if (!isVideoItem(item)) return { seconds: set || DEFAULT_ITEM_DURATION, exact: true };
    const real = videoSeconds(item);
    if (!real) return { seconds: set, exact: false };
    return { seconds: set > real ? Math.ceil(set / real) * real : real, exact: true };
}

// Duración de una vuelta; exact = false si falta la duración de algún video.
export function loopDuration(items: AnyItem[]): { seconds: number; exact: boolean } {
    let seconds = 0;
    let exact = true;
    for (const item of items) {
        const one = itemSeconds(item);
        seconds += one.seconds;
        if (!one.exact) exact = false;
    }
    return { seconds, exact };
}

export function formatDuration(seconds: number): string {
    const s = Math.round(seconds);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? `${m} min ${rest} s` : `${m} min`;
}

// 75 -> "1:15"
export function formatClock(seconds: number): string {
    const s = Math.round(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
