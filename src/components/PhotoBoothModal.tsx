import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";

interface PhotoBoothModalProps {
    isOpen: boolean;
    onClose: () => void;
    photoUrl: string;
    frameUrl?: string | null;
    themeBackgroundUrl?: string | null;
    eventName?: string;
}

export const PhotoBoothModal = ({ isOpen, onClose, photoUrl, frameUrl, themeBackgroundUrl, eventName }: PhotoBoothModalProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isGenerating, setIsGenerating] = useState(true);
    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                // 1. Configuración (Instagram Story 900x1600 para buen balance calidad/peso)
                const canvasWidth = 1080;
                const canvasHeight = 1920;
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
                const photo = await loadImageWithTimeout(photoUrl, 10000);

                // 4. Dibujar Foto (Estilo Polaroid Flotante)
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
                // Calculamos centro del espacio inferior disponible
                // El espacio blanco abajo mide: cardPadding + 120px
                const bottomSpaceHeight = cardPadding + 120;
                const watermarkY = (cardHeight / 2) - (bottomSpaceHeight / 2) + 10; // +10 ajuste visual

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 45px "Orbitron", sans-serif'; // Más grande y tecno
                ctx.fillStyle = "#2563eb"; // Azul Eléctrico (Tailwind blue-600)
                ctx.shadowColor = "rgba(0,0,0,0.1)"; // Sombra muy sutil
                ctx.shadowBlur = 0;
                ctx.fillText("EventPix", 0, watermarkY);

                ctx.restore();

                // 5. Textos (Fuera de la rotación)
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Config text shadow común
                ctx.shadowColor = "rgba(0,0,0,0.8)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 4;

                // Nombre Evento
                if (eventName) {
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
                setFinalImage(photoUrl);
            } finally {
                setIsGenerating(false);
            }
        };

        generateImage();
    }, [isOpen, photoUrl, frameUrl, themeBackgroundUrl, eventName]); // Deps actualizadas

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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-white p-0 overflow-hidden">
                <DialogHeader className="p-4 bg-slate-900/50 backdrop-blur border-b border-slate-800 flex flex-row items-center justify-between">
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

                <div className="p-6 flex flex-col items-center gap-6">
                    <div className="relative w-full aspect-[9/16] bg-slate-900 flex items-center justify-center border border-slate-800 rounded-sm">
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

                    <div className="flex gap-3 w-full">
                        <Button
                            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                            onClick={handleDownload}
                            disabled={isGenerating}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Guardar
                        </Button>
                        {typeof navigator.share === 'function' && (
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={handleShare}
                                disabled={isGenerating}
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Compartir
                            </Button>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 text-center">
                        Guarda tu foto con el marco oficial del evento de recuerdo.
                    </p>
                </div>
            </DialogContent>
        </Dialog >
    );
};
