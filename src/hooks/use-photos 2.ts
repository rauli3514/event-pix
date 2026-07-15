import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Photo {
    id: string;
    image_url: string;
    message: string | null;
    created_at: string;
}

export const usePhotos = (eventId?: string) => {
    return useQuery({
        queryKey: ["photos", eventId],
        queryFn: async () => {
            let query = supabase
                .from("submissions")
                .select("*")
                .eq("status", "approved")
                .eq("type", "photo")
                .order("created_at", { ascending: false });

            if (eventId) {
                query = query.eq("event_id", eventId);
            }

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map((item) => ({
                id: item.id,
                image_url: item.content,
                message: item.author,
                created_at: item.created_at,
            })) as Photo[];
        },
        refetchInterval: 5000, // Refresh every 5 seconds
    });
};
