import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy, Image as ImageIcon, Move, LayoutTemplate } from 'lucide-react';
import { MediaPickerModal } from '../../MediaPickerModal';
import { DisplayMedia } from '@/types/display';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface DynamicLabel {
    id: string;
    text: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    color: string;
    fontFamily: string;
    fontSize: number; // in vw or similar relative unit, or just generic size multiplier 1-10
    fontWeight: string;
    fontStyle: string; // normal, italic
    animation: 'none' | 'fade-in' | 'slide-up' | 'pulse' | 'bounce';
}

export interface DynamicMenuConfig {
    backgroundMediaId?: string;
    backgroundMediaUrl?: string;
    backgroundMediaType?: string;
    labels: DynamicLabel[];
}

const FONTS = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Roboto Mono', label: 'Roboto Mono' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Fredoka', label: 'Fredoka' },
    { value: 'Cinzel', label: 'Cinzel' },
    { value: 'Great Vibes', label: 'Great Vibes' },
    { value: 'Orbitron', label: 'Orbitron' },
];

export const DynamicMenuForm = ({ config, onChange, commerceId }: { config: Partial<DynamicMenuConfig>, onChange: (c: Partial<DynamicMenuConfig>) => void, commerceId: string, currentFolder?: string }) => {
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const labels = config.labels || [];

    const handleBackgroundSelect = (media: any, type: 'media' | 'playlist') => {
        if (type !== 'media') return;
        onChange({
            ...config,
            backgroundMediaId: media.id,
            backgroundMediaUrl: media.url,
            backgroundMediaType: media.type
        });
        setIsMediaPickerOpen(false);
    };

    const addLabel = () => {
        const newLabel: DynamicLabel = {
            id: crypto.randomUUID(),
            text: 'Nuevo Precio $0',
            x: 50,
            y: 50,
            color: '#ffffff',
            fontFamily: 'Montserrat',
            fontSize: 4, // 4vw default
            fontWeight: 'bold',
            fontStyle: 'normal',
            animation: 'none'
        };
        onChange({ ...config, labels: [...labels, newLabel] });
        setSelectedLabelId(newLabel.id);
    };

    const updateLabel = (id: string, updates: Partial<DynamicLabel>) => {
        const newLabels = labels.map(l => l.id === id ? { ...l, ...updates } : l);
        onChange({ ...config, labels: newLabels });
    };

    const duplicateLabel = (id: string) => {
        const labelToCopy = labels.find(l => l.id === id);
        if (!labelToCopy) return;
        
        const newLabel = {
            ...labelToCopy,
            id: crypto.randomUUID(),
            y: Math.min(labelToCopy.y + 5, 90), // offset slightly
            x: Math.min(labelToCopy.x + 5, 90)
        };
        onChange({ ...config, labels: [...labels, newLabel] });
        setSelectedLabelId(newLabel.id);
    };

    const removeLabel = (id: string) => {
        onChange({ ...config, labels: labels.filter(l => l.id !== id) });
        if (selectedLabelId === id) setSelectedLabelId(null);
    };

    const selectedLabel = labels.find(l => l.id === selectedLabelId);

    // Editor Preview Drag Handling
    const handleDragEnd = (id: string, _event: any, info: any) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate new percentages
        // Framer motion gives us point.x and point.y relative to the screen. 
        // We need to find the relative position inside the container.
        const xPx = info.point.x - rect.left;
        const yPx = info.point.y - rect.top;
        
        const xPct = Math.max(0, Math.min(100, (xPx / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, (yPx / rect.height) * 100));

        updateLabel(id, { x: xPct, y: yPct });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Editor Panel */}
            <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="font-semibold text-white mb-4">Fondo del Menú</h3>
                    {config.backgroundMediaUrl ? (
                        <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-700 mb-3">
                            {config.backgroundMediaType === 'video' ? (
                                <video src={config.backgroundMediaUrl} className="w-full h-full object-cover opacity-50" muted />
                            ) : (
                                <img src={config.backgroundMediaUrl} className="w-full h-full object-cover opacity-50" />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Button variant="secondary" size="sm" onClick={() => setIsMediaPickerOpen(true)}>Cambiar Fondo</Button>
                            </div>
                        </div>
                    ) : (
                        <Button 
                            variant="outline" 
                            className="w-full h-32 border-dashed border-slate-700 hover:border-slate-500 bg-slate-950 hover:bg-slate-900"
                            onClick={() => setIsMediaPickerOpen(true)}
                        >
                            <ImageIcon className="w-6 h-6 mr-2 text-slate-400" />
                            Seleccionar Imagen o Video
                        </Button>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-white">Etiquetas Dinámicas</h3>
                        <Button size="sm" onClick={addLabel} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4 mr-1"/> Añadir</Button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto mb-4">
                        {labels.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No hay etiquetas creadas.</p>}
                        {labels.map(label => (
                            <div 
                                key={label.id} 
                                onClick={() => setSelectedLabelId(label.id)}
                                className={cn("flex justify-between items-center p-2 rounded-md border cursor-pointer", selectedLabelId === label.id ? "bg-emerald-500/10 border-emerald-500/50" : "bg-slate-950 border-slate-800 hover:border-slate-700")}
                            >
                                <span className="text-sm text-white truncate flex-1" style={{ fontFamily: label.fontFamily }}>{label.text || 'Sin texto'}</span>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); duplicateLabel(label.id); }}><Copy className="w-3 h-3" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950" onClick={(e) => { e.stopPropagation(); removeLabel(label.id); }}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedLabel && (
                        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Texto / Precio</Label>
                                <Input value={selectedLabel.text} onChange={e => updateLabel(selectedLabel.id, { text: e.target.value })} className="bg-slate-950 border-slate-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipografía</Label>
                                <Select value={selectedLabel.fontFamily} onValueChange={(v) => updateLabel(selectedLabel.id, { fontFamily: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800">
                                        {FONTS.map(f => <SelectItem key={f.value} value={f.value} style={{fontFamily: f.value}}>{f.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Estilo</Label>
                                <Select value={selectedLabel.fontWeight} onValueChange={(v) => updateLabel(selectedLabel.id, { fontWeight: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800">
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="bold">Negrita (Bold)</SelectItem>
                                        <SelectItem value="900">Extrabold</SelectItem>
                                        <SelectItem value="300">Ligera (Light)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tamaño ({selectedLabel.fontSize})</Label>
                                <input type="range" min="1" max="20" step="0.5" value={selectedLabel.fontSize} onChange={e => updateLabel(selectedLabel.id, { fontSize: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={selectedLabel.color} onChange={e => updateLabel(selectedLabel.id, { color: e.target.value })} className="h-10 w-10 rounded border-0 bg-transparent p-0 cursor-pointer" />
                                    <Input value={selectedLabel.color} onChange={e => updateLabel(selectedLabel.id, { color: e.target.value })} className="bg-slate-950 border-slate-700 flex-1" />
                                </div>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Animación</Label>
                                <Select value={selectedLabel.animation} onValueChange={(v: any) => updateLabel(selectedLabel.id, { animation: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800">
                                        <SelectItem value="none">Sin Animación</SelectItem>
                                        <SelectItem value="fade-in">Fade In</SelectItem>
                                        <SelectItem value="slide-up">Slide Up</SelectItem>
                                        <SelectItem value="pulse">Pulse (Latido)</SelectItem>
                                        <SelectItem value="bounce">Bounce</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Interactive Preview Canvas */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
                <div 
                    ref={containerRef}
                    className="relative w-full aspect-video bg-black rounded-lg shadow-2xl overflow-hidden ring-1 ring-slate-800"
                >
                    {config.backgroundMediaUrl ? (
                         config.backgroundMediaType === 'video' ? (
                            <video src={config.backgroundMediaUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                        ) : (
                            <img src={config.backgroundMediaUrl} className="w-full h-full object-cover" />
                        )
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                            <LayoutTemplate className="w-12 h-12 mb-2 opacity-20" />
                            <p>Selecciona un fondo para comenzar</p>
                        </div>
                    )}

                    {/* Draggable Labels */}
                    {labels.map(label => (
                        <motion.div
                            key={label.id}
                            drag
                            dragMomentum={false}
                            onDragEnd={(e, info) => handleDragEnd(label.id, e, info)}
                            dragConstraints={containerRef}
                            onClick={() => setSelectedLabelId(label.id)}
                            style={{
                                position: 'absolute',
                                left: `${label.x}%`,
                                top: `${label.y}%`,
                                transform: 'translate(-50%, -50%)', // Center the drag point
                                color: label.color,
                                fontFamily: label.fontFamily,
                                fontSize: `${label.fontSize * 0.5}vw`, // Scaled for preview (assuming preview is roughly 50vw wide)
                                fontWeight: label.fontWeight,
                                fontStyle: label.fontStyle,
                                zIndex: selectedLabelId === label.id ? 10 : 1,
                                cursor: 'grab'
                            }}
                            className={cn(
                                "whitespace-nowrap px-2 py-1 rounded transition-colors select-none",
                                selectedLabelId === label.id ? "ring-2 ring-emerald-500 bg-emerald-500/20" : "hover:ring-1 hover:ring-slate-500 hover:bg-white/10"
                            )}
                            whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
                        >
                            {label.text}
                        </motion.div>
                    ))}
                </div>
                <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-md text-xs text-slate-400">
                    <Move className="w-3 h-3" /> Arrastra los textos para posicionarlos
                </div>
            </div>

            <MediaPickerModal 
                isOpen={isMediaPickerOpen}
                onClose={() => setIsMediaPickerOpen(false)}
                commerceId={commerceId}
                onSelect={handleBackgroundSelect}
            />
        </div>
    );
};

export const DynamicMenuPreview = ({ config }: { config: Partial<DynamicMenuConfig> }) => {
    const labels = config.labels || [];
    
    // Convert animations to CSS classes or motion props if needed
    // For TvPlayer we can just use tailwind animate classes
    const getAnimationClass = (anim: string) => {
        switch (anim) {
            case 'fade-in': return 'animate-in fade-in duration-1000';
            case 'slide-up': return 'animate-in fade-in slide-in-from-bottom-10 duration-1000';
            case 'pulse': return 'animate-pulse';
            case 'bounce': return 'animate-bounce';
            default: return '';
        }
    };

    return (
        <div className="w-full h-full relative bg-black overflow-hidden">
            {config.backgroundMediaUrl && (
                config.backgroundMediaType === 'video' ? (
                    <video src={config.backgroundMediaUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                ) : (
                    <img src={config.backgroundMediaUrl} className="w-full h-full object-cover" />
                )
            )}
            
            {labels.map(label => (
                <div
                    key={label.id}
                    className={cn("absolute whitespace-nowrap", getAnimationClass(label.animation))}
                    style={{
                        left: `${label.x}%`,
                        top: `${label.y}%`,
                        transform: 'translate(-50%, -50%)',
                        color: label.color,
                        fontFamily: label.fontFamily,
                        fontSize: `${label.fontSize}vw`, // Full TV size (100vw = width)
                        fontWeight: label.fontWeight,
                        fontStyle: label.fontStyle,
                        textShadow: '0px 2px 10px rgba(0,0,0,0.5)' // Basic shadow for legibility
                    }}
                >
                    {label.text}
                </div>
            ))}
        </div>
    );
};
