import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, MessageSquare } from "lucide-react";

import { useEventSettings } from "@/hooks/use-event-settings";

interface EventCardProps {
    onUploadClick: () => void;
    onMessageClick: () => void;
    eventId?: string;
}

export const EventCard = ({ onUploadClick, onMessageClick, eventId }: EventCardProps) => {
    const { data: settings } = useEventSettings(eventId);

    return (
        <Card className="w-full overflow-hidden rounded-[2rem] shadow-2xl border border-white/60 bg-white/80 backdrop-blur-xl hover:shadow-3xl transition-shadow duration-500">
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

            <div className="p-8 grid gap-4 bg-white/50 backdrop-blur-sm">
                <Button
                    onClick={onUploadClick}
                    className="w-full h-14 text-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg shadow-violet-200 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                    <Camera className="h-5 w-5" />
                    Subir Foto
                </Button>

                <Button
                    onClick={onMessageClick}
                    variant="outline"
                    className="w-full h-14 text-lg font-medium bg-slate-50 border-2 border-slate-200 hover:border-violet-200 hover:bg-white text-slate-700 rounded-full transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                    <MessageSquare className="h-5 w-5 text-violet-500" />
                    Dejar Mensaje
                </Button>
            </div>
        </Card>
    );
};
