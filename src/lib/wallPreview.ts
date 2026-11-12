// Lo que se va a mandar (archivos sueltos o los de una playlist), en orden, para
// la vista previa del Mosaico: fotos, videos, carteles, apps y páginas web.

export type WallPreviewKind = 'image' | 'video' | 'poster' | 'app' | 'web' | 'other';

export interface WallPreviewItem {
    kind: WallPreviewKind;
    name: string;
    url: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPreview(item: any): WallPreviewItem | null {
    if (!item || item.type === 'folder') return null;
    const url = item.url || item.imageUrl || null;
    const name = item.name || item.content || '';
    switch (item.type) {
        case 'image':
        case 'image_ad':
            return url ? { kind: 'image', name, url, item } : null;
        case 'video':
        case 'video_ad':
            return url ? { kind: 'video', name, url, item } : null;
        case 'app':
        case 'widget':
        case 'layout':
            return { kind: item.metadata?.appId === 'poster' && item.metadata?.config ? 'poster' : 'app', name, url, item };
        case 'url':
        case 'external_url':
        case 'web':
            return { kind: 'web', name, url, item };
        default:
            return { kind: 'other', name, url, item };
    }
}

const MAX = 40;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function previewItemsOf(assets: any[]): WallPreviewItem[] {
    const out: WallPreviewItem[] = [];
    for (const asset of assets || []) {
        if (asset?.type === 'campaign') {
            const raw = asset.items_json;
            const list = Array.isArray(raw) ? raw : raw?.zones?.[0]?.playlist || [];
            for (const item of list) {
                const p = toPreview(item);
                if (p) out.push(p);
                if (out.length >= MAX) return out;
            }
        } else {
            const p = toPreview(asset);
            if (p) out.push(p);
        }
        if (out.length >= MAX) break;
    }
    return out;
}
