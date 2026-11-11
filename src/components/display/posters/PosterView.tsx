import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLivePriceLists } from '@/hooks/use-live-price-lists';
import { formatPrice, type PriceList } from '@/lib/priceLists';
import {
    POSTER_FONTS, QR_DEFAULT_LABEL, fitList, parseQrUrl, posterColors, scheduleBadge,
    type PosterConfig, type PosterListRow as Row, type PosterPart, type PosterTemplate, type TextStyle,
} from '@/lib/posters';

// Dibuja un cartel (ver lib/posters). Todo se mide en "u" = 1 % del lado corto
// de la pantalla, así se ve igual en el celular y en una TV de 65". Se usa
// flexbox y posiciones absolutas (nada de grid ni gap) para los TV box viejos.

interface Props {
    config: PosterConfig;
    commerceId?: string;
    // Listas ya cargadas (editor); si no, se leen en vivo.
    lists?: PriceList[];
    // Lista de ejemplo de la plantilla, cuando todavía no se vinculó una.
    sampleList?: PosterTemplate['sampleList'];
    // Editor: la tarjeta se puede arrastrar con el dedo o el mouse.
    onCardMove?: (pos: { x: number; y: number }) => void;
    // Editor: cada parte se toca para elegirla y se arrastra para moverla.
    editParts?: {
        selected: PosterPart | null;
        onSelect: (part: PosterPart | null) => void;
        onMove: (part: PosterPart, offset: { x: number; y: number }) => void;
    };
}

function useBox(ref: React.RefObject<HTMLDivElement | null>) {
    const [box, setBox] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const read = () => setBox(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref]);
    return box;
}

function useClock(enabled: boolean) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        if (!enabled) return;
        const id = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(id);
    }, [enabled]);
    return now;
}

const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const ENTRANCE: Record<string, { name: string; dur: number; ease: string }> = {
    fade: { name: 'poster-fade', dur: 0.9, ease: 'ease-out' },
    slide: { name: 'poster-up', dur: 0.8, ease: 'cubic-bezier(.2,.8,.2,1)' },
    pop: { name: 'poster-pop', dur: 0.6, ease: 'ease-out' },
};

