import { useState, useEffect, useRef } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { RouletteModal } from "@/components/display/RouletteModal";
import QRCode from "react-qr-code";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideshowTemplateProps {
    eventId?: string;
}

export const SlideshowTemplate = ({ eventId }: SlideshowTemplateProps) => {
    const { submissions } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);

    // Configuration from settings
    const maxLoops = settings?.carousel_max_loops ?? 3;
    const intervalMs = settings?.carousel_interval_ms ?? 5000;
    const showControls = settings?.wall_show_controls ?? true;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [emptyMessageIndex, setEmptyMessageIndex] = useState(0);

    // Carousel State
    const [mode, setMode] = useState<'carousel' | 'qr'>('carousel');
    const [, setLoopCount] = useState(0);

    // Get latest 20 approved items (LIMIT for performance)
    const approvedContent = submissions?.filter(s => s.status === 'approved').slice(0, 20) || [];

    // Track previous content length to detect new photos
    const prevContentLengthRef = useRef(approvedContent.length);

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

    // Carousel Logic
    useEffect(() => {
        if (approvedContent.length > 0 && mode === 'carousel') {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => {
                    const next = prev + 1;

                    // Check if we reached the end of the list
                    if (next >= approvedContent.length) {
                        // Increment loop counter
                        setLoopCount(currentLoop => {
                            const newLoop = currentLoop + 1;
                            // Check if we reached max loops
                            if (newLoop >= maxLoops) {
                                // Switch to QR mode
                                setMode('qr');
                                return 0; // Reset loop count
                            }
                            return newLoop;
                        });
                        return 0; // Restart index
                    }
                    return next;
                });
            }, intervalMs);
            return () => clearInterval(interval);
        }
    }, [approvedContent.length, mode, maxLoops, intervalMs]);

    // Auto-restart if new photos arrive while in QR mode
    useEffect(() => {
        if (approvedContent.length > prevContentLengthRef.current) {
            if (mode === 'qr') {
                // Optional delay before restarting
                const timer = setTimeout(() => {
                    setMode('carousel');
                    setLoopCount(0);
                    setCurrentIndex(0);
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
        prevContentLengthRef.current = approvedContent.length;
    }, [approvedContent.length, mode]);

    // Safety check for index
    useEffect(() => {
        if (approvedContent.length > 0 && currentIndex >= approvedContent.length) {
            setCurrentIndex(0);
        }
    }, [approvedContent.length, currentIndex]);

    const backgroundUrl = settings?.display_background_url || settings?.background_image_url;
    // Fix: Ensure QR points to the root of the app
    const appUrl = window.location.href.replace(/\/display\/?$/, "");

    const handleResume = () => {
        setMode('carousel');
        setLoopCount(0);
        // Optionally reset index or keep current
        // setCurrentIndex(0); 
    };

    const handlePause = () => {
        setMode('qr');
    };

    return (
        <div className="relative h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans flex flex-col">
            {/* Dynamic Background with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-60"
                style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : {}}
            />
            <div className="absolute inset-0 bg-black/50" />

            {/* Simplified Header - Only event name and EventPix */}
            <header className="relative z-50 px-8 py-4 flex justify-between items-center shrink-0">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-tight text-white drop-shadow-md capitalize">
                    {settings?.title || "EventPix"}
                </h1>
                <h2 className="text-2xl md:text-3xl font-bold text-violet-400 font-sans">EventPix</h2>
            </header>

            {/* Main Content - Maximized for photos */}
            <main className="flex-1 relative z-10 flex items-center justify-center p-6 md:p-8 overflow-hidden w-full">
                {(!approvedContent || approvedContent.length === 0) ? (
                    // Empty State
                    <div className="text-center space-y-4 max-w-3xl animate-fade-in">
                        <div className="bg-white/5 p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-xl backdrop-blur-sm">
                            <p className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium leading-relaxed drop-shadow-md text-violet-100">
                                {emptyMessages[emptyMessageIndex]}
                            </p>
                            <p className="text-xl text-slate-300 mt-6 font-light">
                                ¡Escanea el código QR para participar!
                            </p>
                        </div>
                    </div>
                ) : mode === 'qr' ? (
                    // QR Mode Screen - Full screen QR
                    <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-500">
                        <div className="bg-black/60 backdrop-blur-md p-16 rounded-[3rem] border border-white/20 shadow-2xl text-center max-w-5xl">
                            <h2 className="text-5xl md:text-7xl font-serif font-bold text-white mb-12 drop-shadow-lg">
                                ¡Escaneá el QR para subir tus fotos!
                            </h2>
                            <div className="bg-white p-8 rounded-3xl inline-block shadow-xl mb-12">
                                <QRCode
                                    value={appUrl}
                                    size={400}
                                    className="h-auto w-full max-w-[400px]"
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                            <p className="text-3xl text-violet-200 font-medium">
                                Sumate a la fiesta y compartí tus momentos
                            </p>

                            {showControls && (
                                <div className="mt-16">
                                    <Button
                                        onClick={handleResume}
                                        size="lg"
                                        className="bg-violet-600 hover:bg-violet-700 text-white text-2xl px-10 py-8 rounded-full shadow-lg transition-all hover:scale-105"
                                    >
                                        <Play className="mr-3 h-8 w-8" /> Reanudar Carrusel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Slideshow Content - Maximized
                    <div className="w-full h-full relative flex items-center justify-center">
                        <div className="relative w-full h-full flex items-center justify-center" key={currentIndex}>
                            <div className="w-full h-full bg-black/40 rounded-[2rem] border border-white/10 shadow-xl overflow-hidden relative group animate-in fade-in zoom-in duration-500 flex items-center justify-center backdrop-blur-sm">
                                {approvedContent[currentIndex].type === 'photo' ? (
                                    <div className="w-full h-full relative flex items-center justify-center p-4">
                                        <img
                                            src={approvedContent[currentIndex].content}
                                            alt="Slideshow"
                                            className="w-full h-full object-contain"
                                        />
                                        {approvedContent[currentIndex].author && (
                                            <div className="absolute bottom-8 right-8 bg-black/70 px-6 py-3 rounded-full border border-white/20">
                                                <p className="text-white font-medium text-lg md:text-xl">📸 {approvedContent[currentIndex].author}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-12 md:p-16 text-center bg-gradient-to-br from-violet-900/30 to-fuchsia-900/30">
                                        <div className="bg-white/10 p-10 md:p-14 rounded-[2rem] border border-white/20 shadow-lg max-w-5xl transform rotate-1">
                                            <p className="text-4xl md:text-6xl lg:text-7xl font-serif text-white leading-tight drop-shadow-lg line-clamp-[8]">
                                                "{approvedContent[currentIndex].content}"
                                            </p>
                                            {approvedContent[currentIndex].author && (
                                                <p className="text-2xl md:text-3xl text-violet-200 mt-8 font-medium tracking-wide">
                                                    — {approvedContent[currentIndex].author}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Controls Overlay - Floating in bottom-right */}
            {showControls && mode === 'carousel' && approvedContent.length > 0 && (
                <div className="absolute bottom-8 right-8 z-50">
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={handlePause}
                        className="h-14 w-14 rounded-full shadow-lg bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md"
                        title="Pausar y mostrar QR"
                    >
                        <Pause className="h-7 w-7 text-white" />
                    </Button>
                </div>
            )}

            <RouletteModal />
        </div>
    );
};
