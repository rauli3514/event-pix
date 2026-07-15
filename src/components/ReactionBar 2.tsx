import { useState } from "react";
import { useReactions } from "@/hooks/use-reactions";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const REACTION_EMOJIS = [
    { id: 'love', emoji: '❤️', label: 'Me encanta' },
    { id: 'fire', emoji: '🔥', label: 'Fuego' },
    { id: 'laugh', emoji: '😂', label: 'Jaja' },
    { id: 'clap', emoji: '👏', label: 'Aplausos' },
    { id: 'party', emoji: '✨', label: 'Fiesta' }
];

interface ReactionBarProps {
    eventId: string;
}

export const ReactionBar = ({ eventId }: ReactionBarProps) => {
    const { sendReaction } = useReactions(eventId);
    const [lastReacted, setLastReacted] = useState<string | null>(null);

    const handleReaction = (emoji: string) => {
        // Feedback vibración (si el dispositivo soporta)
        if (navigator.vibrate) navigator.vibrate(50);

        // Animación local
        setLastReacted(emoji);
        setTimeout(() => setLastReacted(null), 1000);

        // Enviar a Supabase (Fire and forget para UX rápida)
        sendReaction.mutate({ emoji });
    };

    return (
        <div className="w-full py-4 px-2">
            <p className="text-center text-sm text-slate-500 mb-3 font-medium">
                ¡Reaccioná en vivo a la pantalla!
            </p>
            <div className="flex justify-center gap-2 md:gap-4">
                {REACTION_EMOJIS.map((item) => (
                    <div key={item.id} className="relative">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 md:h-14 md:w-14 rounded-full text-2xl md:text-3xl bg-white/80 backdrop-blur border-slate-200 shadow-sm hover:scale-110 transition-transform active:scale-90"
                            onClick={() => handleReaction(item.emoji)}
                        >
                            {item.emoji}
                        </Button>

                        {/* Animación de feedback al pulsar */}
                        <AnimatePresence>
                            {lastReacted === item.emoji && (
                                <motion.div
                                    initial={{ opacity: 1, y: 0, scale: 0.5 }}
                                    animate={{ opacity: 0, y: -50, scale: 1.5 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.8 }}
                                    className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
                                >
                                    <span className="text-3xl">{item.emoji}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
};
