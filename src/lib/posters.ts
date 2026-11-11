// Carteles: avisos armados con una plantilla (promo, carta, oferta) que se
// dibujan en vivo en la TV. Se guardan como una app más de Medios
// (type 'app', metadata { appId: 'poster', config: PosterConfig }), así entran
// en playlists, "Enviar a pantallas", Espejo / Olas / Mosaico y la programación.
// Las listas de precios se leen en vivo (ver lib/priceLists).

export const POSTER_APP_ID = 'poster';

export type PosterLayout = 'split' | 'card' | 'band' | 'menu';
export type PosterFormat = '16:9' | '9:16' | '21:9' | '4:3' | '1:1';
export type PosterFont = 'modern' | 'elegant' | 'impact' | 'script' | 'simple';

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
    styles?: { title?: TextStyle; list?: TextStyle; price?: TextStyle };
    // Cuándo aparece (mismas claves que las reglas de cada item de playlist).
    schedule?: { showDays?: number[]; showFrom?: string; showTo?: string } | null;
    autoBadge?: boolean;      // "DE 15 A 19 H" según el horario
    durationS?: number;
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
];

export const themeOf = (id?: string) => POSTER_THEMES.find(t => t.id === id) || POSTER_THEMES[0];

// Letras ya cargadas en index.html.
export const POSTER_FONTS: Record<PosterFont, { label: string; family: string; weight: number }> = {
    modern: { label: 'Moderna', family: "'Montserrat', 'Inter', sans-serif", weight: 800 },
    elegant: { label: 'Elegante', family: "'Playfair Display', Georgia, serif", weight: 700 },
    impact: { label: 'Impacto', family: "'Anton', 'Montserrat', sans-serif", weight: 400 },
    script: { label: 'Manuscrita', family: "'Pinyon Script', cursive", weight: 400 },
    simple: { label: 'Simple', family: "'Inter', sans-serif", weight: 700 },
};

export const POSTER_LAYOUTS: Record<PosterLayout, { label: string; description: string }> = {
    split: { label: 'Mitad y mitad', description: 'Foto a un lado y la información al otro.' },
    card: { label: 'Fotos con tarjeta', description: 'Una o dos fotos y una tarjeta encima.' },
    band: { label: 'Foto con franja', description: 'Foto grande y una franja con el texto.' },
    menu: { label: 'Carta', description: 'La lista de precios grande, con foto al costado.' },
};

export const POSTER_FORMATS: { id: PosterFormat; label: string; ratio: number; hint: string }[] = [
    { id: '16:9', label: 'Tele horizontal · 16:9', ratio: 16 / 9, hint: 'La más común.' },
    { id: '9:16', label: 'Tele vertical · 9:16', ratio: 9 / 16, hint: 'TV parada o el exhibidor de mostrador.' },
    { id: '21:9', label: 'Pantalla larga · 21:9', ratio: 21 / 9, hint: 'La pantalla larga arriba del mostrador.' },
    { id: '4:3', label: 'Tele clásica · 4:3', ratio: 4 / 3, hint: 'Monitores viejos.' },
    { id: '1:1', label: 'Cuadrada · 1:1', ratio: 1, hint: 'Pantallas cuadradas.' },
];

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

export interface PosterTemplate {
    id: string;
    name: string;
    rubro: string;
    config: Omit<PosterConfig, 'version' | 'format' | 'photos'> & { photos?: string[] };
    // Lista de ejemplo para la vista previa (hasta que se vincule una de verdad).
    sampleList?: { name: string; price: string; detail?: string }[];
}

// Plantillas iniciales: formas de armado × colores × textos de ejemplo por rubro.
export const POSTER_TEMPLATES: PosterTemplate[] = [
    {
        id: 'carta-manana', name: 'Carta de la mañana', rubro: 'Cafetería',
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
        id: 'mitad-cafe', name: 'Para acompañar', rubro: 'Cafetería',
        config: { layout: 'split', themeId: 'cafe', font: 'modern', badge: 'HOY', title: 'Para acompañar la música', price: '$ 3.900' },
        sampleList: [
            { name: 'Café', price: '$ 1.800' }, { name: 'Medialuna', price: '$ 900' },
            { name: 'Tostado', price: '$ 3.500' }, { name: 'Jugo de naranja', price: '$ 3.100' },
        ],
    },
    {
        id: 'promo-tarde', name: 'Promo de la tarde', rubro: 'Cafetería',
        config: {
            layout: 'card', themeId: 'noche', font: 'modern', title: 'Café + medialuna', subtitle: 'la promo de la tarde', price: '$ 3.900',
            autoBadge: true, schedule: { showDays: [1, 2, 3, 4, 5], showFrom: '15:00', showTo: '19:00' },
        },
    },
    {
        id: 'pizzas', name: 'Pizzas', rubro: 'Pizzería',
        config: { layout: 'menu', themeId: 'pizzeria', font: 'impact', title: 'Pizzas', subtitle: 'a la piedra', showDetails: true },
        sampleList: [
            { name: 'Muzzarella', price: '$ 5.000', detail: '8 porciones' }, { name: 'Napolitana', price: '$ 6.000' },
            { name: 'Fugazzeta', price: '$ 6.500' }, { name: 'Calabresa', price: '$ 7.000' },
            { name: 'Especial', price: '$ 7.500', detail: 'jamón y morrones' }, { name: 'Faina', price: '$ 1.500' },
        ],
    },
    {
        id: 'jueves-2x1', name: 'Jueves 2×1', rubro: 'Heladería',
        config: { layout: 'card', themeId: 'rosa', font: 'elegant', tilt: true, badge: 'CUCURUCHOS', title: 'Jueves 2×1', subtitle: 'todos los gustos' },
    },
    {
        id: 'clase-sala', name: 'Clase y sala', rubro: 'Gimnasio',
        config: { layout: 'card', themeId: 'lima', font: 'impact', tilt: true, title: 'Clases y sala libre', price: '$ 45.000', subtitle: 'por mes' },
    },
    {
        id: 'living-cocina', name: 'Living y cocina', rubro: 'Inmobiliaria',
        config: { layout: 'band', themeId: 'mar', font: 'modern', badge: 'EN VENTA', title: 'Luz, balcón y cocina integrada', price: 'US$ 98.000' },
    },
    {
        id: 'optica', name: 'Sol, receta y control', rubro: 'Óptica',
        config: { layout: 'band', themeId: 'crema', font: 'elegant', badge: 'ÓPTICA', title: 'Sol, receta y control visual', subtitle: 'turnos sin espera' },
    },
    {
        id: 'precio-grande', name: 'Oferta', rubro: 'Comercio',
        config: { layout: 'split', themeId: 'blanco', font: 'impact', badge: 'OFERTA', title: 'Hamburguesa con papas', price: '$ 10.000', subtitle: 'solo por hoy' },
    },
    {
        id: 'desayunos', name: 'Desayunos y meriendas', rubro: 'Cafetería',
        config: { layout: 'card', themeId: 'cafe', font: 'elegant', badge: 'TODO EL DÍA', title: 'Desayunos y meriendas' },
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
