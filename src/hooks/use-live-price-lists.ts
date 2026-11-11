import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { usePriceLists } from '@/hooks/use-price-lists';
import { getTvDeviceCode } from '@/lib/tvScreenshot';
import type { PriceList } from '@/lib/priceLists';

const REFRESH_MS = 60 * 1000;

function readCache(key: string): PriceList[] | undefined {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as PriceList[]) : undefined;
    } catch {
        return undefined;
    }
}

// Listas de precios en vivo para los carteles.
// - Panel (con sesión): las del comercio.
// - TV (sin sesión): las de su comercio, con su código; lo último que se leyó
//   queda guardado para seguir mostrando precios sin internet.
export function useLivePriceLists(commerceId?: string | null): PriceList[] {
    const deviceCode = getTvDeviceCode();
    const { data: panel } = usePriceLists(deviceCode ? undefined : commerceId);
    const cacheKey = `price_lists:${deviceCode}`;
    const { data: device } = useQuery({
        queryKey: ['device_price_lists', deviceCode],
        enabled: !!deviceCode,
        refetchInterval: REFRESH_MS,
        initialData: () => readCache(cacheKey),
        initialDataUpdatedAt: 0,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('display_device_price_lists', { p_device_code: deviceCode });
            if (error) throw error;
            const lists = (Array.isArray(data) ? data : []) as PriceList[];
            try { localStorage.setItem(cacheKey, JSON.stringify(lists)); } catch { /* sin espacio */ }
            return lists;
        },
    });
    return (deviceCode ? device : panel?.lists) || [];
}
