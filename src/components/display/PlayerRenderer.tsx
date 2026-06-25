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

    // Implementamos transiciones CSS (Fade, Slide, etc.)
    const getTransitionStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: isActive ? 1 : 0,
            pointerEvents: isActive ? 'auto' : 'none',
            zIndex: isActive ? 10 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            willChange: 'opacity, transform'
        };

        if (item.transition === 'none') {
            return { ...base, transition: 'none', display: isActive ? 'flex' : 'none' };
        }
        
        if (item.transition === 'slide') {
            return {
                ...base,
                transition: 'transform 0.8s ease-in-out, opacity 0.8s ease-in-out',
                transform: isActive ? 'translateX(0)' : 'translateX(100%)'
            };
        }

        // Default: Fade
        return {
            ...base,
            transition: 'opacity 1s ease-in-out'
        };
    };

    const displayStyle = getTransitionStyle();
    // Si el item tiene su propio fitMode, lo respetamos, si no usamos contain por defecto
    const objectFitValue: any = item.fitMode || 'contain';

    switch (item.type) {
        case 'url':
        case 'external_url':
            const isImageUrl = item.url && /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(item.url);
            
            if (isImageUrl) {
                return (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', ...displayStyle }}>
                        <img 
                            src={item.url} 
                            alt={item.title || item.content}
                            style={{ width: '100%', height: '100%', objectFit: objectFitValue }}
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
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', ...displayStyle }}>
                    {isActive && normalizedUrl ? (
                        <iframe 
                            ref={iframeRef}
                            src={normalizedUrl} 
                            style={{ width: '100%', height: '100%', border: 0 }}
                            allow="autoplay; fullscreen"
                            title={item.title || item.content}
                        />
                    ) : isActive && !normalizedUrl ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>
                            URL Externa no configurada
                        </div>
                    ) : null}
                </div>
            );
        
        case 'image':
        case 'image_ad':
            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', ...displayStyle }}>
                    {item.imageUrl || item.url ? (
                        <img 
                            src={item.imageUrl || item.url} 
                            alt={item.title || item.content}
                            style={{ width: '100%', height: '100%', objectFit: objectFitValue }}
                            loading="lazy"
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>
                            Imagen no configurada
                        </div>
                    )}
                </div>
            );

        case 'video':
        case 'video_ad':
            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', ...displayStyle }}>
                    {item.url ? (
                        <video 
                            src={item.url} 
                            style={{ width: '100%', height: '100%', objectFit: objectFitValue }}
                            autoPlay={isActive}
                            muted={item.mute !== false}
                            loop={item.loop !== false}
                            playsInline
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>
                            Video no configurado
                        </div>
                    )}
                </div>
            );

        case 'text':
            return (
                <div 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: item.backgroundColor || '#000', alignItems: 'center', justifyContent: 'center', ...displayStyle }} 
                >
                    <p style={{ color: item.color || '#fff', fontSize: '5rem', fontWeight: 'bold', textAlign: 'center', padding: '2rem' }}>
                        {item.content}
                    </p>
                </div>
            );

        case 'event_photos':
            return (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: '#09090b', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...displayStyle }}>
                    <h1 className="text-4xl text-white font-bold mb-4">Galería de EventPix</h1>
                    <p className="text-zinc-400">Próximamente: Integración automática de fotos del evento {item.eventId}</p>
                </div>
            );

        default:
            return (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center', ...displayStyle }}>
                    <p className="text-white text-2xl">Tipo de contenido desconocido</p>
                </div>
            );
    }
};
