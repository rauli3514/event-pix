import { findActiveScheduleEvent, getEventWindow, scheduleDayKey, specialCoversDay } from '@/lib/displaySchedule';

// Cómo se ve una programación semanal en el calendario: los bloques de cada
// día, qué se ve en cada momento (la misma regla que la TV), los huecos con
// el contenido de siempre y las franjas que quedan tapadas por otra.

export interface ScheduleEvent {
    id: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    campaign_id?: string | null;
    media_id?: string | null;
    campaign?: { id: string; name: string } | null;
    media?: { id: string; name: string; type?: string; url?: string } | null;
    // Fecha especial (feriado, Navidad): vale solo esos días y le gana a la semana.
    date_from?: string | null;
    date_to?: string | null;
    label?: string | null;
}

export const MINUTES_PER_DAY = 24 * 60;
export const SLOT = 5; // precisión para calcular qué se ve (minutos)
export const SNAP = 15; // los bloques se acomodan de a 15 minutos

// Lunes primero (Date.getDay(): 0 = domingo).
export const WEEK = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LONG: Record<number, string> = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };
export const DAY_SHORT: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
export const DAY_LETTER: Record<number, string> = { 0: 'D', 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S' };

const pad = (n: number) => String(n).padStart(2, '0');

// 450 -> "07:30"; 1440 -> "24:00"
export const formatMinutes = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// Para guardar: "24:00" se guarda como "23:59" (la TV lo toma como medianoche).
export const toStoredTime = (min: number) => (min >= MINUTES_PER_DAY ? '23:59' : formatMinutes(min));

export const eventName = (ev: Pick<ScheduleEvent, 'campaign' | 'media'>) => ev.campaign?.name || ev.media?.name || 'Sin contenido';
export const eventAssetKey = (ev: Pick<ScheduleEvent, 'campaign_id' | 'media_id' | 'campaign' | 'media'>) =>
    ev.campaign_id || ev.campaign?.id || ev.media_id || ev.media?.id || 'none';

// Inicio y fin en minutos ("07:00"–"11:00" -> 420–660; fin 1440 = medianoche).
export function eventRange(ev: Pick<ScheduleEvent, 'start_time' | 'end_time'>) {
    const win = getEventWindow(ev);
    if (!win) return null;
    return { start: win.start, end: win.end, crossesMidnight: win.crossesMidnight };
}

// "07:00 a 11:00 h"
export function describeRange(ev: Pick<ScheduleEvent, 'start_time' | 'end_time'>) {
    const r = eventRange(ev);
    if (!r) return `${ev.start_time} a ${ev.end_time}`;
    return `${formatMinutes(r.start)} a ${formatMinutes(r.end)} h`;
}

// ---- Colores: uno por playlist o archivo, en orden de aparición ----

export const EVENT_COLORS = [
    { block: 'bg-indigo-500 border-indigo-300/40', dot: 'bg-indigo-500' },
    { block: 'bg-emerald-600 border-emerald-300/40', dot: 'bg-emerald-600' },
    { block: 'bg-amber-500 border-amber-200/50', dot: 'bg-amber-500' },
    { block: 'bg-rose-500 border-rose-200/40', dot: 'bg-rose-500' },
    { block: 'bg-sky-500 border-sky-200/40', dot: 'bg-sky-500' },
    { block: 'bg-violet-600 border-violet-300/40', dot: 'bg-violet-600' },
    { block: 'bg-teal-600 border-teal-200/40', dot: 'bg-teal-600' },
    { block: 'bg-orange-600 border-orange-200/40', dot: 'bg-orange-600' },
];

export function colorMap(events: ScheduleEvent[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const ev of events) {
        const key = eventAssetKey(ev);
        if (!map.has(key)) map.set(key, map.size % EVENT_COLORS.length);
    }
    return map;
}

// ---- Qué se ve en cada momento ----

// Una fecha cualquiera que cae en ese día de la semana (para usar la misma
// regla que la TV). 1 de enero de 2024 fue lunes.
function dateFor(jsDay: number, minute: number): Date {
    const offset = (jsDay + 6) % 7; // lunes = 0
    return new Date(2024, 0, 1 + offset, Math.floor(minute / 60), minute % 60);
}

// Para cada día, quién se ve en cada tramo de 5 minutos (id o null = lo de siempre).
export function winnersByDay(events: ScheduleEvent[]): Map<number, (string | null)[]> {
    const result = new Map<number, (string | null)[]>();
    for (const day of WEEK) {
        const slots: (string | null)[] = [];
        for (let m = 0; m < MINUTES_PER_DAY; m += SLOT) {
            slots.push(findActiveScheduleEvent(events, dateFor(day, m))?.id ?? null);
        }
        result.set(day, slots);
    }
    return result;
}

export interface Segment {
    event: ScheduleEvent;
    start: number;          // minutos en ese día
    end: number;
    continuation: boolean;  // madrugada de una franja que empezó el día anterior
    col: number;            // columna (si se pisa con otras)
    cols: number;
    hidden: { start: number; end: number }[]; // tramos en los que se ve otra
}

// Los bloques de un día, acomodados en columnas si se pisan.
export function segmentsForDay(events: ScheduleEvent[], jsDay: number, winners?: (string | null)[]): Segment[] {
    const prevDay = (jsDay + 6) % 7;
    const raw: Omit<Segment, 'col' | 'cols' | 'hidden'>[] = [];
    for (const ev of events) {
        const r = eventRange(ev);
        if (!r) continue;
        const days = ev.days_of_week || [];
        if (r.crossesMidnight) {
            if (days.includes(jsDay)) raw.push({ event: ev, start: r.start, end: MINUTES_PER_DAY, continuation: false });
            if (days.includes(prevDay)) raw.push({ event: ev, start: 0, end: r.end, continuation: true });
        } else if (days.includes(jsDay)) {
            raw.push({ event: ev, start: r.start, end: r.end, continuation: false });
        }
    }
    raw.sort((a, b) => a.start - b.start || b.end - a.end);

    // Grupos de bloques que se pisan y su columna dentro del grupo.
    const out: Segment[] = [];
    let group: Segment[] = [];
    let groupEnd = -1;
    const closeGroup = () => {
        const cols = Math.max(1, ...group.map(s => s.col + 1));
        group.forEach(s => { s.cols = cols; });
        group = [];
    };
    for (const r of raw) {
        if (r.start >= groupEnd && group.length) closeGroup();
        const used = new Set(group.filter(s => s.end > r.start).map(s => s.col));
        let col = 0;
        while (used.has(col)) col++;
        const seg: Segment = { ...r, col, cols: 1, hidden: [] };
        group.push(seg);
        out.push(seg);
        groupEnd = Math.max(groupEnd, r.end);
    }
    if (group.length) closeGroup();

    if (winners) {
        for (const seg of out) {
            let from: number | null = null;
            for (let m = seg.start; m < seg.end; m += SLOT) {
                const covered = winners[Math.floor(m / SLOT)] !== seg.event.id;
                if (covered && from === null) from = m;
                if (!covered && from !== null) { seg.hidden.push({ start: from, end: m }); from = null; }
            }
            if (from !== null) seg.hidden.push({ start: from, end: seg.end });
        }
    }
    return out;
}

// Tramos del día sin ninguna franja: ahí va el contenido de siempre.
export function gapsForDay(winners: (string | null)[]): { start: number; end: number }[] {
    const gaps: { start: number; end: number }[] = [];
    let from: number | null = null;
    winners.forEach((w, i) => {
        const m = i * SLOT;
        if (w === null && from === null) from = m;
        if (w !== null && from !== null) { gaps.push({ start: from, end: m }); from = null; }
    });
    if (from !== null) gaps.push({ start: from, end: MINUTES_PER_DAY });
    return gaps;
}

// Franjas tapadas por otra, para avisar arriba del calendario:
// "Miércoles 13:00 a 14:00: se ve Ropa de niños en lugar de Ópticas".
export function conflicts(events: ScheduleEvent[], winners: Map<number, (string | null)[]>) {
    const byId = new Map(events.map(e => [e.id, e]));
    const list: { day: number; start: number; end: number; hiddenName: string; shownName: string }[] = [];
    for (const day of WEEK) {
        const w = winners.get(day) || [];
        for (const seg of segmentsForDay(events, day, w)) {
            for (const h of seg.hidden) {
                const shown = byId.get(w[Math.floor(h.start / SLOT)] || '');
                list.push({ day, start: h.start, end: h.end, hiddenName: eventName(seg.event), shownName: shown ? eventName(shown) : '' });
            }
        }
    }
    return list;
}

// Dónde arranca el calendario al abrirse: una hora antes de la primera franja
// (o a las 7 si no hay ninguna).
export function firstVisibleHour(events: ScheduleEvent[]): number {
    const starts = events.map(e => eventRange(e)).filter(Boolean).map(r => r!.start);
    if (starts.length === 0) return 7;
    return Math.max(0, Math.floor(Math.min(...starts) / 60) - 1);
}

// ---- Fechas especiales ----

export const isSpecial = (ev: ScheduleEvent) => !!ev.date_from;
export const weeklyEvents = (events: ScheduleEvent[]) => events.filter(e => !isSpecial(e));
export const specialEvents = (events: ScheduleEvent[]) => events.filter(isSpecial);

const fromKey = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// "mié 24/12" o "2/1 al 15/1"
export function formatSpecialDates(ev: Pick<ScheduleEvent, 'date_from' | 'date_to'>): string {
    if (!ev.date_from) return '';
    const short = (key: string) => {
        const d = fromKey(key);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    };
    if (ev.date_to && ev.date_to !== ev.date_from) return `${short(ev.date_from)} al ${short(ev.date_to)}`;
    const d = fromKey(ev.date_from);
    const weekday = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${short(ev.date_from)}`;
}

// Las que todavía no pasaron (incluye las de hoy), de la más cercana a la más lejana.
export function upcomingSpecials(events: ScheduleEvent[], now: Date = new Date()): ScheduleEvent[] {
    const today = scheduleDayKey(now);
    return specialEvents(events)
        .filter(e => (e.date_to || e.date_from)! >= today)
        .sort((a, b) => a.date_from!.localeCompare(b.date_from!) || a.start_time.localeCompare(b.start_time));
}

export function pastSpecials(events: ScheduleEvent[], now: Date = new Date()): ScheduleEvent[] {
    const today = scheduleDayKey(now);
    return specialEvents(events).filter(e => (e.date_to || e.date_from)! < today);
}

// Fechas especiales de esta semana (lunes a domingo), por día: { 3: 'Navidad' }.
export function specialsThisWeek(events: ScheduleEvent[], now: Date = new Date()): Record<number, string> {
    const out: Record<number, string> = {};
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = scheduleDayKey(d);
        const hit = specialEvents(events).find(e => specialCoversDay(e, key));
        if (hit) out[d.getDay()] = hit.label || 'Fecha especial';
    }
    return out;
}
