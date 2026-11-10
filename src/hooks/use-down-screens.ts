import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDisplayDevices } from '@/hooks/use-display-hub';
import { AlertDevice, DownScreen, LocalHours, findDownScreens, isLocalOpen } from '@/lib/screenAlerts';

// Horario de cada local (el de los avisos por email), por id de comercio.
// null si el servidor todavía no tiene esas columnas: entonces se avisa siempre.
export const useCommerceHours = (commerceId: string | null | undefined) => useQuery({
    queryKey: ['display_commerce_hours', commerceId ?? 'all'],
    queryFn: async (): Promise<Map<string, LocalHours> | null> => {
        let query = supabase.from('display_commerces').select('id, alert_days, alert_from, alert_to, alert_timezone');
        if (commerceId) query = query.eq('id', commerceId);
        const { data, error } = await query;
        if (error || !data) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Map((data as any[]).map(c => [c.id as string, {
            days: c.alert_days || [],
            from: c.alert_from || '00:00',
            to: c.alert_to || '23:59',
            timezone: c.alert_timezone || 'America/Argentina/Buenos_Aires',
        }]));
    },
    staleTime: 5 * 60 * 1000,
});

// Pantallas sin latido hace más de 10 min de un negocio, o de todos con
// commerceId null. Se recalcula con cada actualización de la lista (30 s).
// - screens: caídas dentro del horario del local (aviso rojo).
// - offScreens: sin señal fuera del horario (se desenchufan al cerrar): en gris.
// `loaded` es false hasta que llega la primera lista de pantallas.
export function useDownScreensState(commerceId: string | null | undefined): {
    screens: DownScreen[];
    offScreens: DownScreen[];
    hours: Map<string, LocalHours> | null;
    loaded: boolean;
} {
    const { data, dataUpdatedAt } = useDisplayDevices(commerceId);
    const { data: hours } = useCommerceHours(commerceId);
    return useMemo(() => {
        const now = dataUpdatedAt || 0;
        const all = findDownScreens(data as AlertDevice[] | undefined, now);
        const open = (s: DownScreen) => isLocalOpen(s.commerceId ? hours?.get(s.commerceId) : null, new Date(now));
        return {
            screens: all.filter(open),
            offScreens: all.filter(s => !open(s)),
            hours: hours ?? null,
            loaded: !!data,
        };
    }, [data, dataUpdatedAt, hours]);
}

export function useDownScreens(commerceId: string | null | undefined): DownScreen[] {
    return useDownScreensState(commerceId).screens;
}
