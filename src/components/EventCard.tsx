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
            <div className="relative w-full aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl bg-slate-900 border border-white/10 group">
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
                    <div className="relative w-32 h-32 mb-4 rounded-full p-1.5 bg-black/30 backdrop-blur-sm border border-white/20 shadow-2xl ring-2 ring-white/10">
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

            {/* 2. Action Buttons (Two separated blocks) */}
            <div className="grid grid-cols-2 gap-4">
                <Button
                    onClick={onUploadClick}
                    className="h-16 bg-white hover:bg-slate-100 text-slate-900 font-bold text-lg rounded-2xl shadow-lg border-b-4 border-slate-300 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                >
                    <Camera className="w-6 h-6 group-hover:scale-110 transition-transform text-violet-600" />
                    SELFIE
                </Button>
                <Button
                    onClick={onMessageClick}
                    className="h-16 bg-white hover:bg-slate-100 text-slate-900 font-bold text-lg rounded-2xl shadow-lg border-b-4 border-slate-300 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                >
                    <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform text-violet-600" />
                    MENSAJE
                </Button>
            </div>

            {/* 3. Helper Text */}
            <p className="text-center text-slate-300 text-sm font-medium px-4">
                Comparte tus fotos y envía tus mensajes a la pantalla. <br />
                <span className="text-violet-400">¡Vive la experiencia EventPix!</span>
            </p>

            {/* 4. Audio Button (Pill shape) */}
            {(settings?.audio_messages_enabled ?? true) && (
                <div
                    className="relative h-16 rounded-full bg-slate-800/80 backdrop-blur-md border border-white/10 flex items-center pl-6 pr-2 cursor-pointer group hover:bg-slate-800 transition-colors shadow-lg"
                    onClick={onAudioClick}
                >
                    <div className="flex-1 text-left">
                        <span className="text-white/90 text-sm font-semibold">
                            Envía un audio de recuerdo
                        </span>
                    </div>
                    <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform animate-pulse">
                        <Mic className="text-white w-6 h-6" />
                    </div>
                </div>
            )}

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

