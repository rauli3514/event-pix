// Carteles: avisos armados con una plantilla (promo, carta, oferta) que se
// dibujan en vivo en la TV. Se guardan como una app más de Medios
// (type 'app', metadata { appId: 'poster', config: PosterConfig }), así entran
// en playlists, "Enviar a pantallas", Espejo / Olas / Mosaico y la programación.
// Las listas de precios se leen en vivo (ver lib/priceLists).

export const POSTER_APP_ID = 'poster';

export type PosterLayout = 'split' | 'card' | 'band' | 'menu';
export type PosterFormat = '16:9' | 'h2x1' | 'h1x2' | 'h2x2' | '9:16' | 'v2x1' | 'v1x2' | 'v2x2' | '21:9' | '4:3' | '1:1';
export type PosterFont = 'modern' | 'elegant' | 'impact' | 'script' | 'simple' | 'bold' | 'retro' | 'luxury' | 'playful' | 'gamer';

export interface TextStyle {
    // Tamaño relativo (1 = el de la plantilla).
    scale?: number;
    color?: string;
    shadow?: boolean;
}

export interface PosterTheme {
    id: string;
    label: string;
    panel: string;   // fondo del panel / tarjeta
    text: string;    // texto principal
    accent: string;  // precio, etiqueta, detalles
    photoTint: string; // degradé cuando no hay foto
}

export interface PosterConfig {
    version: 1;
    layout: PosterLayout;
    format: PosterFormat;     // solo para la vista previa: en la TV llena la pantalla
    themeId: string;
    font: PosterFont;
    tilt?: boolean;           // tarjeta inclinada (layout 'card')
    photos: string[];         // 0 a 2 fotos
    badge?: string;
    title?: string;
    subtitle?: string;
    price?: string;           // precio grande escrito a mano ("$ 3.900", "2x1")
    priceRef?: { listId: string; itemId: string } | null; // o vinculado a un producto
    listId?: string | null;   // lista de precios vinculada
    listColumns?: 'auto' | 1 | 2;
    showDetails?: boolean;    // aclaraciones de cada producto
    qrUrl?: string;
    showClock?: boolean;
    styles?: Partial<Record<PosterPart, TextStyle>>;
    // Cuánto se corrió cada parte de su lugar (fracción del ancho y del alto).
    offsets?: Partial<Record<PosterPart, { x: number; y: number }>>;
    // Cuándo aparece (mismas claves que las reglas de cada item de playlist).
    schedule?: { showDays?: number[]; showFrom?: string; showTo?: string } | null;
    autoBadge?: boolean;      // "DE 15 A 19 H" según el horario
    durationS?: number;
    // Armado fino (todo opcional: sin esto queda como la plantilla).
    flip?: boolean;           // foto del otro lado (split, menu) o franja arriba (band)
    photoShare?: number;      // cuánto ocupa la foto, 0.25 a 0.75 (split, menu, band)
    cardPos?: { x: number; y: number } | null; // centro de la tarjeta, 0 a 1 (card)
    cardSize?: number;        // tamaño de la tarjeta, 0.6 a 1.5 (card)
    panelColor?: string;      // fondo propio (si no, el de la paleta)
    accentColor?: string;     // color de precios y etiqueta (si no, el de la paleta)
    qrLabel?: string;         // texto al lado del QR ("Pedí por WhatsApp")
    animation?: PosterAnimation;
    photoMotion?: boolean;    // la foto se acerca despacio
    pricePulse?: boolean;     // el precio grande late
}

export type PosterAnimation = 'none' | 'fade' | 'slide' | 'pop';

// Partes del cartel que se pueden mover y agrandar.
export type PosterPart = 'badge' | 'title' | 'subtitle' | 'list' | 'price' | 'qr' | 'clock';

export const POSTER_PARTS: Record<PosterPart, string> = {
    badge: 'Etiqueta',
    title: 'Título',
    subtitle: 'Subtítulo',
    list: 'Lista de precios',
    price: 'Precio grande',
    qr: 'Código QR',
    clock: 'Hora',
};

export const POSTER_ANIMATIONS: { id: PosterAnimation; label: string }[] = [
    { id: 'none', label: 'Sin animación' },
    { id: 'fade', label: 'Aparece suave' },
    { id: 'slide', label: 'Entra desde abajo' },
    { id: 'pop', label: 'Salta' },
];

// Paleta con los colores propios del cartel aplicados.
export function posterColors(config: Pick<PosterConfig, 'themeId' | 'panelColor' | 'accentColor'>): PosterTheme {
    const t = themeOf(config.themeId);
    const panel = config.panelColor || t.panel;
    return {
        ...t,
        panel,
        accent: config.accentColor || t.accent,
        // Con fondo propio, el texto va claro u oscuro según cuánta luz tenga el fondo.
        text: config.panelColor ? (isLightColor(panel) ? '#111827' : '#f8fafc') : t.text,
    };
}

