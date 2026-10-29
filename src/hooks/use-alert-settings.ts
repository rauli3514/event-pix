import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Avisos por email de pantallas sin señal (ver la migración display_down_alerts).
export interface AlertSettings {
    alerts_enabled: boolean;
    alert_email: string | null;
    email: string | null; // email del comercio (se usa si no hay uno para avisos)
    alert_days: number[];
    alert_from: string; // "09:00:00"
    alert_to: string;
}

// null si el servidor todavía no tiene los avisos (falta correr la migración).
export const useAlertSettings = (commerceId?: string | null) => useQuery({
    queryKey: ['display_alert_settings', commerceId],
    enabled: !!commerceId,
    queryFn: async (): Promise<AlertSettings | null> => {
        const { data, error } = await supabase
            .from('display_commerces')
            .select('email, alerts_enabled, alert_email, alert_days, alert_from, alert_to')
            .eq('id', commerceId!)
            .maybeSingle();
        if (error) return null;
        return data as AlertSettings | null;
    },
});

export const useSaveAlertSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string; enabled: boolean; email: string; days: number[]; from: string; to: string }) => {
            const { error } = await supabase.rpc('display_update_alert_settings', {
                p_commerce: p.commerceId,
                p_enabled: p.enabled,
                p_email: p.email,
                p_days: p.days,
                p_from: p.from,
                p_to: p.to,
            });
            if (error) throw error;
        },
        onSuccess: (_, p) => queryClient.invalidateQueries({ queryKey: ['display_alert_settings', p.commerceId] }),
    });
};
