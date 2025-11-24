import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, MessageSquare } from "lucide-react";

interface EventCardProps {
    onUploadClick: () => void;
    onMessageClick: () => void;
}

import { useEventSettings } from "@/hooks/use-event-settings";

export const EventCard = ({ onUploadClick, onMessageClick }: EventCardProps) => {
    const { data: settings } = useEventSettings();

    return (
        <Card className="w-full overflow-hidden rounded-[2rem] shadow-2xl border border-white/50 bg-white/90 backdrop-blur-xl">
            <div className="relative aspect-[4/3] w-full overflow-hidden group">
                <img
                    src={settings?.background_image_url || "/event-hero.jpg"}
                    alt="Event Hero"
                    className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90" />

                <div className="absolute bottom-0 left-0 p-8 w-full space-y-3">
                    <h2 className="text-4xl font-serif font-bold text-white tracking-tight leading-tight drop-shadow-sm">
                        {settings?.title || "EventPix"}
                    </h2>
                    <p className="text-white/90 text-base font-medium leading-relaxed max-w-[90%] drop-shadow-sm">
                        {settings?.description || "Captura el momento, comparte la magia"}
                    </p>
                </div>
            </div>

            <div className="p-8 grid gap-5 bg-white">
                <Button
                    onClick={onUploadClick}
                    className="w-full h-16 text-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-2xl shadow-lg shadow-violet-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Camera className="mr-3 h-6 w-6" />
                    Subir Foto
                </Button>

                <Button
                    onClick={onMessageClick}
                    variant="outline"
                    className="w-full h-16 text-lg font-medium bg-white border-2 border-slate-100 hover:border-violet-100 hover:bg-slate-50 text-slate-700 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                    <MessageSquare className="mr-3 h-6 w-6 text-violet-500" />
                    Dejar Mensaje
                </Button>
            </div>
        </Card>
    );
};
