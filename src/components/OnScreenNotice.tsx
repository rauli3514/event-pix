import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import { forgetMySubmissions, getMySubmissions } from "@/lib/guestSubmissions";

const POLL_MS = 4000;
const SHOW_MS = 9000;

interface OnScreenNoticeProps {
    eventId: string;
}

/**
 * Le avisa al invitado, en su celular, que lo que subió ya salió en la
 * pantalla grande. Solo consulta mientras tenga envíos esperando aprobación,
 * y solo por esos IDs (los invitados solo pueden leer filas aprobadas).
 */
export const OnScreenNotice = ({ eventId }: OnScreenNoticeProps) => {
    const [notice, setNotice] = useState<'photo' | 'message' | null>(null);

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            const mine = getMySubmissions(eventId).filter((s) => s.type !== 'audio');
            if (mine.length === 0) return;

            const { data, error } = await supabase
                .from('submissions')
                .select('id, type')
                .in('id', mine.map((s) => s.id))
                .eq('status', 'approved');

            if (cancelled || error || !data || data.length === 0) return;

            forgetMySubmissions(eventId, data.map((s) => s.id));
            setNotice(data.some((s) => s.type === 'photo') ? 'photo' : 'message');
            navigator.vibrate?.([200, 100, 200]);
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.2 } });
        };

        check();
        const interval = setInterval(check, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [eventId]);

    useEffect(() => {
        if (!notice) return;
        const timeout = setTimeout(() => setNotice(null), SHOW_MS);
        return () => clearTimeout(timeout);
    }, [notice]);

    return (
        <AnimatePresence>
            {notice && (
                <motion.button
                    type="button"
                    onClick={() => setNotice(null)}
                    initial={{ y: -120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -120, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    className="fixed top-4 left-4 right-4 z-[200] mx-auto max-w-md rounded-3xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 p-5 text-left text-white shadow-2xl ring-2 ring-white/30"
                >
                    <div className="flex items-center gap-4">
                        <span className="text-5xl animate-bounce">📺</span>
                        <div>
                            <p className="text-xl font-extrabold leading-tight">
                                {notice === 'photo' ? '¡Tu foto está en la pantalla!' : '¡Tu mensaje está en la pantalla!'}
                            </p>
                            <p className="mt-1 text-sm font-medium text-white/90">Mirá para arriba 👀 ¡Ahora mismo!</p>
                        </div>
                    </div>
                </motion.button>
            )}
        </AnimatePresence>
    );
};
