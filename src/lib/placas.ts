// "Crear placa": diseños listos para promos, precios y avisos. Se dibujan en
// un canvas y se guardan como imagen JPG en Medios (la TV la muestra como
// cualquier foto). Los datos de la placa quedan en metadata.placa para poder
// cambiarle el precio o el texto más adelante.

export type PlacaTemplateId = 'oferta' | 'precio' | 'combo' | 'descuento' | 'aviso' | 'bienvenida';
export type PlacaOrientation = 'landscape' | 'portrait';
export type PlacaField = 'badge' | 'title' | 'text' | 'price' | 'oldPrice' | 'lines' | 'footer';

export interface PlacaFields {
    badge: string;
    title: string;
    text: string;
    price: string;
    oldPrice: string;
    lines: string;
    footer: string;
}

export interface PlacaPhoto {
    url: string;
    name?: string;
}

export interface PlacaData {
    template: PlacaTemplateId;
    orientation: PlacaOrientation;
    palette: PaletteId;
    fields: PlacaFields;
    photo: PlacaPhoto | null;
}

// ---- Colores ----

export type PaletteId = 'rojo' | 'negro' | 'verde' | 'azul' | 'rosa' | 'crema' | 'blanco';

interface Palette {
    label: string;
    bg: string;
    bg2: string;
    accent: string;
    text: string;
    onAccent: string;
    soft: string; // texto secundario
}

export const PALETTES: Record<PaletteId, Palette> = {
    rojo: { label: 'Rojo y amarillo', bg: '#c81e1e', bg2: '#7f1212', accent: '#fcd34d', text: '#ffffff', onAccent: '#1c1917', soft: 'rgba(255,255,255,0.82)' },
    negro: { label: 'Negro y dorado', bg: '#1c1917', bg2: '#050505', accent: '#e0b84c', text: '#ffffff', onAccent: '#111111', soft: 'rgba(255,255,255,0.75)' },
    verde: { label: 'Verde', bg: '#15803d', bg2: '#0b3d1f', accent: '#fde047', text: '#ffffff', onAccent: '#14290f', soft: 'rgba(255,255,255,0.82)' },
    azul: { label: 'Azul', bg: '#1d4ed8', bg2: '#0b1b4d', accent: '#38bdf8', text: '#ffffff', onAccent: '#06182e', soft: 'rgba(255,255,255,0.82)' },
    rosa: { label: 'Rosa', bg: '#db2777', bg2: '#6d1040', accent: '#ffffff', text: '#ffffff', onAccent: '#9d174d', soft: 'rgba(255,255,255,0.85)' },
    crema: { label: 'Crema', bg: '#fdf3d8', bg2: '#f4dca2', accent: '#b91c1c', text: '#2b1a0e', onAccent: '#ffffff', soft: 'rgba(43,26,14,0.75)' },
    blanco: { label: 'Blanco', bg: '#ffffff', bg2: '#e8ecf3', accent: '#4f46e5', text: '#0f172a', onAccent: '#ffffff', soft: 'rgba(15,23,42,0.7)' },
};

// ---- Diseños ----

interface TemplateInfo {
    label: string;
    hint: string;
    fields: PlacaField[];
    usesPhoto: boolean;
    defaults: Partial<PlacaFields>;
    palette: PaletteId;
}

