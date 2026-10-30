import QRCodeImpl from 'qr.js/lib/QRCode';
import ErrorCorrectLevel from 'qr.js/lib/ErrorCorrectLevel';

// Códigos QR: qué abre (web, WhatsApp, Instagram, Wi-Fi, PDF) y cómo dibujarlo.

export type QrKind = 'web' | 'whatsapp' | 'instagram' | 'wifi' | 'pdf';

export interface QrSpec {
    kind: QrKind;
    url?: string;        // web y pdf
    phone?: string;      // whatsapp
    message?: string;    // whatsapp: mensaje que queda escrito
    user?: string;       // instagram
    ssid?: string;       // wifi
    password?: string;   // wifi
    fileName?: string;   // pdf subido
}

// Lo que se guarda: la configuración, el texto final del QR y la leyenda.
export interface QrData {
    spec: QrSpec;
    value: string;
    caption: string;
}

export const QR_KINDS: Record<QrKind, { label: string; caption: string }> = {
    web: { label: 'Página web', caption: 'Escaneá y mirá más' },
    whatsapp: { label: 'WhatsApp', caption: 'Escribinos por WhatsApp' },
    instagram: { label: 'Instagram', caption: 'Seguinos en Instagram' },
    wifi: { label: 'Wi-Fi', caption: 'Conectate al Wi-Fi' },
    pdf: { label: 'Carta en PDF', caption: 'Escaneá y mirá la carta' },
};

const withHttps = (url: string) => {
    const u = url.trim();
    if (!u) return '';
    return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
};

// Número para wa.me: solo dígitos, con código de país. Los celulares
// argentinos se completan:
//   3411234567     (10 dígitos)          -> 5493411234567
//   93411234567    (con el 9 adelante)   -> 5493411234567
//   543411234567   (54 sin el 9)         -> 5493411234567
//   0341 15 1234567 (con 0 y 15)         -> 5493411234567
export function whatsappNumber(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    // Formato local con 0 y 15: 0 + característica (2 a 4) + 15 + número, 13 dígitos en total.
    if (digits.length === 13 && digits.startsWith('0')) {
        for (const area of [2, 3, 4]) {
            if (digits.slice(1 + area, 3 + area) === '15') {
                digits = digits.slice(1, 1 + area) + digits.slice(3 + area);
                break;
            }
        }
    }
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) return `549${digits}`;
    if (digits.length === 11 && digits.startsWith('9')) return `54${digits}`;
    if (digits.length === 12 && digits.startsWith('54')) return `549${digits.slice(2)}`;
    return digits;
}

const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

// El texto que lleva el QR, o '' si falta algo.
export function qrValue(spec: QrSpec): string {
    switch (spec.kind) {
        case 'web':
        case 'pdf':
            return withHttps(spec.url || '');
        case 'whatsapp': {
            const n = whatsappNumber(spec.phone || '');
            if (n.length < 8) return '';
            const msg = (spec.message || '').trim();
            return `https://wa.me/${n}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
        }
        case 'instagram': {
            const user = (spec.user || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
            return user ? `https://instagram.com/${user}` : '';
        }
        case 'wifi': {
            const ssid = (spec.ssid || '').trim();
            if (!ssid) return '';
            const pass = spec.password || '';
            return pass
                ? `WIFI:T:WPA;S:${wifiEscape(ssid)};P:${wifiEscape(pass)};;`
                : `WIFI:T:nopass;S:${wifiEscape(ssid)};;`;
        }
    }
}

export function qrData(spec: QrSpec, caption: string): QrData | null {
    const value = qrValue(spec);
    return value ? { spec, value, caption } : null;
}

// Matriz del QR (true = cuadradito negro). Nivel M: aguanta un poco de
// suciedad o reflejo en la pantalla. qr.js trabaja byte a byte: se pasa el
// texto en UTF-8 para que los acentos y la ñ se lean bien.
export function qrMatrix(value: string): boolean[][] {
    const bytes = unescape(encodeURIComponent(value));
    const qr = new QRCodeImpl(-1, ErrorCorrectLevel.M);
    qr.addData(bytes);
    qr.make();
    return qr.modules;
}

// Dibuja el QR en un canvas, con su margen blanco (2 módulos).
export function drawQrCode(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = '#000000', bg = '#ffffff') {
    const m = qrMatrix(value);
    const n = m.length + 4;
    const cell = size / n;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = color;
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m.length; c++) {
            // +0.5 px de solape: sin rayitas entre cuadraditos al escalar.
            if (m[r][c]) ctx.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, cell + 0.5, cell + 0.5);
        }
    }
}

// El QR como path de SVG (para la TV), en un cuadrado de (n + 4) unidades.
export function qrSvgPath(value: string): { path: string; size: number } {
    const m = qrMatrix(value);
    let path = '';
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m.length; c++) {
            if (m[r][c]) path += `M${c + 2} ${r + 2}h1v1h-1z`;
        }
    }
    return { path, size: m.length + 4 };
}

// ---- QR fijo en la pantalla ----

export type QrCorner = 'br' | 'bl' | 'tr' | 'tl';
export type QrSize = 's' | 'm' | 'l';

export interface ScreenQr extends QrData {
    corner: QrCorner;
    size: QrSize;
}

export const QR_CORNERS: Record<QrCorner, string> = { tl: 'Arriba a la izquierda', tr: 'Arriba a la derecha', bl: 'Abajo a la izquierda', br: 'Abajo a la derecha' };
export const QR_SIZES: Record<QrSize, { label: string; fraction: number }> = {
    s: { label: 'Chico', fraction: 0.17 },
    m: { label: 'Mediano', fraction: 0.22 },
    l: { label: 'Grande', fraction: 0.28 },
};

// Evento para que la TV vuelva a leer su QR al instante (lo manda el panel).
export const SCREEN_QR_REFRESH_EVENT = 'tv-qr-refresh';

export function parseScreenQr(raw: unknown): ScreenQr | null {
    const q = raw as Partial<ScreenQr> | null;
    if (!q || typeof q.value !== 'string' || !q.value) return null;
    return {
        spec: q.spec || { kind: 'web' },
        value: q.value,
        caption: typeof q.caption === 'string' ? q.caption : '',
        corner: q.corner && q.corner in QR_CORNERS ? q.corner : 'br',
        size: q.size && q.size in QR_SIZES ? q.size : 'm',
    };
}
