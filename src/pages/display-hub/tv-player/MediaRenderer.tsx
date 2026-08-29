import { Component, ErrorInfo, ReactNode } from 'react';
import { PlayerRenderer } from '@/components/display/PlayerRenderer';
import { CampaignItem } from '@/types/display';

interface Props {
    items: CampaignItem[];
    currentIndex: number;
    deviceCommerceId: string;
}

interface State {
    hasError: boolean;
}

export class MediaErrorBoundary extends Component<{children: ReactNode, onError: () => void}, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("MediaRenderer Error:", error, errorInfo);
        this.props.onError();
    }

    public render() {
        if (this.state.hasError) {
            // If the current media crashes, we just render an empty black screen
            // so the rotation logic can move on to the next item seamlessly.
            return <div className="w-full h-full bg-black"></div>;
        }
        return this.props.children;
    }
}

export function MediaRenderer({ items, currentIndex, deviceCommerceId }: Props) {
    if (!items || items.length === 0) return null;

    const prevIndex = items.length > 1 ? (currentIndex - 1 + items.length) % items.length : -1;
    const nextIndex = items.length > 1 ? (currentIndex + 1) % items.length : -1;

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

                return (
                    <MediaErrorBoundary 
                        key={`${item.id}-${index}`}
                        onError={() => {
                            console.log(`Error in item ${item.id}. Watchdog will skip.`);
                        }}
                    >
                        <PlayerRenderer 
                            item={item} 
                            isActive={isActive} 
                            isPrev={isPrev}
                            commerceId={deviceCommerceId}
                        />
                    </MediaErrorBoundary>
                );
            })}
        </div>
    );
}
