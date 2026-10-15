import { useEffect } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import type { EventSettings } from "@/hooks/use-event-settings";

// Reacciones de los invitados (emojis que suben) y efectos del DJ, en cualquier
// diseño del muro (Presentación, Cuadrícula o Mosaico).

const triggerReaction = (emoji: string) => {
    const scalar = 4; // emojis grandes
    const emojiShape = confetti.shapeFromText({ text: emoji, scalar });
    confetti({
        particleCount: 20,
        scalar,
        shapes: [emojiShape],
        spread: 100,
        origin: { x: Math.random(), y: 1.1 }, // desde abajo
        gravity: 0.35, // flotan
        drift: 0,
        ticks: 400, // ~4 segundos en pantalla
        startVelocity: 50,
        decay: 0.92,
        colors: ['#ffffff'],
    });
};

const triggerDjVisuals = (effect: string) => {
    // Origen central inferior, movimiento hacia arriba
    const common = { origin: { x: 0.5, y: 0.85 }, ticks: 600, gravity: 0.6, decay: 0.96, startVelocity: 45, scalar: 2 };

    if (effect === 'siren') {
        confetti({ ...common, particleCount: 80, spread: 40, colors: ['#ff0000', '#ffffff'] });
    } else if (effect === 'love') {
        const heart = confetti.shapeFromText({ text: '❤️', scalar: 3 });
        confetti({ ...common, particleCount: 40, shapes: [heart], gravity: 0.3, spread: 50, startVelocity: 35, scalar: 3 });
    } else if (effect === 'party') {
        confetti({ ...common, particleCount: 100, spread: 60 });
    } else if (effect === 'camera') {
        confetti({ ...common, particleCount: 60, spread: 360, startVelocity: 25, colors: ['#ffffff'], ticks: 100, origin: { x: 0.5, y: 0.5 }, scalar: 1.5 });
    }
};

export const useWallEffects = (eventId: string | undefined, settings: EventSettings | null | undefined) => {
    const reactionsOn = settings?.reactions_enabled !== false;
    const djOn = settings?.dj_mode_enabled !== false;

    useEffect(() => {
        if (!eventId || !reactionsOn) return;
        const channel = supabase
            .channel('public:reactions')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'reactions', filter: `event_id=eq.${eventId}` },
                (payload) => triggerReaction((payload.new as { emoji: string }).emoji)
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [eventId, reactionsOn]);

    useEffect(() => {
        if (!eventId || !djOn) return;
        const channel = supabase.channel('dj-effects');
        channel.on('broadcast', { event: 'dj-effect' }, (payload) => {
            if (payload.payload.eventId === eventId) triggerDjVisuals(payload.payload.effect);
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [eventId, djOn]);
};
