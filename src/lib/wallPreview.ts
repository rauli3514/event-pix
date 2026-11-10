// Primera foto de lo que se va a mandar (archivo suelto o playlist), para la vista previa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function previewImageOf(assets: any[]): string | null {
    const isImage = (t?: string) => t === 'image' || t === 'image_ad';
    for (const asset of assets || []) {
        if (isImage(asset?.type) && (asset.url || asset.imageUrl)) return asset.url || asset.imageUrl;
        if (asset?.type === 'campaign') {
            const raw = asset.items_json;
            const list = Array.isArray(raw) ? raw : raw?.zones?.[0]?.playlist || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const first = list.find((item: any) => isImage(item?.type) && (item.url || item.imageUrl));
            if (first) return first.url || first.imageUrl;
        }
    }
    return null;
}
