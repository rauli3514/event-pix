import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { useEvent } from "@/context/EventContext";
import { useWallEffects } from "@/hooks/use-wall-effects";
import { useGuestUrl } from "@/hooks/use-wall";
import { RouletteModal } from "@/components/display/RouletteModal";
import { WallBackground, WallHeader } from "@/components/display/WallChrome";
import QRCode from "react-qr-code";
import { Play, Pause, Camera, MessageSquare, Repeat, QrCode, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAnonymousAuthor } from "@/lib/guestSubmissions";
import { accentVars } from "@/lib/wallAccent";
import { getWallStats, RankRow } from "@/lib/wallStats";
import { CollageSlide, RankingSlide } from "@/components/display/WallSpecialSlides";
import { Submission } from "@/types";

// Cada cuántos cambios de foto se intercala un collage o el ranking
const SPECIAL_EVERY = 8;
const COLLAGE_SIZE = 12;

type SpecialSlide = { kind: 'collage'; photos: Submission[] } | { kind: 'ranking'; rows: RankRow[] };

const shuffle = <T,>(list: T[]) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

interface SlideshowTemplateProps {
    eventId?: string;
    /** Pausa el carrusel mientras se destaca una foto nueva encima */
    paused?: boolean;
}

export const SlideshowTemplate = ({ eventId, paused = false }: SlideshowTemplateProps) => {
    const { submissions } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const { event } = useEvent();

    // Reacciones de los invitados y efectos del DJ
    useWallEffects(eventId, settings);

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

    // Contador, collage y ranking (sobre todo lo aprobado, no solo las 50 del carrusel)
    const stats = useMemo(() => getWallStats(submissions), [submissions]);
    const allPhotos = useMemo(() => submissions.filter(s => s.status === 'approved' && s.type === 'photo'), [submissions]);
    const [special, setSpecial] = useState<SpecialSlide | null>(null);
    const specialRef = useRef(false);
    const ticksRef = useRef(0);
    const nextSpecialRef = useRef<'collage' | 'ranking'>('collage');
    const liveRef = useRef({ photos: allPhotos, ranking: stats.ranking });
    // Interruptores del panel (Pantalla): sin el dato (base vieja) queda prendido
    const togglesRef = useRef({ collage: true, ranking: true });
    useEffect(() => {
        togglesRef.current = {
            collage: settings?.wall_collage_enabled !== false,
            ranking: settings?.wall_ranking_enabled !== false,
        };
    }, [settings?.wall_collage_enabled, settings?.wall_ranking_enabled]);
    useEffect(() => {
        liveRef.current = { photos: allPhotos, ranking: stats.ranking };
    }, [allPhotos, stats.ranking]);

    const pickSpecial = (): SpecialSlide | null => {
        const { photos, ranking } = liveRef.current;
        const { collage: collageOn, ranking: rankingOn } = togglesRef.current;
        const collageOk = collageOn && photos.length >= 6;
        const rankingOk = rankingOn && ranking.length >= 3 && ranking[0].count >= 2;
        const kind = nextSpecialRef.current === 'ranking'
            ? (rankingOk ? 'ranking' : collageOk ? 'collage' : null)
            : (collageOk ? 'collage' : rankingOk ? 'ranking' : null);
        if (!kind) return null;
        nextSpecialRef.current = kind === 'collage' ? 'ranking' : 'collage';
        return kind === 'collage'
            ? { kind, photos: shuffle(photos).slice(0, COLLAGE_SIZE) }
            : { kind, rows: ranking };
    };

    const clearSpecial = () => {
        specialRef.current = false;
        setSpecial(null);
    };

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
        if (approvedContent.length > 0 && mode === 'carousel' && isPlaying && !paused) {
            // Cambiar animación al azar en cada cambio de foto
            const animations = ["animate-ken-burns-in", "animate-ken-burns-out", "animate-ken-burns-pan"];
            setAnimationClass(animations[Math.floor(Math.random() * animations.length)]);

            const interval = setInterval(() => {
                // Después de un collage/ranking se sigue con la foto que tocaba
                if (specialRef.current) {
                    clearSpecial();
                    return;
                }
                ticksRef.current += 1;
                if (ticksRef.current % SPECIAL_EVERY === 0) {
                    const next = pickSpecial();
                    if (next) {
                        specialRef.current = true;
                        setSpecial(next);
                        return;
                    }
                }
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
    }, [approvedContent.length, mode, maxLoops, intervalMs, isPlaying, isInfiniteLoop, paused]);

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

    // Las fotos nuevas entran al principio de la lista y corren los índices:
    // seguimos mostrando la misma foto en vez de saltar a otra de golpe.
    const currentIdRef = useRef<string | undefined>(undefined);
    useLayoutEffect(() => {
        const id = currentIdRef.current;
        if (!id) return;
        const idx = approvedContent.findIndex(s => s.id === id);
        if (idx !== -1 && idx !== currentIndex) setCurrentIndex(idx);
    }, [approvedContent]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        currentIdRef.current = currentItem?.id;
    }, [currentItem?.id]);

    // Dirección del QR (página del invitado)
    const appUrl = useGuestUrl(event);

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

                        {/* Autor y dedicatoria - Estilo Flotante Minimalista */}
                        {(!isAnonymousAuthor(currentItem.author) || currentItem.caption) && (
                            <div className="absolute bottom-8 right-32 z-30 max-w-[55vw] bg-black/40 backdrop-blur-xl px-5 py-3 rounded-3xl border border-white/5 animate-fade-in shadow-lg group">
                                {!isAnonymousAuthor(currentItem.author) && (
                                    <div className="flex items-center gap-2">
                                        <Camera className="w-5 h-5 text-[var(--accent-text)]" />
                                        <span className="text-white/90 text-xl font-semibold tracking-wide">{currentItem.author}</span>
                                    </div>
                                )}
                                {currentItem.caption && (
                                    <p className="mt-1 text-white/85 text-lg italic line-clamp-2">“{currentItem.caption}”</p>
                                )}
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
                            <MessageSquare className="w-16 h-16 text-[var(--accent-text)] mx-auto mb-8 opacity-80" />
                            <p className="text-4xl md:text-6xl lg:text-7xl font-serif text-white leading-tight drop-shadow-2xl font-medium italic">
                                "{currentItem.content}"
                            </p>
                            {!isAnonymousAuthor(currentItem.author) && (
                                <div className="mt-12 flex items-center justify-center gap-3 opacity-80">
                                    <div className="h-1 w-12 bg-[var(--accent)] rounded-full"></div>
                                    <p className="text-2xl md:text-3xl text-[var(--accent-text)] font-light tracking-widest uppercase">
                                        {currentItem.author}
                                    </p>
                                    <div className="h-1 w-12 bg-[var(--accent)] rounded-full"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <div
            className={`absolute inset-0 w-full h-full bg-black text-white overflow-hidden ${settings?.font_family || 'font-sans'}`}
            style={accentVars(settings?.accent_color)}
        >
            <WallHeader settings={settings} stats={stats} guestUrl={appUrl} showQr={mode === 'carousel'} />

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
                {/* Fondo del tema */}
                <WallBackground settings={settings} />

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
                                <div className="bg-white p-6 rounded-3xl inline-block shadow-[0_0_80px_var(--accent-soft)] ring-4 ring-[var(--accent)]">
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
                            {special?.kind === 'collage' ? (
                                <CollageSlide key="collage" photos={special.photos} total={stats.photos} />
                            ) : special?.kind === 'ranking' ? (
                                <RankingSlide key="ranking" rows={special.rows} />
                            ) : (
                                renderContent()
                            )}
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
                                ? 'bg-[var(--accent-soft)] text-white border-[var(--accent)]'
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
                                clearSpecial();
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
