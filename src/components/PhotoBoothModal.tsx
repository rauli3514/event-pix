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
}

export const PhotoBoothModal = ({ isOpen, onClose, photoUrl, frameUrl }: PhotoBoothModalProps) => {
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

        // Helper: Redimensionar imagen para ahorrar memoria/tiempo
        const resizeImage = (img: HTMLImageElement, maxWidth: number, maxHeight: number): HTMLCanvasElement => {
            try {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) throw new Error('No context');

                const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
                tempCanvas.width = img.width * scale;
                tempCanvas.height = img.height * scale;

                tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                return tempCanvas;
            } catch (e) {
                console.error("Error resizing:", e);
                return img as any; // Fallback
            }
        };

        const generateImage = async (retryCount = 0) => {
            // Límite de reintentos (10 intentos * 100ms = 1 segundo máx)
            if (retryCount > 10) {
                setError("Error interno: El canvas no se pudo inicializar a tiempo.");
                setIsGenerating(false);
                return;
            }

            const canvas = canvasRef.current;
            if (!canvas) {
                // Si no hay canvas, esperar 100ms y reintentar
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
                setError("Error interno: Contexto 2D no disponible");
                setIsGenerating(false);
                return;
            }

            try {
                // 1. Configuración
                const canvasWidth = 600;
                const canvasHeight = 900;
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                // 2. Cargar Marco
                if (frameUrl) {
                    try {
                        console.log('Cargando marco...');
                        // Usar fetch para evitar problemas de CORS con caché de navegador
                        const response = await fetch(frameUrl);
                        const blob = await response.blob();
                        const objectUrl = URL.createObjectURL(blob);

                        const frame = await loadImageWithTimeout(objectUrl, 5000);
                        URL.revokeObjectURL(objectUrl); // Limpiar memoria

                        const optimizedFrame = resizeImage(frame, canvasWidth, canvasHeight);

                        const scale = Math.max(canvasWidth / optimizedFrame.width, canvasHeight / optimizedFrame.height);
                        const x = (canvasWidth - optimizedFrame.width * scale) / 2;
                        const y = (canvasHeight - optimizedFrame.height * scale) / 2;
                        ctx.drawImage(optimizedFrame, x, y, optimizedFrame.width * scale, optimizedFrame.height * scale);
                    } catch (e) {
                        console.warn('Fallo carga de marco:', e);
                        // No bloqueamos, seguimos con fondo blanco
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                    }
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                }

                // 3. Cargar Foto
                console.log('Cargando foto...');
                const photo = await loadImageWithTimeout(photoUrl, 8000);
                console.log('✓ Foto lista');

                // 4. Dibujar
                ctx.save();
                const randomRotation = (Math.random() - 0.5) * 12 * (Math.PI / 180);
                const randomX = (Math.random() - 0.5) * 40;
                const randomY = (Math.random() - 0.5) * 40;

                ctx.translate(canvasWidth / 2 + randomX, canvasHeight / 2 + randomY);
                ctx.rotate(randomRotation);

                const targetWidth = canvasWidth * 0.60; // Reducido al 60% (antes 75%)
                const targetHeight = (photo.height / photo.width) * targetWidth;

                // Sombra más pronunciada (Efecto profundidad)
                ctx.shadowColor = "rgba(0, 0, 0, 0.6)"; // Más oscura
                ctx.shadowBlur = 30; // Más difusa
                ctx.shadowOffsetX = 10;
                ctx.shadowOffsetY = 15;

                // Borde blanco (Polaroid)
                const borderSize = 20; // Un poco más grueso para que se vea bien
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(
                    (-targetWidth / 2) - borderSize,
                    (-targetHeight / 2) - borderSize,
                    targetWidth + (borderSize * 2),
                    targetHeight + (borderSize * 2)
                );

                ctx.shadowColor = "transparent";
                ctx.drawImage(photo, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
                ctx.restore();

                // 5. Exportar
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.60);
                    setFinalImage(dataUrl);
                    console.log('✅ Listo');
                } catch (e: any) {
                    console.error("Error exportando canvas:", e);
                    throw new Error("Error de seguridad (CORS) al exportar imagen. El marco debe permitir acceso cruzado.");
                }

            } catch (err: any) {
                console.error("Error general:", err);
                setError(err.message || "Error desconocido al generar imagen");
                setFinalImage(photoUrl); // Fallback a foto original
            } finally {
                setIsGenerating(false);
            }
        };

        generateImage();
    }, [isOpen, photoUrl, frameUrl]);

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
                    <div className="relative w-full aspect-[2/3] bg-slate-900 flex items-center justify-center">
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