export const PLACA_TEMPLATES: Record<PlacaTemplateId, TemplateInfo> = {
    oferta: {
        label: 'Oferta con foto', hint: 'Producto, precio y precio anterior',
        fields: ['badge', 'title', 'text', 'price', 'oldPrice', 'footer'], usesPhoto: true, palette: 'rojo',
        defaults: { badge: 'Oferta', title: 'Hamburguesa doble con papas', text: 'Solo por esta semana', price: '$ 8.900', oldPrice: '$ 11.500' },
    },
    precio: {
        label: 'Precio grande', hint: 'Una foto de fondo y el precio bien visible',
        fields: ['title', 'text', 'price', 'footer'], usesPhoto: true, palette: 'negro',
        defaults: { title: 'Medialunas', text: 'La docena, recién horneadas', price: '$ 6.500' },
    },
    combo: {
        label: 'Menú o combo', hint: 'Lo que incluye y el precio',
        fields: ['title', 'lines', 'price', 'footer'], usesPhoto: true, palette: 'verde',
        defaults: { title: 'Menú del día', lines: 'Milanesa con puré\nBebida\nPostre', price: '$ 9.900', footer: 'De lunes a viernes al mediodía' },
    },
    descuento: {
        label: 'Descuento', hint: 'Un porcentaje grande que se ve de lejos',
        fields: ['badge', 'title', 'text', 'footer'], usesPhoto: true, palette: 'azul',
        defaults: { badge: '30% OFF', title: 'En toda la tienda', text: 'Pagando en efectivo', footer: 'Válido hasta el domingo' },
    },
    aviso: {
        label: 'Aviso', hint: 'Horarios, feriados, novedades',
        fields: ['badge', 'title', 'text', 'footer'], usesPhoto: false, palette: 'crema',
        defaults: { badge: 'Aviso', title: 'El lunes 24 cerramos por feriado', text: 'Te esperamos el martes de 9 a 20 h' },
    },
    bienvenida: {
        label: 'Bienvenida', hint: 'Tu logo y un saludo',
        fields: ['title', 'text', 'footer'], usesPhoto: true, palette: 'blanco',
        defaults: { title: '¡Bienvenidos!', text: 'Seguinos en Instagram @tunegocio' },
    },
};

export const PLACA_TEMPLATE_IDS = Object.keys(PLACA_TEMPLATES) as PlacaTemplateId[];

export const FIELD_LABELS: Record<PlacaField, { label: string; placeholder: string; max: number }> = {
    badge: { label: 'Etiqueta', placeholder: 'Oferta, Nuevo, 30% OFF…', max: 16 },
    title: { label: 'Título', placeholder: 'Qué ofrecés', max: 60 },
    text: { label: 'Texto', placeholder: 'Un detalle', max: 80 },
    price: { label: 'Precio', placeholder: '$ 8.900', max: 14 },
    oldPrice: { label: 'Precio anterior (tachado)', placeholder: '$ 11.500', max: 14 },
    lines: { label: 'Qué incluye (uno por renglón)', placeholder: 'Milanesa con puré\nBebida', max: 160 },
    footer: { label: 'Pie', placeholder: 'Dirección, horario o redes', max: 60 },
};

export const EMPTY_FIELDS: PlacaFields = { badge: '', title: '', text: '', price: '', oldPrice: '', lines: '', footer: '' };

export function defaultPlaca(template: PlacaTemplateId = 'oferta', orientation: PlacaOrientation = 'landscape'): PlacaData {
    const info = PLACA_TEMPLATES[template];
    return { template, orientation, palette: info.palette, fields: { ...EMPTY_FIELDS, ...info.defaults }, photo: null };
}

export const placaSize = (o: PlacaOrientation) => (o === 'portrait' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });

// Lee metadata.placa de un archivo de Medios (o null si no es una placa).
export function placaFromMetadata(metadata: unknown): PlacaData | null {
    const p = (metadata as { placa?: PlacaData } | null)?.placa;
    if (!p || !PLACA_TEMPLATES[p.template]) return null;
    return {
        template: p.template,
        orientation: p.orientation === 'portrait' ? 'portrait' : 'landscape',
        palette: PALETTES[p.palette] ? p.palette : PLACA_TEMPLATES[p.template].palette,
        fields: { ...EMPTY_FIELDS, ...(p.fields || {}) },
        photo: p.photo?.url ? { url: p.photo.url, name: p.photo.name } : null,
    };
}

// ---- Fuentes ----

const TITLE_FONT = '"Montserrat", "Inter", system-ui, sans-serif';
const DISPLAY_FONT = '"Anton", "Montserrat", "Impact", sans-serif';

// Espera las fuentes de las placas (si no cargan, se usa la de respaldo).
export async function loadPlacaFonts(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    try {
        await Promise.race([
            Promise.all([
                document.fonts.load('900 80px "Montserrat"'),
                document.fonts.load('700 80px "Montserrat"'),
                document.fonts.load('500 80px "Montserrat"'),
                document.fonts.load('80px "Anton"'),
            ]),
            new Promise(resolve => setTimeout(resolve, 2500)),
        ]);
    } catch {
        // seguimos con la fuente de respaldo
    }
}

// ---- Fotos ----

// Carga una foto para dibujarla en el canvas (sin "ensuciarlo": hace falta CORS).
export function loadPlacaImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (!url.startsWith('blob:') && !url.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la foto'));
        img.src = url;
    });
}

