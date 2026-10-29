import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDisplayLabelGroups } from '@/hooks/use-display-labels';
import { fetchSheetPrices, type SheetPrice } from '@/lib/googleSheets';
import { getTvDeviceCode } from '@/lib/tvScreenshot';

const SHEET_REFRESH_MS = 5 * 60 * 1000;
const LABELS_REFRESH_MS = 60 * 1000;

// Lo último que se leyó queda guardado en el equipo: si se corta internet, la
// TV sigue mostrando los precios de la última lectura.
function readCache<T>(key: string): T | undefined {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
        return undefined;
    }
}
function writeCache(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin espacio */ }
}

export const normalizeLabelName = (name?: string | null) => (name || '').toLowerCase().trim();

// Precios de la planilla de Google conectada a una app de Etiquetas.
export function useSheetPrices(sheetUrl?: string | null) {
    const url = (sheetUrl || '').trim();
    const cacheKey = `sheet_prices:${url}`;
    return useQuery({
        queryKey: ['sheet_prices', url],
        enabled: !!url,
        refetchInterval: SHEET_REFRESH_MS,
        staleTime: 60 * 1000,
        retry: 1,
        initialData: () => readCache<SheetPrice[]>(cacheKey),
        initialDataUpdatedAt: 0,
        queryFn: async () => {
            const prices = await fetchSheetPrices(url);
            writeCache(cacheKey, prices);
            return prices;
        },
    });
}

// Textos en vivo de las etiquetas, por nombre (en minúsculas). Manda la
// planilla de Google; si no está ahí, lo de la página Etiquetas.
export function useLiveLabelTexts(commerceId?: string, sheetUrl?: string | null): Map<string, string> {
    const deviceCode = getTvDeviceCode();

    // Panel (con sesión): los grupos de la página Etiquetas.
    const { data: groups = [] } = useDisplayLabelGroups(deviceCode ? undefined : commerceId);

    // TV (sin sesión): los mismos textos, a través de su código.
    const deviceCacheKey = `label_texts:${deviceCode}`;
    const { data: deviceTexts } = useQuery({
        queryKey: ['device_label_texts', deviceCode],
        enabled: !!deviceCode,
        refetchInterval: LABELS_REFRESH_MS,
        initialData: () => readCache<Record<string, string>>(deviceCacheKey),
        initialDataUpdatedAt: 0,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('display_device_label_texts', { p_device_code: deviceCode });
            if (error) throw error;
            const texts = (data || {}) as Record<string, string>;
            writeCache(deviceCacheKey, texts);
            return texts;
        },
    });

    const { data: sheetPrices } = useSheetPrices(sheetUrl);

    return useMemo(() => {
        const map = new Map<string, string>();
        if (deviceCode) {
            Object.entries(deviceTexts || {}).forEach(([name, text]) => map.set(normalizeLabelName(name), text));
        } else {
            groups.forEach(g => g.labels?.forEach(l => {
                if (l.name) map.set(normalizeLabelName(l.name), l.text);
            }));
        }
        (sheetPrices || []).forEach(p => map.set(normalizeLabelName(p.name), p.text));
        return map;
    }, [deviceCode, deviceTexts, groups, sheetPrices]);
}
