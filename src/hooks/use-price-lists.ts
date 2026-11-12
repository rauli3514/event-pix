import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PriceList, PriceListItem, PriceListPromo } from '@/lib/priceLists';
import type { FudoMenu } from '@/lib/fudo';

// Listas de precios del comercio (ver la migración display_price_lists).
// Si la tabla todavía no existe (falta correr el paso en Supabase), `missing` es true.
export const usePriceLists = (commerceId?: string | null) => useQuery({
    queryKey: ['display_price_lists', commerceId],
    enabled: !!commerceId,
    queryFn: async (): Promise<{ lists: PriceList[]; missing: boolean }> => {
        const { data, error } = await supabase
            .from('display_price_lists')
            .select('*')
            .eq('commerce_id', commerceId!)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });
        if (error) {
            const missing = error.code === '42P01' || error.code === 'PGRST205' || /display_price_lists/i.test(error.message || '');
            if (missing) return { lists: [], missing: true };
            throw error;
        }
        return {
            lists: (data || []).map(l => ({ ...l, items: Array.isArray(l.items) ? l.items : [] })) as PriceList[],
            missing: false,
        };
    },
});

const invalidate = (queryClient: ReturnType<typeof useQueryClient>, commerceId: string) => {
    queryClient.invalidateQueries({ queryKey: ['display_price_lists', commerceId] });
};

export const useCreatePriceList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string; name: string; items?: PriceListItem[] }) => {
            const { data, error } = await supabase
                .from('display_price_lists')
                .insert({ commerce_id: p.commerceId, name: p.name.trim(), items: p.items || [] })
                .select()
                .single();
            if (error) throw error;
            return data as PriceList;
        },
        onSuccess: (_, p) => invalidate(queryClient, p.commerceId),
    });
};

export const useUpdatePriceList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string; id: string; name?: string; items?: PriceListItem[]; promo?: PriceListPromo | null; color?: string | null }) => {
            const updates: Record<string, unknown> = {};
            if (p.name !== undefined) updates.name = p.name.trim();
            if (p.items !== undefined) updates.items = p.items;
            if (p.promo !== undefined) updates.promo = p.promo;
            if (p.color !== undefined) updates.color = p.color;
            const { data, error } = await supabase
                .from('display_price_lists')
                .update(updates)
                .eq('id', p.id)
                .select()
                .single();
            if (error) {
                // Falta correr 20261114000000_display_price_list_promo.sql.
                if (p.promo !== undefined && /promo/i.test(error.message || '')) throw new Error('promo_missing');
                throw error;
            }
            return data as PriceList;
        },
        onSuccess: (_, p) => invalidate(queryClient, p.commerceId),
    });
};

export const useDeletePriceList = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string; id: string }) => {
            const { error } = await supabase.from('display_price_lists').delete().eq('id', p.id);
            if (error) throw error;
        },
        onSuccess: (_, p) => invalidate(queryClient, p.commerceId),
    });
};

// Fudo: leer el menú, traer categorías como listas y actualizarlas (ver lib/fudo).
export const useFudoMenu = () => useMutation({
    mutationFn: async (slug: string): Promise<FudoMenu> => {
        const { data, error } = await supabase.rpc('display_fudo_menu', { p_slug: slug });
        if (error) throw new Error(error.message || error.code);
        return data as FudoMenu;
    },
});

export const useFudoImport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string; slug: string; categories: { id: number; name: string; parentName: string | null; color: string }[] }) => {
            const { data, error } = await supabase.rpc('display_fudo_import', { p_commerce_id: p.commerceId, p_slug: p.slug, p_categories: p.categories });
            if (error) throw new Error(error.message || error.code);
            return data as number;
        },
        onSuccess: (_, p) => invalidate(queryClient, p.commerceId),
    });
};

export const useFudoRefresh = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { commerceId: string }) => {
            const { data, error } = await supabase.rpc('display_fudo_refresh', { p_commerce_id: p.commerceId });
            if (error) throw new Error(error.message || error.code);
            return data as number;
        },
        onSuccess: (_, p) => invalidate(queryClient, p.commerceId),
    });
};
