import { useEvent } from "@/context/EventContext";
import { useEventSettings } from "@/hooks/use-event-settings";
import { GridTemplate } from "@/components/display/GridTemplate";
import { SlideshowTemplate } from "@/components/display/SlideshowTemplate";
import { MasonryTemplate } from "@/components/display/MasonryTemplate";

const Display = () => {
    const { event, isLoading: eventLoading } = useEvent();
    const { data: settings, isLoading: settingsLoading } = useEventSettings(event?.id);

    if (eventLoading || settingsLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-muted-foreground">Cargando...</div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-muted-foreground">Evento no encontrado</div>
            </div>
        );
    }

    const template = settings?.display_template || 'slideshow';

    return (
        <div className="min-h-screen bg-background">
            {template === 'grid' && <GridTemplate eventId={event.id} />}
            {template === 'slideshow' && <SlideshowTemplate eventId={event.id} />}
            {template === 'masonry' && <MasonryTemplate eventId={event.id} />}
        </div>
    );
};

export default Display;
