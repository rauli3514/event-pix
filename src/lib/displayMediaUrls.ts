// URLs de videos e imágenes que puede mostrar una asignación (playlist o
// archivo directo, y todas las franjas de su programación). La app TV las
// guarda en el equipo para seguir reproduciendo sin internet.

const MEDIA_ITEM_TYPES = new Set(['image', 'image_ad', 'video', 'video_ad']);
const IMAGE_URL = /\.(jpe?g|png|gif|webp)($|\?)/i;

type AnyRecord = Record<string, any>;

function itemUrls(item: AnyRecord | null | undefined): string[] {
    if (!item) return [];
    const type = String(item.type || '');
    if (MEDIA_ITEM_TYPES.has(type)) {
        return [item.imageUrl, item.url].filter((u): u is string => typeof u === 'string' && u.length > 0);
    }
    // Una "URL externa" que en realidad es una imagen se muestra como imagen.
    if ((type === 'url' || type === 'external_url') && typeof item.url === 'string' && IMAGE_URL.test(item.url)) {
        return [item.url];
    }
    return [];
}

function campaignUrls(campaign: AnyRecord | null | undefined): string[] {
    const raw = campaign?.items_json;
    if (!raw) return [];
    let items: AnyRecord[] = [];
    if (raw.version === '2.0' && Array.isArray(raw.zones)) {
        items = raw.zones.flatMap((zone: AnyRecord) => (Array.isArray(zone?.playlist) ? zone.playlist : []));
    } else if (Array.isArray(raw)) {
        items = raw;
    }
    return items.flatMap(itemUrls);
}

function mediaUrls(media: AnyRecord | null | undefined): string[] {
    if (!media || (media.type !== 'image' && media.type !== 'video')) return [];
    return typeof media.url === 'string' && media.url ? [media.url] : [];
}

export function collectAssignmentMediaUrls(assignment: AnyRecord | null | undefined): string[] {
    if (!assignment) return [];
    const urls: string[] = [
        ...campaignUrls(assignment.campaign),
        ...mediaUrls(assignment.media),
    ];
    const schedule = assignment.schedule;
    if (schedule) {
        urls.push(...campaignUrls(schedule.default_campaign), ...mediaUrls(schedule.default_media));
        for (const event of schedule.events || []) {
            urls.push(...campaignUrls(event?.campaign), ...mediaUrls(event?.media));
        }
    }
    return urls;
}

// Primero lo que se está mostrando (se baja antes), sin repetidos.
export function orderMediaUrls(current: string[], all: string[]): string[] {
    return Array.from(new Set([...current, ...all])).filter(u => /^https:\/\//i.test(u));
}

export { itemUrls as mediaItemUrls };
