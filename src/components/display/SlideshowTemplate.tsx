import { useState, useEffect } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { RouletteModal } from "@/components/display/RouletteModal";
import QRCode from "react-qr-code";

interface SlideshowTemplateProps {
    eventId?: string;
}

export const SlideshowTemplate = ({ eventId }: SlideshowTemplateProps) => {
    const { submissions } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [emptyMessageIndex, setEmptyMessageIndex] = useState(0);

    // Get latest 20 approved items (LIMIT for performance)
    const approvedContent = submissions?.filter(s => s.status === 'approved').slice(0, 20) || [];

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

    const backgroundUrl = settings?.display_background_url || settings?.background_image_url;
    // Fix: Ensure QR points to the root of the app, handling subpaths like /event-pix/
    // We take the current URL and remove '/display' to get the landing page URL
    const appUrl = window.location.href.replace(/\/display\/?$/, "");

    return (
        <div className="relative h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans flex flex-col">
            {/* Dynamic Background with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-60"
                style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : {}}
            />
            <div className="absolute inset-0 bg-black/50" />

            {/* Header: Compact & Elegant (approx 10-12% height) */}
            <header className="relative z-50 px-6 py-3 flex justify-between items-center shrink-0 h-[10vh] min-h-[60px]">
                <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-tight text-white drop-shadow-md capitalize truncate">
                        {settings?.title || "EventPix"}
                    </h1>
                </div>
                <div className="text-right shrink-0 ml-4">
                    <h2 className="text-xl md:text-2xl font-bold text-violet-400 font-sans leading-none">EventPix</h2>
                    <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">by Tecno Eventos</p>
                </div>
            </header>

            {/* Main Content: Slideshow Area (Flexible height, takes remaining space) */}
            <main className="flex-1 relative z-10 flex items-center justify-center p-4 md:p-6 overflow-hidden w-full">
                {(!approvedContent || approvedContent.length === 0) ? (
                    // Empty State
                    <div className="text-center space-y-4 max-w-2xl animate-fade-in">
                        <div className="bg-white/5 p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-xl backdrop-blur-sm">
                            <p className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium leading-relaxed drop-shadow-md text-violet-100">
                                {emptyMessages[emptyMessageIndex]}
                            </p>
                            <p className="text-lg text-slate-300 mt-4 font-light">
                                ¡Escanea el código QR abajo para participar!
                            </p>
                        </div>
                    </div>
                ) : (
                    // Slideshow Content
                    <div className="w-full h-full relative flex items-center justify-center">
                        {/* Content Card - Auto scales to fit without scroll */}
                        <div className="relative w-full h-full flex items-center justify-center p-4" key={currentIndex}>
                            <div className="w-full h-full bg-black/40 rounded-[1.5rem] border border-white/10 shadow-xl overflow-hidden relative group animate-in fade-in zoom-in duration-500 flex items-center justify-center backdrop-blur-sm">
                                {approvedContent[currentIndex].type === 'photo' ? (
                                    <div className="w-full h-full relative flex items-center justify-center p-2">
                                        <img
                                            src={approvedContent[currentIndex].content}
                                            alt="Slideshow"
                                            className="w-full h-full object-contain"
                                        />
                                        {/* Author Badge */}
                                        {approvedContent[currentIndex].author && (
                                            <div className="absolute bottom-6 right-6 bg-black/60 px-5 py-2 rounded-full border border-white/10">
                                                <p className="text-white font-medium text-base md:text-lg">📸 {approvedContent[currentIndex].author}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-8 md:p-12 text-center bg-gradient-to-br from-violet-900/30 to-fuchsia-900/30">
                                        <div className="bg-white/10 p-8 md:p-12 rounded-[2rem] border border-white/20 shadow-lg max-w-4xl transform rotate-1">
                                            <p className="text-3xl md:text-5xl lg:text-6xl font-serif text-white leading-tight drop-shadow-lg line-clamp-[8]">
                                                "{approvedContent[currentIndex].content}"
                                            </p>
                                            {approvedContent[currentIndex].author && (
                                                <p className="text-xl md:text-2xl text-violet-200 mt-6 font-medium tracking-wide">
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

            {/* Footer: QR Code & Info (More prominent for readability) */}
            <footer className="relative z-50 px-6 py-2 flex justify-center items-center shrink-0 h-[30vh] min-h-[200px]">
                <div className="absolute left-6 flex items-center gap-4">
                    <p className="text-sm md:text-base text-slate-500 font-medium uppercase tracking-wider hidden md:block">
                        Tecno Eventos – Servicios interactivos
                    </p>
                </div>

                <div className="flex items-center gap-10 bg-white/5 rounded-3xl p-6 pr-12 border border-white/10 hover:bg-white/10 transition-colors h-[90%]">
                    <div className="bg-white p-4 rounded-2xl h-full aspect-square flex items-center justify-center shadow-lg">
                        <QRCode
                            value={appUrl}
                            style={{ height: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                    <div className="text-left flex flex-col justify-center space-y-2">
                        <p className="text-4xl md:text-5xl font-bold text-white leading-none">¡Participá!</p>
                        <p className="text-xl md:text-2xl text-slate-300 leading-tight">Escaneá para subir fotos</p>
                    </div>
                </div>
            </footer>

            <RouletteModal />
        </div>
    );
};
