import { usePhotos } from "@/hooks/use-photos";

interface MasonryTemplateProps {
    eventId?: string;
}

export const MasonryTemplate = ({ eventId }: MasonryTemplateProps) => {
    const { data: photos, isLoading } = usePhotos(eventId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-muted-foreground">Cargando fotos...</div>
            </div>
        );
    }

    if (!photos || photos.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-2">
                    <p className="text-2xl font-serif text-muted-foreground">
                        Aún no hay fotos
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Las fotos aparecerán aquí cuando los invitados las suban
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="break-inside-avoid mb-4 animate-fade-in"
                    >
                        <div className="overflow-hidden rounded-lg bg-muted">
                            <img
                                src={photo.image_url}
                                alt={photo.message || "Foto del evento"}
                                className="w-full hover:scale-105 transition-transform duration-300"
                            />
                            {photo.message && (
                                <div className="p-3 bg-card">
                                    <p className="text-sm text-card-foreground">{photo.message}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
