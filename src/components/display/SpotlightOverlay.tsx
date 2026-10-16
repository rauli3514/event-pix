import { AnimatePresence, motion } from "framer-motion";
import QRCode from "react-qr-code";
import { accentGradient } from "@/lib/wallAccent";
import { isAnonymousAuthor } from "@/lib/guestSubmissions";
import type { EventSettings } from "@/hooks/use-event-settings";
import { Submission } from "@/types";

// "¡NUEVA FOTO!" en grande, cómo se ve. La cola está en useSpotlightQueue.
// Lo usan la pantalla del evento (NewPhotoSpotlight) y la demo de la landing.

interface SpotlightOverlayProps {
    current?: Submission;
    ready: boolean;
    onLoad: () => void;
    onError: () => void;
    settings?: Pick<EventSettings, 'font_family' | 'background_image_url' | 'accent_color'> | null;
    /** A dónde lleva el QR de la esquina ("¡Subí la tuya!") */
    guestUrl: string;
}

export const SpotlightOverlay = ({ current, ready, onLoad, onError, settings, guestUrl }: SpotlightOverlayProps) => {
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
                        <div className="animate-pulse rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-[3vh] py-[1.2vh] text-[3.4vh] font-extrabold tracking-wide shadow-2xl ring-4 ring-white/25" style={accentGradient(settings?.accent_color)}>
                            {isPhoto ? '📸 ¡NUEVA FOTO!' : '💬 ¡NUEVO MENSAJE!'}
                        </div>
                    </motion.div>

                    {isPhoto ? (
                        <div className="absolute inset-0 flex items-center justify-center px-[4vw] pb-[19vh] pt-[13vh]">
                            <motion.img
                                src={current.content}
                                alt="Nueva foto"
                                onLoad={onLoad}
                                onError={onError}
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
                        <QRCode value={guestUrl} size={110} />
                        <span className="text-[1.6vh] font-bold text-black">¡Subí la tuya!</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
