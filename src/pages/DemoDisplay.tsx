import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Smartphone, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { GridWall } from "@/components/display/GridTemplate";
import { SpotlightOverlay } from "@/components/display/SpotlightOverlay";
import { DemoComposer } from "@/components/demo/DemoComposer";
import { useSpotlightQueue } from "@/hooks/use-spotlight-queue";
import { useDemoReceiver } from "@/hooks/use-demo-channel";
import { DEMO_SETTINGS, demoInitialItems, isValidDemoSession, newDemoSession, postToSubmission, salesWhatsAppUrl, type DemoPost } from "@/lib/demoWall";
import { Submission } from "@/types";

/**
 * Pantalla de demo ("Probalo gratis" en la landing): un muro ya lleno de fotos
 * de ejemplo con su propio QR. Lo que se manda desde el celular aparece con el
 * "¡NUEVA FOTO!" en grande y queda en la cuadrícula. Cada visitante tiene su
 * sesión: nadie ve las fotos de otro y no se guarda nada.
 */
const DemoDisplay = () => {
    const [params, setParams] = useSearchParams();
    // La sesión va en la dirección (?s=...) para que al recargar siga siendo la misma
    const [session] = useState(() => {
        const s = params.get('s');
        return isValidDemoSession(s) ? s! : newDemoSession();
    });
    useEffect(() => {
        if (params.get('s') !== session) setParams({ s: session }, { replace: true });
    }, [session, params, setParams]);
    const [items, setItems] = useState<Submission[]>(demoInitialItems);
    const [received, setReceived] = useState(0);
    const [composerOpen, setComposerOpen] = useState(false);
    const [spotlightActive, setSpotlightActive] = useState(false);
    const { current, ready, enqueue, onLoad, onError } = useSpotlightQueue(setSpotlightActive);

    const guestUrl = useMemo(() => `${window.location.origin}/demo/${session}`, [session]);

    const receive = useCallback((post: DemoPost) => {
        const item = postToSubmission(post);
        setItems((list) => (list.some((s) => s.id === item.id) ? list : [item, ...list].slice(0, 60)));
        setReceived((n) => n + 1);
        enqueue([item]);
    }, [enqueue]);
    useDemoReceiver(session, receive);

    return (
        <div className="fixed inset-0 overflow-hidden bg-black text-white">
            <GridWall submissions={items} settings={DEMO_SETTINGS} guestUrl={guestUrl} paused={spotlightActive} />
            <SpotlightOverlay current={current} ready={ready} onLoad={onLoad} onError={onError} settings={DEMO_SETTINGS} guestUrl={guestUrl} />

            {/* Cartel de demo: qué hacer y, después de probar, cómo seguir */}
            {!current && (
                <div className="absolute bottom-5 left-5 z-40 flex max-w-[92vw] flex-wrap items-center gap-3 rounded-2xl bg-black/70 px-4 py-3 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
                    <span className="rounded-full bg-fuchsia-600 px-2.5 py-0.5 text-xs font-extrabold tracking-widest">DEMO</span>
                    <span className="text-sm font-semibold sm:text-base">
                        {received === 0 ? 'Escaneá el QR con tu celular y aparecé en la pantalla 👉' : '¿Te imaginás esto en tu fiesta? 🎉'}
                    </span>
                    {received === 0 ? (
                        <button
                            type="button"
                            onClick={() => setComposerOpen(true)}
                            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"
                        >
                            <Smartphone className="h-4 w-4" /> Probar desde este dispositivo
                        </button>
                    ) : (
                        <a
                            href={salesWhatsAppUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-sm font-bold hover:bg-green-500"
                        >
                            <FaWhatsapp className="h-4 w-4" /> Consultá tu fecha
                        </a>
                    )}
                </div>
            )}

            {/* Probar sin un segundo dispositivo (por ejemplo, desde el celular) */}
            {composerOpen && (
                <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
                    <div className="relative w-full max-w-md rounded-3xl bg-slate-900/95 p-5 shadow-2xl ring-1 ring-white/10">
                        <button type="button" onClick={() => setComposerOpen(false)} aria-label="Cerrar" className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 hover:bg-white/10">
                            <X className="h-5 w-5" />
                        </button>
                        <h2 className="mb-4 text-xl font-bold">Subí tu foto a la pantalla</h2>
                        <DemoComposer
                            onSend={async (post) => {
                                receive(post);
                                setComposerOpen(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoDisplay;
