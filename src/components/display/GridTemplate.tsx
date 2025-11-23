import { usePhotos } from "@/hooks/use-photos";

interface GridTemplateProps {
    eventId?: string;
}

export const GridTemplate = ({ eventId }: GridTemplateProps) => {
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="aspect-square overflow-hidden rounded-lg bg-muted animate-fade-in"
                    >
                        <img
                            src={photo.image_url}
                            alt={photo.message || "Foto del evento"}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
