// Revisión de videos antes de subirlos al panel.
//
// Los TV box chicos (1 GB de RAM) reproducen bien un MP4 H.264 en 1080p con
// un bitrate moderado. Un 4K, un H.265 (lo que graban los iPhone) o un video
// con mucho bitrate se traba, tarda en descargarse o directamente no se ve.
// Esto avisa antes de subirlo; la persona decide si sube igual.

export interface VideoInfo {
    width: number | null;
    height: number | null;
    durationSec: number | null;
    sizeMb: number;
    bitrateMbps: number | null;
    codec: 'h264' | 'hevc' | 'vp9' | 'av1' | null;
}

export interface VideoIssue {
    code: 'resolution' | 'bitrate' | 'codec' | 'size';
    message: string;
}

// Límites para equipos de 1 GB de RAM.
export const MAX_SIDE_PX = 1920;      // 1080p (horizontal o vertical)
export const MAX_BITRATE_MBPS = 12;   // 1080p H.264 se ve bien con 5-8 Mbps
export const MAX_SIZE_MB = 500;

const SCAN_BYTES = 4 * 1024 * 1024;

interface Mp4Header {
    codec: VideoInfo['codec'];
    width: number | null;
    height: number | null;
    duration: number | null;
}

// Lee del encabezado del MP4/MOV (caja 'moov') el códec, la resolución y la
// duración, sin depender de que el navegador sepa reproducir el video (Firefox
// no lee H.265, por ejemplo). 'moov' está al principio o al final del archivo
// según cómo se exportó: se miran las dos puntas.
async function readMp4Header(file: File): Promise<Mp4Header> {
    const parts = file.size <= SCAN_BYTES * 2
        ? [file]
        : [file.slice(0, SCAN_BYTES), file.slice(file.size - SCAN_BYTES)];
    const header: Mp4Header = { codec: null, width: null, height: null, duration: null };
    const tags = new Set<string>();
    // latin1: un carácter por byte, así se pueden buscar los nombres de 4 letras.
    const decoder = new TextDecoder('latin1');

    for (const part of parts) {
        const buffer = await part.arrayBuffer();
        const view = new DataView(buffer);
        const text = decoder.decode(buffer);
        for (const tag of ['hvc1', 'hev1', 'avc1', 'avc3', 'av01', 'vp09']) {
            if (text.includes(tag)) tags.add(tag);
        }

        // mvhd: duración total = duration / timescale.
        const mvhd = text.indexOf('mvhd');
        if (header.duration === null && mvhd >= 0) {
            try {
                const base = mvhd + 4;
                const version = view.getUint8(base);
                const timescale = version === 1 ? view.getUint32(base + 20) : view.getUint32(base + 12);
                const duration = version === 1
                    ? view.getUint32(base + 24) * 2 ** 32 + view.getUint32(base + 28)
                    : view.getUint32(base + 16);
                if (timescale > 0 && duration > 0) header.duration = duration / timescale;
            } catch { /* encabezado cortado */ }
        }

        // tkhd (una por pista): ancho y alto en punto fijo 16.16. La de audio da 0.
        let tkhd = text.indexOf('tkhd');
        while (tkhd >= 0) {
            try {
                const base = tkhd + 4;
                const version = view.getUint8(base);
                const dims = base + (version === 1 ? 88 : 76);
                const width = Math.round(view.getUint32(dims) / 65536);
                const height = Math.round(view.getUint32(dims + 4) / 65536);
                if (width > 0 && height > 0 && width * height > (header.width || 0) * (header.height || 0)) {
                    header.width = width;
                    header.height = height;
                }
            } catch { /* encabezado cortado */ }
            tkhd = text.indexOf('tkhd', tkhd + 4);
        }
    }

    if (tags.has('hvc1') || tags.has('hev1')) header.codec = 'hevc';
    else if (tags.has('av01')) header.codec = 'av1';
    else if (tags.has('vp09')) header.codec = 'vp9';
    else if (tags.has('avc1') || tags.has('avc3')) header.codec = 'h264';
    return header;
}

function readDimensions(file: File): Promise<{ width: number; height: number; duration: number } | null> {
    return new Promise(resolve => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        let done = false;
        const finish = (value: { width: number; height: number; duration: number } | null) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            URL.revokeObjectURL(url);
            video.removeAttribute('src');
            video.load();
            resolve(value);
        };
        // Si el navegador no puede leer el video (algunos H.265), se sigue sin medidas.
        const timer = setTimeout(() => finish(null), 10000);
        video.preload = 'metadata';
        video.muted = true;
        video.onloadedmetadata = () => finish({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
        });
        video.onerror = () => finish(null);
        video.src = url;
    });
}

export async function analyzeVideo(file: File): Promise<VideoInfo> {
    const sizeMb = file.size / (1024 * 1024);
    const [dims, header] = await Promise.all([
        readDimensions(file).catch(() => null),
        readMp4Header(file).catch((): Mp4Header => ({ codec: null, width: null, height: null, duration: null })),
    ]);
    // Primero lo que mide el navegador; si no pudo abrir el video, el encabezado.
    const width = dims?.width || header.width;
    const height = dims?.height || header.height;
    const rawDuration = dims && Number.isFinite(dims.duration) && dims.duration > 0 ? dims.duration : header.duration;
    const duration = rawDuration && rawDuration > 0 ? rawDuration : null;
    return {
        width: width || null,
        height: height || null,
        durationSec: duration,
        sizeMb: Math.round(sizeMb * 10) / 10,
        bitrateMbps: duration ? Math.round(((file.size * 8) / duration / 1e6) * 10) / 10 : null,
        codec: header.codec,
    };
}

export function videoIssues(info: VideoInfo): VideoIssue[] {
    const issues: VideoIssue[] = [];
    const longSide = Math.max(info.width || 0, info.height || 0);
    if (longSide > MAX_SIDE_PX) {
        issues.push({
            code: 'resolution',
            message: `Resolución ${info.width}×${info.height}${longSide >= 3800 ? ' (4K)' : ''}: los equipos chicos lo reproducen con trabas. Conviene 1080p (1920×1080) o menos.`,
        });
    }
    if (info.codec === 'hevc') {
        issues.push({
            code: 'codec',
            message: 'Formato H.265 (HEVC, el de los iPhone): muchos TV box no lo reproducen. Conviene exportarlo en H.264.',
        });
    } else if (info.codec === 'av1' || info.codec === 'vp9') {
        issues.push({
            code: 'codec',
            message: `Formato ${info.codec.toUpperCase()}: los TV box viejos no lo reproducen. Conviene exportarlo en MP4 H.264.`,
        });
    }
    if (info.bitrateMbps !== null && info.bitrateMbps > MAX_BITRATE_MBPS) {
        issues.push({
            code: 'bitrate',
            message: `Muy pesado para su duración (${info.bitrateMbps} Mbps): conviene 8 Mbps o menos.`,
        });
    }
    if (info.sizeMb > MAX_SIZE_MB) {
        issues.push({
            code: 'size',
            message: `Archivo muy grande (${Math.round(info.sizeMb)} MB): tarda mucho en llegar a las pantallas y ocupa su memoria.`,
        });
    }
    return issues;
}

// Resumen para guardar en display_media.metadata.video (para mostrar "Pesado"
// en la biblioteca sin volver a analizar).
export function videoMetadata(info: VideoInfo, issues: VideoIssue[]) {
    return {
        width: info.width,
        height: info.height,
        duration_sec: info.durationSec ? Math.round(info.durationSec) : null,
        bitrate_mbps: info.bitrateMbps,
        codec: info.codec,
        issues: issues.map(i => i.code),
    };
}
