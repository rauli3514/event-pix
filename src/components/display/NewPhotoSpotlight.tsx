import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { useEvent } from "@/context/EventContext";
import { isAnonymousAuthor } from "@/lib/guestSubmissions";
import { Submission } from "@/types";

const SHOW_MS = 9000;
const LOAD_TIMEOUT_MS = 5000;
// Si se aprueban muchas de golpe ("Aprobar TODO") no se destacan todas:
// solo las más nuevas, el resto sigue en el carrusel normal.
const MAX_QUEUE = 5;

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

    const [queue, setQueue] = useState<Submission[]>([]);
    const [loadedId, setLoadedId] = useState<string | null>(null);
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
        const ordered = fresh.slice(0, MAX_QUEUE).reverse();
        setQueue((q) => {
            const next = [...q, ...ordered];
            return next.length > MAX_QUEUE ? [next[0], ...next.slice(-(MAX_QUEUE - 1))] : next;
        });
    }, [submissions, hasLoaded]);

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

    const appUrl = useMemo(
        () => (event?.slug ? `${window.location.origin}/${event.slug}` : window.location.origin),
        [event?.slug]
    );

    const author = current && !isAnonymousAuthor(current.author) ? current.author : null;
    const isPhoto = current?.type === 'photo';

    return (
        <AnimatePresence mode="wait">
            {current && (
                <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`absolute inset-0 z-50 overflow-hidden bg-black text-white ${settings?.font_family || 'font-sans'}`}
                >
                    {/* Fondo: la misma foto desenfocada, o el skin del evento para mensajes */}
                    <img
                        src={isPhoto ? current.content : settings?.background_image_url || undefined}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-3xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/85" />

                    {/* Cartel superior */}
                    <motion.div
                        initial={{ y: -80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
                        className="absolute inset-x-0 top-[4vh] z-10 flex justify-center"
                    >
                        <div className="animate-pulse rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-[3vh] py-[1.2vh] text-[3.4vh] font-extrabold tracking-wide shadow-2xl ring-4 ring-white/25">
                            {isPhoto ? '📸 ¡NUEVA FOTO!' : '💬 ¡NUEVO MENSAJE!'}
                        </div>
                    </motion.div>

                    {isPhoto ? (
                        <div className="absolute inset-0 flex items-center justify-center px-[4vw] pb-[19vh] pt-[13vh]">
                            <motion.img
                                src={current.content}
                                alt="Nueva foto"
                                onLoad={() => setLoadedId(current.id)}
                                onError={() => setQueue((q) => q.slice(1))}
                                initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
                                animate={ready ? { scale: 1, rotate: -1.5, opacity: 1 } : { scale: 0.6, rotate: -8, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 110, damping: 13 }}
                                className="max-h-full max-w-full rounded-xl border-[1.2vh] border-white bg-white object-contain shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
                            />
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center px-[8vw] pb-[19vh] pt-[13vh]">
                            <motion.p
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 120, damping: 14 }}
                                className="text-center font-serif text-[6vh] font-medium italic leading-tight drop-shadow-2xl"
                            >
                                “{current.content}”
                            </motion.p>
                        </div>
                    )}

                    {/* Nombre y dedicatoria */}
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                        className="absolute inset-x-0 bottom-[4vh] z-10 flex flex-col items-center px-[18vh] text-center"
                    >
                        <p className="text-[5vh] font-extrabold leading-tight drop-shadow-xl">
                            {author ? (isPhoto ? `Foto de ${author}` : author) : isPhoto ? '¡Recién llegada!' : ''}
                        </p>
                        {isPhoto && current.caption && (
                            <p className="mt-[1vh] line-clamp-2 text-[3.4vh] italic text-white/90 drop-shadow-lg">
                                “{current.caption}”
                            </p>
                        )}
                    </motion.div>

                    {/* QR: es el mejor momento para que otro se anime */}
                    <div className="absolute bottom-[4vh] right-[2vh] z-10 flex flex-col items-center gap-[0.8vh] rounded-2xl bg-white p-[1.2vh] shadow-2xl">
                        <QRCode value={appUrl} size={110} />
                        <span className="text-[1.6vh] font-bold text-black">¡Subí la tuya!</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
