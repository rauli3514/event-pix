import { Submission } from '@/types';
import { getWallStats } from '@/lib/wallStats';
import { DEFAULT_ACCENT, isLight, shade, validAccent, withAlpha } from '@/lib/wallAccent';

// "Resumen del evento": una imagen para que el anfitrión comparta al día
// siguiente (WhatsApp, Instagram): título, fecha, collage de fotos de la noche,
// los números del muro y la firma de EventPix.

export type RecapFormat = 'post' | 'story';

export const RECAP_SIZES: Record<RecapFormat, { w: number; h: number }> = {
    post: { w: 1080, h: 1350 }, // publicación / chat de WhatsApp
    story: { w: 1080, h: 1920 }, // historias de Instagram / estados de WhatsApp
};

export interface RecapStats { photos: number; guests: number; messages: number }

export const recapStats = (submissions: Submission[]): RecapStats => {
    const { photos, guests } = getWallStats(submissions);
    const messages = submissions.filter((s) => s.status === 'approved' && s.type === 'message').length;
    return { photos, guests, messages };
};

/**
 * Fotos repartidas a lo largo de la noche (del principio al final), para que el
 * collage cuente el evento. `seed` cambia la elección ("Otras fotos").
 */
export const pickRecapPhotos = (submissions: Submission[], count: number, seed = 0): Submission[] => {
    const photos = submissions
        .filter((s) => s.status === 'approved' && s.type === 'photo' && s.content)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (photos.length <= count) return photos;
    const step = photos.length / count;
    // Con seed se corre el punto de cada tramo, siempre dentro de su parte de la noche
    const offset = seed === 0 ? 0.5 : ((seed * 0.618) % 1);
    return Array.from({ length: count }, (_, i) => photos[Math.min(photos.length - 1, Math.floor(i * step + offset * step))]);
};

/** Tipografía del título según el tema del evento (las que carga la app) */
const titleFont = (fontClass?: string) =>
    fontClass === 'font-modern' ? 'Montserrat' : fontClass === 'font-neon' ? 'Orbitron' : 'Playfair Display';

const loadImage = async (url: string): Promise<ImageBitmap | null> => {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await createImageBitmap(await res.blob());
    } catch {
        return null;
    }
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
};

/** Imagen recortada para llenar el recuadro (como object-cover, con las caras arriba) */
const drawCover = (ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) => {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) * 0.3;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

/** Achica la letra hasta que el texto entre en el ancho */
const fitText = (ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, maxSize: number, maxWidth: number, minSize = 36) => {
    let size = maxSize;
    for (; size > minSize; size -= 4) {
        ctx.font = font(size);
        if (ctx.measureText(text).width <= maxWidth) break;
    }
    return size;
};

/** Parte el título en hasta dos renglones si no entra en uno */
const splitTitle = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const words = text.split(/\s+/);
    let best: string[] = [text];
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ');
        const b = words.slice(i).join(' ');
        const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
        if (diff < bestDiff) { best = [a, b]; bestDiff = diff; }
    }
    return best;
};

/** Columnas y filas del collage según el formato y la cantidad de fotos */
const gridFor = (format: RecapFormat, count: number): [number, number] => {
    const n = Math.max(1, count);
    if (format === 'story') return n >= 6 ? [2, 3] : n >= 4 ? [2, 2] : [1, Math.min(n, 3)];
    return n >= 6 ? [3, 2] : n >= 4 ? [2, 2] : [Math.min(n, 3), 1];
};

export interface RecapOptions {
    format: RecapFormat;
    title: string;
    date?: string | null;
    accent?: string | null;
    fontClass?: string;
    stats: RecapStats;
    photos: Submission[];
}

