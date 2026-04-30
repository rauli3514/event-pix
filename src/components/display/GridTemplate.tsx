import { usePhotos } from "@/hooks/use-photos";
import { Camera, Image as ImageIcon } from "lucide-react";

interface GridTemplateProps {
    eventId?: string;
}

export const GridTemplate = ({ eventId }: GridTemplateProps) => {
    const { data: photos, isLoading } = usePhotos(eventId);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-transparent">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-violet-200 font-light tracking-wide animate-pulse">Cargando galería...</p>
            </div>
        );
    }

    if (!photos || photos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-transparent">
                <div className="bg-slate-900/80 backdrop-blur-xl p-12 rounded-[2rem] border border-slate-700/50 shadow-2xl flex flex-col items-center gap-6 max-w-lg animate-fade-in-up">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
                        <ImageIcon className="h-10 w-10 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-200 to-white">
                            Galería Vacía
                        </h3>
                        <p className="text-slate-300 text-lg leading-relaxed">
                            Aún no hay fotos en este evento.<br />
                            ¡Sé el primero en subir una! 📸
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-violet-950/20 to-slate-950">
            {/* Header decorativo opcional */}
            <div className="container mx-auto px-4 pt-8 pb-4">
                <h2 className="text-2xl font-light tracking-widest text-violet-200/80 uppercase mb-6 border-b border-white/10 pb-4">
                    Galería del Evento
                </h2>
            </div>

            <div className="container mx-auto px-4 pb-12">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {photos.map((photo, index) => (
                        <div
                            key={photo.id}
                            className="group relative aspect-square overflow-hidden rounded-2xl bg-white/5 border border-white/10 shadow-lg backdrop-blur-sm animate-fade-in-up hover:shadow-violet-500/20 hover:border-violet-500/30 transition-all duration-500"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <img
                                src={photo.image_url}
                                alt={photo.message || "Foto del evento"}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                loading="lazy"
                            />

                            {/* Overlay en hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                                {photo.message ? (
                                    <p className="text-white text-sm font-medium line-clamp-2">
                                        "{photo.message}"
                                    </p>
                                ) : (
                                    <div className="flex items-center gap-2 text-white/80 text-xs">
                                        <Camera className="w-3 h-3" />
                                        <span>EventPix</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
