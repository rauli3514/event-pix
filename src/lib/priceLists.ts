// Listas de precios ("Pizzas", "Oferta de la tarde"): renglones con nombre,
// aclaración y precio. Se editan en la página Listas de precios y llegan en vivo
// a las pantallas (ver la migración display_price_lists).

export interface PriceListItem {
    id: string;
    name: string;
    detail?: string;
    price: number | null;
    // false = "sin stock": no se muestra (o se marca) en las pantallas.
    available: boolean;
}

// Cambio temporal (descuento o aumento) de toda la lista: no toca los precios.
// Mientras está vigente se muestra el precio con el cambio (y en los carteles
// el original tachado); al pasar endsAt vuelve solo.
export interface PriceListPromo {
    percent: number;   // -10 = 10 % menos
    roundTo: number;   // redondeo hacia arriba ($ 1, 10, 50, 100, 500)
    startsAt: string;  // ISO
    endsAt: string;    // ISO
}

export interface PriceList {
    id: string;
    commerce_id: string;
    name: string;
    items: PriceListItem[];
    promo?: PriceListPromo | null;
    sort_order: number | null;
    created_at: string;
    updated_at: string;
}

export const newItemId = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `i${Date.now()}${Math.random().toString(36).slice(2, 8)}`);

export const emptyItem = (): PriceListItem => ({ id: newItemId(), name: '', detail: '', price: null, available: true });

// "$ 5.000", "$ 1.234,50" (formato argentino). Sin precio: "".
export function formatPrice(price: number | null | undefined): string {
    if (price === null || price === undefined || !Number.isFinite(price)) return '';
    const whole = Math.round(price) === price;
    return `$ ${price.toLocaleString('es-AR', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// Lo que escribe la gente: "5000", "5.000", "$ 5.000", "1.234,50", "12,5", "12.50".
export function parsePrice(raw: string): number | null {
    let s = (raw || '').replace(/[$\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) {
        // Coma decimal: los puntos son miles.
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes('.')) {
        const parts = s.split('.');
        const last = parts[parts.length - 1];
        // "5.000" o "1.250.000": miles. "12.5" o "12.50": decimales.
        s = parts.length > 2 || last.length === 3 ? parts.join('') : s;
    }
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Pegar una lista de WhatsApp o Excel: un renglón por producto.
// "Muzzarella 5000", "Napolitana $ 6.000", "Fugazzeta; 6500", "Calabresa .... $7.000".
export function parsePastedList(text: string): PriceListItem[] {
    return (text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const m = line.match(/^(.*?)[\s;:\t·.\-–—]*\$?\s*(\d[\d.,]*)\s*$/);
            const name = (m ? m[1] : line).replace(/[\s;:\t·.\-–—$]+$/, '').trim();
            return { ...emptyItem(), name: name || line, price: m ? parsePrice(m[2]) : null };
        })
        .filter(item => item.name);
}

// Aumento (o rebaja) en %, redondeando hacia arriba al múltiplo elegido (1, 10, 50, 100…).
export function increasePrice(price: number | null, percent: number, roundTo: number): number | null {
    if (price === null || !Number.isFinite(price)) return price;
    const raised = price * (1 + percent / 100);
    const step = roundTo > 0 ? roundTo : 1;
    const rounded = Math.ceil(raised / step - 1e-9) * step;
    return Math.max(0, Math.round(rounded * 100) / 100);
}

export const normalizeItemName = (name?: string | null) => (name || '').toLowerCase().trim();

// El cambio temporal de la lista, si está vigente ahora.
export function activePromo(list: Pick<PriceList, 'promo'> | null | undefined, now = Date.now()): PriceListPromo | null {
    const promo = list?.promo;
    if (!promo || !promo.percent || !promo.endsAt) return null;
    // Solo cuenta el final: el inicio es cuando se activó (la hora de cada
    // equipo puede estar un poco corrida y no tiene que demorar el arranque).
    const ends = Date.parse(promo.endsAt);
    return Number.isFinite(ends) && now < ends ? promo : null;
}

// Precio con el cambio temporal (igual que display_promo_price en la base).
export const promoPrice = (price: number | null, promo: PriceListPromo | null) =>
    (promo ? increasePrice(price, promo.percent, promo.roundTo) : price);

// "hoy a las 20:30", "mañana a las 9:00", "el sábado 15/11 a las 22:00".
export const formatEnd = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (d.toDateString() === today.toDateString()) return `hoy a las ${time}`;
    if (d.toDateString() === tomorrow.toDateString()) return `mañana a las ${time}`;
    return `el ${d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' })} a las ${time}`;
};

// "-10 %", "+5 %".
export const formatPercent = (percent: number) => `${percent > 0 ? '+' : '−'}${Math.abs(percent)} %`;

// "2 h 15 min", "45 min", "1 día y 3 h".
export function formatRemaining(ms: number): string {
    const min = Math.max(1, Math.ceil(ms / 60000));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
    const d = Math.floor(h / 24), rh = h % 24;
    return `${d} ${d === 1 ? 'día' : 'días'}${rh ? ` y ${rh} h` : ''}`;
}

// Texto por nombre para lo que usa etiquetas (igual que display_device_label_texts).
export function priceListTexts(lists: PriceList[], now = Date.now()): Map<string, string> {
    const map = new Map<string, string>();
    for (const list of lists) {
        const promo = activePromo(list, now);
        for (const item of list.items || []) {
            const key = normalizeItemName(item.name);
            if (!key) continue;
            map.set(key, item.available === false ? 'Sin stock' : formatPrice(promoPrice(item.price, promo)));
        }
    }
    return map;
}

// Renglón en edición: el precio se escribe libre ("5.000", "$ 5000") y se
// interpreta al guardar.
export type DraftRow = PriceListItem & { priceText: string };

export const toDraftRows = (items: PriceListItem[]): DraftRow[] =>
    items.map(i => ({ ...i, priceText: formatPrice(i.price) }));

export const fromDraftRows = (rows: DraftRow[]): PriceListItem[] =>
    rows
        .filter(r => r.name.trim() || r.priceText.trim())
        .map(({ priceText, ...r }) => ({
            id: r.id,
            name: r.name.trim(),
            detail: (r.detail || '').trim() || undefined,
            price: parsePrice(priceText),
            available: r.available !== false,
        }));

