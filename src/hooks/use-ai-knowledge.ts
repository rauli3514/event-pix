import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useAIPersonality = (commerceId?: string) => {
    return useQuery({
        queryKey: ["ai_personality", commerceId],
        queryFn: async () => {
            if (!commerceId) return null;
            const { data, error } = await supabase
                .from("ai_personality")
                .select("*")
                .eq("commerce_id", commerceId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
        enabled: !!commerceId
    });
};

export const useAIFaqs = (commerceId?: string) => {
    return useQuery({
        queryKey: ["ai_faq", commerceId],
        queryFn: async () => {
            if (!commerceId) return [];
            const { data, error } = await supabase
                .from("ai_faq")
                .select("*")
                .eq("commerce_id", commerceId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!commerceId
    });
};

export const useAIKnowledge = (commerceId?: string) => {
    return useQuery({
        queryKey: ["ai_knowledge", commerceId],
        queryFn: async () => {
            if (!commerceId) return [];
            const { data, error } = await supabase
                .from("ai_knowledge")
                .select("*")
                .eq("commerce_id", commerceId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!commerceId
    });
};

export const useAIPrompts = (commerceId?: string) => {
    return useQuery({
        queryKey: ["ai_prompts", commerceId],
        queryFn: async () => {
            if (!commerceId) return [];
            const { data, error } = await supabase
                .from("ai_prompts")
                .select("*")
                .eq("commerce_id", commerceId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!commerceId
    });
};
