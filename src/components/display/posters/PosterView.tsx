import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLivePriceLists } from '@/hooks/use-live-price-lists';
import { formatPrice, type PriceList } from '@/lib/priceLists';
import { POSTER_FONTS, scheduleBadge, themeOf, type PosterConfig, type PosterTemplate, type TextStyle } from '@/lib/posters';

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
}

interface Row { name: string; detail?: string; price: string }

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

export function PosterView({ config, commerceId, lists: listsProp, sampleList }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const { w: W, h: H } = useBox(ref);
    const live = useLivePriceLists(listsProp ? null : commerceId);
    const lists = listsProp || live;
    const now = useClock(!!config.showClock);

    const theme = themeOf(config.themeId);
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

    const textStyle = (base: number, style: TextStyle | undefined, color: string): CSSProperties => ({
        fontSize: base * u * (style?.scale || 1),
        color: style?.color || color,
        textShadow: style?.shadow ? '0 0.08em 0.35em rgba(0,0,0,0.6)' : undefined,
    });

    const renderPhoto = (url: string | undefined, style: CSSProperties, key?: string) => (
        <div
            key={key}
            style={abs({
                ...style,
                backgroundColor: '#222',
                backgroundImage: url ? `url("${url}")` : theme.photoTint,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            })}
        />
    );

    // Fotos de fondo: una ocupa todo; dos van lado a lado (o una arriba de otra).
    const renderPhotos = (area: CSSProperties & { width: number; height: number }) => {
        const { width, height, ...pos } = area;
        if (photos.length < 2) return renderPhoto(photos[0], { ...pos, width, height });
        const sideBySide = width / Math.max(1, height) >= 1;
        return (
            <>
                {renderPhoto(photos[0], { ...pos, width: sideBySide ? width / 2 : width, height: sideBySide ? height : height / 2 }, 'a')}
                {renderPhoto(photos[1], {
                    ...pos,
                    left: (Number(pos.left) || 0) + (sideBySide ? width / 2 : 0),
                    top: (Number(pos.top) || 0) + (sideBySide ? 0 : height / 2),
                    width: sideBySide ? width / 2 : width,
                    height: sideBySide ? height : height / 2,
                }, 'b')}
            </>
        );
    };

    const renderBadge = () => (badge ? (
        <div style={{ display: 'inline-block', alignSelf: 'flex-start', background: theme.accent, color: theme.panel, fontFamily: POSTER_FONTS.modern.family, fontWeight: 800, letterSpacing: '0.08em', fontSize: 2.2 * u, padding: `${0.5 * u}px ${1.4 * u}px`, borderRadius: 99, marginBottom: 2 * u, whiteSpace: 'nowrap' }}>
            {badge}
        </div>
    ) : null);

    const titleFamily = font.family;
    const renderTitle = (base: number, align: 'left' | 'center' = 'left') => (config.title ? (
        <div style={{ ...textStyle(base, config.styles?.title, theme.text), fontFamily: titleFamily, fontWeight: font.weight, lineHeight: config.font === 'script' ? 1.15 : 1.02, textAlign: align, letterSpacing: config.font === 'impact' ? '0.01em' : undefined }}>
            {config.title}
        </div>
    ) : null);

    const renderSubtitle = (base: number, align: 'left' | 'center' = 'left') => (config.subtitle ? (
        <div style={{ fontSize: base * u, color: theme.accent, fontFamily: POSTER_FONTS.modern.family, fontWeight: 700, marginTop: 1 * u, textAlign: align }}>
            {config.subtitle}
        </div>
    ) : null);

    const renderPrice = (base: number, align: 'left' | 'center' | 'right' = 'left') => (price ? (
        <div style={{ ...textStyle(base, config.styles?.price, theme.accent), fontFamily: font.family === POSTER_FONTS.script.family ? POSTER_FONTS.modern.family : font.family, fontWeight: 800, lineHeight: 1, marginTop: 2 * u, textAlign: align, whiteSpace: 'nowrap' }}>
            {price}
        </div>
    ) : null);

    // Lista de precios: se achica sola para entrar en el alto disponible.
    const renderList = (width: number, height: number, maxBase = 3.4) => {
        if (!rows.length || height <= 0) return null;
        const details = config.showDetails !== false && rows.some(r => r.detail);
        const wide = width / u;
        const cols = config.listColumns === 1 ? 1 : config.listColumns === 2 ? 2 : ((rows.length > 6 && wide > 70) || (rows.length >= 4 && wide > 140) ? 2 : 1);
        const perCol = Math.ceil(rows.length / cols);
        const rowEm = details ? 2.75 : 1.85;
        const scale = config.styles?.list?.scale || 1;
        const size = Math.max(1.4 * u, Math.min(maxBase * u * scale, height / (perCol * rowEm)));
        const color = config.styles?.list?.color || theme.text;
        const shadow = config.styles?.list?.shadow ? '0 0.08em 0.3em rgba(0,0,0,0.6)' : undefined;
        const colWidth = (width - (cols - 1) * 3 * u) / cols;
        const columns: Row[][] = [];
        for (let c = 0; c < cols; c++) columns.push(rows.slice(c * perCol, (c + 1) * perCol));
        return (
            <div style={{ display: 'flex', width, marginTop: 2.5 * u, fontFamily: POSTER_FONTS.modern.family }}>
                {columns.map((col, c) => (
                    <div key={c} style={{ width: colWidth, marginLeft: c ? 3 * u : 0 }}>
                        {col.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${color}22`, padding: `${size * 0.32}px 0`, fontSize: size, color, textShadow: shadow }}>
                                <div style={{ minWidth: 0, overflow: 'hidden', marginRight: size * 0.6 }}>
                                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                                    {details && r.detail && <div style={{ fontSize: '0.62em', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail}</div>}
                                </div>
                                <div style={{ fontWeight: 800, color: config.styles?.list?.color ? color : theme.accent, whiteSpace: 'nowrap' }}>{r.price}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    // Lo que se lleva un bloque de texto, para darle el resto a la lista.
    const reserved = (innerW: number, titleBase: number) => {
        const ft = titleBase * u * (config.styles?.title?.scale || 1);
        const titleLines = config.title ? Math.min(3, Math.max(1, Math.ceil((config.title.length * 0.55 * ft) / Math.max(1, innerW)))) : 0;
        const pt = price ? 10 * u * (config.styles?.price?.scale || 1) + 2 * u : 0;
        return (badge ? 6 * u : 0) + titleLines * ft * 1.05 + (config.subtitle ? 4.5 * u : 0) + pt + 3 * u;
    };

    // Panel con todo el contenido (split, menu y la tarjeta).
    const renderPanel = ({ width, height, pad, titleBase, priceBase }: { width: number; height: number; pad: number; titleBase: number; priceBase: number }) => {
        const innerW = width - 2 * pad;
        const innerH = height - 2 * pad;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: innerW, height: innerH }}>
                {renderBadge()}
                {renderTitle(titleBase)}
                {renderSubtitle(3.2)}
                {renderList(innerW, innerH - reserved(innerW, titleBase))}
                {renderPrice(priceBase)}
            </div>
        );
    };

    let body: ReactNode = null;
    if (W > 0 && H > 0) {
        const layout = config.layout;
        if (layout === 'split') {
            const photoArea = landscape ? { left: 0, top: 0, width: W * 0.5, height: H } : { left: 0, top: 0, width: W, height: H * 0.42 };
            const panel = landscape ? { left: W * 0.5, top: 0, width: W * 0.5, height: H } : { left: 0, top: H * 0.42, width: W, height: H * 0.58 };
            const pad = 6 * u;
            body = (
                <>
                    {renderPhotos(photoArea)}
                    <div style={abs({ ...panel, background: theme.panel, padding: pad, boxSizing: 'border-box' })}>
                        {renderPanel({ width: panel.width, height: panel.height, pad: pad, titleBase: rows.length ? 6.5 : 9, priceBase: rows.length ? 9 : 13 })}
                    </div>
                </>
            );
        } else if (layout === 'menu') {
            const hasPhoto = photos.length > 0;
            const photoArea = landscape ? { left: W * 0.6, top: 0, width: W * 0.4, height: H } : { left: 0, top: 0, width: W, height: H * 0.28 };
            const panel = !hasPhoto ? { left: 0, top: 0, width: W, height: H }
                : landscape ? { left: 0, top: 0, width: W * 0.6, height: H } : { left: 0, top: H * 0.28, width: W, height: H * 0.72 };
            const pad = 6 * u;
            body = (
                <>
                    <div style={abs({ left: 0, top: 0, width: W, height: H, background: theme.panel })} />
                    {hasPhoto && renderPhotos(photoArea)}
                    <div style={abs({ ...panel, padding: pad, boxSizing: 'border-box' })}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: panel.height - 2 * pad }}>
                            {renderBadge()}
                            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                {renderTitle(8)}
                                {config.subtitle && (
                                    <div style={{ marginLeft: 1.6 * u, fontSize: 2.6 * u, color: theme.accent, fontFamily: POSTER_FONTS.modern.family, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{config.subtitle}</div>
                                )}
                            </div>
                            <div style={{ width: 8 * u, height: 0.6 * u, background: theme.accent, marginTop: 1.4 * u, borderRadius: 99 }} />
                            {renderList(panel.width - 2 * pad, panel.height - 2 * pad - reserved(panel.width - 2 * pad, 8) - 2 * u, landscape ? 5.5 : 7)}
                            {renderPrice(9)}
                        </div>
                    </div>
                </>
            );
        } else if (layout === 'band') {
            const bandH = H * (landscape ? 0.32 : 0.36);
            const pad = 4 * u;
            const innerW = W - 2 * pad;
            body = (
                <>
                    {renderPhotos({ left: 0, top: 0, width: W, height: H })}
                    <div style={abs({ left: 0, top: H - bandH, width: W, height: bandH, background: theme.panel, opacity: 0.96, padding: pad, boxSizing: 'border-box', display: 'flex', flexDirection: landscape ? 'row' : 'column', alignItems: landscape ? 'center' : 'flex-start', justifyContent: 'center' })}>
                        <div style={{ flex: landscape ? 1 : undefined, minWidth: 0, width: landscape ? undefined : '100%' }}>
                            {renderBadge()}
                            {renderTitle(landscape ? 6 : 7)}
                            {renderSubtitle(3)}
                            {rows.length > 0 && renderList(price && landscape ? innerW * 0.62 : innerW, bandH - 2 * pad - reserved(innerW * 0.62, landscape ? 6 : 7) + (price && landscape ? 10 * u : 0))}
                        </div>
                        {price && <div style={{ marginLeft: landscape ? 3 * u : 0 }}>{renderPrice(landscape ? 11 : 10, landscape ? 'right' : 'left')}</div>}
                    </div>
                </>
            );
        } else {
            // card: fotos de fondo y una tarjeta encima.
            const cardW = landscape ? Math.min(W * 0.46, H * 1.05) : W * 0.82;
            const cardMaxH = H * (landscape ? 0.78 : 0.6);
            const pad = 4 * u;
            body = (
                <>
                    {renderPhotos({ left: 0, top: 0, width: W, height: H })}
                    <div
                        style={abs({
                            left: (W - cardW) / 2,
                            top: landscape ? (H - cardMaxH) / 2 : H * 0.36,
                            width: cardW,
                            height: cardMaxH,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
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
                                overflow: 'hidden',
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

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: theme.panel }}>
            {body}
            {W > 0 && config.showClock && (
                <div style={abs({ right: 3 * u, top: 3 * u, background: 'rgba(0,0,0,0.55)', color: '#fff', fontFamily: POSTER_FONTS.modern.family, fontWeight: 700, fontSize: 3 * u, padding: `${0.6 * u}px ${1.6 * u}px`, borderRadius: 99 })}>
                    {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
            )}
            {W > 0 && config.qrUrl && (
                <div style={abs({ right: 3 * u, bottom: 3 * u, background: '#fff', padding: 1 * u, borderRadius: 1 * u })}>
                    <QRCodeSVG value={config.qrUrl} size={Math.round(14 * u)} level="M" />
                </div>
            )}
        </div>
    );
}
