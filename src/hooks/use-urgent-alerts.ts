import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UrgentAlertColor, UrgentAlertLayout } from '@/lib/urgentAlerts';

export interface UrgentAlertRow {
    id: string;
    commerce_id: string;
    message: string;
    layout: UrgentAlertLayout;
    color: UrgentAlertColor;
    device_ids: string[] | null;
    starts_at: string;
    ends_at: string;
    cancelled_at: string | null;
    created_at: string;
}

// Avisa a las TVs que vuelvan a consultar el aviso (no lleva el aviso: la TV
// lo lee del servidor, así que no hace falta firmarlo).
async function notifyScreens(deviceCodes: string[]) {
    await Promise.all(deviceCodes.map(async code => {
        const channel = supabase.channel(`device:${code}`);
        try {
            await channel.httpSend('command', { action: 'alert' });
        } catch {
            // Si una TV no responde, igual lo toma en su próxima consulta (30 s).
        } finally {
            supabase.removeChannel(channel);
        }
    }));
}

// Avisos activos del comercio. available = false si el servidor todavía no
// tiene la tabla (falta correr la migración).
export const useActiveUrgentAlerts = (commerceId?: string) => useQuery({
    queryKey: ['display_urgent_alerts', commerceId],
    enabled: !!commerceId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<{ alerts: UrgentAlertRow[]; available: boolean }> => {
        const { data, error } = await supabase
            .from('display_urgent_alerts')
            .select('*')
            .eq('commerce_id', commerceId!)
            .is('cancelled_at', null)
            .gt('ends_at', new Date().toISOString())
            .order('created_at', { ascending: false });
        if (error) return { alerts: [], available: false };
        return { alerts: data as UrgentAlertRow[], available: true };
    },
});

export const useCreateUrgentAlert = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: {
            commerceId: string;
            message: string;
            layout: UrgentAlertLayout;
            color: UrgentAlertColor;
            endsAt: Date;
            deviceIds: string[] | null;   // null = todas
            notifyCodes: string[];        // códigos de las pantallas a avisar
        }) => {
            const { error } = await supabase.from('display_urgent_alerts').insert({
                commerce_id: p.commerceId,
                message: p.message,
                layout: p.layout,
                color: p.color,
                ends_at: p.endsAt.toISOString(),
                device_ids: p.deviceIds,
            });
            if (error) throw error;
            await notifyScreens(p.notifyCodes);
        },
        onSuccess: (_, p) => queryClient.invalidateQueries({ queryKey: ['display_urgent_alerts', p.commerceId] }),
    });
};

export const useCancelUrgentAlert = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { id: string; commerceId: string; notifyCodes: string[] }) => {
            const { error } = await supabase
                .from('display_urgent_alerts')
                .update({ cancelled_at: new Date().toISOString() })
                .eq('id', p.id);
            if (error) throw error;
            await notifyScreens(p.notifyCodes);
        },
        onSuccess: (_, p) => queryClient.invalidateQueries({ queryKey: ['display_urgent_alerts', p.commerceId] }),
    });
};
