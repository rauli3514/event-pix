import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { usePlaylistRotation } from '@/hooks/use-playlist-rotation';
import { PlayerRenderer } from '@/components/display/PlayerRenderer';

interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[];
    commerceId?: string;
    portrait?: boolean;
    shuffle?: boolean;
    transition?: string;
    // Pausada mientras está abierta la vista previa grande.
    enabled?: boolean;
}

// Pantalla en miniatura que pasa la playlist como el TV. Se dibuja al tamaño
// de un TV (1280x720) y se achica, así las apps y webs se ven proporcionadas.
export function PlaylistMiniPreview({ items, commerceId, portrait, shuffle, transition, enabled = true }: Props) {
    const baseW = portrait ? 720 : 1280;
    const baseH = portrait ? 1280 : 720;
    const frameRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);

    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const update = () => setScale(el.clientWidth / baseW);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [baseW]);

    const { currentIndex, prevIndex, onVideoEnded, onVideoError, onVideoDuration } =
        usePlaylistRotation(items, enabled && items.length > 0, null, !!shuffle);

    return (
        <div>
            <div
                ref={frameRef}
                className={`relative w-full overflow-hidden rounded-lg bg-black ring-4 ring-zinc-800 dark:ring-zinc-700 ${portrait ? 'aspect-[9/16] max-w-[180px] mx-auto' : 'aspect-video'}`}
            >
                {items.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-zinc-500">
                        <Play className="w-6 h-6" />
                        <span className="text-xs">Todavía no hay nada para mostrar</span>
                    </div>
                ) : enabled && scale > 0 ? (
                    <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                        {items.map((item, index) => (index === currentIndex || index === prevIndex) && (
                            <PlayerRenderer
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={index === currentIndex}
                                isPrev={index === prevIndex}
                                commerceId={commerceId}
                                defaultTransition={transition}
                                nativeLoop={items.length === 1 && item.loop !== false}
                                onVideoEnded={() => onVideoEnded(index)}
                                onVideoError={() => onVideoError(index)}
                                onVideoDuration={seconds => onVideoDuration(index, seconds)}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
            {items.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground text-center">
                    Mostrando {Math.min(currentIndex, items.length - 1) + 1} de {items.length}
                </p>
            )}
        </div>
    );
}