// ---- Dibujo ----

type Ctx = CanvasRenderingContext2D;

interface Box { x: number; y: number; w: number; h: number }

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawCover(ctx: Ctx, img: HTMLImageElement, b: Box) {
    const scale = Math.max(b.w / img.width, b.h / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h);
}

function drawContain(ctx: Ctx, img: HTMLImageElement, b: Box) {
    const scale = Math.min(b.w / img.width, b.h / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h);
}

function background(ctx: Ctx, p: Palette, b: Box) {
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.6, b.y + b.h);
    g.addColorStop(0, p.bg);
    g.addColorStop(1, p.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
}

// Círculos suaves de adorno.
function decor(ctx: Ctx, p: Palette, W: number, H: number) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = p.accent;
    const r = Math.max(W, H);
    ctx.beginPath(); ctx.arc(W * 0.95, H * 0.05, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.02, H * 1.0, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

interface FitOptions {
    maxWidth: number;
    maxHeight: number;
    maxSize: number;
    minSize: number;
    weight?: number | string;
    family?: string;
    lineHeight?: number;
    maxLines?: number;
    uppercase?: boolean;
}

interface Fitted { size: number; lines: string[]; lineHeight: number; height: number; font: string }

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
    const out: string[] = [];
    for (const para of text.split('\n')) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        let line = words[0];
        for (const word of words.slice(1)) {
            const test = `${line} ${word}`;
            if (ctx.measureText(test).width <= maxWidth) line = test;
            else {
                out.push(line);
                line = word;
            }
        }
        out.push(line);
    }
    return out;
}

// El tamaño más grande con el que el texto entra en la caja.
function fitText(ctx: Ctx, raw: string, o: FitOptions): Fitted {
    const text = o.uppercase ? raw.toUpperCase() : raw;
    const lh = o.lineHeight ?? 1.1;
    let size = o.maxSize;
    for (;;) {
        const font = `${o.weight ?? 800} ${size}px ${o.family ?? TITLE_FONT}`;
        ctx.font = font;
        const lines = wrap(ctx, text, o.maxWidth);
        const widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
        const height = lines.length * size * lh;
        const fits = widest <= o.maxWidth && height <= o.maxHeight && (!o.maxLines || lines.length <= o.maxLines);
        if (fits || size <= o.minSize) return { size, lines, lineHeight: size * lh, height, font };
        size = Math.max(o.minSize, Math.floor(size * 0.93));
    }
}

function drawLines(ctx: Ctx, f: Fitted, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
    ctx.font = f.font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    f.lines.forEach((line, i) => {
        ctx.fillText(line, x, y + f.size * 0.86 + i * f.lineHeight + (f.lineHeight - f.size) / 2);
    });
}

// Etiqueta tipo píldora ("OFERTA"). Devuelve el alto.
function pill(ctx: Ctx, text: string, x: number, y: number, size: number, bg: string, color: string, align: 'left' | 'center' = 'left'): number {
    ctx.font = `800 ${size}px ${TITLE_FONT}`;
    const label = text.toUpperCase();
    const w = ctx.measureText(label).width + size * 1.3;
    const h = size * 1.8;
    const left = align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = bg;
    roundRect(ctx, left, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, left + w / 2, y + h / 2 + size * 0.04);
    return h;
}

// Precio dentro de un bloque de color. Devuelve el alto.
function priceBlock(ctx: Ctx, price: string, old: string, x: number, y: number, maxW: number, size: number, p: Palette, align: 'left' | 'center' = 'left'): number {
    if (!price) return 0;
    const f = fitText(ctx, price, { maxWidth: maxW - size * 0.8, maxHeight: size * 1.2, maxSize: size, minSize: size * 0.4, family: DISPLAY_FONT, weight: 400, lineHeight: 1, maxLines: 1 });
    ctx.font = f.font;
    const w = ctx.measureText(f.lines[0] || '').width + f.size * 0.8;
    const h = f.size * 1.35;
    let top = y;
    const left = align === 'center' ? x - w / 2 : x;
    if (old) {
        const os = Math.round(f.size * 0.32);
        ctx.font = `600 ${os}px ${TITLE_FONT}`;
        ctx.fillStyle = p.soft;
        ctx.textAlign = align;
        ctx.textBaseline = 'top';
        const ox = align === 'center' ? x : left + f.size * 0.1;
        ctx.fillText(`Antes ${old}`, ox, top);
        const tw = ctx.measureText(`Antes ${old}`).width;
        const sx = align === 'center' ? x - tw / 2 : ox;
        ctx.strokeStyle = p.soft;
        ctx.lineWidth = Math.max(2, os * 0.08);
        ctx.beginPath();
        ctx.moveTo(sx + ctx.measureText('Antes ').width, top + os * 0.55);
        ctx.lineTo(sx + tw, top + os * 0.55);
        ctx.stroke();
        top += os * 1.45;
    }
    ctx.save();
    ctx.translate(left + w / 2, top + h / 2);
    ctx.rotate(-0.025);
    ctx.fillStyle = p.accent;
    roundRect(ctx, -w / 2, -h / 2, w, h, f.size * 0.18);
    ctx.fill();
    ctx.font = f.font;
    ctx.fillStyle = p.onAccent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.lines[0] || '', 0, f.size * 0.04);
    ctx.restore();
    return top - y + h;
}

