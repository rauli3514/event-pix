import { useEvent } from "@/context/EventContext";
import { useEventSettings } from "@/hooks/use-event-settings";
import { GridTemplate } from "@/components/display/GridTemplate";
import { SlideshowTemplate } from "@/components/display/SlideshowTemplate";
import { MasonryTemplate } from "@/components/display/MasonryTemplate";
import { PhotoVoteDisplayOverlay } from "@/components/photovote/PhotoVoteDisplayOverlay";
import { TriviaDisplayOverlay } from "@/components/trivia/TriviaDisplayOverlay";
import { Button } from "@/components/ui/button";

const Display = () => {
    const { event, isLoading: eventLoading } = useEvent();
    const { data: settings, isLoading: settingsLoading } = useEventSettings(event?.id);

    if (eventLoading || settingsLoading) {
        return (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                <div className="text-slate-400">Cargando evento...</div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-6">
                <div className="text-xl text-slate-400">Evento no encontrado</div>
                <Button 
                    variant="outline" 
                    className="border-violet-500/50 hover:bg-violet-500/20 text-violet-300"
                    onClick={() => {
                        const w = window as any;
                        if (w.caches) {
                            w.caches.keys().then((names: string[]) => Promise.all(names.map((name: string) => w.caches.delete(name))))
                                .then(() => window.location.reload());
                        } else {
                            window.location.reload();
                        }
                    }}
                >
                    Limpiar Memoria y Recargar
                </Button>
            </div>
        );
    }

    const template = settings?.display_template || 'slideshow';

    return (
        <div className="absolute inset-0 w-full h-full bg-slate-950 text-white overflow-hidden">
            {template === 'grid' && <GridTemplate eventId={event.id} />}
            {template === 'slideshow' && <SlideshowTemplate eventId={event.id} />}
            {template === 'masonry' && <MasonryTemplate eventId={event.id} />}

            {/* Overlays para juegos dinámicos */}
            <PhotoVoteDisplayOverlay eventId={event.id} />
            <TriviaDisplayOverlay eventId={event.id} />
        </div>
    );
};

export default Display;
