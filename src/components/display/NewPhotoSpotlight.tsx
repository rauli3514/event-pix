import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { useEvent } from "@/context/EventContext";
import { SpotlightOverlay } from "@/components/display/SpotlightOverlay";
import { useSpotlightQueue } from "@/hooks/use-spotlight-queue";

interface NewPhotoSpotlightProps {
    eventId: string;
    onActiveChange?: (active: boolean) => void;
}

/**
 * "¡Estás en pantalla!": cada foto o mensaje recién aprobado interrumpe lo que
 * se esté mostrando, aparece en grande con el nombre y la dedicatoria, y
 * después la pantalla sigue como venía. Funciona sobre cualquier plantilla.
 */
export const NewPhotoSpotlight = ({ eventId, onActiveChange }: NewPhotoSpotlightProps) => {
    const queryClient = useQueryClient();
    const { submissions, hasLoaded } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const { event } = useEvent();

    const { current, ready, enqueue, onLoad, onError } = useSpotlightQueue(onActiveChange);
    const seenRef = useRef<Set<string> | null>(null);

    // Tiempo real: apenas cambia algo, se vuelve a pedir la lista (además del
    // refresco cada 5 s que ya existía, por si el tiempo real se cae).
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const channel = supabase
            .channel(`submissions-live-${eventId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${eventId}` },
                () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
                        queryClient.invalidateQueries({ queryKey: ['photos', eventId] });
                    }, 300);
                }
            )
            .subscribe();

        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [eventId, queryClient]);

    // Detectar lo recién aprobado. Lo que ya estaba al abrir la pantalla no se destaca.
    useEffect(() => {
        if (!hasLoaded) return;
        const approved = submissions.filter(
            (s) => s.status === 'approved' && (s.type === 'photo' || s.type === 'message')
        );

        if (seenRef.current === null) {
            seenRef.current = new Set(approved.map((s) => s.id));
            return;
        }

        const seen = seenRef.current;
        const fresh = approved.filter((s) => !seen.has(s.id));
        if (fresh.length === 0) return;
        fresh.forEach((s) => seen.add(s.id));

        // La lista viene de más nueva a más vieja: se muestran en orden de llegada
        enqueue(fresh.slice(0, 5).reverse());
    }, [submissions, hasLoaded, enqueue]);

    const appUrl = useMemo(
        () => (event?.slug ? `${window.location.origin}/${event.slug}` : window.location.origin),
        [event?.slug]
    );

    return <SpotlightOverlay current={current} ready={ready} onLoad={onLoad} onError={onError} settings={settings} guestUrl={appUrl} />;
};
