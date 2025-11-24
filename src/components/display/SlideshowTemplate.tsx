import { useState, useEffect } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { RouletteModal } from "@/components/display/RouletteModal";
import QRCode from "react-qr-code";

export const SlideshowTemplate = () => {
    const { submissions } = useSubmissions();
    const { data: settings } = useEventSettings();
    const [emptyMessageIndex, setEmptyMessageIndex] = useState(0);

    // Get latest 20 approved items for the wall
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

    const backgroundUrl = settings?.display_background_url || settings?.background_image_url;
    // Fix: Ensure QR points to the root of the app, handling subpaths like /event-pix/
    // We take the current URL and remove '/display' to get the landing page URL
    const appUrl = window.location.href.replace(/\/display\/?$/, "");

    return (
        <div className="relative h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans flex flex-col">
            {/* Dynamic Background with Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-30 blur-sm"
                style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : {}}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/70 to-slate-950/90" />

            {/* Header: Compact & Elegant (approx 10-12% height) */}
            <header className="relative z-50 px-6 py-3 flex justify-between items-center border-b border-white/5 bg-slate-950/80 shrink-0 h-[10vh] min-h-[60px]">
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

            {/* Main Content: Masonry Wall (Flexible height, takes remaining space) */}
            <main className="flex-1 relative z-10 p-4 md:p-6 overflow-hidden w-full">
                {(!approvedContent || approvedContent.length === 0) ? (
                    // Empty State
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-4 max-w-2xl animate-fade-in">
                            <div className="bg-white/5 p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-xl">
                                <p className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium leading-relaxed drop-shadow-md text-violet-100">
                                    {emptyMessages[emptyMessageIndex]}
                                </p>
                                <p className="text-lg text-slate-300 mt-4 font-light">
                                    ¡Escanea el código QR abajo para participar!
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Masonry Grid Content
                    <div className="w-full h-full columns-1 md:columns-3 lg:columns-4 gap-4 space-y-4 overflow-hidden">
                        {approvedContent.map((item) => (
                            <div key={item.id} className="break-inside-avoid bg-black/40 rounded-xl border border-white/10 shadow-lg overflow-hidden relative group animate-in fade-in zoom-in duration-500 hover:scale-[1.02] transition-transform">
                                {item.type === 'photo' ? (
                                    <div className="relative">
                                        <img
                                            src={item.content}
                                            alt="Event moment"
                                            className="w-full h-auto object-cover"
                                            loading="lazy"
                                        />
                                        {item.author && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                                                <p className="text-white text-sm font-medium truncate">📸 {item.author}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-6 bg-gradient-to-br from-violet-900/40 to-fuchsia-900/40 text-center flex flex-col items-center justify-center min-h-[150px]">
                                        <p className="text-lg md:text-xl font-serif text-white leading-snug drop-shadow-sm line-clamp-6">
                                            "{item.content}"
                                        </p>
                                        {item.author && (
                                            <p className="text-sm text-violet-200 mt-3 font-medium tracking-wide">
                                                — {item.author}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer: QR Code & Info (More prominent for readability) */}
            <footer className="relative z-50 bg-slate-950/90 border-t border-white/5 px-6 py-2 flex justify-between items-center shrink-0 h-[15vh] min-h-[100px]">
                <div className="flex items-center gap-4">
                    <p className="text-sm md:text-base text-slate-500 font-medium uppercase tracking-wider hidden md:block">
                        Tecno Eventos – Servicios interactivos
                    </p>
                </div>

                <div className="flex items-center gap-6 bg-white/5 rounded-2xl p-3 pr-6 border border-white/10 hover:bg-white/10 transition-colors h-[90%]">
                    <div className="bg-white p-2 rounded-xl h-full aspect-square flex items-center justify-center shadow-lg">
                        <QRCode
                            value={appUrl}
                            style={{ height: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                    <div className="text-left flex flex-col justify-center space-y-1">
                        <p className="text-xl md:text-2xl font-bold text-white leading-none">¡Participá!</p>
                        <p className="text-xs md:text-sm text-slate-300 leading-tight">Escaneá para subir fotos</p>
                    </div>
                </div>
            </footer>

            <RouletteModal />
        </div>
    );
};
