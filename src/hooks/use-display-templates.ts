import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type TemplateCategory = {
    id: string;
    name: string;
    icon: string;
    order_index: number;
    status: 'active' | 'inactive';
    created_at: string;
};

export type Template = {
    id: string;
    category_id: string;
    name: string;
    description: string;
    thumbnail_url: string;
    canva_url: string;
    orientation: 'vertical' | 'horizontal' | 'square';
    format: string;
    order_index: number;
    status: 'active' | 'draft';
    created_at: string;
};

// --- Categories Hooks ---

export const useTemplateCategories = () => {
    return useQuery({
        queryKey: ['display_template_categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('display_template_categories')
                .select('*')
                .order('order_index', { ascending: true })
                .order('name', { ascending: true });
            
            if (error) throw error;
            return data as TemplateCategory[];
        }
    });
};

export const useCreateTemplateCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (category: Partial<TemplateCategory>) => {
            const { data, error } = await supabase
                .from('display_template_categories')
                .insert([category])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_template_categories'] });
            toast.success('Categoría creada correctamente');
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
    });
};

export const useUpdateTemplateCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<TemplateCategory> }) => {
            const { data, error } = await supabase
                .from('display_template_categories')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_template_categories'] });
            toast.success('Categoría actualizada');
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
    });
};

export const useDeleteTemplateCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('display_template_categories')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_template_categories'] });
            toast.success('Categoría eliminada');
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
    });
};

// --- Templates Hooks ---

export const useTemplates = (categoryId?: string) => {
    return useQuery({
        queryKey: ['display_templates', categoryId],
        queryFn: async () => {
            let query = supabase
                .from('display_templates')
                .select('*')
                .order('order_index', { ascending: true })
                .order('created_at', { ascending: false });
                
            if (categoryId) {
                query = query.eq('category_id', categoryId);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data as Template[];
        }
    });
};

export const useCreateTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (template: Partial<Template>) => {
            const { data, error } = await supabase
                .from('display_templates')
                .insert([template])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_templates'] });
            toast.success('Plantilla creada correctamente');
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
    });
};

export const useUpdateTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Template> }) => {
            const { data, error } = await supabase
                .from('display_templates')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_templates'] });
            toast.success('Plantilla actualizada');
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
    });
};

export const useDeleteTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('display_templates')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_templates'] });
            toast.success('Plantilla eliminada');
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
    });
};
