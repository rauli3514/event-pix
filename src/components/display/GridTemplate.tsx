import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings, type EventSettings } from "@/hooks/use-event-settings";
import { useWallEffects } from "@/hooks/use-wall-effects";
import { useGuestUrl } from "@/hooks/use-wall";
import { useEvent } from "@/context/EventContext";
import { getWallStats, wallItems } from "@/lib/wallStats";
import { accentVars } from "@/lib/wallAccent";
import { RouletteModal } from "@/components/display/RouletteModal";
import { MessageCard, PhotoCredit, WallBackground, WallEmpty, WallHeader } from "@/components/display/WallChrome";
import { Submission } from "@/types";

// "Cuadrícula viva": 12 fotos y mensajes a la vez; cada pocos segundos una
// casilla cambia por otra, así la pantalla siempre se mueve sin marear.

const TILES = 12;
const SWAP_MS = 3500;

/** Lo que se borró se reemplaza en su lugar y las casillas libres se llenan con lo más nuevo */
const reconcileSlots = (prev: string[], pool: Submission[]) => {
    const ids = new Set(pool.map((s) => s.id));
    const want = Math.min(TILES, pool.length);
    const shown = new Set(prev.filter((id) => ids.has(id)));
    const fresh = pool.filter((s) => !shown.has(s.id)).map((s) => s.id);
    const next = prev
        .map((id) => (ids.has(id) ? id : fresh.shift()))
        .filter((id): id is string => !!id)
        .slice(0, want);
    while (next.length < want && fresh.length) next.push(fresh.shift()!);
    return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
};

interface GridTemplateProps {
    eventId?: string;
    /** Quieto mientras se destaca una foto nueva encima */
    paused?: boolean;
}

export const GridTemplate = ({ eventId, paused = false }: GridTemplateProps) => {
    const { submissions } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const { event } = useEvent();
    useWallEffects(eventId, settings);
    const guestUrl = useGuestUrl(event);

    return (
        <GridWall submissions={submissions} settings={settings} guestUrl={guestUrl} paused={paused}>
            <RouletteModal />
        </GridWall>
    );
};

interface GridWallProps {
    submissions: Submission[];
    settings?: EventSettings | null;
    guestUrl: string;
    paused?: boolean;
    children?: ReactNode;
}

/** La cuadrícula en sí, con los datos que le pasen (la usa también la demo de la landing) */
export const GridWall = ({ submissions, settings, guestUrl, paused = false, children }: GridWallProps) => {
    const stats = useMemo(() => getWallStats(submissions), [submissions]);
    const pool = useMemo(() => wallItems(submissions), [submissions]);
    const byId = useMemo(() => new Map(pool.map((s) => [s.id, s])), [pool]);

    // Qué hay en cada casilla (ids). Arranca con lo más nuevo.
    const [slots, setSlots] = useState<string[]>(() => reconcileSlots([], pool));
    const cursorRef = useRef(0);
    const lastSlotRef = useRef(-1);

    // Altas y bajas: se ajusta en el mismo render en que cambia la lista
    const [prevPool, setPrevPool] = useState(pool);
    if (pool !== prevPool) {
        setPrevPool(pool);
        setSlots(reconcileSlots(slots, pool));
    }

    // Fotos que ya pasaron por pantalla: las nuevas tienen prioridad al rotar
    const everShownRef = useRef(new Set<string>());
    useEffect(() => { slots.forEach((id) => everShownRef.current.add(id)); }, [slots]);

    // Cada tanto una casilla al azar muestra otra foto que no esté en pantalla
    useEffect(() => {
        if (paused || pool.length <= TILES) return;
        const timer = setInterval(() => {
            setSlots((prev) => {
                const shown = new Set(prev);
                const candidates = pool.filter((s) => !shown.has(s.id));
                if (!candidates.length) return prev;
                const neverShown = candidates.find((s) => !everShownRef.current.has(s.id));
                const incoming = neverShown ?? candidates[cursorRef.current++ % candidates.length];
                let slot = Math.floor(Math.random() * prev.length);
                if (slot === lastSlotRef.current) slot = (slot + 1) % prev.length;
                lastSlotRef.current = slot;
                const next = [...prev];
                next[slot] = incoming.id;
                return next;
            });
        }, SWAP_MS);
        return () => clearInterval(timer);
    }, [paused, pool]);

    const items = slots.map((id) => byId.get(id)).filter(Boolean) as Submission[];
    // Con pocas fotos se agrandan las casillas
    const fitWhole = items.length <= 6;
    const cols = items.length <= 4 ? 'grid-cols-2 portrait:grid-cols-2' : items.length <= 6 ? 'grid-cols-3 portrait:grid-cols-2' : 'grid-cols-4 portrait:grid-cols-3';

    return (
        <div
            className={`absolute inset-0 flex flex-col overflow-hidden bg-black text-white ${settings?.font_family || 'font-sans'}`}
            style={accentVars(settings?.accent_color)}
        >
            <WallBackground settings={settings} dim="strong" />
            <WallHeader settings={settings} stats={stats} guestUrl={guestUrl} variant="bar" showQr={items.length > 0} />

            {items.length === 0 ? (
                <WallEmpty settings={settings} guestUrl={guestUrl} />
            ) : (
                <main className={`relative z-10 grid flex-1 min-h-0 auto-rows-fr gap-4 px-8 pb-8 portrait:px-5 portrait:pb-5 ${cols}`}>
                    {slots.map((id, i) => {
                        const item = byId.get(id);
                        if (!item) return null;
                        return (
                            <div key={i} className="relative min-h-0 overflow-hidden rounded-2xl bg-white/5 shadow-2xl ring-1 ring-white/10">
                                <AnimatePresence initial={false}>
                                    <motion.div
                                        key={item.id}
                                        className="absolute inset-0"
                                        initial={{ opacity: 0, scale: 1.08 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.9, ease: 'easeOut' }}
                                    >
                                        {item.type === 'photo' ? (
                                            <>
                                                {fitWhole ? (
                                                    // Casillas grandes: la foto entera sobre una copia desenfocada (no se cortan caras)
                                                    <>
                                                        <img src={item.content} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-2xl" />
                                                        <img src={item.content} alt="" className="relative h-full w-full object-contain" />
                                                    </>
                                                ) : (
                                                    <img src={item.content} alt="" className="h-full w-full object-cover object-[center_30%]" />
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-10">
                                                    <PhotoCredit item={item} size="sm" />
                                                </div>
                                            </>
                                        ) : (
                                            <MessageCard item={item} className="h-full w-full rounded-none border-0" />
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </main>
            )}

            {children}
        </div>
    );
};
