import { useState } from 'react';
import { Clock, Globe, Play, Star, Tag } from 'lucide-react';
import { appIdOf, appKindOf } from '@/lib/appCovers';

// Portadas de las apps y páginas web: cada tipo con su color, su ícono y algo
// de su contenido (ciudades del clima, zonas de la pantalla dividida, el video
// de YouTube…), así se distinguen de un vistazo en Medios y en las playlists.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

function youtubeId(url?: string): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    return match ? match[1] : null;
}

function hostOf(url?: string): string | null {
    if (!url) return null;
    try {
        return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

const DOLAR_TYPES: Record<string, string> = { all: 'Todas las cotizaciones', blue: 'Dólar blue', oficial: 'Dólar oficial', tarjeta: 'Dólar tarjeta', cripto: 'Dólar cripto' };

// Lo de adentro de cada portada grande.
function AppScene({ item }: { item: AnyItem }) {
    const appId = appIdOf(item);
    const config = item?.metadata?.config || {};
    const kind = appKindOf(item);
    const Icon = kind.icon;

    if (appId === 'split-screen' && Array.isArray(config.zones) && config.zones.length > 0) {
        return (
            <div className="absolute inset-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {config.zones.map((zone: any, i: number) => {
                    const image = zone.mediaObj?.type === 'image' ? zone.mediaObj.url : null;
                    return (
                        <div
                            key={zone.id || i}
                            className="absolute p-0.5"
                            style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
                        >
                            <div className="w-full h-full rounded-md bg-white/15 border border-white/30 overflow-hidden flex items-center justify-center">
                                {image
                                    ? <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
                                    : <span className="text-white/90 text-sm font-semibold">{i + 1}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (appId === 'youtube') {
        const id = youtubeId(config.url);
        return (
            <>
                {id && (
                    <img
                        src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}
                <span className="relative w-12 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 text-white fill-white" />
                </span>
            </>
        );
    }

    if (appId === 'dynamic-menu' && config.backgroundMediaUrl && config.backgroundMediaType !== 'video') {
        const labels = Array.isArray(config.labels) ? config.labels.length : 0;
        return (
            <>
                <img src={config.backgroundMediaUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                <span className="relative flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    <Tag className="w-3.5 h-3.5" /> {labels === 1 ? '1 etiqueta' : `${labels} etiquetas`}
                </span>
            </>
        );
    }

    if (appId === 'clock') {
        const now = new Date();
        const time = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: config.format24h === false });
        return (
            <div className="relative text-center text-white">
                {config.type === 'analog'
                    ? <Clock className="w-12 h-12 mx-auto" strokeWidth={1.5} />
                    : <p className="text-3xl font-bold tabular-nums tracking-tight">{time}</p>}
                {config.showDate !== false && (
                    <p className="text-xs text-white/80 mt-1 first-letter:uppercase">{now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                )}
            </div>
        );
    }

    // Texto debajo del ícono según lo que tenga configurado cada app.
    let detail: string | null = null;
    if (appId === 'weather') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cities = Array.isArray(config.locations) ? config.locations.map((l: any) => l?.name?.split(',')[0]).filter(Boolean) : [];
        detail = cities.length > 0 ? cities.join(' · ') : config.locationName || null;
    } else if (appId === 'dolar') {
        detail = DOLAR_TYPES[config.type] || null;
    } else if (appId === 'ticker') {
        detail = config.sourceType === 'rss' ? 'Noticias (RSS)' : (config.customText || '').trim() || null;
    } else if (appId === 'qr') {
        detail = config.title || hostOf(config.value) || null;
    } else if (appId === 'reviews') {
        const count = Array.isArray(config.reviews) ? config.reviews.length : 0;
        detail = count > 0 ? (count === 1 ? '1 reseña' : `${count} reseñas`) : config.title || null;
    }

    return (
        <div className="relative flex flex-col items-center gap-1.5 px-3 text-center text-white max-w-full">
            {appId === 'reviews' ? (
                <span className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map(i => <Star key={i} className="w-5 h-5 fill-white text-white" />)}
                </span>
            ) : (
                <Icon className="w-10 h-10" strokeWidth={1.5} />
            )}
            {detail && (
                appId === 'ticker'
                    ? <p className="w-full rounded bg-black/30 px-2 py-0.5 text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis">{detail}</p>
                    : <p className="text-xs font-medium text-white/90 line-clamp-2">{detail}</p>
            )}
        </div>
    );
}

interface CoverProps {
    item: AnyItem;
    className?: string;
    // Miniatura chica: solo color e ícono.
    compact?: boolean;
}

export function AppCover({ item, className = '', compact }: CoverProps) {
    const kind = appKindOf(item);
    const Icon = kind.icon;
    return (
        <div className={`relative overflow-hidden bg-gradient-to-br ${kind.bg} flex items-center justify-center ${className}`}>
            {compact ? <Icon className="w-1/2 h-1/2 max-w-[24px] max-h-[24px] text-white" strokeWidth={1.75} /> : <AppScene item={item} />}
        </div>
    );
}

export function WebCover({ item, className = '', compact }: CoverProps) {
    const host = hostOf(item?.url);
    const [iconFailed, setIconFailed] = useState(false);
    const favicon = host && !iconFailed
        ? <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" loading="lazy" onError={() => setIconFailed(true)} className="w-full h-full object-contain" />
        : <Globe className="w-full h-full text-slate-600" strokeWidth={1.5} />;

    if (compact) {
        return (
            <div className={`flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-600 dark:to-slate-800 ${className}`}>
                <span className="w-1/2 h-1/2 max-w-[24px] max-h-[24px] rounded bg-white p-0.5 flex">{favicon}</span>
            </div>
        );
    }
    return (
        <div className={`relative overflow-hidden bg-gradient-to-br from-slate-600 to-slate-900 flex flex-col items-center justify-center gap-2 px-3 ${className}`}>
            <span className="w-12 h-12 rounded-xl bg-white p-2 shadow-lg flex">{favicon}</span>
            {host && <span className="max-w-full truncate text-xs font-medium text-white/90">{host}</span>}
        </div>
    );
}
