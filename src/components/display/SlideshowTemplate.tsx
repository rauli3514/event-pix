import { useState, useEffect } from "react";
import { usePhotos } from "@/hooks/use-photos";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideshowTemplateProps {
    eventId?: string;
}

export const SlideshowTemplate = ({ eventId }: SlideshowTemplateProps) => {
    const { data: photos, isLoading } = usePhotos(eventId);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!photos || photos.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % photos.length);
        }, 5000); // Change photo every 5 seconds

        return () => clearInterval(interval);
    }, [photos]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-muted-foreground">Cargando fotos...</div>
            </div>
        );
    }

    if (!photos || photos.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center space-y-2">
                    <p className="text-2xl font-serif text-foreground">
                        Aún no hay fotos
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Las fotos aparecerán aquí cuando los invitados las suban
                    </p>
                </div>
            </div>
        );
    }

    const currentPhoto = photos[currentIndex];

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
    };

    return (
        <div className="relative min-h-screen bg-background flex items-center justify-center">
            <div className="relative w-full h-screen flex items-center justify-center p-8">
                <img
                    key={currentPhoto.id}
                    src={currentPhoto.image_url}
                    alt={currentPhoto.message || "Foto del evento"}
                    className="max-w-full max-h-full object-contain animate-fade-in"
                />

                {currentPhoto.message && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-6 py-3 rounded-lg max-w-2xl">
                        <p className="text-foreground text-center">{currentPhoto.message}</p>
                    </div>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80"
                    onClick={goToPrevious}
                >
                    <ChevronLeft className="h-8 w-8" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80"
                    onClick={goToNext}
                >
                    <ChevronRight className="h-8 w-8" />
                </Button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {photos.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${index === currentIndex
                                    ? "bg-foreground w-8"
                                    : "bg-muted-foreground/50"
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
