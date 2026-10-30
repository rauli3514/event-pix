import { isScheduleEventActive } from '@/lib/displaySchedule';
import { itemDateStatus, localDayKey } from '@/lib/playlistItems';

// Reglas de cada elemento de una playlist: "cuándo se muestra".
//   showDays: días de la semana (0 = domingo … 6 = sábado). Vacío = todos.
//   showFrom / showTo: "HH:MM", hora del equipo. El fin no se incluye y puede
//     cruzar la medianoche (22:00 → 02:00).
//   weather: solo con lluvia, frío o calor en una ciudad (servicio gratis
//     Open-Meteo, el mismo de la app Clima).
// Todo se combina con las fechas (validFrom / validUntil).

export type WeatherWhen = 'rain' | 'cold' | 'heat';

export interface WeatherPlace {
    name: string;
    lat: number;
    lon: number;
}

export interface WeatherRule {
    when: WeatherWhen;
    place: WeatherPlace;
}

export interface WeatherNow {
    temp: number;      // °C
    code: number;      // weather_code de Open-Meteo
    precip: number;    // mm en la última hora
    at: number;        // cuándo se midió (ms)
}

export const COLD_BELOW = 15;
export const HEAT_ABOVE = 28;

export const WEATHER_RULES: Record<WeatherWhen, { label: string; badge: string }> = {
    rain: { label: 'Si llueve', badge: 'Si llueve' },
    cold: { label: `Si hace frío (menos de ${COLD_BELOW}°)`, badge: `Si hace menos de ${COLD_BELOW}°` },
    heat: { label: `Si hace calor (más de ${HEAT_ABOVE}°)`, badge: `Si hace más de ${HEAT_ABOVE}°` },
};

// Lluvia, llovizna, chaparrones o tormenta (códigos WMO), o agua medida.
export const isRaining = (w: WeatherNow) =>
    w.precip > 0.1 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95;

export function weatherMatches(when: WeatherWhen, w: WeatherNow): boolean {
    if (when === 'rain') return isRaining(w);
    if (when === 'cold') return w.temp < COLD_BELOW;
    return w.temp > HEAT_ABOVE;
}

export const placeKey = (p: WeatherPlace) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

export const itemWeatherRule = (item: AnyItem): WeatherRule | null => {
    const rule = item?.weather;
    if (!rule || !WEATHER_RULES[rule.when as WeatherWhen]) return null;
    const lat = Number(rule.place?.lat);
    const lon = Number(rule.place?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { when: rule.when, place: { name: String(rule.place?.name || ''), lat, lon } };
};

const validDays = (item: AnyItem): number[] =>
    Array.isArray(item?.showDays) ? item.showDays.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) : [];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const itemHasSchedule = (item: AnyItem) =>
    (validDays(item).length > 0 && validDays(item).length < 7) || !!(item?.showFrom && item?.showTo);

export const itemHasRules = (item: AnyItem) => itemHasSchedule(item) || !!itemWeatherRule(item);

// ¿Toca por día y horario?
export function scheduleAllows(item: AnyItem, now: Date): boolean {
    const days = validDays(item);
    const effectiveDays = days.length ? days : ALL_DAYS;
    if (item?.showFrom && item?.showTo && item.showFrom !== item.showTo) {
        return isScheduleEventActive({ start_time: item.showFrom, end_time: item.showTo, days_of_week: effectiveDays }, now);
    }
    return effectiveDays.includes(now.getDay());
}

export type ItemNowStatus = 'active' | 'expired' | 'upcoming' | 'off_schedule' | 'off_weather' | 'no_weather';

// Clima de una ciudad, o null si todavía no se sabe (sin internet, cargando).
export type WeatherLookup = (place: WeatherPlace) => WeatherNow | null;

// Si se ve ahora y, si no, por qué. Sin datos del clima, lo que depende del
// clima no se muestra (es contenido para una ocasión).
export function itemNowStatus(item: AnyItem, now: Date, weatherOf?: WeatherLookup): ItemNowStatus {
    const date = itemDateStatus(item, localDayKey(now));
    if (date !== 'active') return date;
    if (!scheduleAllows(item, now)) return 'off_schedule';
    const rule = itemWeatherRule(item);
    if (rule) {
        const w = weatherOf?.(rule.place) ?? null;
        if (!w) return 'no_weather';
        if (!weatherMatches(rule.when, w)) return 'off_weather';
    }
    return 'active';
}

export const itemsActiveNow = <T,>(items: T[], now: Date, weatherOf?: WeatherLookup): T[] =>
    items.filter(item => itemNowStatus(item, now, weatherOf) === 'active');

// Ciudades distintas que usan las reglas de clima de una lista.
export function weatherPlacesOf(items: AnyItem[]): WeatherPlace[] {
    const map = new Map<string, WeatherPlace>();
    for (const item of items) {
        const rule = itemWeatherRule(item);
        if (rule) map.set(placeKey(rule.place), rule.place);
    }
    return [...map.values()];
}

// Última ciudad elegida en este navegador, para proponerla la próxima vez.
const LAST_PLACE_KEY = 'edm_weather_last_place';

export function readLastPlace(): WeatherPlace | null {
    try {
        const p = JSON.parse(localStorage.getItem(LAST_PLACE_KEY) || 'null');
        return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null;
    } catch {
        return null;
    }
}

export function rememberPlace(p: WeatherPlace) {
    try {
        localStorage.setItem(LAST_PLACE_KEY, JSON.stringify(p));
    } catch {
        // sin almacenamiento: no pasa nada
    }
}

// ---- Textos ----

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// Orden de la semana para mostrar: lunes primero.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LETTER: Record<number, string> = { 0: 'D', 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S' };
export const DAY_NAME: Record<number, string> = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };

export function describeDays(days: number[]): string {
    const set = new Set(days);
    if (set.size === 0 || set.size === 7) return '';
    const ordered = WEEK_ORDER.filter(d => set.has(d));
    if (set.size === 5 && ordered.join() === '1,2,3,4,5') return 'Lun a Vie';
    if (set.size === 2 && set.has(6) && set.has(0)) return 'Fin de semana';
    // Días seguidos: "Jue a Sáb".
    const idx = ordered.map(d => WEEK_ORDER.indexOf(d));
    const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
    if (consecutive && ordered.length >= 3) return `${DAY_SHORT[ordered[0]]} a ${DAY_SHORT[ordered[ordered.length - 1]]}`;
    return ordered.map(d => DAY_SHORT[d]).join(', ');
}

// "07:00" -> "7", "07:30" -> "7:30"
const shortTime = (t: string) => {
    const [h, m] = t.split(':');
    return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
};

export function describeHours(from?: string, to?: string): string {
    if (!from || !to || from === to) return '';
    return `${shortTime(from)} a ${to === '00:00' ? '24' : shortTime(to)} h`;
}

// "Lun a Vie · 7 a 11 h"
export function describeSchedule(item: AnyItem): string {
    return [describeDays(validDays(item)), describeHours(item?.showFrom, item?.showTo)].filter(Boolean).join(' · ');
}

export function describeWeatherNow(w: WeatherNow): string {
    const temp = `${Math.round(w.temp)}°`;
    if (isRaining(w)) return `${temp}, lloviendo`;
    if (w.code === 0) return `${temp}, despejado`;
    if (w.code <= 3) return `${temp}, nublado`;
    if (w.code >= 71 && w.code <= 77) return `${temp}, nevando`;
    return temp;
}
