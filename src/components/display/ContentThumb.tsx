import { Globe, Image as ImageIcon, LayoutGrid, Video } from 'lucide-react';

// Miniatura de un item de playlist o archivo de la biblioteca.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ContentThumb({ item, className = '', iconClassName = 'w-5 h-5' }: { item: any; className?: string; iconClassName?: string }) {
    const url = item?.imageUrl || item?.url;
    const type = item?.type;
    if ((type === 'image' || type === 'image_ad') && url) {
        return <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />;
    }
    if ((type === 'video' || type === 'video_ad') && url) {
        return <video src={`${url}#t=0.5`} className={`object-cover ${className}`} muted playsInline preload="metadata" />;
    }
    const Icon = type === 'video' || type === 'video_ad' ? Video
        : type === 'url' || type === 'external_url' || type === 'web' ? Globe
            : type === 'image' || type === 'image_ad' ? ImageIcon : LayoutGrid;
    return (
        <div className={`flex items-center justify-center bg-muted ${className}`}>
            <Icon className={`${iconClassName} text-muted-foreground`} />
        </div>
    );
}
