import { useState, useEffect } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SlideshowTemplate = () => {
    const { submissions, isLoading } = useSubmissions();
    const { data: settings } = useEventSettings();

    // Filter only approved content (both photos and messages)
    const approvedContent = submissions.filter(s => s.status === 'approved');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!approvedContent || approvedContent.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % approvedContent.length);
        }, 8000); // Change every 8 seconds for better readability

        return () => clearInterval(interval);
    }, [approvedContent.length]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-muted-foreground">Cargando contenido...</div>
            </div>
        );
    }

    if (!approvedContent || approvedContent.length === 0) {
        return (
            <div
                className="flex items-center justify-center min-h-screen bg-background bg-cover bg-center"
                style={settings?.background_image_url ? { backgroundImage: `url(${settings.background_image_url})` } : {}}
            >
                {settings?.background_image_url && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                )}
                <div className="relative z-10 text-center space-y-2 p-8 bg-card/80 backdrop-blur rounded-xl border border-white/10">
                    <p className="text-2xl font-serif text-foreground">
                        Esperando contenido...
                    </p>
                    <p className="text-sm text-muted-foreground">
                        ¡Sube tus fotos y mensajes para verlos aquí!
                    </p>
                </div>
            </div>
        );
    }

    const currentItem = approvedContent[currentIndex];

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + approvedContent.length) % approvedContent.length);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % approvedContent.length);
    };

    return (
        <div
            className="relative min-h-screen bg-background flex items-center justify-center overflow-hidden bg-cover bg-center transition-all duration-1000"
            style={settings?.background_image_url ? { backgroundImage: `url(${settings.background_image_url})` } : {}}
        >
            {/* Background Overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="relative z-10 w-full h-screen flex items-center justify-center p-4 md:p-12">
                <div className="w-full max-w-5xl aspect-video relative flex items-center justify-center">

                    {currentItem.type === 'photo' ? (
                        // PHOTO DISPLAY
                        <div className="relative w-full h-full flex items-center justify-center animate-fade-in">
                            <img
                                key={currentItem.id}
                                src={currentItem.content}
                                alt="Foto del evento"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border-4 border-white/20"
                            />
                            {currentItem.author && (
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                                    <p className="text-white text-lg font-medium">📸 {currentItem.author}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // MESSAGE DISPLAY
                        <div className="w-full max-w-3xl bg-white text-black p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-fade-in transform transition-all hover:scale-105 relative">
                            {/* Speech Bubble Tail */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rotate-45 transform origin-center"></div>

                            <div className="text-center space-y-6">
                                <div className="inline-block p-3 bg-gray-100 rounded-full mb-4">
                                    <span className="text-4xl">💬</span>
                                </div>
                                <p className="text-4xl md:text-6xl font-bold leading-tight text-gray-900 break-words">
                                    "{currentItem.content}"
                                </p>
                                <div className="pt-4 border-t border-gray-200">
                                    <p className="text-2xl text-gray-600 font-serif italic">- {currentItem.author}</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Navigation Controls */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 rounded-full"
                    onClick={goToPrevious}
                >
                    <ChevronLeft className="h-8 w-8" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 rounded-full"
                    onClick={goToNext}
                >
                    <ChevronRight className="h-8 w-8" />
                </Button>

                {/* Progress Dots */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                    {approvedContent.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentIndex
                                    ? "bg-white w-8"
                                    : "bg-white/30 w-2 hover:bg-white/50"
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
