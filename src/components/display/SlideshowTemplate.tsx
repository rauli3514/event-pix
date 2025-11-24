import { useState, useEffect } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouletteModal } from "@/components/display/RouletteModal";
import QRCode from "react-qr-code";

export const SlideshowTemplate = () => {
    const { submissions } = useSubmissions();
    const { data: settings } = useEventSettings();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [emptyMessageIndex, setEmptyMessageIndex] = useState(0);

    const approvedContent = submissions?.filter(s => s.status === 'approved') || [];

    const emptyMessages = [
        "Todavía no hay nada por aquí… ¡subí tu primera foto y arrancamos la fiesta!",
        "Pantalla tímida 😳 — necesita que le subas fotos para animarse.",
        "¿Y las fotos? ¡No sean tímidos, queremos ver sus caras!",
        "¡Este mural está esperando tus mejores momentos!",
        "Escanea el QR y sé el primero en aparecer aquí 📸"
    ];

    // Rotate empty messages
    useEffect(() => {
        if (approvedContent.length === 0) {
            const interval = setInterval(() => {
                setEmptyMessageIndex((prev) => (prev + 1) % emptyMessages.length);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [approvedContent.length]);

    // Rotate content
    useEffect(() => {
        if (approvedContent.length > 0) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % approvedContent.length);
            }, 8000); // 8 seconds per slide
            return () => clearInterval(interval);
        }
    }, [approvedContent.length]);

    // Safety check for index
    useEffect(() => {
        if (approvedContent.length > 0 && currentIndex >= approvedContent.length) {
            setCurrentIndex(0);
        }
    }, [approvedContent.length, currentIndex]);

    const goToPrevious = () => {
        if (approvedContent.length > 0) {
            setCurrentIndex((prev) => (prev - 1 + approvedContent.length) % approvedContent.length);
        }
    };

    const goToNext = () => {
        if (approvedContent.length > 0) {
            setCurrentIndex((prev) => (prev + 1) % approvedContent.length);
        }
    };

    const backgroundUrl = settings?.display_background_url || settings?.background_image_url;
    const appUrl = window.location.origin; // Dynamic URL for QR code

    return (
        <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden font-sans flex flex-col">
            {/* Dynamic Background with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-30 blur-sm"
                style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : {}}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/90" />

            {/* Header: Event Title & Branding */}
            <header className="relative z-20 px-8 py-6 flex justify-between items-center border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
                <div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-white drop-shadow-lg capitalize">
                        {settings?.title || "EventPix"}
                    </h1>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-violet-400 font-sans">EventPix</h2>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">by Tecno Eventos</p>
                </div>
            </header>

            {/* Main Content: Slideshow Area */}
            <main className="flex-1 relative z-10 flex items-center justify-center p-8">
                {(!approvedContent || approvedContent.length === 0) ? (
                    // Empty State
                    <div className="text-center space-y-6 max-w-3xl animate-fade-in">
                        <div className="bg-white/10 backdrop-blur-xl p-12 rounded-[3rem] border border-white/20 shadow-2xl">
                            <p className="text-4xl md:text-5xl font-serif font-medium leading-relaxed drop-shadow-md text-violet-100">
                                {emptyMessages[emptyMessageIndex]}
                            </p>
                            <p className="text-xl text-slate-300 mt-6 font-light">
                                ¡Escanea el código QR abajo para participar!
                            </p>
                        </div>
                    </div>
                ) : (
                    // Slideshow Content
                    <div className="w-full max-w-[70rem] aspect-[16/9] relative flex items-center justify-center">
                        {/* Navigation Buttons (Hidden on hover usually, but kept for manual control if needed) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-4 z-30 text-white/50 hover:text-white hover:bg-white/10 rounded-full w-16 h-16 opacity-0 hover:opacity-100 transition-opacity"
                            onClick={goToPrevious}
                        >
                            <ChevronLeft className="w-10 h-10" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 z-30 text-white/50 hover:text-white hover:bg-white/10 rounded-full w-16 h-16 opacity-0 hover:opacity-100 transition-opacity"
                            onClick={goToNext}
                        >
                            <ChevronRight className="w-10 h-10" />
                        </Button>

                        {/* Content Card */}
                        <div className="w-full h-full bg-black/40 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden relative group animate-in fade-in zoom-in duration-500" key={currentIndex}>
                            {approvedContent[currentIndex].type === 'photo' ? (
                                <div className="w-full h-full relative">
                                    <img
                                        src={approvedContent[currentIndex].content}
                                        alt="Slideshow"
                                        className="w-full h-full object-contain p-4"
                                    />
                                    {/* Author Badge */}
                                    {approvedContent[currentIndex].author && (
                                        <div className="absolute bottom-8 right-8 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                                            <p className="text-white font-medium text-lg">📸 {approvedContent[currentIndex].author}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-16 text-center bg-gradient-to-br from-violet-900/40 to-fuchsia-900/40">
                                    <div className="bg-white/10 backdrop-blur-md p-12 rounded-[3rem] border border-white/20 shadow-xl max-w-4xl transform rotate-1">
                                        <p className="text-5xl md:text-6xl font-serif text-white leading-tight drop-shadow-lg">
                                            "{approvedContent[currentIndex].content}"
                                        </p>
                                        {approvedContent[currentIndex].author && (
                                            <p className="text-2xl text-violet-200 mt-8 font-medium tracking-wide">
                                                — {approvedContent[currentIndex].author}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer: QR Code & Info */}
            <footer className="relative z-20 bg-slate-950/80 backdrop-blur-xl border-t border-white/10 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">
                        Tecno Eventos – Servicios interactivos para eventos
                    </p>
                </div>

                <div className="flex items-center gap-6 bg-white/5 rounded-2xl p-3 pr-6 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="bg-white p-2 rounded-xl">
                        <QRCode value={appUrl} size={80} />
                    </div>
                    <div className="text-left">
                        <p className="text-lg font-bold text-white leading-tight">¡Participá ahora!</p>
                        <p className="text-sm text-slate-300">Escaneá para subir fotos y mensajes</p>
                    </div>
                </div>
            </footer>

            <RouletteModal />
        </div>
    );
};