export async function drawRecap(opts: RecapOptions): Promise<Blob> {
    const { w: W, h: H } = RECAP_SIZES[opts.format];
    const story = opts.format === 'story';
    const accent = validAccent(opts.accent) || DEFAULT_ACCENT;
    // Sobre fondo oscuro: los colores claros (dorado, neón) van tal cual; los oscuros se aclaran
    const accentText = isLight(accent) ? accent : shade(accent, 0.4);
    const family = titleFont(opts.fontClass);
    await Promise.all([
        document.fonts.load(`700 80px "${family}"`),
        document.fonts.load('700 40px Inter'),
        document.fonts.load('500 30px Inter'),
    ]).catch(() => undefined);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Fondo: oscuro con un brillo del color del evento arriba
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, -H * 0.1, 50, W / 2, H * 0.15, H * 0.9);
    glow.addColorStop(0, withAlpha(accent, 0.55));
    glow.addColorStop(1, withAlpha(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const M = 72;
    let y = story ? 170 : 96;

    // Encabezado
    ctx.textAlign = 'center';
    ctx.fillStyle = accentText;
    ctx.font = '700 30px Inter';
    ctx.letterSpacing = '8px';
    ctx.fillText('¡GRACIAS POR SER PARTE!', W / 2, y);
    ctx.letterSpacing = '0px';
    y += 34;

    ctx.fillStyle = '#ffffff';
    const titleFontAt = (s: number) => `700 ${s}px "${family}"`;
    let size = fitText(ctx, opts.title, titleFontAt, 92, W - 2 * M, 64);
    ctx.font = titleFontAt(size);
    let lines = [opts.title];
    if (ctx.measureText(opts.title).width > W - 2 * M) {
        lines = splitTitle(ctx, opts.title, W - 2 * M);
        size = Math.min(...lines.map((l) => fitText(ctx, l, titleFontAt, 84, W - 2 * M, 40)));
        ctx.font = titleFontAt(size);
    }
    for (const line of lines) {
        y += size * 1.12;
        ctx.fillText(line, W / 2, y);
    }

    if (opts.date) {
        const label = new Date(opts.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
        y += 58;
        ctx.font = '500 32px Inter';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(label, W / 2, y);
    }

    // Collage: 3x2 en publicación, 2x3 en historia
    const footerH = 90;
    const statsH = story ? 250 : 210;
    const top = y + (story ? 80 : 50);
    const bottom = H - footerH - statsH - (story ? 60 : 30);
    // La grilla se adapta a las fotos que haya (sin recuadros vacíos)
    const [cols, rows] = gridFor(opts.format, opts.photos.length);
    const gap = 18;
    const cellW = (W - 2 * M - gap * (cols - 1)) / cols;
    const cellH = Math.min((bottom - top - gap * (rows - 1)) / rows, cellW * 1.35);
    const gridH = cellH * rows + gap * (rows - 1);
    const gridTop = top + (bottom - top - gridH) / 2;

    const images = await Promise.all(opts.photos.slice(0, cols * rows).map((p) => loadImage(p.content)));
    const shown = images.filter((i): i is ImageBitmap => !!i);
    for (let i = 0; i < cols * rows; i++) {
        const cx = M + (i % cols) * (cellW + gap);
        const cy = gridTop + Math.floor(i / cols) * (cellH + gap);
        ctx.save();
        roundRect(ctx, cx, cy, cellW, cellH, 22);
        ctx.clip();
        const img = shown[i] ?? (shown.length ? shown[i % shown.length] : null);
        if (img) {
            drawCover(ctx, img, cx, cy, cellW, cellH);
        } else {
            ctx.fillStyle = withAlpha(accent, 0.25);
            ctx.fillRect(cx, cy, cellW, cellH);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        roundRect(ctx, cx, cy, cellW, cellH, 22);
        ctx.stroke();
    }

    // Números de la noche
    const items = [
        { n: opts.stats.photos, one: 'foto', many: 'fotos' },
        { n: opts.stats.guests, one: 'invitado', many: 'invitados' },
        { n: opts.stats.messages, one: 'mensaje', many: 'mensajes' },
    ].filter((it) => it.n > 0);
    const statsTop = H - footerH - statsH;
    const boxW = (W - 2 * M - gap * (items.length - 1)) / Math.max(1, items.length);
    items.forEach((it, i) => {
        const bx = M + i * (boxW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        roundRect(ctx, bx, statsTop, boxW, statsH - 40, 28);
        ctx.fill();
        ctx.fillStyle = accentText;
        ctx.font = `800 ${story ? 96 : 84}px Inter`;
        ctx.fillText(String(it.n), bx + boxW / 2, statsTop + (statsH - 40) * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '600 30px Inter';
        ctx.fillText(it.n === 1 ? it.one : it.many, bx + boxW / 2, statsTop + (statsH - 40) * 0.82);
    });

    // Firma
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '500 28px Inter';
    ctx.fillText('Hecho con EventPix · event-pix.com.ar', W / 2, H - footerH / 2);
    // Detalle del color del evento
    ctx.fillStyle = accent;
    roundRect(ctx, W / 2 - 40, H - footerH / 2 - 62, 80, 6, 3);
    ctx.fill();

    return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo armar la imagen'))), 'image/jpeg', 0.9)
    );
}
