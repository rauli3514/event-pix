import { useMemo } from 'react';
import { useDisplayDevices } from '@/hooks/use-display-hub';
import { AlertDevice, DownScreen, findDownScreens } from '@/lib/screenAlerts';

// Pantallas caídas (sin latido hace más de 10 min) de un negocio, o de todos
// con commerceId null. Se recalcula con cada actualización de la lista (30 s).
export function useDownScreens(commerceId: string | null | undefined): DownScreen[] {
    const { data, dataUpdatedAt } = useDisplayDevices(commerceId);
    return useMemo(
        () => findDownScreens(data as AlertDevice[] | undefined, dataUpdatedAt || 0),
        [data, dataUpdatedAt]
    );
}
