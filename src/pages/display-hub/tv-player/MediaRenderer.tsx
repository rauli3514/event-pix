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
    const activeItem = items[currentIndex];

    if (!activeItem) return null;

    return (
        <MediaErrorBoundary 
            key={`${activeItem.id}-${currentIndex}`}
            onError={() => {
                console.log(`Error in item ${activeItem.id}. Watchdog will skip.`);
            }}
        >
            <PlayerRenderer 
                item={activeItem} 
                isActive={true} 
                commerceId={deviceCommerceId}
            />
        </MediaErrorBoundary>
    );
}
