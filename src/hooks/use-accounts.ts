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

// Admin: qué usuarios se registraron para probar, con el estado de su negocio
// (para la etiqueta "Prueba" en Gestión de Usuarios). Sin la migración, vacío.
export const useTrialUsers = (enabled = true) => useQuery({
    queryKey: ['display_trial_users'],
    enabled,
    retry: false,
    queryFn: async (): Promise<Record<string, { plan: AccountPlan; trial_ends_at: string | null }>> => {
        const { data, error } = await supabase
            .from('display_trial_signups')
            .select('user_id, commerce:display_commerces(plan, trial_ends_at)');
        if (error || !data) return {};
        const out: Record<string, { plan: AccountPlan; trial_ends_at: string | null }> = {};
        for (const row of data as unknown as { user_id: string | null; commerce: { plan: AccountPlan; trial_ends_at: string | null } | null }[]) {
            if (row.user_id && row.commerce) out[row.user_id] = row.commerce;
        }
        return out;
    },
});

// Admin: borrar los archivos (fotos, videos) y los medios de una prueba que
// venció hace más de 30 días. Se hace desde acá y no desde la base porque
// Supabase no deja borrar archivos del Storage con SQL. Quedan el negocio y
// los datos del registro (para poder escribirle).
export const useCleanAccountData = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (commerceId: string): Promise<{ files: number; items: number }> => {
            const { data: media, error } = await supabase
                .from('display_media')
                .select('id, type, storage_path')
                .eq('commerce_id', commerceId);
            if (error) throw new Error(error.message || error.code);
            const rows = (media || []) as { id: string; type: string; storage_path: string | null }[];
            // Solo archivos subidos a la carpeta del negocio (no carteles, apps ni links).
            const paths = rows.map(r => r.storage_path || '').filter(p => p.startsWith(`${commerceId}/`));
            for (let i = 0; i < paths.length; i += 100) {
                const { error: e } = await supabase.storage.from('display-media').remove(paths.slice(i, i + 100));
                if (e) throw new Error(e.message);
            }
            const ids = rows.map(r => r.id);
            for (let i = 0; i < ids.length; i += 100) {
                const { error: e } = await supabase.from('display_media').delete().in('id', ids.slice(i, i + 100));
                if (e) throw new Error(e.message || e.code);
            }
            const { error: e2 } = await supabase.from('display_commerces').update({ data_cleaned_at: new Date().toISOString() }).eq('id', commerceId);
            if (e2) throw new Error(e2.message || e2.code);
            return { files: paths.length, items: ids.length };
        },
        onSuccess: (_, commerceId) => {
            queryClient.invalidateQueries({ queryKey: ['display_admin_accounts'] });
            queryClient.invalidateQueries({ queryKey: ['display_media', commerceId] });
        },
    });
};