export function isLightColor(hex: string): boolean {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// ── Código QR: se arma el link a partir de lo que entiende la gente. ──
export type QrKind = 'web' | 'whatsapp' | 'instagram';

export const QR_DEFAULT_LABEL: Record<QrKind, string> = {
    web: 'Escaneá para ver más',
    whatsapp: 'Pedí por WhatsApp',
    instagram: 'Seguinos en Instagram',
};

// Número argentino a formato wa.me: "362 454-7382" → 5493624547382.
export function whatsappNumber(raw: string): string {
    let d = (raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('54')) {
        d = d.slice(2);
        if (d.startsWith('9')) d = d.slice(1);
    }
    if (d.startsWith('0')) d = d.slice(1);
    // "362 15 454-7382": se saca el 15 después de la característica.
    const m15 = /^(\d{2,4})15(\d{6,8})$/.exec(d);
    if (m15 && (m15[1] + m15[2]).length === 10) d = m15[1] + m15[2];
    return d.length === 10 ? `549${d}` : d;
}

export function buildQrUrl(kind: QrKind, value: string, message = ''): string {
    const v = (value || '').trim();
    if (!v) return '';
    if (kind === 'whatsapp') {
        const n = whatsappNumber(v);
        if (!n) return '';
        return `https://wa.me/${n}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''}`;
    }
    if (kind === 'instagram') {
        const user = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
        return user ? `https://instagram.com/${user}` : '';
    }
    return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

export function parseQrUrl(url?: string | null): { kind: QrKind; value: string; message: string } {
    const u = (url || '').trim();
    const wa = /^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)\/?(\d*)(?:\?(.*))?$/i.exec(u);
    if (wa) {
        const params = new URLSearchParams(wa[2] || '');
        const phone = wa[1] || params.get('phone') || '';
        return { kind: 'whatsapp', value: phone, message: params.get('text') || '' };
    }
    const ig = /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(u);
    if (ig) return { kind: 'instagram', value: `@${ig[1]}`, message: '' };
    return { kind: 'web', value: u, message: '' };
}

export const POSTER_THEMES: PosterTheme[] = [
    { id: 'noche', label: 'Noche', panel: '#15171c', text: '#f8fafc', accent: '#f26b3a', photoTint: 'linear-gradient(135deg,#3b2a20,#0f1115)' },
    { id: 'cafe', label: 'Café', panel: '#2b1c14', text: '#fff7ed', accent: '#e8a85a', photoTint: 'linear-gradient(135deg,#6b4423,#1d120c)' },
    { id: 'pizzeria', label: 'Pizzería', panel: '#7a1d1d', text: '#fff8f0', accent: '#fbbf24', photoTint: 'linear-gradient(135deg,#b45309,#450a0a)' },
    { id: 'crema', label: 'Crema', panel: '#f6efe2', text: '#2b2118', accent: '#c2410c', photoTint: 'linear-gradient(135deg,#e7d7bd,#a8916d)' },
    { id: 'rosa', label: 'Rosa', panel: '#4a1d3a', text: '#fff1f7', accent: '#f9a8d4', photoTint: 'linear-gradient(135deg,#f5c2d7,#7c2d55)' },
    { id: 'lima', label: 'Lima', panel: '#c6f432', text: '#101010', accent: '#101010', photoTint: 'linear-gradient(135deg,#3f3f46,#09090b)' },
    { id: 'mar', label: 'Mar', panel: '#0f2a44', text: '#f0f9ff', accent: '#38bdf8', photoTint: 'linear-gradient(135deg,#94a3b8,#0f2a44)' },
    { id: 'blanco', label: 'Blanco', panel: '#ffffff', text: '#111827', accent: '#16a34a', photoTint: 'linear-gradient(135deg,#d1fae5,#065f46)' },
    { id: 'fuego', label: 'Fuego', panel: '#141110', text: '#fffaf5', accent: '#ff5a1f', photoTint: 'linear-gradient(135deg,#7c2d12,#1c1917)' },
    { id: 'cerveza', label: 'Cerveza', panel: '#1b130a', text: '#fff7e6', accent: '#f5b301', photoTint: 'linear-gradient(135deg,#b45309,#1b130a)' },
    { id: 'neon', label: 'Neón', panel: '#14041c', text: '#fdf4ff', accent: '#ff2bd6', photoTint: 'linear-gradient(135deg,#6d28d9,#14041c)' },
    { id: 'helado', label: 'Helado', panel: '#d9f7ee', text: '#0f3b33', accent: '#ff4f86', photoTint: 'linear-gradient(135deg,#fbcfe8,#99f6e4)' },
    { id: 'moda', label: 'Moda', panel: '#0a0a0a', text: '#fafafa', accent: '#d6c7a1', photoTint: 'linear-gradient(135deg,#525252,#0a0a0a)' },
    { id: 'nude', label: 'Nude', panel: '#efe6dc', text: '#2a211b', accent: '#9a3412', photoTint: 'linear-gradient(135deg,#e7cfb4,#8a6a55)' },
    { id: 'sale', label: 'Liquidación', panel: '#e3121b', text: '#ffffff', accent: '#ffe600', photoTint: 'linear-gradient(135deg,#fb7185,#7f1d1d)' },
    { id: 'almacen', label: 'Almacén', panel: '#1f3d2b', text: '#f7f3e8', accent: '#f4c430', photoTint: 'linear-gradient(135deg,#a3b18a,#1f3d2b)' },
    { id: 'gamer', label: 'Gamer', panel: '#0b0420', text: '#f5f3ff', accent: '#22e3a0', photoTint: 'linear-gradient(135deg,#7c3aed,#0b0420)' },
    { id: 'electro', label: 'Electro', panel: '#06142b', text: '#e6f1ff', accent: '#00c2ff', photoTint: 'linear-gradient(135deg,#1d4ed8,#06142b)' },
    { id: 'vino', label: 'Vino', panel: '#3b0a1a', text: '#fdf2f4', accent: '#d4af37', photoTint: 'linear-gradient(135deg,#7f1d1d,#1f0710)' },
    { id: 'fuerza', label: 'Fuerza', panel: '#0b0b0b', text: '#ffffff', accent: '#c6f432', photoTint: 'linear-gradient(135deg,#3f3f46,#0b0b0b)' },
];

export const themeOf = (id?: string) => POSTER_THEMES.find(t => t.id === id) || POSTER_THEMES[0];

// Letras ya cargadas en index.html.
// size: para que todas se vean del mismo tamaño; charEm: ancho de una letra (aprox.).
export const POSTER_FONTS: Record<PosterFont, { label: string; family: string; weight: number; size: number; charEm: number }> = {
    modern: { label: 'Moderna', family: "'Montserrat', 'Inter', sans-serif", weight: 800, size: 1, charEm: 0.62 },
    elegant: { label: 'Elegante', family: "'Playfair Display', Georgia, serif", weight: 700, size: 1, charEm: 0.56 },
    impact: { label: 'Impacto', family: "'Anton', 'Montserrat', sans-serif", weight: 400, size: 1.05, charEm: 0.46 },
    script: { label: 'Manuscrita', family: "'Pinyon Script', cursive", weight: 400, size: 1.1, charEm: 0.5 },
    simple: { label: 'Simple', family: "'Inter', sans-serif", weight: 700, size: 1, charEm: 0.6 },
    bold: { label: 'Gruesa', family: "'Bebas Neue', 'Anton', sans-serif", weight: 400, size: 1.25, charEm: 0.42 },
    retro: { label: 'Retro', family: "'Lobster', cursive", weight: 400, size: 1.05, charEm: 0.52 },
    luxury: { label: 'Lujo', family: "'Cinzel', 'Playfair Display', serif", weight: 700, size: 0.92, charEm: 0.78 },
    playful: { label: 'Divertida', family: "'Fredoka', 'Montserrat', sans-serif", weight: 700, size: 1, charEm: 0.6 },
    gamer: { label: 'Gamer', family: "'Orbitron', 'Montserrat', sans-serif", weight: 700, size: 0.88, charEm: 0.82 },
};

export const POSTER_LAYOUTS: Record<PosterLayout, { label: string; description: string }> = {
    split: { label: 'Mitad y mitad', description: 'Foto a un lado y la información al otro.' },
    card: { label: 'Fotos con tarjeta', description: 'Una o dos fotos y una tarjeta encima.' },
    band: { label: 'Foto con franja', description: 'Foto grande y una franja con el texto.' },
    menu: { label: 'Carta', description: 'La lista de precios grande, con foto al costado.' },
};

// Formatos: los mismos que los mosaicos. Cada TV es 1920×1080 (o 1080×1920
// parada) y un mosaico suma columnas y filas. En Mosaico, cada TV dibuja el
// cartel al tamaño de todo el mosaico y muestra su parte.
export interface PosterFormatInfo {
    id: PosterFormat;
    label: string;
    group: 'TV horizontal' | 'TV vertical' | 'Otros';
    cols: number;
    rows: number;
    width: number;
    height: number;
    ratio: number;
    hint: string;
    legacy?: boolean; // formatos viejos: solo para carteles ya guardados
}

const tvFormat = (id: PosterFormat, portraitTv: boolean, cols: number, rows: number, name: string, hint: string): PosterFormatInfo => {
    const width = cols * (portraitTv ? 1080 : 1920);
    const height = rows * (portraitTv ? 1920 : 1080);
    return {
        id, cols, rows, width, height, ratio: width / height, hint,
        group: portraitTv ? 'TV vertical' : 'TV horizontal',
        label: `${name} · ${width}×${height}`,
    };
};

export const POSTER_FORMATS: PosterFormatInfo[] = [
    tvFormat('16:9', false, 1, 1, '1 TV horizontal', 'La más común.'),
    tvFormat('h2x1', false, 2, 1, '2 TV una al lado de la otra (2×1)', 'Mosaico de 2 TV acostadas, lado a lado.'),
    tvFormat('h1x2', false, 1, 2, '2 TV una arriba de la otra (1×2)', 'Mosaico de 2 TV acostadas, una sobre otra.'),
    tvFormat('h2x2', false, 2, 2, '4 TV (2×2)', 'Mosaico de 4 TV acostadas.'),
    tvFormat('9:16', true, 1, 1, '1 TV vertical', 'TV parada o el exhibidor de mostrador.'),
    tvFormat('v2x1', true, 2, 1, '2 TV paradas una al lado de la otra (2×1)', 'Mosaico de 2 TV paradas, lado a lado.'),
    tvFormat('v1x2', true, 1, 2, '2 TV paradas una arriba de la otra (1×2)', 'Mosaico de 2 TV paradas, una sobre otra.'),
    tvFormat('v2x2', true, 2, 2, '4 TV paradas (2×2)', 'Mosaico de 4 TV paradas.'),
    { id: '21:9', label: 'Pantalla larga · 21:9', group: 'Otros', cols: 1, rows: 1, width: 2560, height: 1080, ratio: 21 / 9, hint: '', legacy: true },
    { id: '4:3', label: 'Tele clásica · 4:3', group: 'Otros', cols: 1, rows: 1, width: 1440, height: 1080, ratio: 4 / 3, hint: '', legacy: true },
    { id: '1:1', label: 'Cuadrada · 1:1', group: 'Otros', cols: 1, rows: 1, width: 1080, height: 1080, ratio: 1, hint: '', legacy: true },
];

export const formatInfo = (f?: PosterFormat) => POSTER_FORMATS.find(x => x.id === f) || POSTER_FORMATS[0];

export const formatRatio = (f?: PosterFormat) => POSTER_FORMATS.find(x => x.id === f)?.ratio || 16 / 9;

// "DE 15 A 19 H", "DE 9:30 A 13 H".
export function scheduleBadge(schedule?: PosterConfig['schedule']): string | null {
    if (!schedule?.showFrom || !schedule?.showTo) return null;
    const short = (t: string) => {
        const [h, m] = t.slice(0, 5).split(':');
        return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
    };
    return `DE ${short(schedule.showFrom)} A ${short(schedule.showTo)} H`;
}

// Rubros para buscar diseños (los de más llegada primero).
export const POSTER_GROUPS = [
    'Comidas y restaurantes',
    'Bares y cervecerías',
    'Heladerías y cafeterías',
    'Moda y accesorios',
    'Almacén y minoristas',
    'Videojuegos y electrónica',
    'Vinotecas',
    'Gimnasios',
    'Otros',
] as const;
export type PosterGroup = typeof POSTER_GROUPS[number];

export interface PosterTemplate {
    id: string;
    name: string;
    rubro: string;
    grupo?: PosterGroup;
    config: Omit<PosterConfig, 'version' | 'format' | 'photos'> & { photos?: string[] };
    // Lista de ejemplo para la vista previa (hasta que se vincule una de verdad).
    sampleList?: { name: string; price: string; detail?: string }[];
}

// Cartel en blanco ("Empezar de cero").
export const BLANK_TEMPLATE: PosterTemplate = {
    id: 'blank', name: 'Cartel nuevo', rubro: 'Desde cero',
    config: { layout: 'split', themeId: 'noche', font: 'modern', title: 'Tu título acá', subtitle: 'Una frase corta', price: '' },
};

// Plantillas por rubro: formas de armado × colores × textos de ejemplo.
export const POSTER_TEMPLATES: PosterTemplate[] = [
    {
        id: 'pizzas', name: 'Pizzas', rubro: 'Pizzería', grupo: 'Comidas y restaurantes',
        config: { layout: 'menu', themeId: 'pizzeria', font: 'impact', title: 'Pizzas', subtitle: 'a la piedra', showDetails: true },
        sampleList: [
            { name: 'Muzzarella', price: '$ 5.000', detail: '8 porciones' },
            { name: 'Napolitana', price: '$ 6.000' },
            { name: 'Fugazzeta', price: '$ 6.500' },
            { name: 'Calabresa', price: '$ 7.000' },
            { name: 'Especial', price: '$ 7.500', detail: 'jamón y morrones' },
            { name: 'Faina', price: '$ 1.500' },
        ],
    },
    {
        id: 'hamburguesas', name: 'Hamburguesas', rubro: 'Hamburguesería', grupo: 'Comidas y restaurantes',
        config: { layout: 'menu', themeId: 'fuego', font: 'bold', title: 'Hamburguesas', subtitle: 'smash', showDetails: true },
        sampleList: [
            { name: 'Clásica', price: '$ 9.500', detail: 'carne, cheddar y lechuga' },
            { name: 'Doble cheddar', price: '$ 12.000' },
            { name: 'Bacon', price: '$ 12.500', detail: 'panceta crocante' },
            { name: 'Veggie', price: '$ 10.000', detail: 'medallón de garbanzos' },
            { name: 'Papas fritas', price: '$ 5.000', detail: 'con cheddar + $ 1.500' },
        ],
    },
    {
        id: 'combo-burger', name: 'Combo burger', rubro: 'Hamburguesería', grupo: 'Comidas y restaurantes',
        config: { layout: 'card', themeId: 'fuego', font: 'bold', tilt: true, badge: 'COMBO', title: 'Burger + papas + gaseosa', price: '$ 13.900', pricePulse: true, animation: 'pop' },
    },
    {
        id: 'parrilla', name: 'Parrilla', rubro: 'Parrilla', grupo: 'Comidas y restaurantes',
        config: { layout: 'menu', themeId: 'fuego', font: 'elegant', title: 'Parrilla', subtitle: 'a la leña', showDetails: true },
        sampleList: [
            { name: 'Asado', price: '$ 18.000', detail: 'porción de 400 g' },
            { name: 'Vacío', price: '$ 17.500' },
            { name: 'Matambre a la pizza', price: '$ 16.000' },
            { name: 'Chorizo', price: '$ 4.500' },
            { name: 'Morcilla', price: '$ 4.000' },
            { name: 'Provoleta', price: '$ 7.500' },
        ],
    },
    {
        id: 'menu-del-dia', name: 'Menú del día', rubro: 'Restaurante', grupo: 'Comidas y restaurantes',
        config: { layout: 'split', themeId: 'crema', font: 'elegant', badge: 'MENÚ DEL DÍA', title: 'Milanesa con puré', subtitle: 'incluye bebida y postre', price: '$ 12.500' },
    },
    {
        id: 'empanadas', name: 'Empanadas', rubro: 'Rotisería', grupo: 'Comidas y restaurantes',
        config: { layout: 'menu', themeId: 'crema', font: 'impact', title: 'Empanadas', subtitle: 'al horno', showDetails: true },
        sampleList: [
            { name: 'Carne cortada a cuchillo', price: '$ 2.000' },
            { name: 'Jamón y queso', price: '$ 2.000' },
            { name: 'Pollo', price: '$ 2.000' },
            { name: 'Humita', price: '$ 2.000' },
            { name: 'Caprese', price: '$ 2.200' },
            { name: 'Docena', price: '$ 21.000', detail: 'surtidas' },
        ],
    },
    {
        id: 'lomito', name: 'Lomito completo', rubro: 'Rotisería', grupo: 'Comidas y restaurantes',
        config: { layout: 'card', themeId: 'pizzeria', font: 'bold', title: 'Lomito completo', subtitle: 'con papas fritas', price: '$ 14.000' },
    },
    {
        id: 'pastas', name: 'Pastas caseras', rubro: 'Restaurante', grupo: 'Comidas y restaurantes',
        config: { layout: 'menu', themeId: 'crema', font: 'elegant', title: 'Pastas', subtitle: 'caseras', showDetails: true },
        sampleList: [
            { name: 'Ñoquis', price: '$ 9.000', detail: 'de papa' },
            { name: 'Sorrentinos', price: '$ 11.000', detail: 'jamón y queso' },
            { name: 'Ravioles', price: '$ 10.000', detail: 'de verdura' },
            { name: 'Tallarines', price: '$ 8.500' },
            { name: 'Lasaña', price: '$ 12.000', detail: 'bolognesa' },
        ],
    },
    {
        id: 'sushi', name: 'Sushi para compartir', rubro: 'Restaurante', grupo: 'Comidas y restaurantes',
        config: { layout: 'split', themeId: 'noche', font: 'elegant', badge: 'DELIVERY', title: 'Sushi para compartir', subtitle: '30 piezas', price: '$ 28.000' },
    },
    {
        id: 'envios', name: 'Hacemos envíos', rubro: 'Restaurante', grupo: 'Comidas y restaurantes',
        config: { layout: 'band', themeId: 'blanco', font: 'bold', badge: 'DELIVERY', title: 'Hacemos envíos a domicilio', subtitle: 'pedí por WhatsApp' },
    },
    {
        id: 'happy-hour', name: 'Happy hour', rubro: 'Bar', grupo: 'Bares y cervecerías',
        config: { layout: 'card', themeId: 'neon', font: 'bold', tilt: true, title: 'Happy hour 2×1', subtitle: 'en tragos y pintas', autoBadge: true, schedule: { showFrom: '19:00', showTo: '21:00' }, animation: 'pop' },
    },
    {
        id: 'pintas', name: 'Cervezas tiradas', rubro: 'Cervecería', grupo: 'Bares y cervecerías',
        config: { layout: 'menu', themeId: 'cerveza', font: 'bold', title: 'Cervezas', subtitle: 'tiradas', showDetails: true },
        sampleList: [
            { name: 'Golden', price: '$ 4.500', detail: 'pinta' },
            { name: 'Honey', price: '$ 4.800', detail: 'pinta' },
            { name: 'IPA', price: '$ 5.500', detail: 'pinta' },
            { name: 'Scottish', price: '$ 5.000', detail: 'pinta' },
            { name: 'Stout', price: '$ 5.200', detail: 'pinta' },
            { name: 'APA', price: '$ 5.300', detail: 'pinta' },
        ],
    },
    {
        id: 'tragos', name: 'Tragos', rubro: 'Bar', grupo: 'Bares y cervecerías',
        config: { layout: 'menu', themeId: 'neon', font: 'retro', title: 'Tragos', subtitle: 'de la casa' },
        sampleList: [
            { name: 'Fernet con coca', price: '$ 6.000' },
            { name: 'Gin tonic', price: '$ 7.500' },
            { name: 'Aperol spritz', price: '$ 7.800' },
            { name: 'Mojito', price: '$ 7.000' },
            { name: 'Campari', price: '$ 6.500' },
            { name: 'Daiquiri', price: '$ 7.000' },
        ],
    },
    {
        id: 'picada', name: 'Picada + pintas', rubro: 'Cervecería', grupo: 'Bares y cervecerías',
        config: { layout: 'split', themeId: 'cerveza', font: 'bold', badge: 'PARA DOS', title: 'Picada + 2 pintas', subtitle: 'fiambres, quesos y papas', price: '$ 22.000' },
    },
    {
        id: 'partido', name: 'Partido en pantalla gigante', rubro: 'Bar', grupo: 'Bares y cervecerías',
        config: { layout: 'band', themeId: 'noche', font: 'bold', badge: 'HOY', title: 'Partido en pantalla gigante', subtitle: 'reservá tu mesa' },
    },
    {
        id: 'musica-vivo', name: 'Música en vivo', rubro: 'Bar', grupo: 'Bares y cervecerías',
        config: { layout: 'card', themeId: 'neon', font: 'retro', badge: 'SÁBADO', title: 'Música en vivo', subtitle: 'desde las 22 h', animation: 'fade' },
    },
    {
        id: 'helados-precios', name: 'Helados', rubro: 'Heladería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'menu', themeId: 'helado', font: 'playful', title: 'Helados', subtitle: 'artesanales', showDetails: true },
        sampleList: [
            { name: '1/4 kg', price: '$ 6.500', detail: '2 gustos' },
            { name: '1/2 kg', price: '$ 11.500', detail: '3 gustos' },
            { name: '1 kg', price: '$ 21.000', detail: '4 gustos' },
            { name: 'Cucurucho', price: '$ 3.500' },
            { name: 'Vasito', price: '$ 3.000' },
            { name: 'Batido', price: '$ 5.500' },
        ],
    },
    {
        id: 'gusto-del-mes', name: 'Gusto del mes', rubro: 'Heladería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'split', themeId: 'helado', font: 'playful', badge: 'NUEVO', title: 'Pistacho con almendras', subtitle: 'el gusto del mes' },
    },
    {
        id: 'kilo-promo', name: 'Promo kilo', rubro: 'Heladería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'card', themeId: 'rosa', font: 'playful', tilt: true, badge: 'PROMO', title: '1 kg + 1/4 de regalo', price: '$ 21.000', pricePulse: true },
    },
    {
        id: 'jueves-2x1', name: 'Jueves 2×1', rubro: 'Heladería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'card', themeId: 'rosa', font: 'elegant', tilt: true, badge: 'CUCURUCHOS', title: 'Jueves 2×1', subtitle: 'todos los gustos' },
    },
    {
        id: 'carta-manana', name: 'Carta de la mañana', rubro: 'Cafetería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'menu', themeId: 'noche', font: 'modern', title: 'Carta', subtitle: 'de la mañana', showDetails: true },
        sampleList: [
            { name: 'Café con leche', price: '$ 2.800', detail: 'taza grande' },
            { name: 'Medialunas', price: '$ 3.300', detail: 'manteca o grasa · x3' },
            { name: 'Tostado', price: '$ 5.400', detail: 'jamón y queso' },
            { name: 'Licuado', price: '$ 4.200', detail: 'frutilla y banana' },
            { name: 'Exprimido', price: '$ 3.600', detail: 'naranja · 400 cc' },
        ],
    },
    {
        id: 'mitad-cafe', name: 'Para acompañar', rubro: 'Cafetería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'split', themeId: 'cafe', font: 'modern', badge: 'HOY', title: 'Para acompañar la música', price: '$ 3.900' },
        sampleList: [
            { name: 'Café', price: '$ 1.800' },
            { name: 'Medialuna', price: '$ 900' },
            { name: 'Tostado', price: '$ 3.500' },
            { name: 'Jugo de naranja', price: '$ 3.100' },
        ],
    },
    {
        id: 'promo-tarde', name: 'Promo de la tarde', rubro: 'Cafetería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'card', themeId: 'noche', font: 'modern', title: 'Café + medialuna', subtitle: 'la promo de la tarde', price: '$ 3.900',
            autoBadge: true, schedule: { showDays: [1, 2, 3, 4, 5], showFrom: '15:00', showTo: '19:00' } },
    },
    {
        id: 'cafe-especialidad', name: 'Café de especialidad', rubro: 'Cafetería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'menu', themeId: 'crema', font: 'retro', title: 'Café', subtitle: 'de especialidad' },
        sampleList: [
            { name: 'Espresso', price: '$ 2.500' },
            { name: 'Cortado', price: '$ 2.800' },
            { name: 'Latte', price: '$ 3.500' },
            { name: 'Flat white', price: '$ 3.800' },
            { name: 'Cold brew', price: '$ 4.200' },
            { name: 'Medialuna', price: '$ 1.000' },
        ],
    },
    {
        id: 'desayunos', name: 'Desayunos y meriendas', rubro: 'Cafetería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'card', themeId: 'cafe', font: 'elegant', badge: 'TODO EL DÍA', title: 'Desayunos y meriendas' },
    },
    {
        id: 'tortas', name: 'Tortas por encargo', rubro: 'Pastelería', grupo: 'Heladerías y cafeterías',
        config: { layout: 'split', themeId: 'rosa', font: 'retro', title: 'Tortas por encargo', subtitle: 'pedila con 48 h', price: 'desde $ 25.000' },
    },
    {
        id: 'nueva-temporada', name: 'Nueva temporada', rubro: 'Tienda de ropa', grupo: 'Moda y accesorios',
        config: { layout: 'split', themeId: 'moda', font: 'luxury', badge: 'NUEVA COLECCIÓN', title: 'Primavera · Verano', subtitle: 'ya en el local', animation: 'fade' },
    },
    {
        id: 'liquidacion', name: 'Liquidación', rubro: 'Tienda de ropa', grupo: 'Moda y accesorios',
        config: { layout: 'card', themeId: 'sale', font: 'bold', tilt: true, badge: 'LIQUIDACIÓN', title: 'Hasta 50% OFF', subtitle: 'en toda la tienda', animation: 'pop' },
    },
    {
        id: 'cuotas', name: 'Cuotas sin interés', rubro: 'Tienda de ropa', grupo: 'Moda y accesorios',
        config: { layout: 'band', themeId: 'nude', font: 'modern', badge: 'TODOS LOS BANCOS', title: '3 y 6 cuotas sin interés', subtitle: 'con tarjetas de crédito' },
    },
    {
        id: 'accesorios', name: 'Carteras y bijou', rubro: 'Accesorios', grupo: 'Moda y accesorios',
        config: { layout: 'split', themeId: 'nude', font: 'luxury', badge: 'NUEVOS INGRESOS', title: 'Carteras y bijou', price: 'desde $ 15.000' },
    },
    {
        id: 'jeans', name: 'Jeans', rubro: 'Tienda de ropa', grupo: 'Moda y accesorios',
        config: { layout: 'menu', themeId: 'moda', font: 'bold', title: 'Jeans', subtitle: 'todos los talles' },
        sampleList: [
            { name: 'Mom', price: '$ 39.000' },
            { name: 'Recto', price: '$ 37.000' },
            { name: 'Wide leg', price: '$ 42.000' },
            { name: 'Skinny', price: '$ 35.000' },
            { name: 'Bermuda', price: '$ 28.000' },
        ],
    },
    {
        id: 'zapatillas', name: 'Zapatillas', rubro: 'Calzado', grupo: 'Moda y accesorios',
        config: { layout: 'card', themeId: 'moda', font: 'bold', badge: 'NUEVAS', title: 'Zapatillas urbanas', subtitle: 'del 35 al 45', price: '$ 69.900' },
    },
    {
        id: 'ofertas-semana', name: 'Ofertas de la semana', rubro: 'Almacén', grupo: 'Almacén y minoristas',
        config: { layout: 'menu', themeId: 'almacen', font: 'bold', title: 'Ofertas', subtitle: 'de la semana' },
        sampleList: [
            { name: 'Yerba 1 kg', price: '$ 4.900' },
            { name: 'Aceite 1,5 L', price: '$ 5.200' },
            { name: 'Fideos 500 g', price: '$ 1.400' },
            { name: 'Arroz 1 kg', price: '$ 1.800' },
            { name: 'Leche 1 L', price: '$ 1.500' },
            { name: 'Azúcar 1 kg', price: '$ 1.300' },
        ],
    },
    {
        id: 'fiambres', name: 'Fiambrería', rubro: 'Almacén', grupo: 'Almacén y minoristas',
        config: { layout: 'menu', themeId: 'crema', font: 'modern', title: 'Fiambrería', subtitle: 'por 1/4 kg' },
        sampleList: [
            { name: 'Jamón cocido', price: '$ 4.500' },
            { name: 'Queso de máquina', price: '$ 4.200' },
            { name: 'Salame', price: '$ 5.000' },
            { name: 'Mortadela', price: '$ 2.800' },
            { name: 'Paleta', price: '$ 3.500' },
        ],
    },
    {
        id: 'oferta-dia', name: 'Oferta del día', rubro: 'Almacén', grupo: 'Almacén y minoristas',
        config: { layout: 'split', themeId: 'almacen', font: 'bold', badge: 'OFERTA', title: 'Yerba 1 kg', subtitle: 'hasta agotar stock', price: '$ 4.900', pricePulse: true },
    },
    {
        id: 'precio-grande', name: 'Oferta', rubro: 'Comercio', grupo: 'Almacén y minoristas',
        config: { layout: 'split', themeId: 'blanco', font: 'impact', badge: 'OFERTA', title: 'Hamburguesa con papas', price: '$ 10.000', subtitle: 'solo por hoy' },
    },
    {
        id: 'medios-pago', name: 'Medios de pago', rubro: 'Comercio', grupo: 'Almacén y minoristas',
        config: { layout: 'band', themeId: 'blanco', font: 'modern', badge: 'ACEPTAMOS', title: 'Débito, crédito, QR y transferencia', subtitle: 'pagá como quieras' },
    },
    {
        id: 'kiosco', name: 'Kiosco', rubro: 'Kiosco', grupo: 'Almacén y minoristas',
        config: { layout: 'menu', themeId: 'mar', font: 'bold', title: 'Kiosco', subtitle: 'bebidas y golosinas' },
        sampleList: [
            { name: 'Gaseosa 500 ml', price: '$ 1.800' },
            { name: 'Agua 500 ml', price: '$ 1.200' },
            { name: 'Alfajor', price: '$ 1.200' },
            { name: 'Chocolate', price: '$ 2.500' },
            { name: 'Papas fritas', price: '$ 2.200' },
            { name: 'Energizante', price: '$ 2.800' },
        ],
    },
    {
        id: 'lanzamiento-juego', name: 'Lanzamiento', rubro: 'Videojuegos', grupo: 'Videojuegos y electrónica',
        config: { layout: 'split', themeId: 'gamer', font: 'gamer', badge: 'YA DISPONIBLE', title: 'El juego del año', subtitle: 'reservá tu copia', price: '$ 89.999', animation: 'slide' },
    },
    {
        id: 'consolas', name: 'Consolas', rubro: 'Videojuegos', grupo: 'Videojuegos y electrónica',
        config: { layout: 'menu', themeId: 'gamer', font: 'gamer', title: 'Consolas', subtitle: 'y accesorios' },
        sampleList: [
            { name: 'PlayStation 5', price: '$ 999.999' },
            { name: 'Xbox Series S', price: '$ 699.999' },
            { name: 'Nintendo Switch', price: '$ 649.999' },
            { name: 'Joystick extra', price: '$ 99.999' },
            { name: 'Auriculares gamer', price: '$ 79.999' },
        ],
    },
    {
        id: 'torneo', name: 'Torneo', rubro: 'Videojuegos', grupo: 'Videojuegos y electrónica',
        config: { layout: 'card', themeId: 'gamer', font: 'gamer', tilt: true, badge: 'SÁBADO 18 H', title: 'Torneo de fútbol', subtitle: 'inscripción en el local', price: '$ 10.000' },
    },
    {
        id: 'celulares', name: 'Celulares en cuotas', rubro: 'Electrónica', grupo: 'Videojuegos y electrónica',
        config: { layout: 'split', themeId: 'electro', font: 'modern', badge: 'CUOTAS', title: 'Celulares de última generación', price: '12 × $ 49.999' },
    },
    {
        id: 'tecnologia', name: 'Tecnología', rubro: 'Electrónica', grupo: 'Videojuegos y electrónica',
        config: { layout: 'menu', themeId: 'electro', font: 'modern', title: 'Tecnología', subtitle: 'precios de contado' },
        sampleList: [
            { name: 'Smart TV 50"', price: '$ 549.999' },
            { name: 'Notebook 14"', price: '$ 799.999' },
            { name: 'Auriculares bluetooth', price: '$ 39.999' },
            { name: 'Parlante portátil', price: '$ 59.999' },
            { name: 'Cargador rápido', price: '$ 19.999' },
            { name: 'Smartwatch', price: '$ 89.999' },
        ],
    },
    {
        id: 'servicio-tecnico', name: 'Servicio técnico', rubro: 'Electrónica', grupo: 'Videojuegos y electrónica',
        config: { layout: 'band', themeId: 'electro', font: 'modern', badge: 'SERVICIO TÉCNICO', title: 'Reparamos celulares y notebooks', subtitle: 'presupuesto sin cargo' },
    },
    {
        id: 'vinos', name: 'Vinos', rubro: 'Vinoteca', grupo: 'Vinotecas',
        config: { layout: 'menu', themeId: 'vino', font: 'luxury', title: 'Vinos', subtitle: 'selección de la casa', showDetails: true },
        sampleList: [
            { name: 'Malbec reserva', price: '$ 18.000', detail: 'Mendoza' },
            { name: 'Cabernet sauvignon', price: '$ 16.500', detail: 'San Juan' },
            { name: 'Blend de tintos', price: '$ 21.000', detail: 'Valle de Uco' },
            { name: 'Torrontés', price: '$ 12.000', detail: 'Salta' },
            { name: 'Espumante', price: '$ 15.000', detail: 'extra brut' },
        ],
    },
    {
        id: 'vino-semana', name: 'Vino de la semana', rubro: 'Vinoteca', grupo: 'Vinotecas',
        config: { layout: 'split', themeId: 'vino', font: 'luxury', badge: 'RECOMENDADO', title: 'Malbec reserva 2022', subtitle: 'Valle de Uco', price: '$ 18.000' },
    },
    {
        id: 'degustacion', name: 'Degustación', rubro: 'Vinoteca', grupo: 'Vinotecas',
        config: { layout: 'card', themeId: 'vino', font: 'elegant', badge: 'VIERNES 20 H', title: 'Degustación de vinos', subtitle: 'cupos limitados', price: '$ 15.000' },
    },
    {
        id: 'seis-botellas', name: 'Llevá 6, pagá 5', rubro: 'Vinoteca', grupo: 'Vinotecas',
        config: { layout: 'band', themeId: 'vino', font: 'luxury', badge: 'PROMO', title: 'Llevá 6 y pagá 5', subtitle: 'en vinos seleccionados' },
    },
    {
        id: 'gym-planes', name: 'Planes', rubro: 'Gimnasio', grupo: 'Gimnasios',
        config: { layout: 'menu', themeId: 'fuerza', font: 'bold', title: 'Planes', subtitle: 'por mes' },
        sampleList: [
            { name: 'Pase libre', price: '$ 45.000' },
            { name: '3 veces por semana', price: '$ 35.000' },
            { name: 'Funcional', price: '$ 30.000' },
            { name: 'Spinning', price: '$ 28.000' },
            { name: 'Clase suelta', price: '$ 6.000' },
        ],
    },
    {
        id: 'clase-sala', name: 'Clases y sala libre', rubro: 'Gimnasio', grupo: 'Gimnasios',
        config: { layout: 'card', themeId: 'lima', font: 'impact', tilt: true, title: 'Clases y sala libre', price: '$ 45.000', subtitle: 'por mes' },
    },
    {
        id: 'gym-inscripcion', name: 'Inscripción sin cargo', rubro: 'Gimnasio', grupo: 'Gimnasios',
        config: { layout: 'split', themeId: 'fuerza', font: 'bold', badge: 'ESTE MES', title: 'Inscripción sin cargo', subtitle: 'empezá hoy', animation: 'slide' },
    },
    {
        id: 'gym-amigo', name: 'Entrená con un amigo', rubro: 'Gimnasio', grupo: 'Gimnasios',
        config: { layout: 'card', themeId: 'fuerza', font: 'bold', tilt: true, badge: '2×1', title: 'Entrená con un amigo', subtitle: 'y paguen uno solo', animation: 'pop' },
    },
    {
        id: 'living-cocina', name: 'Living y cocina', rubro: 'Inmobiliaria', grupo: 'Otros',
        config: { layout: 'band', themeId: 'mar', font: 'modern', badge: 'EN VENTA', title: 'Luz, balcón y cocina integrada', price: 'US$ 98.000' },
    },
    {
        id: 'optica', name: 'Sol, receta y control', rubro: 'Óptica', grupo: 'Otros',
        config: { layout: 'band', themeId: 'crema', font: 'elegant', badge: 'ÓPTICA', title: 'Sol, receta y control visual', subtitle: 'turnos sin espera' },
    },
];

