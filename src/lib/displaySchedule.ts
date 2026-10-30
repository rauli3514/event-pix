// Lógica de programación de Display Digital compartida entre el reproductor de
// TV y el panel, para que los dos decidan lo mismo sobre qué se ve y cuándo.

const MINUTES_PER_DAY = 24 * 60;

// "14:30", "2:30 PM", "02:30 p. m." → minutos desde la medianoche.
export function parseScheduleTime(timeStr: string | null | undefined): number | null {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.replace(/[.\s]/g, '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

export interface ScheduleWindow {
    start: number; // minutos desde la medianoche
    end: number;   // exclusivo; puede ser 1440 (= medianoche)
    crossesMidnight: boolean;
}

// Ventana horaria de un evento. El fin es exclusivo: 09:00–12:00 deja las 12:00
// libres para un evento 12:00–15:00. Por compatibilidad, un fin "23:59" (el
// formulario no permitía cruzar la medianoche) cubre hasta la medianoche, igual
// que un fin "00:00". Si el fin es menor que el inicio (22:00–02:00), el evento
// empieza el día marcado y termina al día siguiente.
export function getEventWindow(ev: { start_time?: string | null; end_time?: string | null }): ScheduleWindow | null {
    const start = parseScheduleTime(ev.start_time);
    let end = parseScheduleTime(ev.end_time);
    if (start === null || end === null) return null;
    if (end === MINUTES_PER_DAY - 1 || (end === 0 && start > 0)) end = MINUTES_PER_DAY;
    if (end === start) return null;
    return { start, end, crossesMidnight: end < start };
}

type ScheduleEventLike = {
    start_time?: string | null;
    end_time?: string | null;
    days_of_week?: number[] | null;
    // Fechas especiales: la franja vale solo esos días (AAAA-MM-DD, inclusive).
    date_from?: string | null;
    date_to?: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
// "AAAA-MM-DD" en la hora del equipo.
export const scheduleDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const isSpecialDateEvent = (ev: ScheduleEventLike) => !!ev.date_from;

// ¿La fecha especial cubre ese día?
export function specialCoversDay(ev: ScheduleEventLike, dayKey: string): boolean {
    if (!ev.date_from) return false;
    return dayKey >= ev.date_from && dayKey <= (ev.date_to || ev.date_from);
}

export function isScheduleEventActive(ev: ScheduleEventLike, now: Date): boolean {
    const win = getEventWindow(ev);
    if (!win) return false;
    const minutes = now.getHours() * 60 + now.getMinutes();

    if (ev.date_from) {
        const today = scheduleDayKey(now);
        if (!win.crossesMidnight) return specialCoversDay(ev, today) && minutes >= win.start && minutes < win.end;
        const prev = new Date(now);
        prev.setDate(prev.getDate() - 1);
        return (specialCoversDay(ev, today) && minutes >= win.start)
            || (specialCoversDay(ev, scheduleDayKey(prev)) && minutes < win.end);
    }

    const days = ev.days_of_week || [];
    if (days.length === 0) return false;
    const today = now.getDay();

    if (!win.crossesMidnight) {
        return days.includes(today) && minutes >= win.start && minutes < win.end;
    }
    const yesterday = (today + 6) % 7;
    return (days.includes(today) && minutes >= win.start)
        || (days.includes(yesterday) && minutes < win.end);
}

// Evento que corresponde ahora, o null si toca el contenido predeterminado.
// Una fecha especial (feriado, Navidad) le gana a la semana tipo. Si dos se
// superponen, gana la que empieza más tarde (la más específica).
export function findActiveScheduleEvent<T extends ScheduleEventLike>(
    events: T[] | null | undefined,
    now: Date
): T | null {
    const active = (events || []).filter(ev => isScheduleEventActive(ev, now));
    if (active.length === 0) return null;
    const specials = active.filter(isSpecialDateEvent);
    const pool = specials.length ? specials : active;
    const minutes = now.getHours() * 60 + now.getMinutes();
    // Minutos transcurridos desde que empezó cada evento (contemplando la medianoche).
    const elapsed = (ev: T) => (minutes - (getEventWindow(ev)?.start ?? 0) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return pool.reduce((best, ev) => (elapsed(ev) < elapsed(best) ? ev : best));
}

interface AssignmentLike {
    device_id?: string | null;
    group_id?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    created_at?: string | null;
}

// Asignación que manda en una pantalla: primero la directa de la pantalla y,
// si no hay, la de su grupo. Las asignaciones con rango de fechas solo cuentan
// dentro de ese rango. Entre empatadas, la más reciente.
export function pickActiveAssignment<T extends AssignmentLike>(
    assignments: T[] | null | undefined,
    deviceId: string,
    groupId: string | null | undefined,
    now: Date = new Date()
): T | null {
    const inWindow = (a: T) => {
        if (a.start_time && new Date(a.start_time) > now) return false;
        if (a.end_time && new Date(a.end_time) <= now) return false;
        return true;
    };
    const newestFirst = (a: T, b: T) => (b.created_at || '').localeCompare(a.created_at || '');
    const candidates = (assignments || []).filter(inWindow).sort(newestFirst);

    return candidates.find(a => a.device_id === deviceId)
        || (groupId ? candidates.find(a => a.group_id === groupId) : undefined)
        || null;
}

// Qué muestra ahora una pantalla según su asignación (la misma regla que el
// reproductor): la playlist o el archivo directo, o el de la franja de su
// programación que toca ahora (si no toca ninguna, el predeterminado).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assignmentContentNow(assignment: any, now: Date = new Date()): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    campaign: any | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: any | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schedule: any | null;
} {
    if (!assignment) return { campaign: null, media: null, schedule: null };
    const schedule = assignment.schedule;
    if (schedule) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = findActiveScheduleEvent<any>(schedule.events, now);
        return event
            ? { campaign: event.campaign || null, media: event.media || null, schedule }
            : { campaign: schedule.default_campaign || null, media: schedule.default_media || null, schedule };
    }
    return { campaign: assignment.campaign || null, media: assignment.media || null, schedule: null };
}
