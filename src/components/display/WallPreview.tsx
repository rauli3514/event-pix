import { useState } from 'react';
import { isPortrait } from '@/lib/screenStatus';

// Vista previa del Mosaico en "Enviar a pantallas": la imagen tal como va a
// salir (llenando todo el mosaico y recortada, o completa con franjas negras),
// con las líneas de corte y el número y nombre de cada pantalla en su lugar.

interface Props {
    cols: number;
    rows: number;
    // Pantallas en orden: la 1 va arriba a la izquierda.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screens: any[];
    imageUrl: string | null;
    // 'cover': llena y recorta. 'contain': completa, con franjas negras.
    fit?: 'cover' | 'contain';
}

const SCREEN_LONG = 1920;
const SCREEN_SHORT = 1080;

export function WallPreview({ cols, rows, screens, imageUrl, fit = 'cover' }: Props) {
    const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null);

    // Forma de cada pantalla: si son mezcla, se toma la de la primera y se avisa.
    const portraitFlags = screens.map(d => isPortrait(d));
    const portrait = portraitFlags[0] ?? false;
    const mixed = portraitFlags.some(p => p !== portrait);
    const screenW = portrait ? SCREEN_SHORT : SCREEN_LONG;
    const screenH = portrait ? SCREEN_LONG : SCREEN_SHORT;
    const idealW = cols * screenW;
    const idealH = rows * screenH;
    const wallAspect = idealW / idealH;

    const size = natural && natural.url === imageUrl ? natural : null;
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
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt=""
                            className={`absolute inset-0 h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                            onLoad={e => setNatural({ url: imageUrl, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/25 to-indigo-500/25" />
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
            <div className="text-xs text-slate-400 space-y-0.5">
                <p>
                    Imagen ideal: <strong className="text-slate-200">{idealW} × {idealH} px</strong>
                    {' '}({cols} {cols === 1 ? 'pantalla' : 'pantallas'} {portrait ? (cols === 1 ? 'vertical' : 'verticales') : (cols === 1 ? 'horizontal' : 'horizontales')} de ancho × {rows} de alto).
                </p>
                {size && <p>Tu imagen: {size.w} × {size.h} px. {cropText}</p>}
                {!imageUrl && <p>La vista previa se ve con fotos; con videos o apps el recorte es el mismo.</p>}
                {mixed && <p className="text-amber-300">Hay pantallas verticales y horizontales: para el mosaico conviene que sean todas iguales.</p>}
                <p className="text-slate-500">Si las pantallas son de distinto tamaño físico, el dibujo no va a calzar perfecto en el corte.</p>
            </div>
        </div>
    );
}
