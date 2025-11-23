import { useEventSettings } from "@/hooks/use-event-settings";
import { GridTemplate } from "@/components/display/GridTemplate";
import { SlideshowTemplate } from "@/components/display/SlideshowTemplate";
import { MasonryTemplate } from "@/components/display/MasonryTemplate";

const Display = () => {
    const { data: settings, isLoading } = useEventSettings();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-muted-foreground">Cargando...</div>
            </div>
        );
    }

    const template = settings?.display_template || 'grid';

    return (
        <div className="min-h-screen bg-background">
            {template === 'grid' && <GridTemplate />}
            {template === 'slideshow' && <SlideshowTemplate />}
            {template === 'masonry' && <MasonryTemplate />}
        </div>
    );
};

export default Display;