export function PosterView({ config, commerceId, lists: listsProp, sampleList, onCardMove, editParts }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
    const partDrag = useRef<{ part: PosterPart; sx: number; sy: number; x: number; y: number } | null>(null);
    const { w: W, h: H } = useBox(ref);
    const live = useLivePriceLists(listsProp ? null : commerceId);
    const lists = listsProp || live;
    const now = useClock(!!config.showClock);

    const theme = posterColors(config);
    const font = POSTER_FONTS[config.font] || POSTER_FONTS.modern;

    // Renglones: la lista vinculada (sin los "sin stock") o el ejemplo de la plantilla.
    const list = config.listId ? lists.find(l => l.id === config.listId) : undefined;
    const rows: Row[] = list
        ? (list.items || []).filter(i => i.available !== false && i.name).map(i => ({ name: i.name, detail: i.detail, price: formatPrice(i.price) }))
        : !config.listId && sampleList ? sampleList : [];

    // Precio grande: vinculado a un producto o escrito a mano.
    let price = config.price || '';
    if (config.priceRef) {
        const item = lists.find(l => l.id === config.priceRef?.listId)?.items.find(i => i.id === config.priceRef?.itemId);
        price = item && item.available !== false ? formatPrice(item.price) : '';
    }
    const badge = config.badge || (config.autoBadge ? scheduleBadge(config.schedule) : null) || '';

    const landscape = W / Math.max(1, H) >= 1.2;
    const u = Math.min(W, H) / 100;
    const photos = (config.photos || []).filter(Boolean);

    // Animaciones: cada parte entra un poquito después de la anterior.
    const entrance = config.animation && config.animation !== 'none' ? ENTRANCE[config.animation] : null;
    const animStyle = (i: number): CSSProperties | undefined => (entrance
        ? { animation: `${entrance.name} ${entrance.dur}s ${entrance.ease} ${(0.2 + i * 0.14).toFixed(2)}s both` }
        : undefined);
    const seq = (node: ReactNode, i: number) => (node ? <div style={animStyle(i)}>{node}</div> : null);

    const textStyle = (base: number, style: TextStyle | undefined, color: string): CSSProperties => ({
        fontSize: base * u * (style?.scale || 1),
        color: style?.color || color,
        textShadow: style?.shadow ? '0 0.08em 0.35em rgba(0,0,0,0.6)' : undefined,
    });

    const scaleOf = (part: PosterPart) => config.styles?.[part]?.scale || 1;

    // Cada parte puede estar corrida de su lugar; en el editor se elige y se arrastra.
    const partStyle = (part: PosterPart): CSSProperties => {
        const off = config.offsets?.[part];
        const style: CSSProperties = off && (off.x || off.y) ? { transform: `translate(${Math.round(off.x * W)}px, ${Math.round(off.y * H)}px)` } : {};
        if (editParts) {
            style.cursor = 'move';
            style.touchAction = 'none';
            style.outline = editParts.selected === part ? '2px solid #6366f1' : '1px dashed rgba(255,255,255,0.55)';
            style.outlineOffset = 2;
        }
        return style;
    };
    const partHandlers = (part: PosterPart) => (editParts ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
            e.stopPropagation();
            e.preventDefault();
            editParts.onSelect(part);
            const off = config.offsets?.[part];
            partDrag.current = { part, sx: e.clientX, sy: e.clientY, x: off?.x || 0, y: off?.y || 0 };
            e.currentTarget.setPointerCapture?.(e.pointerId);
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
            const d = partDrag.current;
            if (!d || d.part !== part || W <= 0 || H <= 0) return;
            const dx = e.clientX - d.sx;
            const dy = e.clientY - d.sy;
            if (Math.abs(dx) + Math.abs(dy) < 3) return;
            editParts.onMove(part, {
                x: Math.round(clamp(d.x + dx / W, -1, 1) * 1000) / 1000,
                y: Math.round(clamp(d.y + dy / H, -1, 1) * 1000) / 1000,
            });
        },
        onPointerUp: () => { partDrag.current = null; },
        onPointerCancel: () => { partDrag.current = null; },
    } : {});
    const wrap = (part: PosterPart, node: ReactNode, display: 'block' | 'table' = 'block', extra?: CSSProperties) => (node ? (
        <div style={{ display, position: 'relative', ...extra, ...partStyle(part) }} {...partHandlers(part)}>{node}</div>
    ) : null);

    const renderPhoto = (url: string | undefined, style: CSSProperties, key?: string) => (
        <div key={key} style={abs({ ...style, overflow: 'hidden', backgroundColor: '#222', animation: entrance ? 'poster-fade 1s ease-out both' : undefined })}>
            <div
                className={config.photoMotion ? 'poster-motion' : undefined}
                style={abs({
                    left: 0, top: 0, width: '100%', height: '100%',
                    backgroundImage: url ? `url("${url}")` : theme.photoTint,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    animation: config.photoMotion ? 'poster-photo-zoom 14s ease-in-out infinite alternate' : undefined,
                })}
            />
        </div>
    );

    // Fotos de fondo: una ocupa todo; dos van lado a lado (o una arriba de otra).
    const renderPhotos = (area: { left: number; top: number; width: number; height: number }) => {
        const { width, height, left, top } = area;
        if (photos.length < 2) return renderPhoto(photos[0], { left, top, width, height });
        const sideBySide = width / Math.max(1, height) >= 1;
        return (
            <>
                {renderPhoto(photos[0], { left, top, width: sideBySide ? width / 2 : width, height: sideBySide ? height : height / 2 }, 'a')}
                {renderPhoto(photos[1], {
                    left: left + (sideBySide ? width / 2 : 0),
                    top: top + (sideBySide ? 0 : height / 2),
                    width: sideBySide ? width / 2 : width,
                    height: sideBySide ? height : height / 2,
                }, 'b')}
            </>
        );
    };

    const renderBadge = () => (badge ? wrap('badge', (
        <div style={{ display: 'inline-block', background: config.styles?.badge?.color || theme.accent, color: theme.panel, fontFamily: POSTER_FONTS.modern.family, fontWeight: 800, letterSpacing: '0.08em', fontSize: 2.2 * u * scaleOf('badge'), padding: '0.22em 0.64em', borderRadius: 99, whiteSpace: 'nowrap' }}>
            {badge}
        </div>
    ), 'table', { marginBottom: 2 * u, alignSelf: 'flex-start' }) : null);

    const titleFamily = font.family;
    const renderTitle = (base: number, align: 'left' | 'center' = 'left') => (config.title ? wrap('title',
        <div style={{ ...textStyle(base, config.styles?.title, theme.text), fontFamily: titleFamily, fontWeight: font.weight, lineHeight: config.font === 'script' ? 1.15 : 1.02, textAlign: align, letterSpacing: config.font === 'impact' ? '0.01em' : undefined, wordWrap: 'break-word' }}>
            {config.title}
        </div>,
    ) : null);

    const renderSubtitle = (base: number, align: 'left' | 'center' = 'left') => (config.subtitle ? wrap('subtitle',
        <div style={{ ...textStyle(base, config.styles?.subtitle, theme.accent), fontFamily: POSTER_FONTS.modern.family, fontWeight: 700, marginTop: 1 * u, textAlign: align }}>
            {config.subtitle}
        </div>,
    ) : null);

    const renderPrice = (base: number, align: 'left' | 'center' | 'right' = 'left') => (price ? wrap('price',
        <div style={{ marginTop: 2 * u, textAlign: align }}>
            <div
                className={config.pricePulse ? 'poster-motion' : undefined}
                style={{
                    ...textStyle(base, config.styles?.price, theme.accent),
                    display: 'inline-block',
                    fontFamily: font.family === POSTER_FONTS.script.family ? POSTER_FONTS.modern.family : font.family,
                    fontWeight: 800,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    transformOrigin: align === 'right' ? 'right center' : align === 'center' ? 'center' : 'left center',
                    animation: config.pricePulse ? 'poster-pulse 1.8s ease-in-out 1.2s infinite' : undefined,
                }}
            >
                {price}
            </div>
        </div>,
    ) : null);

    // Lista de precios: se achica sola para entrar en el alto disponible.
    const renderList = (width: number, height: number, maxBase = 3.4) => {
        if (!rows.length || height <= 0) return null;
        const details = config.showDetails !== false && rows.some(r => r.detail);
        const scale = config.styles?.list?.scale || 1;
        const { size, cols } = fitList(rows, {
            width, height: height - 2.5 * u, u, details,
            maxSize: maxBase * u * scale,
            minSize: 1.1 * u,
            columns: config.listColumns || 'auto',
        });
        const color = config.styles?.list?.color || theme.text;
        const shadow = config.styles?.list?.shadow ? '0 0.08em 0.3em rgba(0,0,0,0.6)' : undefined;
        const perCol = Math.ceil(rows.length / cols);
        const colWidth = (width - (cols - 1) * 3 * u) / cols;
        const columns: Row[][] = [];
        for (let c = 0; c < cols; c++) columns.push(rows.slice(c * perCol, (c + 1) * perCol));
        return wrap('list',
            <div style={{ display: 'flex', width, marginTop: 2.5 * u, fontFamily: POSTER_FONTS.modern.family }}>
                {columns.map((col, c) => (
                    <div key={c} style={{ width: colWidth, marginLeft: c ? 3 * u : 0 }}>
                        {col.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${color}22`, padding: `${size * 0.32}px 0`, fontSize: size, color, textShadow: shadow }}>
                                <div style={{ flex: 1, minWidth: 0, marginRight: size * 0.6 }}>
                                    <div style={{ fontWeight: 700, lineHeight: 1.15, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordWrap: 'break-word' }}>{r.name}</div>
                                    {details && r.detail && <div style={{ fontSize: '0.62em', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail}</div>}
                                </div>
                                <div style={{ fontWeight: 800, color: config.styles?.list?.color ? color : theme.accent, whiteSpace: 'nowrap' }}>{r.price}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>,
        );
    };

    // Lo que se lleva un bloque de texto, para darle el resto a la lista.
    const reserved = (innerW: number, titleBase: number) => {
        const ft = titleBase * u * (config.styles?.title?.scale || 1);
        const titleLines = config.title ? Math.min(3, Math.max(1, Math.ceil((config.title.length * 0.55 * ft) / Math.max(1, innerW)))) : 0;
        const pt = price ? 10 * u * (config.styles?.price?.scale || 1) + 2 * u : 0;
        return (badge ? 6 * u : 0) + titleLines * ft * 1.05 + (config.subtitle ? 4.5 * u : 0) + pt + 3 * u;
    };

    // Panel con todo el contenido (split y la tarjeta).
    const renderPanel = ({ width, height, pad, titleBase, priceBase, stagger = true }: { width: number; height: number; pad: number; titleBase: number; priceBase: number; stagger?: boolean }) => {
        const innerW = width - 2 * pad;
        const innerH = height - 2 * pad;
        const part = (node: ReactNode, i: number) => (stagger ? seq(node, i) : node);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: innerW, height: innerH }}>
                {part(renderBadge(), 0)}
                {part(renderTitle(titleBase), 1)}
                {part(renderSubtitle(3.2), 2)}
                {part(renderList(innerW, innerH - reserved(innerW, titleBase)), 3)}
                {part(renderPrice(priceBase), 4)}
            </div>
        );
    };

    const share = (fallback: number) => clamp(config.photoShare || fallback, 0.25, 0.75);

    let body: ReactNode = null;
    if (W > 0 && H > 0) {
        const layout = config.layout;
        const flip = !!config.flip;
        if (layout === 'split') {
            const s = share(landscape ? 0.5 : 0.42);
            const photoArea = landscape
                ? { left: flip ? W * (1 - s) : 0, top: 0, width: W * s, height: H }
                : { left: 0, top: flip ? H * (1 - s) : 0, width: W, height: H * s };
            const panel = landscape
                ? { left: flip ? 0 : W * s, top: 0, width: W * (1 - s), height: H }
                : { left: 0, top: flip ? 0 : H * s, width: W, height: H * (1 - s) };
            const pad = 6 * u;
            body = (
                <>
                    {renderPhotos(photoArea)}
                    <div style={abs({ ...panel, background: theme.panel, padding: pad, boxSizing: 'border-box' })}>
                        {renderPanel({ width: panel.width, height: panel.height, pad, titleBase: rows.length ? 6.5 : 9, priceBase: rows.length ? 9 : 13 })}
                    </div>
                </>
            );
        } else if (layout === 'menu') {
            const hasPhoto = photos.length > 0;
            const s = share(landscape ? 0.4 : 0.28);
            const photoArea = landscape
                ? { left: flip ? 0 : W * (1 - s), top: 0, width: W * s, height: H }
                : { left: 0, top: flip ? H * (1 - s) : 0, width: W, height: H * s };
            const panel = !hasPhoto ? { left: 0, top: 0, width: W, height: H }
                : landscape ? { left: flip ? W * s : 0, top: 0, width: W * (1 - s), height: H }
                    : { left: 0, top: flip ? 0 : H * s, width: W, height: H * (1 - s) };
            const pad = 6 * u;
            body = (
                <>
                    <div style={abs({ left: 0, top: 0, width: W, height: H, background: theme.panel })} />
                    {hasPhoto && renderPhotos(photoArea)}
                    <div style={abs({ ...panel, padding: pad, boxSizing: 'border-box' })}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: panel.height - 2 * pad }}>
                            {seq(renderBadge(), 0)}
                            {seq(
                                <>
                                    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                        {renderTitle(8)}
                                        {config.subtitle && wrap('subtitle',
                                            <div style={{ fontSize: 2.6 * u * scaleOf('subtitle'), color: config.styles?.subtitle?.color || theme.accent, fontFamily: POSTER_FONTS.modern.family, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{config.subtitle}</div>,
                                            'block', { marginLeft: 1.6 * u },
                                        )}
                                    </div>
                                    <div style={{ width: 8 * u, height: 0.6 * u, background: theme.accent, marginTop: 1.4 * u, borderRadius: 99 }} />
                                </>,
                                1,
                            )}
                            {seq(renderList(panel.width - 2 * pad, panel.height - 2 * pad - reserved(panel.width - 2 * pad, 8) - 2 * u, landscape ? 8 : 9), 2)}
                            {seq(renderPrice(9), 3)}
                        </div>
                    </div>
                </>
            );
        } else if (layout === 'band') {
            const bandH = H * (1 - share(landscape ? 0.68 : 0.64));
            const pad = 4 * u;
            const innerW = W - 2 * pad;
            body = (
                <>
                    {renderPhotos({ left: 0, top: 0, width: W, height: H })}
                    <div style={abs({ left: 0, top: flip ? 0 : H - bandH, width: W, height: bandH, background: theme.panel, opacity: 0.96, padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: landscape ? 'row' : 'column', alignItems: landscape ? 'center' : 'flex-start', justifyContent: 'center', ...(animStyle(0) || {}) })}>
                        <div style={{ flex: landscape ? 1 : undefined, minWidth: 0, width: landscape ? undefined : '100%' }}>
                            {seq(renderBadge(), 1)}
                            {seq(renderTitle(landscape ? 6 : 7), 2)}
                            {seq(renderSubtitle(3), 3)}
                            {rows.length > 0 && seq(renderList(price && landscape ? innerW * 0.62 : innerW, bandH - 2 * pad - reserved(innerW * 0.62, landscape ? 6 : 7) + (price && landscape ? 10 * u : 0)), 4)}
                        </div>
                        {price && <div style={{ marginLeft: landscape ? 3 * u : 0, ...(animStyle(5) || {}) }}>{renderPrice(landscape ? 11 : 10, landscape ? 'right' : 'left')}</div>}
                    </div>
                </>
            );
        } else {
            // card: fotos de fondo y una tarjeta encima, que se puede mover y agrandar.
            const size = clamp(config.cardSize || 1, 0.6, 1.5);
            const cardW = Math.min(W * 0.96, (landscape ? Math.min(W * 0.46, H * 1.05) : W * 0.82) * size);
            const cardMaxH = Math.min(H * 0.96, H * (landscape ? 0.78 : 0.6) * size);
            const pos = config.cardPos || { x: 0.5, y: landscape ? 0.5 : 0.66 };
            const left = clamp(pos.x * W - cardW / 2, 0, W - cardW);
            const top = clamp(pos.y * H - cardMaxH / 2, 0, H - cardMaxH);
            const pad = 4 * u;
            const editable = !!onCardMove;
            const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
                if (!editable) return;
                e.preventDefault();
                drag.current = { sx: e.clientX, sy: e.clientY, x: (left + cardW / 2) / W, y: (top + cardMaxH / 2) / H };
                e.currentTarget.setPointerCapture?.(e.pointerId);
            };
            const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
                const d = drag.current;
                if (!d || !onCardMove) return;
                const halfW = cardW / 2 / W;
                const halfH = cardMaxH / 2 / H;
                onCardMove({
                    x: Math.round(clamp(d.x + (e.clientX - d.sx) / W, halfW, 1 - halfW) * 1000) / 1000,
                    y: Math.round(clamp(d.y + (e.clientY - d.sy) / H, halfH, 1 - halfH) * 1000) / 1000,
                });
            };
            const endDrag = () => { drag.current = null; };
            body = (
                <>
                    {renderPhotos({ left: 0, top: 0, width: W, height: H })}
                    <div
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        style={abs({
                            left,
                            top,
                            width: cardW,
                            height: cardMaxH,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: editable ? 'grab' : undefined,
                            touchAction: editable ? 'none' : undefined,
                            ...(animStyle(0) || {}),
                        })}
                    >
                        <div
                            style={{
                                width: cardW,
                                maxHeight: cardMaxH,
                                background: theme.panel,
                                padding: pad,
                                boxSizing: 'border-box',
                                borderRadius: 1.4 * u,
                                boxShadow: `0 ${1.5 * u}px ${5 * u}px rgba(0,0,0,0.45)`,
                                transform: config.tilt ? 'rotate(-4deg)' : undefined,
                                // Con partes corridas, pueden salir de la tarjeta.
                                overflow: Object.values(config.offsets || {}).some(o => o && (o.x || o.y)) ? 'visible' : 'hidden',
                                outline: editable ? '2px dashed rgba(255,255,255,0.75)' : undefined,
                                outlineOffset: editable ? 3 : undefined,
                            }}
                        >
                            {renderBadge()}
                            {renderTitle(rows.length ? 6 : 8)}
                            {renderSubtitle(3)}
                            {renderList(cardW - 2 * pad, cardMaxH - 2 * pad - reserved(cardW - 2 * pad, rows.length ? 6 : 8))}
                            {renderPrice(rows.length ? 8 : 11)}
                        </div>
                    </div>
                </>
            );
        }
    }

    const qrLabel = config.qrUrl ? (config.qrLabel ?? QR_DEFAULT_LABEL[parseQrUrl(config.qrUrl).kind]) : '';

    return (
        <div ref={ref} onPointerDown={editParts ? () => editParts.onSelect(null) : undefined} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: theme.panel }}>
            {body}
            {W > 0 && config.showClock && (
                <div {...partHandlers('clock')} style={abs({ right: 3 * u, top: 3 * u, background: 'rgba(0,0,0,0.55)', color: config.styles?.clock?.color || '#fff', fontFamily: POSTER_FONTS.modern.family, fontWeight: 700, fontSize: 3 * u * scaleOf('clock'), padding: '0.2em 0.53em', borderRadius: 99, ...partStyle('clock') })}>
                    {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
            )}
            {W > 0 && config.qrUrl && (
                <div {...partHandlers('qr')} style={abs({ right: 3 * u, bottom: 3 * u, background: '#fff', padding: 1.2 * u * scaleOf('qr'), borderRadius: 1.2 * u, width: 17 * u * scaleOf('qr'), boxSizing: 'content-box', textAlign: 'center', ...partStyle('qr') })}>
                    <QRCodeSVG value={config.qrUrl} size={Math.round(17 * u * scaleOf('qr'))} level="M" style={{ display: 'block' }} />
                    {qrLabel && (
                        <div style={{ marginTop: 0.8 * u, fontSize: 2.1 * u * scaleOf('qr'), lineHeight: 1.15, fontWeight: 700, color: '#111', fontFamily: POSTER_FONTS.modern.family }}>{qrLabel}</div>
                    )}
                </div>
            )}
        </div>
    );
}
