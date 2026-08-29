import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, MonitorPlay } from 'lucide-react';
import { PlayerRenderer } from '@/components/display/PlayerRenderer';

interface PlaylistPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: any[];
}

export const PlaylistPreviewModal: React.FC<PlaylistPreviewModalProps> = ({ isOpen, onClose, items }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Reiniciar al abrir
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
        } else {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
        }
    }, [isOpen]);

    // Lógica de rotación automática
    useEffect(() => {
        if (!isOpen || items.length === 0) return;

        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);

        const currentItem = items[currentIndex];
        if (!currentItem) {
            setCurrentIndex(0);
            return;
        }

        // Default a 10s si no hay duración válida
        const durationMs = (currentItem.duration && currentItem.duration > 0 ? currentItem.duration : 10) * 1000;

        rotationTimeoutRef.current = setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }, durationMs);

        return () => {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
        };
    }, [currentIndex, items, isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-card border-border text-foreground shadow-2xl max-w-5xl p-0 overflow-hidden sm:rounded-2xl h-[85vh] flex flex-col">
                <DialogHeader className="px-6 py-4 border-b border-border bg-muted flex flex-row items-center justify-between shrink-0">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <MonitorPlay className="w-5 h-5 text-primary" />
                        Vista Previa de Playlist
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 bg-black relative overflow-hidden">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Play className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">La playlist está vacía</p>
                            <p className="text-sm">Añade elementos para previsualizarlos aquí</p>
                        </div>
                    ) : (
                        items.map((item, index) => {
                            const isActive = index === currentIndex;
                            const prevIndex = items.length > 1 ? (currentIndex - 1 + items.length) % items.length : -1;
                            const isPrev = index === prevIndex;

                            return (
                                <PlayerRenderer 
                                    key={`${item.id}-${index}`} 
                                    item={item} 
                                    isActive={isActive} 
                                    isPrev={isPrev}
                                />
                            );
                        })
                    )}
                </div>

                {/* Footer Controls */}
                {items.length > 0 && (
                    <div className="px-6 py-3 border-t border-border bg-muted flex items-center justify-between shrink-0">
                        <div className="text-sm font-medium text-muted-foreground">
                            Mostrando {currentIndex + 1} de {items.length}
                        </div>
                        <div className="flex items-center gap-2">
                            {items.map((_, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-primary w-4' : 'bg-border hover:bg-primary/50'}`}
                                    aria-label={`Ir al elemento ${idx + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
