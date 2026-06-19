import { useEffect, useRef } from 'react';
import { CampaignItem } from '@/types/display';

interface PlayerRendererProps {
    item: CampaignItem;
    isActive: boolean;
}

export const PlayerRenderer = ({ item, isActive }: PlayerRendererProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Si es un iframe, forzar una recarga suave cuando se vuelve activo (opcional, depende de si queremos resetear el estado de la web externa)
    useEffect(() => {
        if (isActive && item.type === 'external_url' && iframeRef.current) {
            // Uncomment if you want to refresh the iframe every time it shows
            // iframeRef.current.src = item.url || '';
        }
    }, [isActive, item]);

    // Ocultar si no está activo, pero mantenerlo montado para no perder tiempo de carga
    const visibilityClass = isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none";

    switch (item.type) {
        case 'external_url':
            return (
                <div className={`absolute inset-0 transition-opacity duration-1000 bg-black ${visibilityClass}`}>
                    {item.url ? (
                        <iframe 
                            ref={iframeRef}
                            src={item.url} 
                            className="w-full h-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                            title={item.title}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-2xl">
                            URL Externa no configurada
                        </div>
                    )}
                </div>
            );
        
        case 'image_ad':
            return (
                <div className={`absolute inset-0 transition-opacity duration-1000 bg-black flex items-center justify-center ${visibilityClass}`}>
                    {item.imageUrl ? (
                        <img 
                            src={item.imageUrl} 
                            alt={item.title}
                            className="w-full h-full object-cover" // object-contain si no queremos recortar
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-2xl">
                            Imagen no configurada
                        </div>
                    )}
                </div>
            );

        case 'event_photos':
            return (
                <div className={`absolute inset-0 transition-opacity duration-1000 bg-zinc-950 flex flex-col items-center justify-center ${visibilityClass}`}>
                    <h1 className="text-4xl text-white font-bold mb-4">Galería de EventPix</h1>
                    <p className="text-zinc-400">Próximamente: Integración automática de fotos del evento {item.eventId}</p>
                </div>
            );

        default:
            return (
                <div className={`absolute inset-0 transition-opacity duration-1000 bg-zinc-950 flex items-center justify-center ${visibilityClass}`}>
                    <p className="text-white text-2xl">Tipo de contenido desconocido</p>
                </div>
            );
    }
};
