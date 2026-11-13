import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AccountPlan } from '@/lib/accounts';

// Estado del negocio (cliente, prueba, baja) para el panel. Va aparte de
// useCommerces para que, si la migración display_trials no se corrió, no se
// rompa nada: devuelve null y el panel se ve como siempre.
export const useCommercePlan = (commerceId?: string | null) => useQuery({
    queryKey: ['display_commerce_plan', commerceId],
    enabled: !!commerceId,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ plan: AccountPlan; trial_ends_at: string | null } | null> => {
        const { data, error } = await supabase
            .from('display_commerces')
            .select('plan, trial_ends_at')
            .eq('id', commerceId!)
            .maybeSingle();
        if (error || !data) return null;
        return data as { plan: AccountPlan; trial_ends_at: string | null };
    },
});
