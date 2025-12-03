import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Download, X } from "lucide-react";
import { useState } from "react";
import { saveAs } from "file-saver";

interface PublicGalleryProps {
    eventId: string;
}

export const PublicGallery = ({ eventId }: PublicGalleryProps) => {
    const { submissions, isLoading } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Filtrar solo aprobados y fotos (no mensajes de texto puros si no tienen imagen, aunque submissions actuales mezclan)
    // Asumimos que content es la URL de la imagen
    const photos = submissions?.filter(s => s.status === 'approved' && s.type === 'photo') || [];

    if (!settings?.public_gallery_enabled) return null;

    const handleDownload = (url: string) => {
        saveAs(url, `event-pix-${Date.now()}.jpg`);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full mt-4 text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors gap-2"
                >
                    <ImageIcon className="w-4 h-4" />
                    Ver Galería de Fotos
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 bg-slate-950 border-slate-800">
                <DialogHeader className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
                    <DialogTitle className="text-white flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-violet-400" />
                        Galería del Evento
                        <span className="ml-auto text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                            {photos.length} fotos
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
                        </div>
                    ) : photos.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>Aún no hay fotos aprobadas.</p>
                            <p className="text-sm mt-2">¡Sé el primero en subir una!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {photos.map((photo) => (
                                <div
                                    key={photo.id}
                                    className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-slate-900"
                                    onClick={() => setSelectedImage(photo.content)}
                                >
                                    <img
                                        src={photo.content}
                                        alt="Foto del evento"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>

            {/* Modal de imagen completa */}
            {selectedImage && (
                <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="relative max-w-full max-h-full flex flex-col items-center">
                        <img
                            src={selectedImage}
                            alt="Vista completa"
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                        />
                        <Button
                            onClick={() => handleDownload(selectedImage)}
                            className="mt-6 bg-white text-black hover:bg-slate-200 rounded-full px-6"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar Foto
                        </Button>
                    </div>
                </div>
            )}
        </Dialog>
    );
};
