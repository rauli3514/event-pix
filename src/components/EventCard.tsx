import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { ReactionBar } from "@/components/ReactionBar";
import { PublicGallery } from "./PublicGallery";

import { useEventSettings } from "@/hooks/use-event-settings";

interface EventCardProps {
    onUploadClick: () => void;
    onMessageClick: () => void;
    eventId: string;
}

export const EventCard = ({ onUploadClick, onMessageClick, eventId }: EventCardProps) => {
    const { data: settings } = useEventSettings(eventId);
    const [darkMode, setDarkMode] = useState(false);

    // Detectar preferencia de modo oscuro del sistema
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setDarkMode(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Control para permitir mensajes de texto (default: true si no está definido)
    const textMessagesEnabled = settings?.text_messages_enabled ?? true;

    return (
        <Card className={`w-full overflow-hidden rounded-[2rem] shadow-2xl border transition-colors duration-300 ${darkMode
            ? 'border-slate-700 bg-slate-800/90 backdrop-blur-xl hover:shadow-violet-900/50'
            : 'border-white/60 bg-white/80 backdrop-blur-xl hover:shadow-3xl'
            }`}>
            <div className="relative aspect-[4/5] w-full overflow-hidden group">
                <img
                    src={settings?.background_image_url || "/event-hero.jpg"}
                    alt="Event Hero"
                    className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                <div className="absolute bottom-0 left-0 p-8 w-full space-y-2">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight leading-tight drop-shadow-md capitalize">
                        {settings?.title || "EventPix"}
                    </h2>
                    <p className="text-white/90 text-sm md:text-base font-medium leading-relaxed drop-shadow-sm">
                        {settings?.description || "Captura el momento, comparte la magia"}
                    </p>
                </div>
            </div>

            <div className={`p-8 grid gap-4 transition-colors duration-300 ${darkMode ? 'bg-slate-800/70 backdrop-blur-sm' : 'bg-white/50 backdrop-blur-sm'
                }`}>
                <Button
                    onClick={onUploadClick}
                    className="w-full h-14 text-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg shadow-violet-200 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                    <Camera className="h-5 w-5" />
                    Subir Foto
                </Button>

                {/* Solo mostrar botón de mensaje si está habilitado */}
                {textMessagesEnabled ? (
                    <Button
                        onClick={onMessageClick}
                        variant="outline"
                        className={`w-full h-14 text-lg font-medium rounded-full transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 ${darkMode
                            ? 'bg-slate-700 border-2 border-slate-600 hover:border-violet-400 hover:bg-slate-600 text-white'
                            : 'bg-slate-50 border-2 border-slate-200 hover:border-violet-200 hover:bg-white text-slate-700'
                            }`}
                    >
                        <MessageSquare className="h-5 w-5 text-violet-500" />
                        Dejar Mensaje
                    </Button>
                ) : (
                    <p className={`text-center text-sm py-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        En este evento solo podés subir fotos.
                    </p>
                )}

                {/* Barra de Reacciones en Vivo */}
                {(settings?.reactions_enabled ?? true) && (
                    <div className="pt-2 border-t border-slate-100/50">
                        <ReactionBar eventId={eventId} />
                    </div>
                )}

                {/* Galería Pública (Solo si está activada) */}
                <PublicGallery eventId={eventId} />

                {/* Banner de marca fijo abajo */}
                {settings?.frame_enabled && settings?.frame_image_url && (
                    <div className="mt-2 w-full flex justify-center">
                        <img
                            src={settings.frame_image_url}
                            alt="Patrocinado por"
                            className="h-12 w-auto object-contain opacity-90"
                        />
                    </div>
                )}
            </div>
        </Card>
    );
};
