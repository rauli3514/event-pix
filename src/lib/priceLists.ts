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

export interface PriceList {
    id: string;
    commerce_id: string;
    name: string;
    items: PriceListItem[];
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

// Texto por nombre para lo que usa etiquetas (igual que display_device_label_texts).
export function priceListTexts(lists: PriceList[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const list of lists) {
        for (const item of list.items || []) {
            const key = normalizeItemName(item.name);
            if (!key) continue;
            map.set(key, item.available === false ? 'Sin stock' : formatPrice(item.price));
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

