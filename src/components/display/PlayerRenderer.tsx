import { useEffect, useRef } from 'react';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { WeatherPreview } from './apps/weather/WeatherApp';
import { SplitScreenPreview } from './apps/split-screen/SplitScreenApp';
import { DolarPreview } from './apps/dolar/DolarApp';
import { TickerPreview } from './apps/ticker/TickerApp';
import { ClockPreview } from './apps/clock/ClockApp';
import { QRPreview } from './apps/qr/QRApp';
import { ReviewsPreview } from './apps/reviews/ReviewsApp';
import { DynamicMenuPreview } from './apps/dynamic-menu/DynamicMenuApp';
import { YoutubePreview } from './apps/youtube/YoutubeApp';

interface PlayerRendererProps {
    item: any; // Using any to support both CampaignItem (V1) and UniversalElement (V2)
    isActive: boolean;
    commerceId?: string;
}

export const PlayerRenderer = ({ item, isActive, commerceId }: PlayerRendererProps) => {
    // Attempt to fetch live media to keep apps synchronized with recent edits without reloading the playlist
    const { data: mediaList = [] } = useDisplayMedia(commerceId || '');

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Si es un iframe, forzar una recarga suave cuando se vuelve activo (opcional, depende de si queremos resetear el estado de la web externa)
    useEffect(() => {
        if (isActive && item.type === 'external_url' && iframeRef.current) {
            // Uncomment if you want to refresh the iframe every time it shows
            // iframeRef.current.src = item.url || '';
        }
    }, [isActive, item]);

    // Handle video play/pause based on active state without unmounting
    useEffect(() => {
        if ((item.type === 'video' || item.type === 'video_ad') && videoRef.current) {
            if (isActive) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {});
            } else {
                videoRef.current.pause();
            }
        }
    }, [isActive, item.type]);

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
        case 'app':
        case 'widget':
        case 'layout':
            let metadata = item.metadata || {};
            
            // Sync with live app config if available (fixes playlist caching old app configs)
            if (mediaList.length > 0) {
                let liveMedia = null;
                if (item.source_id) {
                    liveMedia = mediaList.find((m: any) => m.id === item.source_id);
                } else if (item.content) {
                    // Fallback for old items that didn't save source_id
                    liveMedia = mediaList.find((m: any) => m.type === 'app' && m.name === item.content);
                }
                if (liveMedia && liveMedia.metadata) {
                    metadata = liveMedia.metadata;
                }
            }
            
            const appId = metadata.appId || (item.url?.startsWith('app://') ? item.url.replace('app://', '') : null);
            
            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#000', ...displayStyle }}>
                    {appId === 'weather' ? (
                        <WeatherPreview config={metadata.config || {}} />
                    ) : appId === 'split-screen' ? (
                        <SplitScreenPreview config={metadata.config || {}} commerceId={commerceId} />
                    ) : appId === 'dolar' ? (
                        <DolarPreview config={metadata.config || {}} />
                    ) : appId === 'ticker' ? (
                        <TickerPreview config={metadata.config || {}} />
                    ) : appId === 'clock' ? (
                        <ClockPreview config={metadata.config || {}} />
                    ) : appId === 'qr' ? (
                        <QRPreview config={metadata.config || {}} />
                    ) : appId === 'reviews' ? (
                        <ReviewsPreview config={metadata.config || {}} />
                    ) : appId === 'dynamic-menu' ? (
                        <DynamicMenuPreview config={metadata.config || {}} commerceId={commerceId} />
                    ) : appId === 'youtube' ? (
                        <YoutubePreview config={metadata.config || {}} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white bg-slate-900 flex-col gap-4">
                            <span className="text-2xl font-bold">App: {appId}</span>
                            <span className="text-slate-400">Esta app aún no está soportada en el reproductor.</span>
                        </div>
                    )}
                </div>
            );

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
                    {normalizedUrl ? (
                        <iframe 
                            ref={iframeRef}
                            src={normalizedUrl} 
                            style={{ width: '100%', height: '100%', border: 0 }}
                            allow="autoplay; fullscreen"
                            title={item.title || item.content}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>
                            URL Externa no configurada
                        </div>
                    )}
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
                            ref={videoRef}
                            src={item.url} 
                            style={{ width: '100%', height: '100%', objectFit: objectFitValue, pointerEvents: 'none' }}
                            muted={item.mute !== false}
                            loop={item.loop !== false}
                            playsInline
                            preload="auto"
                            disablePictureInPicture
                            controls={false}
                            poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                            className="[&::-webkit-media-controls-play-button]:hidden [&::-webkit-media-controls-start-playback-button]:hidden [&::-webkit-media-controls]:hidden"
                            onEnded={(e) => {
                                if (item.loop !== false) {
                                    const video = e.target as HTMLVideoElement;
                                    video.currentTime = 0;
                                    video.play().catch(() => {});
                                }
                            }}
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
