import { usePhotos } from "@/hooks/use-photos";
import { Camera, Image as ImageIcon } from "lucide-react";

interface MasonryTemplateProps {
    eventId?: string;
}

export const MasonryTemplate = ({ eventId }: MasonryTemplateProps) => {
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
                <div className="bg-white/5 backdrop-blur-xl p-12 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col items-center gap-6 max-w-lg animate-fade-in-up">
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
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950/20 to-slate-950">
            {/* Header decorativo opcional */}
            <div className="container mx-auto px-4 pt-8 pb-4">
                <h2 className="text-2xl font-light tracking-widest text-violet-200/80 uppercase mb-6 border-b border-white/10 pb-4">
                    Muro Social
                </h2>
            </div>

            <div className="container mx-auto px-4 pb-12">
                <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
                    {photos.map((photo, index) => (
                        <div
                            key={photo.id}
                            className="break-inside-avoid relative mb-4 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-lg backdrop-blur-md animate-fade-in-up hover:shadow-violet-500/20 transition-all duration-300 group"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <img
                                src={photo.image_url}
                                alt={photo.message || "Foto del evento"}
                                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                                loading="lazy"
                            />

                            {/* Overlay con mensaje siempre visible si hay texto, o en hover */}
                            <div className={`
                                w-full p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent
                                ${!photo.message ? "absolute bottom-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" : ""}
                            `}>
                                {photo.message ? (
                                    <>
                                        <p className="text-white text-sm md:text-base font-medium leading-snug">
                                            "{photo.message}"
                                        </p>
                                        <div className="mt-2 flex items-center gap-2 text-violet-300 text-xs">
                                            <div className="h-1 w-1 bg-violet-400 rounded-full"></div>
                                            <span>Mensaje del invitado</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-white/80 text-xs">
                                        <Camera className="w-3 h-3" />
                                        <span>Captura EventPix</span>
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
