import { useCallback, useEffect, useMemo, useState } from 'react';
import { placeKey, type WeatherLookup, type WeatherNow, type WeatherPlace } from '@/lib/itemRules';

// Clima actual de las ciudades que usan las reglas "si llueve / frío / calor".
// Se consulta cada 15 minutos a Open-Meteo (gratis, sin clave) y se guarda una
// copia en el equipo: si se corta internet, sirve hasta 3 horas.
const REFRESH_MS = 15 * 60 * 1000;
const MAX_AGE_MS = 3 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'edm_weather_';

function readCache(key: string): WeatherNow | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (!raw) return null;
        const w = JSON.parse(raw) as WeatherNow;
        return Number.isFinite(w?.temp) && Number.isFinite(w?.at) ? w : null;
    } catch {
        return null;
    }
}

function writeCache(key: string, w: WeatherNow) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(w));
    } catch {
        // Sin espacio o sin almacenamiento: se usa solo en memoria.
    }
}

export async function fetchWeatherNow(place: WeatherPlace): Promise<WeatherNow | null> {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,precipitation,weather_code&timezone=auto`);
        if (!res.ok) return null;
        const data = await res.json();
        const c = data?.current;
        const temp = Number(c?.temperature_2m);
        if (!Number.isFinite(temp)) return null;
        return { temp, code: Number(c?.weather_code) || 0, precip: Number(c?.precipitation) || 0, at: Date.now() };
    } catch {
        return null;
    }
}

export function useWeatherNow(places: WeatherPlace[]): { weatherOf: WeatherLookup; byKey: Record<string, WeatherNow> } {
    // Firma estable: solo se vuelve a pedir si cambian las ciudades.
    const signature = places.map(placeKey).sort().join('|');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stablePlaces = useMemo(() => places, [signature]);

    const [byKey, setByKey] = useState<Record<string, WeatherNow>>(() => {
        const initial: Record<string, WeatherNow> = {};
        for (const p of places) {
            const cached = readCache(placeKey(p));
            if (cached) initial[placeKey(p)] = cached;
        }
        return initial;
    });

    useEffect(() => {
        if (stablePlaces.length === 0) return;
        let cancelled = false;
        const load = async () => {
            for (const p of stablePlaces) {
                const key = placeKey(p);
                const w = await fetchWeatherNow(p);
                if (cancelled) return;
                if (w) {
                    writeCache(key, w);
                    setByKey(prev => ({ ...prev, [key]: w }));
                } else {
                    const cached = readCache(key);
                    if (cached) setByKey(prev => (prev[key]?.at === cached.at ? prev : { ...prev, [key]: cached }));
                }
            }
        };
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [stablePlaces]);

    const weatherOf = useCallback<WeatherLookup>(place => {
        const w = byKey[placeKey(place)];
        if (!w || Date.now() - w.at > MAX_AGE_MS) return null;
        return w;
    }, [byKey]);

    return { weatherOf, byKey };
}
