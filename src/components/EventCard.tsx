import { Button } from "@/components/ui/button";

import { Camera, MessageSquare, Mic } from "lucide-react";
import { ReactionBar } from "@/components/ReactionBar";
import { PublicGallery } from "./PublicGallery";

import { useEventSettings } from "@/hooks/use-event-settings";

interface EventCardProps {
    onUploadClick: () => void;
    onMessageClick: () => void;
    onAudioClick: () => void;
    eventId: string;
}

export const EventCard = ({ onUploadClick, onMessageClick, onAudioClick, eventId }: EventCardProps) => {
    const { data: settings } = useEventSettings(eventId);

    // Control para permitir mensajes de texto (default: true si no está definido)
    // const textMessagesEnabled = settings?.text_messages_enabled ?? true;

    return (
        <div className="w-full max-w-md mx-auto space-y-6">
            {/* 1. Main Visual Card (Recuadro Grande) */}
            <div className="relative w-full aspect-[16/10] rounded-[2rem] overflow-hidden shadow-2xl bg-slate-900 border border-white/10 group">
                {/* Theme Background */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={settings?.background_image_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"}
                        alt="Event Banner"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />
                    {/* Gradient overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
                </div>

                {/* Content: Logo Circle + Title */}
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
                    {/* Circle Logo */}
                    <div className="relative w-28 h-28 mb-3 rounded-full p-1.5 bg-black/30 backdrop-blur-sm border border-white/20 shadow-2xl ring-2 ring-white/10">
                        {settings?.splash_logo_url ? (
                            <img
                                src={settings.splash_logo_url}
                                alt="Logo Evento"
                                className="w-full h-full object-cover rounded-full shadow-inner"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center border border-white/10">
                                <span className="text-4xl">🎉</span>
                            </div>
                        )}
                    </div>

                    {/* Event Title */}
                    <h2 className={`text-3xl md:text-4xl font-bold ${settings?.font_family || 'font-sans'} text-white drop-shadow-md leading-tight`}>
                        {settings?.title || "EventPix"}
                    </h2>
                    {settings?.description && (
                        <p className="text-white/80 text-sm mt-2 font-medium drop-shadow">{settings.description}</p>
                    )}
                </div>
            </div>

            {/* 2. Acción principal: una sola, bien grande */}
            <Button
                onClick={onUploadClick}
                className="w-full h-20 rounded-3xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:opacity-95 text-white text-xl font-extrabold shadow-2xl shadow-violet-900/50 ring-2 ring-white/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-3 [&_svg]:size-7"
            >
                <Camera className="w-8 h-8" />
                Subí tu foto a la pantalla
            </Button>
            <p className="-mt-3 text-center text-slate-300 text-sm font-medium">
                Aparece en la pantalla gigante en segundos ✨
            </p>

            {/* 3. Acciones secundarias */}
            <div className={`grid gap-3 ${(settings?.audio_messages_enabled ?? true) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Button
                    onClick={onMessageClick}
                    variant="ghost"
                    className="h-14 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold border border-white/15 backdrop-blur-md flex items-center justify-center gap-2"
                >
                    <MessageSquare className="w-5 h-5 text-violet-300" />
                    Dejá un mensaje
                </Button>
                {(settings?.audio_messages_enabled ?? true) && (
                    <Button
                        onClick={onAudioClick}
                        variant="ghost"
                        className="h-14 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold border border-white/15 backdrop-blur-md flex items-center justify-center gap-2"
                    >
                        <Mic className="w-5 h-5 text-rose-300" />
                        Mandá un audio
                    </Button>
                )}
            </div>

            {/* 5. Extra Content (Reactions/Gallery) */}
            <div className="space-y-4 pt-4">
                {(settings?.reactions_enabled ?? true) && (
                    <div className="flex justify-center">
                        <ReactionBar eventId={eventId} />
                    </div>
                )}
                <PublicGallery eventId={eventId} />
            </div>
        </div>
    );
};

