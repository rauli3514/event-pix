import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Submission } from "@/types";

// Cola del "¡NUEVA FOTO!" en grande (ver components/display/SpotlightOverlay):
// cada una se muestra unos segundos con confeti y pasa a la siguiente.

const SHOW_MS = 9000;
const LOAD_TIMEOUT_MS = 5000;
// Si llegan muchas de golpe ("Aprobar TODO") no se destacan todas:
// solo las más nuevas, el resto sigue en el carrusel normal.
const MAX_QUEUE = 5;

export const useSpotlightQueue = (onActiveChange?: (active: boolean) => void) => {
    const [queue, setQueue] = useState<Submission[]>([]);
    const [loadedId, setLoadedId] = useState<string | null>(null);

    const current = queue[0];
    const ready = !!current && (current.type === 'message' || loadedId === current.id);

    useEffect(() => {
        onActiveChange?.(!!current);
    }, [!!current]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!current) return;
        const advance = () => setQueue((q) => q.slice(1));

        if (!ready) {
            const timeout = setTimeout(advance, LOAD_TIMEOUT_MS);
            return () => clearTimeout(timeout);
        }

        confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, startVelocity: 45 });
        const timeout = setTimeout(advance, SHOW_MS);
        return () => clearTimeout(timeout);
    }, [current?.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Suma lo nuevo en orden de llegada (sin pasarse de MAX_QUEUE) */
    const enqueue = useCallback((items: Submission[]) => {
        if (!items.length) return;
        setQueue((q) => {
            const next = [...q, ...items];
            return next.length > MAX_QUEUE ? [next[0], ...next.slice(-(MAX_QUEUE - 1))] : next;
        });
    }, []);

    return {
        current,
        ready,
        enqueue,
        onLoad: () => current && setLoadedId(current.id),
        onError: () => setQueue((q) => q.slice(1)),
    };
};
