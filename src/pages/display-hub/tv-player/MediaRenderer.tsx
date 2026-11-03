import { PlayerRenderer } from '@/components/display/PlayerRenderer';
import { CampaignItem } from '@/types/display';
import { isCheapItem } from '@/lib/tvPerformance';
import { RetryBoundary } from '@/components/display/apps/RetryBoundary';

interface Props {
    items: CampaignItem[];
    currentIndex: number;
    // Con orden aleatorio el anterior/siguiente no son ±1: los decide la rotación.
    prevIndex?: number;
    nextIndex?: number;
    deviceCommerceId: string;
    onVideoEnded: (index: number) => boolean;
    onVideoError: (index: number) => void;
    onVideoDuration: (index: number, seconds: number) => void;
    // Modo liviano (equipos con poca memoria, ver tvPerformance.ts).
    lite?: boolean;
}

export function MediaRenderer({ items, currentIndex, prevIndex: prevProp, nextIndex: nextProp, deviceCommerceId, onVideoEnded, onVideoError, onVideoDuration, lite }: Props) {
    if (!items || items.length === 0) return null;

    const prevIndex = prevProp ?? (items.length > 1 ? (currentIndex - 1 + items.length) % items.length : -1);
    const nextIndex = nextProp ?? (items.length > 1 ? (currentIndex + 1) % items.length : -1);

    return (
        <div className="relative w-full h-full overflow-hidden bg-black">
            {items.map((item, index) => {
                const isActive = index === currentIndex;
                const isPrev = index === prevIndex;
                const isNext = index === nextIndex;

                // Solo renderizar en el DOM si es el activo, el anterior (en transición de salida) o el siguiente (precargando)
                if (!isActive && !isPrev && !isNext && items.length > 3) {
                    return null;
                }
                // Modo liviano: fuera de pantalla solo quedan imágenes y textos. Un
                // video, una web o una app montados de fondo ocupan memoria y CPU
                // (decodificador, JavaScript corriendo) aunque no se vean.
                if (lite && !isActive && (!(isPrev || isNext) || !isCheapItem(item.type as string))) {
                    return null;
                }

                return (
                    // Si el item falla queda en negro (la rotación sigue) y a los 30 s se
                    // vuelve a intentar: antes quedaba negro hasta reiniciar la TV.
                    <RetryBoundary key={`${item.id}-${index}`}>
                        <PlayerRenderer 
                            item={item} 
                            isActive={isActive} 
                            isPrev={isPrev}
                            lite={lite}
                            commerceId={deviceCommerceId}
                            nativeLoop={items.length === 1 && (item as any).loop !== false}
                            onVideoEnded={() => onVideoEnded(index)}
                            onVideoError={() => onVideoError(index)}
                            onVideoDuration={(seconds) => onVideoDuration(index, seconds)}
                        />
                    </RetryBoundary>
                );
            })}
        </div>
    );
}
