import { parseCsv, readXlsx } from '@/lib/xlsxReader';

// Ingreso VIP: lista de invitados del evento guardada en el equipo (funciona sin
// internet). Se carga desde un Excel o CSV con las columnas de la plantilla:
// Mesa, Nombre, Apellido y, opcionales, Trasnoche y Living (Sí / No).

export interface VipGuest {
  first: string;
  last: string;
  table: string;
  afterParty?: boolean;
  living?: boolean;
}

const KEY = 'kiosk_vip_guests';
/** Video de bienvenida (IndexedDB del equipo, ver kioskMedia). */
export const VIP_VIDEO_KEY = 'vip:video' as const;
export const VIP_TEMPLATE_URL = 'https://app.event-pix.com.ar/plantilla-invitados.xlsx';

export const getVipGuests = (): VipGuest[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveVipGuests = (list: VipGuest[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('kiosk-vip-changed'));
};

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const yes = (s: string | undefined) => /^(si|sí|s|x|yes|y|1|true|verdadero)$/i.test((s ?? '').trim());

/** Encabezados aceptados para cada dato (en minúscula y sin acentos). */
const HEADERS = {
  first: ['nombre', 'nombres', 'first_name', 'name'],
  last: ['apellido', 'apellidos', 'last_name', 'surname'],
  table: ['mesa', 'mesas', 'nro de mesa', 'nro mesa', 'n de mesa', 'numero de mesa', 'num mesa', 'n° mesa', 'n° de mesa', 'nº mesa', 'nº de mesa', 'table', 'ubicacion', 'lugar'],
  afterParty: ['trasnoche', 'after', 'after_party'],
  living: ['living', 'puff', 'sillon'],
} as const;

/** Lee el archivo (xlsx o csv) y devuelve los invitados válidos. */
export async function parseGuestFile(file: File): Promise<{ guests: VipGuest[]; skipped: number }> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const rows = isCsv ? parseCsv(await file.text()) : await readXlsx(file);
  const headerIndex = rows.findIndex(r => r.some(c => (HEADERS.first as readonly string[]).includes(normalize(c))));
  if (headerIndex < 0) throw new Error('No encontramos la columna "Nombre". Usá la plantilla.');
  const header = rows[headerIndex].map(normalize);
  const col = (names: readonly string[]) => header.findIndex(h => names.includes(h));
  const idx = {
    first: col(HEADERS.first), last: col(HEADERS.last), table: col(HEADERS.table),
    afterParty: col(HEADERS.afterParty), living: col(HEADERS.living),
  };
  const guests: VipGuest[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIndex + 1)) {
    const first = (r[idx.first] ?? '').trim();
    const last = idx.last >= 0 ? (r[idx.last] ?? '').trim() : '';
    if (!first && !last) { if (r.some(c => c?.trim())) skipped++; continue; }
    // Si el nombre completo vino en una sola columna, se separa el apellido
    let f = first, l = last;
    if (!l && f.includes(' ')) { const parts = f.split(/\s+/); l = parts.pop() ?? ''; f = parts.join(' '); }
    guests.push({
      first: f,
      last: l,
      table: idx.table >= 0 ? (r[idx.table] ?? '').trim() : '',
      afterParty: idx.afterParty >= 0 ? yes(r[idx.afterParty]) : false,
      living: idx.living >= 0 ? yes(r[idx.living]) : false,
    });
  }
  if (!guests.length) throw new Error('El archivo no tiene invitados');
  return { guests, skipped };
}

export const fullName = (g: VipGuest) => `${g.first} ${g.last}`.trim();

/** Invitados cuyo nombre o apellido coincide con lo escrito (desde 3 letras). */
export function searchGuests(list: VipGuest[], query: string): VipGuest[] {
  const q = normalize(query);
  if (q.length < 3) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return list
    .map(g => ({ g, name: normalize(fullName(g)) }))
    .filter(({ name }) => {
      const parts = name.split(/\s+/);
      // Cada palabra escrita tiene que ser el comienzo de alguna palabra del nombre
      return words.every(w => parts.some(p => p.startsWith(w))) || name.includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, 30)
    .map(x => x.g);
}

/** "Mesa 5" → "5"; otros nombres de ubicación quedan igual ("Mesa VIP" → "VIP"). */
export const tableLabel = (table: string) => table.replace(/^(mesa|table)\s*/i, '').trim();
export const isNumberedTable = (table: string) => /^\d+$/.test(tableLabel(table)) || /^mesa/i.test(table.trim());
