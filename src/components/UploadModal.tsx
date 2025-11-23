import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { Upload, X, Camera } from "lucide-react";
import { useSubmissions } from "@/hooks/use-submissions";

interface UploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const UploadModal = ({ open, onOpenChange }: UploadModalProps) => {
    const { createSubmission } = useSubmissions();
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = () => {
        if (!preview) return;

        createSubmission.mutate({
            type: 'photo',
            content: preview, // Used as fallback/preview if mock
            file: file || undefined,
            author: 'Invitado'
        }, {
            onSuccess: () => {
                setPreview(null);
                setFile(null);
                onOpenChange(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-script text-center text-primary">Compartir Foto</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {!preview ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/20 rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/50 transition-colors bg-black/20"
                        >
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Camera className="h-8 w-8 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Toca para tomar una foto o elegir de la galería
                            </p>
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden aspect-[3/4]">
                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                            <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-2 right-2 rounded-full"
                                onClick={() => {
                                    setPreview(null);
                                    setFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={!preview || createSubmission.isPending}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {createSubmission.isPending ? (
                            "Enviando..."
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Enviar Foto
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
