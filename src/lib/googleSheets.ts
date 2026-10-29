import { supabase } from '@/lib/supabase';

// Precios desde una planilla de Google: columna A = nombre de la etiqueta
// (igual que en la app de Etiquetas), columna B = lo que se muestra ("$ 9.500").
// La planilla tiene que estar compartida como "Cualquier persona con el enlace".

export interface SheetPrice {
    name: string;
    text: string;
}

// Link de la planilla (el de la barra del navegador, o el de "Publicar en la
// web") → link que devuelve la hoja en CSV. null si no es de Google Sheets.
export function toSheetCsvUrl(input: string): string | null {
    const url = input.trim();
    const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
    const published = url.match(/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)/);
    if (published) {
        return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv${gid ? `&gid=${gid}` : ''}`;
    }
    const normal = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
    if (normal) {
        return `https://docs.google.com/spreadsheets/d/${normal[1]}/export?format=csv&gid=${gid || '0'}`;
    }
    return null;
}

// CSV → filas (contempla comillas, comas dentro de comillas y saltos \r\n).
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(field); field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            rows.push(row); row = [];
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

const HEADER_NAMES = ['producto', 'productos', 'nombre', 'item', 'ítem', 'etiqueta', 'articulo', 'artículo', 'descripcion', 'descripción'];

export function rowsToPrices(rows: string[][]): SheetPrice[] {
    const prices: SheetPrice[] = [];
    rows.forEach((row, index) => {
        const name = (row[0] || '').trim();
        if (!name) return;
        if (index === 0 && HEADER_NAMES.includes(name.toLowerCase())) return;
        prices.push({ name, text: (row[1] || '').trim() });
    });
    return prices;
}

// Lee la planilla (a través de la función del servidor que ya usa el texto
// deslizante para los RSS, porque Google no deja leerla directo desde la web).
export async function fetchSheetPrices(sheetUrl: string): Promise<SheetPrice[]> {
    const csvUrl = toSheetCsvUrl(sheetUrl);
    if (!csvUrl) throw new Error('not_sheet');
    const { data, error } = await supabase.functions.invoke('fetch-rss', { body: { url: csvUrl } });
    if (error || data?.error) throw new Error('fetch_failed');
    const text = String(data?.xml ?? '');
    // Si no está compartida, Google devuelve la página de inicio de sesión.
    if (/^\s*</.test(text)) throw new Error('not_shared');
    return rowsToPrices(parseCsv(text));
}

export const SHEET_ERRORS: Record<string, string> = {
    not_sheet: 'Ese link no es de una planilla de Google.',
    not_shared: 'La planilla no está compartida: en Google Sheets tocá Compartir → "Cualquier persona con el enlace" → Lector.',
    fetch_failed: 'No se pudo leer la planilla. Revisá el link y probá de nuevo.',
};
