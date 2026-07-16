import { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
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
    const [renderedIndices, setRenderedIndices] = useState<number[]>([currentIndex]);

    useEffect(() => {
        setRenderedIndices(prev => {
            if (prev.includes(currentIndex)) return prev;
            // Keep the previous index and the new current index in the DOM for transitions
            return [prev[prev.length - 1], currentIndex].filter(i => i !== undefined);
        });
    }, [currentIndex]);

    if (items.length === 0) return null;

    return (
        <>
            {renderedIndices.map(index => {
                const item = items[index];
                if (!item) return null;
                const isActive = index === currentIndex;

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
                            commerceId={deviceCommerceId}
                        />
                    </MediaErrorBoundary>
                );
            })}
        </>
    );
}
