import { useEffect, useState } from 'react';
import { CloudRain, MapPin, Search, Snowflake, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DAY_LETTER, DAY_NAME, WEATHER_RULES, WEEK_ORDER, describeWeatherNow, itemWeatherRule, rememberPlace, weatherMatches,
    type WeatherLookup, type WeatherPlace, type WeatherWhen,
} from '@/lib/itemRules';

// "Cuándo se muestra" de un elemento: días, horario y clima.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const HOUR_PRESETS = [
    { label: 'Desayuno', from: '07:00', to: '11:00' },
    { label: 'Almuerzo', from: '12:00', to: '15:00' },
    { label: 'Merienda', from: '16:00', to: '19:00' },
    { label: 'Noche', from: '20:00', to: '00:00' },
];

const WEATHER_ICONS: Record<WeatherWhen, typeof Sun> = { rain: CloudRain, cold: Snowflake, heat: Sun };

interface Props {
    item: AnyItem;
    onChange: (patch: Record<string, unknown>) => void;
    // Ciudad a proponer (la que ya usan otros elementos o la última elegida).
    defaultPlace: WeatherPlace | null;
    weatherOf: WeatherLookup;
}

const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-md border text-xs ${active
        ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300'
        : 'border-border text-muted-foreground hover:text-foreground'}`;

export function ItemRulesEditor({ item, onChange, defaultPlace, weatherOf }: Props) {
    const days: number[] = Array.isArray(item.showDays) && item.showDays.length ? item.showDays : ALL_DAYS;
    const hasHours = !!(item.showFrom && item.showTo);
    const rule = itemWeatherRule(item);
    // Clima elegido que todavía espera la ciudad.
    const [pendingWhen, setPendingWhen] = useState<WeatherWhen | null>(null);
    const [changingPlace, setChangingPlace] = useState(false);

    const setDays = (next: number[]) => {
        const unique = [...new Set(next)].sort();
        onChange({ showDays: unique.length === 0 || unique.length === 7 ? undefined : unique });
    };
    const toggleDay = (d: number) => {
        if (days.includes(d)) {
            if (days.length === 1) return; // al menos un día
            setDays(days.filter(x => x !== d));
        } else {
            setDays([...days, d]);
        }
    };
    const sameDays = (list: number[]) => days.length === list.length && list.every(d => days.includes(d));

    const pickWeather = (when: WeatherWhen | null) => {
        setChangingPlace(false);
        if (!when) {
            setPendingWhen(null);
            onChange({ weather: undefined });
            return;
        }
        const place = rule?.place || defaultPlace;
        if (place) {
            setPendingWhen(null);
            onChange({ weather: { when, place } });
        } else {
            setPendingWhen(when);
        }
    };

    const pickPlace = (place: WeatherPlace) => {
        rememberPlace(place);
        const when = pendingWhen || rule?.when;
        setPendingWhen(null);
        setChangingPlace(false);
        if (when) onChange({ weather: { when, place } });
    };

    const selectedWhen = pendingWhen || rule?.when || null;
    const now = rule ? weatherOf(rule.place) : null;

    return (
        <>
            <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Días y horario (desayunos, almuerzos, fines de semana)</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {WEEK_ORDER.map(d => (
                        <button
                            key={d}
                            type="button"
                            title={DAY_NAME[d]}
                            aria-label={DAY_NAME[d]}
                            aria-pressed={days.includes(d)}
                            onClick={() => toggleDay(d)}
                            className={`w-8 h-8 rounded-full border text-xs font-semibold ${days.includes(d)
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-border text-muted-foreground hover:text-foreground'}`}
                        >
                            {DAY_LETTER[d]}
                        </button>
                    ))}
                    <span className="mx-1 h-5 w-px bg-border" />
                    <button type="button" onClick={() => setDays(ALL_DAYS)} className={chip(days.length === 7)}>Todos</button>
                    <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])} className={chip(sameDays([1, 2, 3, 4, 5]))}>Lun a Vie</button>
                    <button type="button" onClick={() => setDays([6, 0])} className={chip(sameDays([6, 0]))}>Fin de semana</button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => onChange({ showFrom: undefined, showTo: undefined })} className={chip(!hasHours)}>Todo el día</button>
                    {HOUR_PRESETS.map(p => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => onChange({ showFrom: p.from, showTo: p.to })}
                            className={chip(item.showFrom === p.from && item.showTo === p.to)}
                        >
                            {p.label} <span className="opacity-70">{Number(p.from.slice(0, 2))}–{p.to === '00:00' ? 24 : Number(p.to.slice(0, 2))} h</span>
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Solo de</span>
                    <Input
                        type="time" value={item.showFrom || ''} aria-label="Desde la hora"
                        onChange={e => onChange({ showFrom: e.target.value || undefined, showTo: item.showTo || (e.target.value ? '23:59' : undefined) })}
                        className="h-8 w-[110px] bg-background border-border"
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                        type="time" value={item.showTo || ''} aria-label="Hasta la hora"
                        onChange={e => onChange({ showTo: e.target.value || undefined, showFrom: item.showFrom || (e.target.value ? '00:00' : undefined) })}
                        className="h-8 w-[110px] bg-background border-border"
                    />
                    <span className="text-muted-foreground">h</span>
                </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Según el clima</p>
                <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => pickWeather(null)} className={chip(!selectedWhen)}>Llueva o no</button>
                    {(Object.keys(WEATHER_RULES) as WeatherWhen[]).map(when => {
                        const Icon = WEATHER_ICONS[when];
                        return (
                            <button key={when} type="button" onClick={() => pickWeather(when)} className={`${chip(selectedWhen === when)} inline-flex items-center gap-1`}>
                                <Icon className="w-3.5 h-3.5" /> {WEATHER_RULES[when].label}
                            </button>
                        );
                    })}
                </div>
                {selectedWhen && (pendingWhen || changingPlace) && (
                    <CitySearch onPick={pickPlace} onCancel={rule ? () => setChangingPlace(false) : () => setPendingWhen(null)} />
                )}
                {rule && !pendingWhen && !changingPlace && (
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {rule.place.name}</span>
                        <button type="button" onClick={() => setChangingPlace(true)} className="text-indigo-600 dark:text-indigo-400 hover:underline">Cambiar ciudad</button>
                        {now ? (
                            <span>
                                · Ahora: {describeWeatherNow(now)} →{' '}
                                {weatherMatches(rule.when, now)
                                    ? <strong className="text-emerald-600 dark:text-emerald-400">se muestra</strong>
                                    : <strong className="text-foreground">no se muestra</strong>}
                            </span>
                        ) : <span>· Consultando el clima…</span>}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">El clima se revisa cada 15 minutos. Si la pantalla se queda sin internet, este elemento no se muestra.</p>
            </div>
        </>
    );
}

interface GeoResult {
    id: number;
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
}

function CitySearch({ onPick, onCancel }: { onPick: (p: WeatherPlace) => void; onCancel: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoResult[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 3) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`);
                const data = await res.json();
                if (!cancelled) setResults(Array.isArray(data?.results) ? data.results : []);
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 400);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query]);

    const shown = query.trim().length >= 3 ? results : [];

    return (
        <div className="rounded-lg border border-border bg-background p-2 space-y-2">
            <p className="text-xs">¿En qué ciudad? (para saber el clima)</p>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Ej.: Rosario" className="h-8 pl-8 bg-card border-border" aria-label="Buscar ciudad" />
                </div>
                <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
            {searching && <p className="text-xs text-muted-foreground">Buscando…</p>}
            {shown.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
                    {shown.map(r => (
                        <li key={r.id}>
                            <button
                                type="button"
                                onClick={() => onPick({ name: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : null, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude })}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"
                            >
                                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                {r.name}<span className="text-muted-foreground text-xs">{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
