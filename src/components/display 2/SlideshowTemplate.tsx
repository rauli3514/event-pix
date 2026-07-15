import { useState, useEffect, useRef, useMemo } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { useEvent } from "@/context/EventContext";
import { RouletteModal } from "@/components/display/RouletteModal";
import QRCode from "react-qr-code";
import { Play, Pause, Camera, MessageSquare, Repeat, QrCode, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import confetti from 'canvas-confetti';
import { supabase } from "@/lib/supabase";

interface SlideshowTemplateProps {
    eventId?: string;
}

export const SlideshowTemplate = ({ eventId }: SlideshowTemplateProps) => {
    const { submissions } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const { event } = useEvent();

    // Escuchar reacciones en tiempo real
    useEffect(() => {
        if (!eventId || settings?.reactions_enabled === false) return;

        console.log("🔌 Iniciando conexión Realtime para reacciones...", { eventId, enabled: settings?.reactions_enabled });

        const channel = supabase
            .channel('public:reactions')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'reactions',
                    filter: `event_id=eq.${eventId}`
                },
                (payload) => {
                    console.log("🎉 Reacción recibida!", payload.new);
                    const newReaction = payload.new as { emoji: string };
                    triggerReaction(newReaction.emoji);
                }
            )
            .subscribe((status) => {
                console.log("📡 Estado de suscripción Realtime:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId, settings?.reactions_enabled]);

    // Escuchar efectos DJ (Broadcast)
    useEffect(() => {
        if (!eventId || settings?.dj_mode_enabled === false) return;

        const channel = supabase.channel('dj-effects');

        channel.on(
            'broadcast',
            { event: 'dj-effect' },
            (payload) => {
                if (payload.payload.eventId === eventId) {
                    triggerDjVisuals(payload.payload.effect);
                }
            }
        ).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId, settings?.dj_mode_enabled]);

    const triggerReaction = (emoji: string) => {
        // Configuración base del confeti
        const scalar = 4; // Emojis MUCHO más grandes (antes 2)
        const emojiShape = confetti.shapeFromText({ text: emoji, scalar });

        // Lanzar confeti con efecto "flotante" y lento
        confetti({
            particleCount: 20, // Un poco más de partículas
            scalar,
            shapes: [emojiShape],
            spread: 100, // Más dispersión para ocupar más ancho
            origin: { x: Math.random(), y: 1.1 }, // Desde abajo
            gravity: 0.35, // Gravedad baja para que "floten" (antes 0.8)
            drift: 0,
            ticks: 400, // Duran mucho más tiempo en pantalla (aprox 4s)
            startVelocity: 50, // Impulso inicial fuerte hacia arriba
            decay: 0.92, // Se frenan suavemente en el aire
            colors: ['#ffffff'] // No afecta emojis pero requerido
        });
    };

    const triggerDjVisuals = (effect: string) => {
        // Configuración común: Origen central inferior, movimiento hacia arriba
        const commonConfig = {
            origin: { x: 0.5, y: 0.85 }, // Centro abajo
            ticks: 600, // 10 segundos
            gravity: 0.6, // Gravedad normal para que suban y bajen natural
            decay: 0.96, // Desvanecimiento suave
            startVelocity: 45, // Velocidad moderada, no explosiva
            scalar: 2 // Tamaño moderado (no gigante)
        };

        if (effect === 'siren') {
            // Efecto Alerta: Fuente roja y blanca contenida
            confetti({
                ...commonConfig,
                particleCount: 80,
                spread: 40, // Muy concentrado (chorro vertical)
                colors: ['#ff0000', '#ffffff'],
            });
        } else if (effect === 'love') {
            // Efecto Romance: Corazones subiendo suavemente
            const heart = confetti.shapeFromText({ text: '❤️', scalar: 3 });
            confetti({
                ...commonConfig,
                particleCount: 40,
                shapes: [heart],
                gravity: 0.3, // Flotan un poco más
                spread: 50,
                startVelocity: 35,
                scalar: 3
            });
        } else if (effect === 'party') {
            // Efecto Fiesta: Fuente multicolor clásica
            confetti({
                ...commonConfig,
                particleCount: 100,
                spread: 60,
            });
        } else if (effect === 'camera') {
            // Efecto Foto: Destellos blancos concentrados
            confetti({
                ...commonConfig,
                particleCount: 60,
                spread: 360, // Radial pero pequeño
                startVelocity: 25, // Lento
                colors: ['#ffffff'],
                ticks: 100, // Corto (flash)
                origin: { x: 0.5, y: 0.5 }, // Centro absoluto
                scalar: 1.5
            });
        }
    };

    // Configuration
    const maxLoops = settings?.carousel_max_loops ?? 3;
    const intervalMs = settings?.carousel_interval_ms ?? 8000; // Más lento para disfrutar la foto
    const showControls = settings?.wall_show_controls ?? true;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [emptyMessageIndex, setEmptyMessageIndex] = useState(0);
    const [mode, setMode] = useState<'carousel' | 'qr'>('carousel');
    const [, setLoopCount] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isInfiniteLoop, setIsInfiniteLoop] = useState(false);

    // Animación aleatoria para cada foto
    const [animationClass, setAnimationClass] = useState("animate-ken-burns-in");

    // Filtrar contenido aprobado (limitado a 50 para performance)
    const approvedContent = useMemo(() =>
        submissions?.filter(s => s.status === 'approved').slice(0, 50) || [],
        [submissions]);

    const prevContentLengthRef = useRef(approvedContent.length);

    const emptyMessages = [
        "¡La fiesta recién empieza! Subí tu foto 📸",
        "Escaneá el QR y aparecé en pantalla gigante 🚀",
        "¿Quién falta en el muro? ¡Suban sus selfies! 🤳",
        "Capturá el momento y compartilo con todos ✨",
        "¡Queremos ver sus caras de felicidad! 😄"
    ];

    // Rotar mensajes vacíos
    useEffect(() => {
        if (approvedContent.length === 0) {
            const interval = setInterval(() => {
                setEmptyMessageIndex((prev) => (prev + 1) % emptyMessages.length);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [approvedContent.length]);

    // Lógica del Carrusel
    useEffect(() => {
        if (approvedContent.length > 0 && mode === 'carousel' && isPlaying) {
            // Cambiar animación al azar en cada cambio de foto
            const animations = ["animate-ken-burns-in", "animate-ken-burns-out", "animate-ken-burns-pan"];
            setAnimationClass(animations[Math.floor(Math.random() * animations.length)]);

            const interval = setInterval(() => {
                setCurrentIndex((prev) => {
                    const next = prev + 1;
                    if (next >= approvedContent.length) {
                        setLoopCount(currentLoop => {
                            if (isInfiniteLoop) return currentLoop; // No incrementar vueltas ni salir si es infinito

                            const newLoop = currentLoop + 1;
                            if (newLoop >= maxLoops) {
                                setMode('qr');
                                return 0;
                            }
                            return newLoop;
                        });
                        return 0;
                    }
                    return next;
                });
            }, intervalMs);
            return () => clearInterval(interval);
        }
    }, [approvedContent.length, mode, maxLoops, intervalMs, isPlaying, isInfiniteLoop]);

    // Auto-reinicio si llegan fotos nuevas
    useEffect(() => {
        if (approvedContent.length > prevContentLengthRef.current) {
            if (mode === 'qr') {
                setTimeout(() => {
                    setMode('carousel');
                    setLoopCount(0);
                    setCurrentIndex(0);
                }, 3000);
            }
        }
        prevContentLengthRef.current = approvedContent.length;
    }, [approvedContent.length, mode]);

    // Safety check
    if (approvedContent.length > 0 && currentIndex >= approvedContent.length) {
        setCurrentIndex(0);
    }

    const currentItem = approvedContent[currentIndex];

    // Construir URL correcta para el QR usando el slug del evento
    const appUrl = useMemo(() => {
        if (!event?.slug) {
            console.warn('⚠️ QR: No hay evento o slug disponible', { event });
            return window.location.origin;
        }
        const url = `${window.location.origin}/${event.slug}`;
        console.log('📱 QR generado con URL:', url, { eventSlug: event.slug, eventName: event.name });
        return url;
    }, [event?.slug]);

    // Renderizado del contenido actual (Foto o Texto)
    const renderContent = () => {
        if (!currentItem) return null;

        if (currentItem.type === 'photo') {
            return (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">

                    {/* AMBIENT LIGHT: Foto actual difuminada de fondo para inmersión (Adaptive) */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                        <img
                            src={currentItem.content}
                            className="w-full h-full object-cover blur-3xl scale-125 opacity-50 transition-all duration-1000 ease-in-out"
                            alt=""
                        />
                        <div className="absolute inset-0 bg-black/20" /> {/* Dimmer suave */}
                    </div>

                    {/* Imagen Principal Enfocada */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                        <div className={`relative z-20 transition-all duration-700 ease-out ${animationClass}`}>
                            <img
                                src={currentItem.content}
                                alt="Event Moment"
                                className="max-h-[90vh] max-w-[95vw] w-auto h-auto object-contain glass-liquid-image rounded-3xl"
                                style={{ transform: "translateZ(0)" }} // Force GPU
                            />
                        </div>

                        {/* Autor de la foto - Estilo Flotante Minimalista */}
                        {currentItem.author && (
                            <div className="absolute bottom-8 right-8 z-30 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5 flex items-center gap-2 animate-fade-in shadow-lg group">
                                <Camera className="w-4 h-4 text-white/80" />
                                <span className="text-white/90 font-medium tracking-wide">{currentItem.author}</span>
                            </div>
                        )}
                    </div>
                </div>
            );

        } else {
            // Mensaje de Texto (Sin background directo para mostrar el Skin)
            return (
                <div className="w-full h-full flex items-center justify-center p-8 relative overflow-hidden">
                    <div className="relative z-10 max-w-5xl w-full">
                        <div className="bg-black/30 backdrop-blur-md p-16 md:p-24 rounded-[3rem] border border-white/20 shadow-2xl text-center transform hover:scale-105 transition-transform duration-700">
                            <MessageSquare className="w-16 h-16 text-violet-400 mx-auto mb-8 opacity-80" />
                            <p className="text-4xl md:text-6xl lg:text-7xl font-serif text-white leading-tight drop-shadow-2xl font-medium italic">
                                "{currentItem.content}"
                            </p>
                            {currentItem.author && (
                                <div className="mt-12 flex items-center justify-center gap-3 opacity-80">
                                    <div className="h-1 w-12 bg-violet-400 rounded-full"></div>
                                    <p className="text-2xl md:text-3xl text-violet-200 font-light tracking-widest uppercase">
                                        {currentItem.author}
                                    </p>
                                    <div className="h-1 w-12 bg-violet-400 rounded-full"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    };

    const DEFAULT_BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

    return (
        <div className={`absolute inset-0 w-full h-full bg-black text-white overflow-hidden ${settings?.font_family || 'font-sans'}`}>
            {/* Header Flotante Minimalista */}
            <header className="absolute top-0 left-0 z-50 p-6 w-full flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                <div>
                    <h1 className={`text-4xl font-bold ${settings?.font_family || 'font-serif'} tracking-tight text-white drop-shadow-lg flex items-center gap-3`}>
                        {settings?.title || "EventPix"}
                        <img src="/pwa-192x192.png" alt="EventPix" className="h-10 w-10 object-contain ml-2 opacity-90 drop-shadow-md" />
                    </h1>
                </div>

                {/* QR Pequeño siempre visible (Opcional) */}
                {mode === 'carousel' && (
                    <div className="bg-white p-2 rounded-lg shadow-lg opacity-80 hover:opacity-100 transition-opacity">
                        <QRCode value={appUrl} size={60} />
                    </div>
                )}
            </header>

            {/* ========== MARCO ENVOLVENTE (FRAME) ========== */}
            {settings?.frame_enabled && settings?.frame_image_url && mode === 'carousel' && approvedContent.length > 0 && (
                <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
                    <img
                        src={settings.frame_image_url}
                        alt=""
                        onError={(e) => {
                            e.currentTarget.style.display = 'none'; // Ocultar si falla
                            console.error("Error cargando marco:", settings.frame_image_url);
                        }}
                        className="w-full h-full object-cover opacity-90 drop-shadow-2xl"
                    />
                </div>
            )}

            {/* Contenido Principal */}
            <main className="w-full h-full relative">
                {/* GLOBAL SKIN / BACKGROUND */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={settings?.background_image_url || DEFAULT_BACKGROUND_IMAGE}
                        alt="Background Skin"
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
                </div>

                <div className="relative z-10 w-full h-full">
                    {(!approvedContent || approvedContent.length === 0) ? (
                        // Estado Vacío (Esperando fotos)
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <div className="text-center max-w-4xl px-4 flex flex-col items-center">
                                {/* Logo opcional */}
                                {settings?.splash_logo_url && (
                                    <img src={settings.splash_logo_url} className="h-32 w-32 object-cover rounded-full border-4 border-white/20 mb-8 shadow-2xl animate-fade-in-down" alt="Logo" />
                                )}

                                <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 drop-shadow-lg animate-fade-in-up">
                                    {emptyMessages[emptyMessageIndex]}
                                </h2>
                                <div className="bg-white p-6 rounded-3xl inline-block shadow-2xl animate-bounce-slow">
                                    <QRCode value={appUrl} size={250} />
                                </div>
                                <p className="text-2xl text-slate-300 mt-8 font-light tracking-wide">
                                    Escaneá para comenzar la magia ✨
                                </p>
                            </div>
                        </div>
                    ) : mode === 'qr' ? (
                        // Pantalla QR Full Screen (Intermedio)
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <div className="bg-black/60 backdrop-blur-xl p-12 rounded-[3rem] border border-white/10 shadow-2xl text-center max-w-5xl animate-in zoom-in duration-500">
                                {/* Logo opcional en QR mode */}
                                {settings?.splash_logo_url && (
                                    <img src={settings.splash_logo_url} className="h-24 mx-auto mb-6 object-contain drop-shadow-lg" alt="Logo" />
                                )}

                                <h2 className="text-5xl md:text-6xl font-bold text-white mb-10 drop-shadow-xl">
                                    ¡Es tu turno! 📸
                                </h2>
                                <div className="bg-white p-6 rounded-[2rem] inline-block shadow-[0_0_50px_rgba(255,255,255,0.2)] mb-10 transform hover:scale-105 transition-transform duration-500">
                                    <QRCode value={appUrl} size={300} />
                                </div>
                                <p className="text-3xl text-slate-200 font-medium mb-8 max-w-2xl mx-auto">
                                    Escaneá el QR y compartí tus fotos en la pantalla
                                </p>

                                {showControls && (
                                    <Button
                                        onClick={() => { setMode('carousel'); setLoopCount(0); }}
                                        size="lg"
                                        className="bg-white text-black hover:bg-slate-200 text-xl px-10 py-8 rounded-full font-bold shadow-xl transition-all hover:scale-110"
                                    >
                                        <Play className="mr-3 h-6 w-6 fill-current" /> Continuar Show
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Modo Carrusel (Super Muro)
                        <div className="w-full h-full">
                            {renderContent()}
                        </div>
                    )}
                </div>
            </main>

            {/* Controles Flotantes */}
            {/* Controles Flotantes Modernos - Discretos a la izquierda */}
            {showControls && mode === 'carousel' && approvedContent.length > 0 && (
                <div className="absolute bottom-6 left-6 z-50">
                    <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-white/10 p-2 rounded-full shadow-lg hover:bg-black/50 transition-colors">
                        {/* Play / Pause - Deja foto fija */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`h-10 w-10 rounded-full border transition-all ${isPlaying
                                ? 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                                : 'bg-red-500/50 hover:bg-red-600/80 text-white border-red-400/50'
                                }`}
                            title={isPlaying ? "Pausar (Foto fija)" : "Reanudar"}
                        >
                            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                        </Button>

                        <div className="w-px h-6 bg-white/10 mx-1"></div>

                        {/* Infinite Loop - Evita ir al QR */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsInfiniteLoop(!isInfiniteLoop)}
                            className={`h-9 w-9 rounded-full transition-all border ${isInfiniteLoop
                                ? 'bg-violet-500/50 text-white border-violet-400/50'
                                : 'text-white/50 hover:text-white hover:bg-white/5 border-transparent'
                                }`}
                            title={isInfiniteLoop ? "Loop Infinito (Activo)" : "Activar Loop Infinito"}
                        >
                            <Repeat className="h-4 w-4" />
                        </Button>

                        {/* Go to QR - Manual */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMode('qr')}
                            className="h-9 w-9 rounded-full text-white/50 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                            title="Ir a Pantalla QR"
                        >
                            <QrCode className="h-4 w-4" />
                        </Button>

                        {/* Next Photo (Manual Skip) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setCurrentIndex((prev) => (prev + 1) % approvedContent.length);
                                setIsPlaying(false);
                            }}
                            className="h-9 w-9 rounded-full text-white/50 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                            title="Siguiente Foto"
                        >
                            <SkipForward className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <RouletteModal />
        </div>
    );
};
