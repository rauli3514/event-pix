// Fudo: traer las categorías del menú online (menu.fu.do/<local>) como listas
// de precios. La lectura la hace la base (ver la migración display_fudo_import).

export interface FudoCategory { id: number; name: string; parentId: number | null; position: number }
export interface FudoProduct { id: number; name: string; price: number | null; available: boolean; categoryId: number | null; position: number }
export interface FudoMenu { categories: FudoCategory[]; products: FudoProduct[] }

// Lo que guarda una lista que viene de Fudo.
export interface FudoSource {
    type: 'fudo';
    slug: string;
    categoryId: number;
    categoryName?: string;
    parentName?: string | null;
    syncedAt?: string;
    lastError?: string;
    lastErrorAt?: string;
}

// Colores para separar las categorías (uno distinto por lista).
export const LIST_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#e11d48', '#a855f7', '#eab308', '#14b8a6', '#ec4899', '#64748b', '#84cc16', '#06b6d4', '#f43f5e'];

// "https://menu.fu.do/yoca", "menu.fu.do/yoca/empanadas", "yoca" → "yoca".
export function parseFudoSlug(input: string): string | null {
    const raw = (input || '').trim();
    if (!raw) return null;
    const m = /(?:^|\/\/|\b)menu\.fu\.do\/([^/?#\s]+)/i.exec(raw);
    const slug = m ? m[1] : /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(raw) ? raw : null;
    return slug && /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(slug) ? slug : null;
}

export function isFudoList<T extends { source?: unknown }>(list: T | null | undefined): list is T & { source: FudoSource } {
    return !!list && typeof list.source === 'object' && (list.source as FudoSource | null)?.type === 'fudo';
}

export interface FudoGroup {
    parent: string | null;
    categories: { category: FudoCategory; products: FudoProduct[] }[];
}

// Categorías con productos, agrupadas por la categoría de arriba ("EMPANADAS" › "solo horno").
export function fudoGroups(menu: FudoMenu): FudoGroup[] {
    const byId = new Map(menu.categories.map(c => [c.id, c]));
    const groups = new Map<string, FudoGroup>();
    for (const category of menu.categories) {
        const products = menu.products.filter(p => p.categoryId === category.id);
        if (!products.length) continue;
        const parent = category.parentId != null ? byId.get(category.parentId)?.name ?? null : null;
        const key = parent ?? '';
        if (!groups.has(key)) groups.set(key, { parent, categories: [] });
        groups.get(key)!.categories.push({ category, products });
    }
    return [...groups.values()];
}

// Mensaje para la persona según el error de la base.
export function fudoErrorText(message?: string): string {
    const m = message || '';
    if (/fudo_not_found|fudo_bad_slug/.test(m)) return 'No encontramos ese menú en Fudo. Revisá el link (por ejemplo menu.fu.do/tulocal).';
    if (/display_fudo_|PGRST202|does not exist|schema cache/i.test(m)) return 'Falta un paso en Supabase: correr supabase/migrations/20261115000000_display_fudo_import.sql (y activar la extensión "http").';
    if (/extensions\.http|http_request|function http/i.test(m)) return 'Falta activar la extensión "http" en Supabase (Database → Extensions).';
    if (/fudo_http_/.test(m)) return 'Fudo no respondió. Probá de nuevo en un rato.';
    return 'No se pudo leer el menú de Fudo. Probá de nuevo en un rato.';
}

// "hace 3 h", "hace 2 días".
export function timeAgo(iso?: string, now = Date.now()): string {
    if (!iso) return '';
    const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
    if (min < 1) return 'recién';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}