export function configFromTemplate(t: PosterTemplate, format: PosterFormat): PosterConfig {
    return {
        version: 1,
        format,
        listColumns: 'auto',
        showDetails: true,
        durationS: 10,
        ...t.config,
        photos: t.config.photos || [],
    };
}

// Las playlists que usan este cartel, con su configuración nueva. (Las playlists
// guardan una copia de la app: al editar el cartel hay que actualizarla para que
// las pantallas muestren la versión nueva.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function playlistsWithNewMetadata(campaigns: any[], mediaId: string, metadata: unknown, name: string): { id: string; items_json: unknown }[] {
    const changed: { id: string; items_json: unknown }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches = (item: any) => !!item && item.source_id === mediaId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fix = (item: any) => (matches(item) ? { ...item, metadata, content: name } : item);
    for (const c of campaigns) {
        const data = c?.items_json;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPosterItem = (item: any) => item?.metadata?.appId === POSTER_APP_ID;

// ── Lista de precios dentro del cartel ──
export interface PosterListRow { name: string; detail?: string; price: string }
type Row = PosterListRow;

// Ancho aproximado de un texto en negrita (en "em").
const NAME_EM = 0.66;
const PRICE_EM = 0.64;

// Tamaño de letra y columnas para que la lista entre: los nombres largos pasan
// a dos renglones antes de cortarse, y "columnas solas" elige lo que deja la
// letra más grande.
export function fitList(rows: Row[], opts: {
    width: number; height: number; u: number; maxSize: number; minSize: number;
    columns: 'auto' | 1 | 2; details: boolean;
}): { size: number; cols: number } {
    const { width, height, u, maxSize, minSize, details } = opts;
    const candidates = opts.columns === 'auto' ? (rows.length >= 4 && width / u > 60 ? [1, 2] : [1]) : [opts.columns];
    let best = { size: minSize, cols: candidates[0] };
    let bestFits = false;
    for (const cols of candidates) {
        const gapW = 3 * u;
        const colW = (width - (cols - 1) * gapW) / cols;
        const perCol = Math.ceil(rows.length / cols);
        const columns: Row[][] = [];
        for (let c = 0; c < cols; c++) columns.push(rows.slice(c * perCol, (c + 1) * perCol));
        const heightAt = (s: number) => {
            let tallest = 0;
            for (const col of columns) {
                let h = 0;
                for (const r of col) {
                    const priceW = r.price.length * PRICE_EM * s;
                    const nameW = Math.max(s * 2, colW - priceW - 0.6 * s);
                    const lines = Math.min(2, Math.max(1, Math.ceil((r.name.length * NAME_EM * s) / nameW)));
                    h += (lines * 1.15 + 0.64) * s + (details && r.detail ? 0.62 * 1.25 * s : 0) + 1;
                }
                tallest = Math.max(tallest, h);
            }
            return tallest;
        };
        const nameFits = (s: number) => columns.every(col => col.every(r => {
            const priceW = r.price.length * PRICE_EM * s;
            const nameW = Math.max(s * 2, colW - priceW - 0.6 * s);
            // Entra en dos renglones y ninguna palabra queda cortada por la mitad.
            const longestWord = r.name.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
            return r.name.length * NAME_EM * s <= nameW * 2 && longestWord * NAME_EM * s <= nameW;
        }));
        let s = maxSize;
        while (s > minSize && (heightAt(s) > height || !nameFits(s))) s *= 0.95;
        s = Math.max(minSize, s);
        const fits = heightAt(s) <= height && nameFits(s);
        if ((fits && !bestFits) || (fits === bestFits && s > best.size * 1.04)) {
            best = { size: s, cols };
            bestFits = fits;
        }
    }
    return best;
}

