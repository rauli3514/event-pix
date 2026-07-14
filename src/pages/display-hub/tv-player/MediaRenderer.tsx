import React, { Component, ErrorInfo, ReactNode } from 'react';
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
    return (
        <>
            {items.map((item, index) => (
                <MediaErrorBoundary 
                    key={`${item.id}-${index}`}
                    onError={() => {
                        console.log(`Error in item ${item.id}. Watchdog will skip.`);
                    }}
                >
                    <PlayerRenderer 
                        item={item} 
                        isActive={index === currentIndex} 
                        commerceId={deviceCommerceId}
                    />
                </MediaErrorBoundary>
            ))}
        </>
    );
}
