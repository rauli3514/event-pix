import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface PhotoBoothModalProps {
    isOpen: boolean;
    onClose: () => void;
    photoUrl: string;
    frameUrl?: string | null;
    themeBackgroundUrl?: string | null;
    eventName?: string;
    aiGenerationEnabled?: boolean;
}

export const PhotoBoothModal = ({ isOpen, onClose, photoUrl, frameUrl, themeBackgroundUrl, eventName, aiGenerationEnabled = false }: PhotoBoothModalProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isGenerating, setIsGenerating] = useState(true);
    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>(photoUrl);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [hasGeneratedAI, setHasGeneratedAI] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [playerPosition, setPlayerPosition] = useState("DELANTERO");

    useEffect(() => {
        if (isOpen) {
            setCurrentPhotoUrl(photoUrl);
            setHasGeneratedAI(false);
            setPlayerName("");
            setPlayerPosition("DELANTERO");
        }
    }, [isOpen, photoUrl]);

    useEffect(() => {
        if (!isOpen || !photoUrl) return;
        setError(null); // Reset error

        // Helper: Cargar imagen con timeout
        const loadImageWithTimeout = (src: string, timeoutMs: number = 5000): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";

                const timer = setTimeout(() => {
                    reject(new Error(`Timeout loading image: ${src}`));
                }, timeoutMs);

                img.onload = () => {
                    clearTimeout(timer);
                    resolve(img);
                };

                img.onerror = () => {
                    clearTimeout(timer);
                    reject(new Error(`Failed to load image: ${src}`));
                };

                img.src = src;
            });
        };


        const generateImage = async (retryCount = 0) => {
            // Límite de reintentos
            if (retryCount > 10) {
                setError("Error interno: El canvas no se pudo inicializar a tiempo.");
                setIsGenerating(false);
                return;
            }

            const canvas = canvasRef.current;
            if (!canvas) {
                setTimeout(() => generateImage(retryCount + 1), 100);
                return;
            }

            setIsGenerating(true);
            setError(null);

            const ctx = canvas.getContext('2d', {
                alpha: false,
                willReadFrequently: false
            });

            if (!ctx) {
                setError("Contexto 2D no disponible");
                setIsGenerating(false);
                return;
            }

            try {
                // 1. Configuración (Ajustar al tamaño de IA si hay marco)
                const canvasWidth = frameUrl ? 896 : 1080;
                const canvasHeight = frameUrl ? 1152 : 1920;
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                // 2. Fondo Base (Themes)
                // Intentar cargar fondo del tema
                if (themeBackgroundUrl) {
                    try {
                        const themeBg = await loadImageWithTimeout(themeBackgroundUrl, 8000);
                        // Object-fit: cover
                        const scale = Math.max(canvasWidth / themeBg.width, canvasHeight / themeBg.height);
                        const x = (canvasWidth - themeBg.width * scale) / 2;
                        const y = (canvasHeight - themeBg.height * scale) / 2;
                        ctx.drawImage(themeBg, x, y, themeBg.width * scale, themeBg.height * scale);

                        // Overlay oscuro elegante para resaltar el contenido central
                        const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
                        gradient.addColorStop(0, 'rgba(0,0,0,0.3)');
                        gradient.addColorStop(0.5, 'rgba(0,0,0,0.5)'); // Más oscuro al centro si se quiere, o al revés
                        gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                    } catch (e) {
                        console.warn('Fallo carga de fondo theme:', e);
                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                    }
                } else {
                    // Gradiente por defecto si no hay tema
                    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
                    gradient.addColorStop(0, '#2d1b4e'); // Purple dark
                    gradient.addColorStop(1, '#000000');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                }

                // 3. Cargar Foto Usuario
                const photo = await loadImageWithTimeout(currentPhotoUrl, 10000);

                if (frameUrl) {
                    // MODO MARCO PERSONALIZADO (Ej: Tarjeta FIFA)
                    try {
                        const frameBg = await loadImageWithTimeout(frameUrl, 8000);
                        
                        // Dibujar foto (cover central)
                        const scale = Math.max(canvasWidth / photo.width, canvasHeight / photo.height);
                        const x = (canvasWidth - photo.width * scale) / 2;
                        const y = (canvasHeight - photo.height * scale) / 2;
                        ctx.drawImage(photo, x, y, photo.width * scale, photo.height * scale);

                        // Dibujar marco encima (estirado al canvas entero)
                        ctx.drawImage(frameBg, 0, 0, canvasWidth, canvasHeight);

                        // Dibujar Textos Personalizados de Jugador (Si hay nombre)
                        if (playerName) {
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'top';
                            
                            // Configurar sombra fuerte y elegante
                            ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
                            ctx.shadowBlur = 15;
                            ctx.shadowOffsetX = 3;
                            ctx.shadowOffsetY = 3;
                            
                            // Nombre
                            ctx.fillStyle = '#ffffff'; 
                            ctx.font = '900 60px "Impact", sans-serif'; // Usamos Impact o sans-serif gruesa
                            ctx.fillText(playerName, 80, 90);
                            
                            // Borde negro extra para legibilidad
                            ctx.shadowColor = "transparent";
                            ctx.lineWidth = 3;
                            ctx.strokeStyle = "rgba(0,0,0,0.8)";
                            ctx.strokeText(playerName, 80, 90);

                            // Posición
                            ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
                            ctx.fillStyle = '#e2e8f0'; 
                            ctx.font = 'bold 40px "Impact", sans-serif';
                            ctx.fillText(playerPosition, 80, 160);
                            
                            ctx.shadowColor = "transparent";
                            ctx.lineWidth = 2;
                            ctx.strokeText(playerPosition, 80, 160);

                            // Bandera Argentina (Emoji)
                            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
                            ctx.shadowBlur = 10;
                            ctx.font = '70px sans-serif';
                            ctx.fillText('🇦🇷', canvasWidth - 150, 90);
                            
                            // Reset
                            ctx.shadowColor = "transparent";
                        }
                    } catch (e) {
                        console.error("Error al cargar marco personalizado:", e);
                    }
                } else {
                    // MODO POLAROID BLANCA POR DEFECTO
                    ctx.save();

                    // Posición central desplazada ligeramente arriba para dejar espacio al texto abajo
                    const centerX = canvasWidth / 2;
                    const centerY = canvasHeight * 0.45;

                    // Rotación aleatoria muy sutil para naturalidad
                    const randomRotation = (Math.random() - 0.5) * 4 * (Math.PI / 180);

                    ctx.translate(centerX, centerY);
                    ctx.rotate(randomRotation);

                    // Dimensiones del Polaroid
                    const cardWidth = 850; // 80% del ancho aprox
                    const cardPadding = 40;
                    // Altura dinámica según foto pero con base mínima de polaroid

                    // Calcular dimensiones de foto para que entre en el ancho disponible (Card - Padding)
                    const availableWidth = cardWidth - (cardPadding * 2);
                    const scaleFactor = availableWidth / photo.width;
                    const photoDrawWidth = availableWidth;
                    const photoDrawHeight = photo.height * scaleFactor;

                    // El alto total de la tarjeta es: PaddingTop + PhotoHeight + PaddingBottom (Extra para estilo polaroid)
                    const cardHeight = cardPadding + photoDrawHeight + cardPadding + 120; // 150px extra abajo

                    // Dibujar Sombra de la tarjeta
                    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                    ctx.shadowBlur = 60;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 30;

                    // Dibujar Tarjeta Blanca
                    ctx.fillStyle = "#ffffff";
                    // Centramos rectángulo en 0,0 relativo a la traslación
                    const cardX = -cardWidth / 2;
                    const cardY = -cardHeight / 2;

                    // Rounded rect manual simple o fillRect
                    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

                    // Reset shadow para la foto
                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;

                    // Dibujar Foto
                    const photoX = cardX + cardPadding;
                    const photoY = cardY + cardPadding;
                    ctx.drawImage(photo, photoX, photoY, photoDrawWidth, photoDrawHeight);

                    // Borde sutil a la foto para separarla del blanco si es muy clara
                    ctx.strokeStyle = "rgba(0,0,0,0.05)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(photoX, photoY, photoDrawWidth, photoDrawHeight);

                    // Marca de Agua (EventPix) dentro del borde blanco inferior
                    const bottomSpaceHeight = cardPadding + 120;
                    const watermarkY = (cardHeight / 2) - (bottomSpaceHeight / 2) + 10;

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold 45px "Orbitron", sans-serif'; 
                    ctx.fillStyle = "#2563eb"; 
                    ctx.shadowColor = "rgba(0,0,0,0.1)"; 
                    ctx.shadowBlur = 0;
                    ctx.fillText("EventPix", 0, watermarkY);

                    ctx.restore();
                }

                // 5. Textos (Fuera de la rotación)
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Config text shadow común
                ctx.shadowColor = "rgba(0,0,0,0.8)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 4;

                // Nombre Evento (Solo si no hay marco personalizado)
                if (eventName && !frameUrl) {
                    // Ajustar fuente según largo
                    const fontSize = eventName.length > 20 ? 70 : 90;
                    ctx.font = `bold ${fontSize}px "Playfair Display", serif`; // Fuente elegante
                    ctx.fillStyle = "#ffffff";

                    const textY = canvasHeight * 0.82; // Abajo
                    ctx.fillText(eventName, canvasWidth / 2, textY);

                    // Fecha (Pequeña abajo del nombre)
                    const date = new Date();
                    const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    // O formato texto: { day: 'numeric', month: 'long' }

                    ctx.font = '300 36px "Montserrat", sans-serif'; // Fuente moderna limpia
                    ctx.fillStyle = "rgba(255,255,255,0.9)";
                    ctx.fillText(dateStr.replace(/\//g, '.'), canvasWidth / 2, textY + 70);
                }

                // 7. Exportar
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.90); // Alta calidad
                    setFinalImage(dataUrl);
                } catch (e: any) {
                    console.error("Error exportando canvas:", e);
                    throw new Error("Error de seguridad (CORS) al guardar imagen.");
                }

            } catch (err: any) {
                console.error("Error general:", err);
                setError(err.message || "Error generando imagen");
                setFinalImage(currentPhotoUrl);
            } finally {
                setIsGenerating(false);
            }
        };

        generateImage();
    }, [isOpen, currentPhotoUrl, frameUrl, themeBackgroundUrl, eventName, playerName, playerPosition]); // Añadidos dependencies

    const handleDownload = () => {
        if (finalImage) {
            saveAs(finalImage, `souvenir-eventpix-${Date.now()}.jpg`);
        }
    };

    const handleShare = async () => {
        if (finalImage && navigator.share) {
            try {
                // Convertir dataURL a Blob para compartir
                const res = await fetch(finalImage);
                const blob = await res.blob();
                const file = new File([blob], "souvenir.jpg", { type: "image/jpeg" });

                await navigator.share({
                    title: 'Mi recuerdo de EventPix',
                    text: '¡Mira mi foto del evento!',
                    files: [file]
                });
            } catch (error) {
                console.error("Error sharing:", error);
            }
        }
    };

    const handleAIGeneration = async () => {
        if (!currentPhotoUrl) return;
        setIsGeneratingAI(true);
        toast.info("¡La IA está transformando tu foto! Esto puede tomar unos segundos...");
        try {
            const prompt = "ultra realistic portrait of a professional football player, wearing Argentina national team jersey, standing in a stadium at night with bright lights, centered composition, looking directly at the camera, sharp focus, highly detailed face, natural skin texture, cinematic lighting, 85mm lens, shallow depth of field, high detail, professional sports photography, FIFA ultimate team card style, symmetrical framing, clean background separation, realistic proportions, no text, no watermark --no deformed face, distorted eyes, extra eyes, extra fingers, blurry, low quality, cartoon, anime, unrealistic skin, bad anatomy, mutated face, duplicate face, disfigured, oversharpen, noise, artifacts";
            
            const replicateToken = import.meta.env.VITE_REPLICATE_API_TOKEN;
            if (!replicateToken) {
                throw new Error("Falta el token de Replicate en las variables de entorno (.env).");
            }

            // 1. Iniciar la predicción usando el proxy local de Vite
            const createRes = await fetch('/api/replicate/v1/predictions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${replicateToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'wait'
                },
                body: JSON.stringify({
                    version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
                    input: {
                        prompt: prompt,
                        main_face_image: currentPhotoUrl,
                        num_steps: 20,
                        start_step: 4,
                        id_weight: 1,
                        guidance_scale: 4,
                        true_cfg: 1,
                        max_sequence_length: 128,
                        width: 896,
                        height: 1152,
                        output_format: "webp",
                        output_quality: 80,
                        negative_prompt: "bad quality, worst quality, text, signature, watermark, extra limbs"
                    }
                }),
            });

            const resText = await createRes.text();
            if (!createRes.ok) {
                console.error("Detalle del error Replicate:", createRes.status, resText);
                throw new Error(`Error API (${createRes.status}): ${resText.substring(0, 60)}...`);
            }
            let prediction = JSON.parse(resText);

            // 2. Polling si no terminó inmediatamente
            let attempts = 0;
            while (
                prediction.status !== 'succeeded' &&
                prediction.status !== 'failed' &&
                prediction.status !== 'canceled' &&
                attempts < 30
            ) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const pollRes = await fetch(`/api/replicate/v1/predictions/${prediction.id}`, {
                    headers: { 'Authorization': `Bearer ${replicateToken}` }
                });
                prediction = await pollRes.json();
                attempts++;
            }

            if (prediction.status !== 'succeeded') throw new Error("La generación falló o tardó demasiado.");
            
            const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
            
            if (outputUrl) {
                // Fetch de la imagen para evitar problemas de CORS en el Canvas
                const res = await fetch(outputUrl);
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCurrentPhotoUrl(reader.result as string);
                    toast.success("¡Foto transformada con éxito!");
                    setIsGeneratingAI(false);
                    setHasGeneratedAI(true);
                };
                reader.readAsDataURL(blob);
            } else {
                throw new Error("No se pudo obtener la imagen generada.");
            }
        } catch (error: any) {
            console.error("Error con IA:", error);
            toast.error(error.message || "Ocurrió un error al convertir tu foto con IA.");
            setIsGeneratingAI(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-white p-0 max-h-[95vh] flex flex-col overflow-hidden">
                <DialogHeader className="p-4 bg-slate-900/50 backdrop-blur border-b border-slate-800 flex flex-row items-center justify-between shrink-0">
                    <div>
                        <DialogTitle className="text-lg font-medium flex items-center gap-2">
                            🎉 ¡Tu Recuerdo!
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-sm">
                            Tu foto con el marco del evento
                        </DialogDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </DialogHeader>

                <div className="p-4 flex flex-col items-center gap-4 overflow-y-auto flex-1">
                    <div className="relative w-full h-[45vh] bg-slate-900 flex items-center justify-center border border-slate-800 rounded-sm overflow-hidden shrink-0">
                        {isGenerating ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 animate-pulse">Creando tu recuerdo...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center gap-4 p-6 text-center">
                                <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-2">
                                    ⚠️
                                </div>
                                <p className="text-red-400 font-medium">Hubo un problema</p>
                                <p className="text-slate-400 text-sm">{error}</p>
                                <Button variant="outline" onClick={onClose} className="mt-4">
                                    Cerrar
                                </Button>
                            </div>
                        ) : finalImage ? (
                            <img
                                src={finalImage}
                                alt="Photo Booth"
                                className="w-full h-full object-contain"
                            />
                        ) : null}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />

                    <div className="flex flex-col gap-3 w-full">
                        {aiGenerationEnabled && !hasGeneratedAI && (
                            <div className="flex flex-col gap-3 w-full p-4 bg-slate-900 border border-slate-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm font-medium text-slate-300 uppercase tracking-wider">Tu Tarjeta de Jugador</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="TU NOMBRE"
                                    maxLength={20}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-3 text-sm text-white font-bold uppercase placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                                />
                                <select 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-3 text-sm text-white font-bold uppercase focus:outline-none focus:border-cyan-500"
                                    value={playerPosition}
                                    onChange={(e) => setPlayerPosition(e.target.value)}
                                >
                                    <option value="DELANTERO">Delantero</option>
                                    <option value="MEDIOCAMPISTA">Mediocampista</option>
                                    <option value="DEFENSOR">Defensor</option>
                                    <option value="ARQUERO">Arquero</option>
                                    <option value="DT">Director Técnico</option>
                                </select>
                                <Button
                                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold h-12 shadow-lg shadow-blue-500/30 mt-2"
                                    onClick={handleAIGeneration}
                                    disabled={isGenerating || isGeneratingAI || !playerName.trim()}
                                >
                                    {isGeneratingAI ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Generando con IA...
                                        </>
                                    ) : (
                                        "Generar Foto IA"
                                    )}
                                </Button>
                                {!playerName.trim() && (
                                    <p className="text-[10px] text-yellow-500 text-center">Ingresa tu nombre para habilitar el botón</p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3 w-full">
                            <Button
                                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white h-12 shadow-lg"
                                onClick={handleDownload}
                                disabled={isGenerating}
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Guardar
                            </Button>
                            {typeof navigator.share === 'function' && (
                                <Button
                                    variant="secondary"
                                    className="flex-1 h-12 shadow-lg"
                                    onClick={handleShare}
                                    disabled={isGenerating}
                                >
                                    <Share2 className="w-5 h-5 mr-2" />
                                    Compartir
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            className="w-full h-14 border-red-500/50 text-red-500 hover:bg-red-500/10 bg-slate-900 mt-2 font-black text-sm uppercase tracking-wider"
                            onClick={onClose}
                        >
                            <X className="w-6 h-6 mr-2" />
                            Cerrar y Seguir Subiendo
                        </Button>
                        <p className="text-[10px] text-slate-500 text-center mt-1">
                            Guarda tu foto con el marco oficial del evento de recuerdo.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
};
