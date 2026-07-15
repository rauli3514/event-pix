import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useReactions = (eventId?: string) => {
    // Enviar una reacción
    const sendReaction = useMutation({
        mutationFn: async ({ emoji, submissionId }: { emoji: string; submissionId?: string }) => {
            if (!eventId) throw new Error("No event ID");

            const { error } = await supabase
                .from('reactions')
                .insert({
                    event_id: eventId,
                    submission_id: submissionId || null, // Opcional: si queremos reaccionar a una foto específica
                    emoji
                });

            if (error) throw error;
        }
    });

    return {
        sendReaction
    };
};
