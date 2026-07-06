import { useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy, Image as ImageIcon, Save, FolderOpen } from 'lucide-react';
import { MediaPickerModal } from '../../MediaPickerModal';
import { toast } from 'sonner';
import { useDisplayLabelGroups, useCreateLabelGroup } from '@/hooks/use-display-labels';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DynamicLabel } from '@/types/display';

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

export const DynamicMenuForm = ({ config, onChange, commerceId }: { config: Partial<DynamicMenuConfig>, onChange: (c: Partial<DynamicMenuConfig>) => void, commerceId: string }) => {
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

    const labels = config.labels || [];
    
    // DB Labels Integration
    const { data: savedGroups = [] } = useDisplayLabelGroups(commerceId);
    
    const liveTextMap = useMemo(() => {
        const map: Record<string, string> = {};
        savedGroups.forEach(g => {
            g.labels?.forEach((l: any) => {
                if (l.name) map[l.name] = l.text;
            });
        });
        return map;
    }, [savedGroups]);

    const createGroup = useCreateLabelGroup();

    const saveGroup = async () => {
        if (labels.length === 0) {
            toast.error('No hay etiquetas para guardar');
            return;
        }
        const name = prompt('Nombre del grupo de etiquetas (ej: Precios Cafetería):');
        if (!name) return;
        
        try {
            await createGroup.mutateAsync({ commerceId, name, labels });
            toast.success('Grupo guardado en la base de datos');
        } catch (e) {
            toast.error('Error al guardar grupo');
        }
    };

    const loadGroup = (group: any) => {
        if (labels.length > 0) {
            if (!confirm('¿Reemplazar las etiquetas actuales por las del grupo "' + group.name + '"?')) return;
        }
        
        // Detect if this group comes from WorkspaceLabels (all labels clustered around the center)
        const isRawGroup = group.labels.every((l: any) => l.x >= 40 && l.x <= 60 && l.y >= 40 && l.y <= 60);

        const newLabels = group.labels.map((l: any, i: number) => {
            if (isRawGroup) {
                // Auto-layout as a neat vertical list
                return {
                    ...l,
                    id: crypto.randomUUID(),
                    x: 20,
                    y: Math.min(15 + (i * 10), 85) // 10% vertical spacing
                };
            }
            // Preserve carefully saved positions
            return {
                ...l, 
                id: crypto.randomUUID()
            };
        });
        
        onChange({ ...config, labels: newLabels });
        toast.success('Grupo cargado');
    };

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

    // Label Management
    const addLabel = () => {
        const newLabel: DynamicLabel = {
            id: crypto.randomUUID(),
            text: '1000',
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

    // Editor Preview Drag Handling moved to Preview component

    return (
        <div className="flex flex-col gap-6 h-full pb-10">
            {/* Editor Panel */}
            <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
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
                        <div className="flex gap-2">
                            {savedGroups.length > 0 && (
                                <Select onValueChange={(v) => loadGroup(savedGroups.find(g => g.id === v)!)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 h-8 text-xs w-[120px]">
                                        <FolderOpen className="w-3 h-3 mr-2" />
                                        <span>Librería</span>
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800">
                                        {savedGroups.map(g => (
                                            <div key={g.id} className="flex justify-between items-center group">
                                                <SelectItem value={g.id} className="flex-1 cursor-pointer pr-8">{g.name}</SelectItem>
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button size="sm" variant="outline" onClick={saveGroup} className="h-8 text-xs bg-slate-950 border-slate-800 hover:bg-slate-800" title="Guardar como grupo en librería">
                                <Save className="w-3 h-3" />
                            </Button>
                            <Button size="sm" onClick={addLabel} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"><Plus className="w-3 h-3 mr-1"/> Añadir</Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto mb-4">
                        {labels.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No hay etiquetas creadas.</p>}
                        {labels.map(label => (
                            <div 
                                key={label.id} 
                                onClick={() => setSelectedLabelId(label.id)}
                                className={cn("flex justify-between items-center p-2 rounded-md border cursor-pointer", selectedLabelId === label.id ? "bg-emerald-500/10 border-emerald-500/50" : "bg-slate-950 border-slate-800 hover:border-slate-700")}
                            >
                                <span className="text-sm text-white truncate flex-1 font-bold">{label.name || label.text || 'Sin texto'}</span>
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
                                <Label>Identificador (Opcional)</Label>
                                <Input placeholder="Ej: Precio Hamburguesa" value={selectedLabel.name || ''} onChange={e => updateLabel(selectedLabel.id, { name: e.target.value })} className="bg-slate-950 border-slate-700" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label>Texto / Precio</Label>
                                {selectedLabel.name && liveTextMap[selectedLabel.name] !== undefined ? (
                                    <div className="space-y-1">
                                        <Input 
                                            value={liveTextMap[selectedLabel.name]} 
                                            disabled 
                                            className="bg-slate-900 border-emerald-500/50 text-emerald-400 font-bold" 
                                        />
                                        <p className="text-xs text-emerald-500">Este precio se sincroniza en vivo desde la pestaña "Etiquetas"</p>
                                    </div>
                                ) : (
                                    <Input value={selectedLabel.text} onChange={e => updateLabel(selectedLabel.id, { text: e.target.value })} className="bg-slate-950 border-slate-700" />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Tipografía</Label>
                                <Select value={selectedLabel.fontFamily} onValueChange={(v) => updateLabel(selectedLabel.id, { fontFamily: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {FONTS.map(f => <SelectItem key={f.value} value={f.value} style={{fontFamily: f.value}}>{f.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Estilo</Label>
                                <Select value={selectedLabel.fontWeight} onValueChange={(v) => updateLabel(selectedLabel.id, { fontWeight: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="bold">Negrita (Bold)</SelectItem>
                                        <SelectItem value="900">Extrabold</SelectItem>
                                        <SelectItem value="300">Ligera (Light)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tamaño ({selectedLabel.fontSize})</Label>
                                <Input type="number" min="1" max="50" step="0.5" value={selectedLabel.fontSize} onChange={e => updateLabel(selectedLabel.id, { fontSize: parseFloat(e.target.value) })} className="bg-slate-950 border-slate-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={selectedLabel.color} onChange={e => updateLabel(selectedLabel.id, { color: e.target.value })} className="h-10 w-10 rounded border border-slate-700 bg-transparent p-1 cursor-pointer" />
                                </div>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Animación</Label>
                                <Select value={selectedLabel.animation} onValueChange={(v: any) => updateLabel(selectedLabel.id, { animation: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue/></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
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
            
            <MediaPickerModal 
                isOpen={isMediaPickerOpen}
                onClose={() => setIsMediaPickerOpen(false)}
                commerceId={commerceId}
                onSelect={handleBackgroundSelect}
            />
        </div>
    );
};

export const DynamicMenuPreview = ({ config, onChange, isEditing = false, commerceId }: { config: Partial<DynamicMenuConfig>, onChange?: (c: Partial<DynamicMenuConfig>) => void, isEditing?: boolean, commerceId?: string }) => {
    const labels = config.labels || [];
    const containerRef = useRef<HTMLDivElement>(null);
    const params = useParams<{ commerceId: string }>();
    const effectiveCommerceId = commerceId || params.commerceId || '';
    const { data: savedGroups = [], error: labelsError } = useDisplayLabelGroups(effectiveCommerceId);

    const displayLabels = useMemo(() => {
        if (!labels.length || !savedGroups.length) return labels;
        
        const liveTextMap = new Map();
        savedGroups.forEach(g => {
            if (Array.isArray(g.labels)) {
                g.labels.forEach((l: any) => {
                    if (l.name) liveTextMap.set(l.name.toLowerCase().trim(), l.text);
                });
            }
        });

        return labels.map(label => {
            if (label.name) {
                const liveText = liveTextMap.get(label.name.toLowerCase().trim());
                if (liveText !== undefined) {
                    return { ...label, text: liveText };
                }
            }
            return label;
        });
    }, [labels, savedGroups]);
    
    // Editor Preview Drag Handling
    const handleDragEnd = (id: string, _event: any, info: any) => {
        if (!containerRef.current || !onChange) return;
        
        const label = labels.find(l => l.id === id);
        if (!label) return;

        const rect = containerRef.current.getBoundingClientRect();
        
        // Convert original percentage to pixels
        const startXPx = (label.x / 100) * rect.width;
        const startYPx = (label.y / 100) * rect.height;
        
        // Add the drag offset (how many pixels the user moved it)
        const newXPx = startXPx + info.offset.x;
        const newYPx = startYPx + info.offset.y;
        
        const xPct = Math.max(0, Math.min(100, (newXPx / rect.width) * 100));
        const yPct = Math.max(0, Math.min(100, (newYPx / rect.height) * 100));

        const newLabels = labels.map(l => l.id === id ? { ...l, x: xPct, y: yPct } : l);
        onChange({ ...config, labels: newLabels });
    };
    
    // Convert animations to CSS classes or motion props if needed
    // For TvPlayer we can just use tailwind animate classes
    const getAnimationClass = (anim: string) => {
        switch (anim) {
            case 'fade-in': return 'animate-in fade-in duration-1000';
            case 'slide-up': return 'animate-in fade-in slide-in-from-bottom-full duration-1000';
            case 'pulse': return 'animate-pulse';
            case 'bounce': return 'animate-bounce';
            default: return '';
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full relative bg-black overflow-hidden">
            {config.backgroundMediaUrl && (
                config.backgroundMediaType === 'video' ? (
                    <video src={config.backgroundMediaUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                ) : (
                    <img src={config.backgroundMediaUrl} className="w-full h-full object-cover" />
                )
            )}
            
            {displayLabels.map(label => {
                if (isEditing && onChange) {
                    return (
                        <motion.div
                            key={`${label.id}-${label.x}-${label.y}`} // Force remount on drop to reset transform
                            drag
                            dragMomentum={false}
                            onDragEnd={(_e, info) => handleDragEnd(label.id, _e, info)}
                            dragConstraints={containerRef}
                            style={{
                                position: 'absolute',
                                left: `${label.x}%`,
                                top: `${label.y}%`,
                                transform: 'translate(-50%, -50%)',
                                color: label.color,
                                fontFamily: label.fontFamily,
                                fontSize: `${label.fontSize}vw`,
                                fontWeight: label.fontWeight,
                                fontStyle: label.fontStyle,
                                textShadow: '0px 4px 15px rgba(0,0,0,0.9), 0px 0px 8px rgba(0,0,0,0.8)',
                                WebkitTextStroke: '1px rgba(0,0,0,0.3)',
                                zIndex: 10,
                                cursor: 'grab'
                            }}
                            className="whitespace-nowrap select-none hover:outline hover:outline-2 hover:outline-emerald-500 hover:outline-offset-4 rounded cursor-grab"
                            whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
                        >
                            {label.text}
                        </motion.div>
                    )
                }

                return (
                    <div
                        key={label.id}
                        className={cn("absolute whitespace-nowrap", getAnimationClass(label.animation))}
                        style={{
                            left: `${label.x}%`,
                            top: `${label.y}%`,
                            transform: 'translate(-50%, -50%)',
                            color: label.color,
                            fontFamily: label.fontFamily,
                            fontSize: `${label.fontSize}vw`,
                            fontWeight: label.fontWeight,
                            fontStyle: label.fontStyle,
                            textShadow: '0px 2px 10px rgba(0,0,0,0.8)'
                        }}
                    >
                        {label.text}
                    </div>
                )
            })}
        </div>
    );
};
