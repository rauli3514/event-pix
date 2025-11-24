import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface EventSettings {
    id: string;
    title: string;
    description: string;
    background_image_url: string | null;
    display_background_url: string | null;
    display_template: 'grid' | 'slideshow' | 'masonry';
    created_at: string;
    updated_at: string;
}

export const useEventSettings = (eventId?: string) => {
    return useQuery({
        queryKey: ["event-settings", eventId],
        queryFn: async () => {
            if (!eventId) return null;

            const { data, error } = await supabase
                .from("event_settings")
                .select("*")
                .eq("event_id", eventId)
                .maybeSingle();

            if (error) {
                console.error("Error fetching settings:", error);
                return null;
            }

            return data as EventSettings;
        },
        retry: 1,
        staleTime: 1000 * 60 * 5, // 5 minutes
        enabled: !!eventId,
    });
};

export const useUpdateEventSettings = (eventId?: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: Partial<EventSettings>) => {
            const { data, error } = await supabase
                .from("event_settings")
                .update({
                    ...settings,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", settings.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["event-settings", eventId] });
        },
    });
};

export const useUploadEventImage = () => {
    return useMutation({
        mutationFn: async (file: File) => {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("event-images")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from("event-images")
                .getPublicUrl(filePath);

            return data.publicUrl;
        },
    });
};