function footerText(ctx: Ctx, text: string, x: number, y: number, maxW: number, size: number, color: string, align: CanvasTextAlign = 'left') {
    if (!text) return;
    const f = fitText(ctx, text, { maxWidth: maxW, maxHeight: size * 1.3, maxSize: size, minSize: size * 0.5, weight: 600, maxLines: 1 });
    drawLines(ctx, f, x, y - f.height, color, align);
}

// Dibuja la placa completa en un canvas del tamaño de placaSize().
export function drawPlaca(ctx: Ctx, data: PlacaData, photo: HTMLImageElement | null) {
    const { width: W, height: H } = placaSize(data.orientation);
    const p = PALETTES[data.palette] || PALETTES.rojo;
    const f = data.fields;
    const v = data.orientation === 'portrait';
    const u = Math.min(W, H) / 1080; // unidad: 1 en 1080p
    const pad = 90 * u;
    const img = PLACA_TEMPLATES[data.template].usesPhoto ? photo : null;

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    background(ctx, p, { x: 0, y: 0, w: W, h: H });

    switch (data.template) {
        case 'oferta': {
            // Foto a un lado (arriba en vertical) y el texto en el panel de color.
            let panel: Box;
            if (img) {
                const photoBox = v ? { x: 0, y: 0, w: W, h: H * 0.48 } : { x: 0, y: 0, w: W * 0.52, h: H };
                ctx.save();
                ctx.beginPath(); ctx.rect(photoBox.x, photoBox.y, photoBox.w, photoBox.h); ctx.clip();
                drawCover(ctx, img, photoBox);
                ctx.restore();
                panel = v ? { x: 0, y: H * 0.48, w: W, h: H * 0.52 } : { x: W * 0.52, y: 0, w: W * 0.48, h: H };
                // Borde diagonal del panel.
                const g = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w * 0.6, panel.y + panel.h);
                g.addColorStop(0, p.bg);
                g.addColorStop(1, p.bg2);
                ctx.fillStyle = g;
                ctx.beginPath();
                if (v) { ctx.moveTo(0, panel.y + 70 * u); ctx.lineTo(W, panel.y - 50 * u); ctx.lineTo(W, H); ctx.lineTo(0, H); }
                else { ctx.moveTo(panel.x - 110 * u, H); ctx.lineTo(panel.x + 40 * u, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); }
                ctx.closePath();
                ctx.fill();
                panel = v ? { x: pad, y: panel.y + 90 * u, w: W - pad * 2, h: panel.h - 90 * u - pad } : { x: panel.x + 40 * u, y: pad, w: panel.w - 40 * u - pad, h: H - pad * 2 };
            } else {
                decor(ctx, p, W, H);
                panel = { x: pad * 1.3, y: pad, w: W - pad * 2.6, h: H - pad * 2 };
            }
            let y = panel.y;
            if (f.badge) y += pill(ctx, f.badge, panel.x, y, 38 * u, p.accent, p.onAccent) + 36 * u;
            const footerH = f.footer ? 60 * u : 0;
            const priceH = f.price ? (img ? 210 : 260) * u + (f.oldPrice ? 70 * u : 0) : 0;
            const textH = f.text ? 140 * u : 0;
            const title = fitText(ctx, f.title, { maxWidth: panel.w, maxHeight: Math.max(120 * u, panel.y + panel.h - y - priceH - textH - footerH - 40 * u), maxSize: (img ? 110 : 140) * u, minSize: 44 * u, weight: 900, maxLines: 4, lineHeight: 1.05 });
            drawLines(ctx, title, panel.x, y, p.text);
            y += title.height + 24 * u;
            if (f.text) {
                const t = fitText(ctx, f.text, { maxWidth: panel.w, maxHeight: 120 * u, maxSize: 50 * u, minSize: 28 * u, weight: 500, maxLines: 2, lineHeight: 1.2 });
                drawLines(ctx, t, panel.x, y, p.soft);
                y += t.height + 36 * u;
            }
            if (f.price) priceBlock(ctx, f.price, f.oldPrice, panel.x, y, panel.w, (img ? 150 : 190) * u, p);
            footerText(ctx, f.footer, panel.x, panel.y + panel.h, panel.w, 40 * u, p.soft);
            break;
        }
        case 'precio': {
            // Foto de fondo oscurecida abajo; nombre y precio enormes.
            if (img) {
                drawCover(ctx, img, { x: 0, y: 0, w: W, h: H });
                const g = ctx.createLinearGradient(0, H * (v ? 0.35 : 0.2), 0, H);
                g.addColorStop(0, 'rgba(0,0,0,0)');
                g.addColorStop(1, 'rgba(0,0,0,0.85)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            } else decor(ctx, p, W, H);
            const textColor = img ? '#ffffff' : p.text;
            const softColor = img ? 'rgba(255,255,255,0.85)' : p.soft;
            const footerH = f.footer ? 70 * u : 0;
            if (v) {
                const bottom = H - pad - footerH;
                const priceSize = 220 * u;
                const priceTop = bottom - priceSize * 1.35;
                priceBlock(ctx, f.price, '', pad, priceTop, W - pad * 2, priceSize, p);
                let y = priceTop - 40 * u;
                if (f.text) {
                    const t = fitText(ctx, f.text, { maxWidth: W - pad * 2, maxHeight: 130 * u, maxSize: 54 * u, minSize: 28 * u, weight: 500, maxLines: 2, lineHeight: 1.2 });
                    y -= t.height;
                    drawLines(ctx, t, pad, y, softColor);
                    y -= 24 * u;
                }
                const title = fitText(ctx, f.title, { maxWidth: W - pad * 2, maxHeight: 420 * u, maxSize: 150 * u, minSize: 50 * u, weight: 900, maxLines: 3, lineHeight: 1.03 });
                drawLines(ctx, title, pad, y - title.height, textColor);
            } else {
                const colW = W * 0.55;
                let y = H - pad - footerH;
                if (f.text) {
                    const t = fitText(ctx, f.text, { maxWidth: colW, maxHeight: 130 * u, maxSize: 54 * u, minSize: 28 * u, weight: 500, maxLines: 2, lineHeight: 1.2 });
                    y -= t.height;
                    drawLines(ctx, t, pad, y, softColor);
                    y -= 24 * u;
                }
                const title = fitText(ctx, f.title, { maxWidth: colW, maxHeight: 460 * u, maxSize: 150 * u, minSize: 50 * u, weight: 900, maxLines: 3, lineHeight: 1.03 });
                drawLines(ctx, title, pad, y - title.height, textColor);
                const priceSize = 230 * u;
                const priceW = W - colW - pad * 3;
                ctx.font = `400 ${priceSize}px ${DISPLAY_FONT}`;
                const pw = Math.min(priceW, ctx.measureText(f.price).width + priceSize * 0.8);
                priceBlock(ctx, f.price, '', W - pad - pw, H - pad - footerH - priceSize * 1.35, pw, priceSize, p);
            }
            footerText(ctx, f.footer, pad, H - pad * 0.7, W - pad * 2, 40 * u, softColor);
            break;
        }
        case 'combo': {
            decor(ctx, p, W, H);
            const lines = f.lines.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
            let col: Box;
            if (img) {
                const d = v ? W * 0.62 : H * 0.72;
                const cx = v ? W / 2 : W - pad - d / 2;
                const cy = v ? pad + d / 2 + 20 * u : H / 2;
                ctx.save();
                ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.clip();
                drawCover(ctx, img, { x: cx - d / 2, y: cy - d / 2, w: d, h: d });
                ctx.restore();
                ctx.strokeStyle = p.accent;
                ctx.lineWidth = 16 * u;
                ctx.beginPath(); ctx.arc(cx, cy, d / 2 + 8 * u, 0, Math.PI * 2); ctx.stroke();
                col = v ? { x: pad, y: cy + d / 2 + 70 * u, w: W - pad * 2, h: H - (cy + d / 2 + 70 * u) - pad } : { x: pad * 1.2, y: pad, w: W - d - pad * 3.4, h: H - pad * 2 };
            } else col = { x: pad * 1.3, y: pad, w: W - pad * 2.6, h: H - pad * 2 };
            let y = col.y;
            const title = fitText(ctx, f.title, { maxWidth: col.w, maxHeight: 260 * u, maxSize: 120 * u, minSize: 50 * u, weight: 900, maxLines: 2, lineHeight: 1.05 });
            drawLines(ctx, title, col.x, y, p.text);
            y += title.height + 36 * u;
            const footerH = f.footer ? 70 * u : 0;
            const priceH = f.price ? 230 * u : 0;
            if (lines.length) {
                const avail = col.y + col.h - y - priceH - footerH - 20 * u;
                const size = Math.max(30 * u, Math.min(62 * u, avail / (lines.length * 1.45)));
                ctx.font = `600 ${size}px ${TITLE_FONT}`;
                lines.forEach((line, i) => {
                    const ly = y + i * size * 1.45;
                    ctx.fillStyle = p.accent;
                    ctx.beginPath(); ctx.arc(col.x + size * 0.3, ly + size * 0.55, size * 0.2, 0, Math.PI * 2); ctx.fill();
                    const t = fitText(ctx, line, { maxWidth: col.w - size, maxHeight: size * 1.2, maxSize: size, minSize: size * 0.6, weight: 600, maxLines: 1 });
                    drawLines(ctx, t, col.x + size * 0.85, ly, p.text);
                });
                y += lines.length * size * 1.45 + 30 * u;
            }
            if (f.price) priceBlock(ctx, f.price, '', col.x, Math.min(y, col.y + col.h - priceH - footerH), col.w, 160 * u, p);
            footerText(ctx, f.footer, col.x, col.y + col.h, col.w, 40 * u, p.soft);
            break;
        }
        case 'descuento': {
            if (img) {
                drawCover(ctx, img, { x: 0, y: 0, w: W, h: H });
                ctx.fillStyle = p.bg2;
                ctx.globalAlpha = 0.78;
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = 1;
            } else decor(ctx, p, W, H);
            const cx = W / 2;
            const big = fitText(ctx, f.badge || '%', { maxWidth: W - pad * 2, maxHeight: (v ? 560 : 440) * u, maxSize: (v ? 330 : 400) * u, minSize: 80 * u, family: DISPLAY_FONT, weight: 400, maxLines: 2, lineHeight: 1, uppercase: true });
            const title = f.title ? fitText(ctx, f.title, { maxWidth: W - pad * 2, maxHeight: 240 * u, maxSize: 100 * u, minSize: 44 * u, weight: 900, maxLines: 2, lineHeight: 1.05 }) : null;
            const text = f.text ? fitText(ctx, f.text, { maxWidth: W - pad * 2, maxHeight: 110 * u, maxSize: 54 * u, minSize: 28 * u, weight: 500, maxLines: 2, lineHeight: 1.2 }) : null;
            const gap = 34 * u;
            const total = big.height + (title ? title.height + gap : 0) + (text ? text.height + gap : 0);
            let y = (H - total) / 2 - (f.footer ? 30 * u : 0);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 30 * u;
            drawLines(ctx, big, cx, y, p.accent, 'center');
            ctx.restore();
            y += big.height + gap;
            if (title) { drawLines(ctx, title, cx, y, p.text, 'center'); y += title.height + gap; }
            if (text) drawLines(ctx, text, cx, y, p.soft, 'center');
            footerText(ctx, f.footer, cx, H - pad * 0.8, W - pad * 2, 42 * u, p.soft, 'center');
            break;
        }
        case 'aviso': {
            // Marco y texto centrado.
            ctx.strokeStyle = p.accent;
            ctx.lineWidth = 10 * u;
            roundRect(ctx, pad * 0.5, pad * 0.5, W - pad, H - pad, 40 * u);
            ctx.stroke();
            const cx = W / 2;
            const maxW = W - pad * 3;
            const title = fitText(ctx, f.title, { maxWidth: maxW, maxHeight: (v ? 800 : 480) * u, maxSize: (v ? 130 : 140) * u, minSize: 50 * u, weight: 900, maxLines: v ? 6 : 4, lineHeight: 1.08 });
            const text = f.text ? fitText(ctx, f.text, { maxWidth: maxW, maxHeight: 200 * u, maxSize: 60 * u, minSize: 30 * u, weight: 500, maxLines: 3, lineHeight: 1.25 }) : null;
            const badgeH = f.badge ? 38 * u * 1.8 + 50 * u : 0;
            const gap = 44 * u;
            const total = badgeH + title.height + (text ? gap + text.height : 0);
            let y = (H - total) / 2;
            if (f.badge) { pill(ctx, f.badge, cx, y, 38 * u, p.accent, p.onAccent, 'center'); y += badgeH; }
            drawLines(ctx, title, cx, y, p.text, 'center');
            y += title.height + gap;
            if (text) drawLines(ctx, text, cx, y, p.soft, 'center');
            footerText(ctx, f.footer, cx, H - pad * 1.1, maxW, 40 * u, p.soft, 'center');
            break;
        }
        case 'bienvenida': {
            decor(ctx, p, W, H);
            const cx = W / 2;
            const maxW = W - pad * 3;
            const logoH = img ? (v ? 620 : 420) * u : 0;
            const title = fitText(ctx, f.title, { maxWidth: maxW, maxHeight: 300 * u, maxSize: 150 * u, minSize: 50 * u, weight: 900, maxLines: 2, lineHeight: 1.05 });
            const text = f.text ? fitText(ctx, f.text, { maxWidth: maxW, maxHeight: 150 * u, maxSize: 56 * u, minSize: 28 * u, weight: 500, maxLines: 2, lineHeight: 1.2 }) : null;
            const gap = 50 * u;
            const total = (img ? logoH + gap : 0) + title.height + (text ? gap * 0.6 + text.height : 0);
            let y = (H - total) / 2;
            if (img) {
                drawContain(ctx, img, { x: cx - maxW / 2, y, w: maxW, h: logoH });
                y += logoH + gap;
            }
            drawLines(ctx, title, cx, y, p.text, 'center');
            y += title.height + gap * 0.6;
            if (text) drawLines(ctx, text, cx, y, p.soft, 'center');
            footerText(ctx, f.footer, cx, H - pad * 0.8, maxW, 40 * u, p.soft, 'center');
            break;
        }
    }
    ctx.restore();
}

// La placa como JPG.
export async function renderPlacaBlob(data: PlacaData, photo: HTMLImageElement | null): Promise<Blob> {
    const { width, height } = placaSize(data.orientation);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    await loadPlacaFonts();
    drawPlaca(ctx, data, photo);
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.9);
    });
}

