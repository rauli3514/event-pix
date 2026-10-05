// Lector mínimo de planillas Excel (.xlsx) sin librerías: un .xlsx es un ZIP con XML
// adentro. Se lee la primera hoja como una tabla de textos. Usa DecompressionStream
// del navegador (WebView de Android 80+ / Chrome 80+).

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

interface ZipEntry { name: string; method: number; size: number; offset: number }

function zipEntries(buf: Uint8Array): ZipEntry[] {
  // Fin del directorio central: firma 0x06054b50 cerca del final
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (u32(buf, i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('El archivo no es un Excel válido');
  const count = u16(buf, end + 10);
  let p = u32(buf, end + 16);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(buf, p) !== 0x02014b50) break;
    const method = u16(buf, p + 10);
    const size = u32(buf, p + 20);
    const nameLen = u16(buf, p + 28), extraLen = u16(buf, p + 30), commentLen = u16(buf, p + 32);
    const offset = u32(buf, p + 42);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: Uint8Array, e: ZipEntry): Promise<string> {
  const nameLen = u16(buf, e.offset + 26), extraLen = u16(buf, e.offset + 28);
  const start = e.offset + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error('Formato de Excel no soportado');
  if (typeof DecompressionStream === 'undefined') throw new Error('Este equipo no puede leer Excel: guardalo como CSV');
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}

/** Índice de columna desde la referencia de celda ("C12" → 2). */
const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Primera hoja del Excel como filas de texto. */
export async function readXlsx(file: Blob): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = zipEntries(buf);
  const find = (name: string) => entries.find(e => e.name === name);
  const parser = new DOMParser();

  const shared: string[] = [];
  const sst = find('xl/sharedStrings.xml');
  if (sst) {
    const doc = parser.parseFromString(await readEntry(buf, sst), 'application/xml');
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent ?? '').join(''));
    }
  }

  const sheet = find('xl/worksheets/sheet1.xml') ?? entries.find(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sheet) throw new Error('El Excel no tiene hojas');
  const doc = parser.parseFromString(await readEntry(buf, sheet), 'application/xml');
  const rows: string[][] = [];
  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const index = ref ? colIndex(ref) : cells.length;
      const type = c.getAttribute('t');
      let value = '';
      if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map(t => t.textContent ?? '').join('');
      else {
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        value = type === 's' ? shared[Number(v)] ?? '' : v;
      }
      while (cells.length < index) cells.push('');
      cells[index] = value.trim();
    }
    rows.push(cells);
  }
  return rows;
}

/** CSV de Excel (separado por coma o punto y coma, con comillas). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}
