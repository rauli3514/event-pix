import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DynamicLabel } from "@/types/display";

export interface DisplayLabelGroup {
    id: string;
    commerce_id: string;
    name: string;
    description: string | null;
    labels: DynamicLabel[];
    created_at: string;
    updated_at: string;
}

export const useDisplayLabelGroups = (commerceId?: string) => {
    return useQuery({
        queryKey: ["display_label_groups", commerceId],
        queryFn: async () => {
            if (!commerceId) return [];

            const { data, error } = await supabase
                .from("display_label_groups")
                .select("*")
                .eq("commerce_id", commerceId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as DisplayLabelGroup[];
        },
        enabled: !!commerceId,
        refetchInterval: 30000, // Refetch every 30s so the TV player gets live updates
    });
};

export const useCreateLabelGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ commerceId, name, description, labels }: { commerceId: string, name: string, description?: string, labels: DynamicLabel[] }) => {
            const { data, error } = await supabase
                .from("display_label_groups")
                .insert([{ 
                    commerce_id: commerceId, 
                    name, 
                    description, 
                    labels 
                }])
                .select()
                .single();

            if (error) {
                console.error("Supabase insert error:", error);
                throw error;
            }
            return data as DisplayLabelGroup;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_label_groups", variables.commerceId] });
        }
    });
};

export const useUpdateLabelGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<DisplayLabelGroup> }) => {
            const { data, error } = await supabase
                .from("display_label_groups")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as DisplayLabelGroup;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["display_label_groups", data.commerce_id] });
        }
    });
};

export const useDeleteLabelGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: string, commerceId: string }) => {
            const { error } = await supabase
                .from("display_label_groups")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_label_groups", variables.commerceId] });
        }
    });
};