// Nombre del archivo en Medios.
export function placaName(data: PlacaData): string {
    const main = (data.fields.title || data.fields.badge || PLACA_TEMPLATES[data.template].label).trim().replace(/\s+/g, ' ');
    return `Placa · ${main.slice(0, 50)}`;
}

// Las playlists que usan este archivo, con la dirección nueva de la imagen.
// (Las playlists guardan una copia de la dirección; al editar la placa hay que
// actualizarla para que las pantallas muestren la versión nueva.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function playlistsWithNewUrl(campaigns: any[], media: { id: string; url: string }, newUrl: string): { id: string; items_json: unknown }[] {
    const changed: { id: string; items_json: unknown }[] = [];
    for (const c of campaigns) {
        const data = c?.items_json;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matches = (item: any) => !!item && (item.source_id
            ? item.source_id === media.id
            : !!media.url && (item.url === media.url || item.imageUrl === media.url));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fix = (item: any) => (matches(item) ? { ...item, url: newUrl, ...(item.imageUrl ? { imageUrl: newUrl } : {}) } : item);
        if (Array.isArray(data)) {
            if (data.some(matches)) changed.push({ id: c.id, items_json: data.map(fix) });
        } else if (data?.version === '2.0' && Array.isArray(data.zones)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (data.zones.some((z: any) => (z?.playlist || []).some(matches))) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                changed.push({ id: c.id, items_json: { ...data, zones: data.zones.map((z: any) => ({ ...z, playlist: (z?.playlist || []).map(fix) })) } });
            }
        }
    }
    return changed;
}
