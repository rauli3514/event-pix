import imageCompression from 'browser-image-compression';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { Upload, X, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useSubmissions } from "@/hooks/use-submissions";

interface UploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId?: string;
    onSuccess?: (photoUrl: string) => void;
}

export const UploadModal = ({ open, onOpenChange, eventId, onSuccess }: UploadModalProps) => {
    const { createSubmission } = useSubmissions(eventId);
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const originalFile = e.target.files?.[0];
        if (originalFile) {
            try {
                setIsCompressing(true);

                // Opciones de compresión optimizadas para eventos
                const options = {
                    maxSizeMB: 1,              // Máximo 1MB (suficiente para pantallas)
                    maxWidthOrHeight: 1920,    // Full HD (1080p)
                    useWebWorker: true,        // No congelar la UI
                    initialQuality: 0.8,       // 80% calidad
                    fileType: 'image/jpeg'     // Convertir todo a JPG
                };

                const compressedFile = await imageCompression(originalFile, options);

                // Usar el archivo comprimido
                setFile(compressedFile);

                // Crear preview
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreview(reader.result as string);
                    setIsCompressing(false);
                };
                reader.readAsDataURL(compressedFile);

            } catch (error) {
                console.error("Error al comprimir imagen:", error);
                // Fallback: usar original si falla la compresión
                setFile(originalFile);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreview(reader.result as string);
                    setIsCompressing(false);
                };
                reader.readAsDataURL(originalFile);
            }
        }
    };

    const handleSubmit = () => {
        if (!preview) return;

        // Guardar referencia local
        const uploadedPhotoUrl = preview;

        createSubmission.mutate({
            type: 'photo',
            content: preview,
            file: file || undefined,
            author: 'Invitado'
        }, {
            onSuccess: () => {
                setShowSuccess(true);

                // Llamar al callback de éxito
                if (onSuccess) {
                    onSuccess(uploadedPhotoUrl);
                }

                setTimeout(() => {
                    setShowSuccess(false);
                    setPreview(null);
                    setFile(null);
                    onOpenChange(false);
                }, 2500);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10">
                {showSuccess ? (
                    // Success View
                    <div className="py-8 px-4">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-foreground">¡Foto Enviada!</h3>
                                <p className="text-muted-foreground">Tu foto aparecerá en pantalla pronto.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Upload View
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-center text-xl font-serif">Subir Foto</DialogTitle>
                        </DialogHeader>

                        <div className="grid gap-6 py-4">
                            <div
                                className="relative aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden bg-muted/20"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {preview ? (
                                    <>
                                        <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-none"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreview(null);
                                                setFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                            <Upload className="h-6 w-6 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">Toca para seleccionar</p>
                                        <p className="text-xs text-muted-foreground">o toma una foto</p>
                                    </>
                                )}
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <Button
                                onClick={handleSubmit}
                                disabled={!preview || isCompressing || createSubmission.isPending}
                                className="w-full h-12 text-lg font-medium"
                            >
                                {isCompressing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Comprimiendo...
                                    </>
                                ) : createSubmission.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <Camera className="mr-2 h-5 w-5" />
                                        Enviar Foto
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
