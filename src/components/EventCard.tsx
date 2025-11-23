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
        <Card className="w-full max-w-md mx-auto overflow-hidden glass-card border-none">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
                <img
                    src={settings?.background_image_url || "/event-hero.jpg"}
                    alt="Event Hero"
                    className="object-cover w-full h-full transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 w-full">
                    <h2 className="text-3xl font-serif text-white mb-2">{settings?.title || "Boda de Ana & Carlos"}</h2>
                    <p className="text-white/80 text-sm">{settings?.description || "Comparte tus mejores momentos con nosotros"}</p>
                </div>
            </div>

            <div className="p-6 grid gap-4">
                <Button
                    onClick={onUploadClick}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow transition-all hover:-translate-y-1"
                >
                    <Camera className="mr-2 h-5 w-5" />
                    Tomar Selfie
                </Button>

                <Button
                    onClick={onMessageClick}
                    variant="secondary"
                    className="w-full h-14 text-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg transition-all hover:-translate-y-1"
                >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Enviar Mensaje
                </Button>
            </div>
        </Card>
    );
};
