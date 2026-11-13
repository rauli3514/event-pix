import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AccountPlan, AdminAccount } from '@/lib/accounts';

// Admin: todos los negocios con su estado (cliente, prueba, baja) y los datos
// del registro de prueba. Si la migración todavía no se corrió, devuelve null y
// el panel sigue andando como antes (todos como clientes).
export const useAdminAccounts = (enabled = true) => useQuery({
    queryKey: ['display_admin_accounts'],
    enabled,
    retry: false,
    queryFn: async (): Promise<{ accounts: AdminAccount[] | null; error?: string }> => {
        const { data, error } = await supabase.rpc('display_admin_accounts');
        if (error) return { accounts: null, error: error.message || error.code };
        return { accounts: (Array.isArray(data) ? data : []) as AdminAccount[] };
    },
});

export const useSetAccountPlan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string; plan: AccountPlan; extendDays?: number }) => {
            const { error } = await supabase.rpc('display_admin_set_plan', {
                p_commerce: p.commerceId,
                p_plan: p.plan,
                p_extend_days: p.extendDays ?? null,
            });
            if (error) throw new Error(error.message || error.code);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_admin_accounts'] });
        },
    });
};

export const useSaveTrialNotes = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { signupId: string; notes: string }) => {
            const { error } = await supabase
                .from('display_trial_signups')
                .update({ notes: p.notes.trim() || null })
                .eq('id', p.signupId);
            if (error) throw new Error(error.message || error.code);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_admin_accounts'] });
        },
    });
};
