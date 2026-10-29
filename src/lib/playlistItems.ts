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
export function mediaToPlaylistItem(media: DisplayMedia, settings?: { defaultDuration?: number; transition?: string }) {
    return {
        id: crypto.randomUUID(),
        type: media.type === 'web' ? 'url' : media.type,
        url: media.url,
        content: media.name,
        metadata: media.metadata || {},
        duration: settings?.defaultDuration || DEFAULT_ITEM_DURATION,
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
