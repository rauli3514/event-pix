import { useEffect, useRef } from 'react';

interface PlayerRendererProps {
    item: any; // Using any to support both CampaignItem (V1) and UniversalElement (V2)
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
        case 'url':
        case 'external_url':
            const isImageUrl = item.url && /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(item.url);
            
            if (isImageUrl) {
                return (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000' }} className={`transition-opacity duration-1000 flex items-center justify-center ${visibilityClass}`}>
                        <img 
                            src={item.url} 
                            alt={item.title || item.content}
                            style={{ width: '100vw', height: '100vh', objectFit: item.fitMode || 'contain' }}
                            loading="lazy"
                        />
                    </div>
                );
            }

            let normalizedUrl = item.url;
            if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
                normalizedUrl = 'https://' + normalizedUrl;
            }

            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000' }} className={`transition-opacity duration-1000 ${visibilityClass}`}>
                    {isActive && normalizedUrl ? (
                        <iframe 
                            ref={iframeRef}
                            src={normalizedUrl} 
                            style={{ width: '100%', height: '100%', border: 0 }}
                            allow="autoplay; fullscreen"
                            title={item.title || item.content}
                        />
                    ) : isActive && !normalizedUrl ? (
                        <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center text-white text-2xl">
                            URL Externa no configurada
                        </div>
                    ) : null}
                </div>
            );
        
        case 'image':
        case 'image_ad':
            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000' }} className={`transition-opacity duration-1000 flex items-center justify-center ${visibilityClass}`}>
                    {item.imageUrl || item.url ? (
                        <img 
                            src={item.imageUrl || item.url} 
                            alt={item.title || item.content}
                            style={{ width: '100vw', height: '100vh', objectFit: item.fitMode || 'contain' }}
                            loading="lazy"
                        />
                    ) : (
                        <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center text-white text-2xl">
                            Imagen no configurada
                        </div>
                    )}
                </div>
            );

        case 'video':
        case 'video_ad':
            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000' }} className={`transition-opacity duration-1000 flex items-center justify-center ${visibilityClass}`}>
                    {item.url ? (
                        <video 
                            src={item.url} 
                            style={{ width: '100vw', height: '100vh', objectFit: item.fitMode || 'contain' }}
                            autoPlay={isActive}
                            muted={item.mute !== false}
                            loop={item.loop !== false}
                            playsInline
                        />
                    ) : (
                        <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center text-white text-2xl">
                            Video no configurado
                        </div>
                    )}
                </div>
            );

        case 'text':
            return (
                <div 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: item.backgroundColor || '#000' }} 
                    className={`transition-opacity duration-1000 flex items-center justify-center ${visibilityClass}`}
                >
                    <p style={{ color: item.color || '#fff', fontSize: '5rem', fontWeight: 'bold', textAlign: 'center', padding: '2rem' }}>
                        {item.content}
                    </p>
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
