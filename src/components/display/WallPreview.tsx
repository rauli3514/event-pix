import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isPortrait } from '@/lib/screenStatus';
import { AppCover, WebCover } from '@/components/display/AppCover';
import { PosterView } from '@/components/display/posters/PosterView';
import type { WallPreviewItem } from '@/lib/wallPreview';

// Vista previa del Mosaico en "Enviar a pantallas": lo que se manda tal como va a
// salir (fotos y videos llenando todo el mosaico y recortados, o completos con
// franjas negras; carteles y apps dibujados al tamaño de todo el mosaico), con
// las líneas de corte y el número y nombre de cada pantalla en su lugar.

interface Props {
    cols: number;
    rows: number;
    // Pantallas en orden: la 1 va arriba a la izquierda.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screens: any[];
    // Lo que se manda (archivos o los de una playlist), en orden.
    items: WallPreviewItem[];
    commerceId?: string;
    // 'cover': llena y recorta. 'contain': completa, con franjas negras.
    fit?: 'cover' | 'contain';
}

const SCREEN_LONG = 1920;
const SCREEN_SHORT = 1080;

const KIND_LABEL: Record<WallPreviewItem['kind'], string> = {
    image: 'Foto', video: 'Video', poster: 'Cartel', app: 'App', web: 'Página web', other: 'Contenido',
};

export function WallPreview({ cols, rows, screens, items, commerceId, fit = 'cover' }: Props) {
    const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null);
    const [index, setIndex] = useState(0);
    const current = items.length ? items[Math.min(index, items.length - 1)] : null;
    const mediaUrl = current && (current.kind === 'image' || current.kind === 'video') ? current.url : null;
    const objectFit = fit === 'contain' ? 'object-contain' : 'object-cover';

    // Forma de cada pantalla: si son mezcla, se toma la de la primera y se avisa.
    const portraitFlags = screens.map(d => isPortrait(d));
    const portrait = portraitFlags[0] ?? false;
    const mixed = portraitFlags.some(p => p !== portrait);
    const screenW = portrait ? SCREEN_SHORT : SCREEN_LONG;
    const screenH = portrait ? SCREEN_LONG : SCREEN_SHORT;
    const idealW = cols * screenW;
    const idealH = rows * screenH;
    const wallAspect = idealW / idealH;

    const size = natural && natural.url === mediaUrl ? natural : null;
    let cropText: string | null = null;
    if (size) {
        const imgAspect = size.w / size.h;
        const lost = imgAspect > wallAspect ? 1 - wallAspect / imgAspect : 1 - imgAspect / wallAspect;
        const pct = Math.round(lost * 100);
        if (pct < 5) cropText = 'Entra completa.';
        else if (fit === 'contain') cropText = imgAspect > wallAspect
            ? `Se ve completa, con franjas negras arriba y abajo (${pct} % del mosaico).`
            : `Se ve completa, con franjas negras a los costados (${pct} % del mosaico).`;
        else cropText = imgAspect > wallAspect
            ? `Se recortan los costados (se pierde un ${pct} %).`
            : `Se recorta arriba y abajo (se pierde un ${pct} %).`;
    }

    return (
        <div className="space-y-2">
            {/* Hasta 260 px de alto: las formas altas (1×2, verticales) quedan más angostas. */}
            <div className="mx-auto w-full" style={{ maxWidth: `${Math.round(260 * wallAspect)}px` }}>
                <div className="relative w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950" style={{ aspectRatio: `${idealW} / ${idealH}` }}>
                    {!current ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/25 to-indigo-500/25" />
                    ) : current.kind === 'image' ? (
                        <img
                            key={current.url!}
                            src={current.url!}
                            alt=""
                            className={`absolute inset-0 h-full w-full ${objectFit}`}
                            onLoad={e => setNatural({ url: current.url!, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                        />
                    ) : current.kind === 'video' ? (
                        <video
                            key={current.url!}
                            src={current.url!}
                            muted
                            autoPlay
                            loop
                            playsInline
                            className={`absolute inset-0 h-full w-full ${objectFit}`}
                            onLoadedMetadata={e => setNatural({ url: current.url!, w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
                        />
                    ) : current.kind === 'poster' ? (
                        <div className="absolute inset-0">
                            <PosterView config={{ ...current.item.metadata.config, animation: 'none' }} commerceId={commerceId} />
                        </div>
                    ) : current.kind === 'app' ? (
                        <AppCover item={current.item} className="absolute inset-0 h-full w-full" />
                    ) : current.kind === 'web' ? (
                        <WebCover item={current.item} className="absolute inset-0 h-full w-full" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-500/25 to-indigo-500/25 px-4 text-center text-sm text-white/80">{current.name}</div>
                    )}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
                        {screens.map((device, i) => (
                            <div key={device.id} className="relative border border-white/70">
                                <span className="absolute left-1 top-1 max-w-[90%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    {i + 1} · {device.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {items.length > 1 && current && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
                    <button type="button" onClick={() => setIndex(i => (i - 1 + items.length) % items.length)} className="rounded-full border border-slate-700 p-1 hover:bg-slate-800" aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="min-w-0 max-w-[16rem] truncate">{Math.min(index, items.length - 1) + 1} de {items.length} · {KIND_LABEL[current.kind]}{current.name ? `: ${current.name}` : ''}</span>
                    <button type="button" onClick={() => setIndex(i => (i + 1) % items.length)} className="rounded-full border border-slate-700 p-1 hover:bg-slate-800" aria-label="Siguiente"><ChevronRight className="w-4 h-4" /></button>
                </div>
            )}
            <div className="text-xs text-slate-400 space-y-0.5">
                <p>
                    Medida ideal: <strong className="text-slate-200">{idealW} × {idealH} px</strong>
                    {' '}({cols} {cols === 1 ? 'pantalla' : 'pantallas'} {portrait ? (cols === 1 ? 'vertical' : 'verticales') : (cols === 1 ? 'horizontal' : 'horizontales')} de ancho × {rows} de alto).
                </p>
                {size && <p>{current?.kind === 'video' ? 'Tu video' : 'Tu imagen'}: {size.w} × {size.h} px. {cropText}</p>}
                {current?.kind === 'poster' && <p>El cartel se arma al tamaño de todo el mosaico: no se recorta. Conviene que los textos no queden justo en la unión de las pantallas.</p>}
                {(current?.kind === 'app' || current?.kind === 'web') && <p>{current.kind === 'app' ? 'La app' : 'La página'} ocupa todo el mosaico y cada pantalla muestra su parte.</p>}
                {mixed && <p className="text-amber-300">Hay pantallas verticales y horizontales: para el mosaico conviene que sean todas iguales.</p>}
                <p className="text-slate-500">Si las pantallas son de distinto tamaño físico, el dibujo no va a calzar perfecto en el corte.</p>
            </div>
        </div>
    );
}
