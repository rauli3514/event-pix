import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDisplayLabelGroups, useCreateLabelGroup, useUpdateLabelGroup, useDeleteLabelGroup } from '@/hooks/use-display-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy, Database, Edit, Tags, PenTool } from 'lucide-react';
import { DynamicLabel } from '@/types/display';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const FONTS = [
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Outfit', label: 'Outfit' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Bebas Neue', label: 'Bebas Neue' },
    { value: 'Orbitron', label: 'Orbitron' },
];

export default function WorkspaceLabels() {
    const { commerceId } = useParams();
    const { data: groups = [], isLoading } = useDisplayLabelGroups(commerceId);
    
    const createGroup = useCreateLabelGroup();
    const updateGroup = useUpdateLabelGroup();
    const deleteGroup = useDeleteLabelGroup();

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');

    const activeGroup = groups.find(g => g.id === selectedGroupId);

    const handleCreateGroup = async () => {
        if (!commerceId || !newGroupName.trim()) return;
        try {
            const group = await createGroup.mutateAsync({
                commerceId,
                name: newGroupName,
                description: newGroupDesc,
                labels: []
            });
            setIsCreatingGroup(false);
            setNewGroupName('');
            setNewGroupDesc('');
            setSelectedGroupId(group.id);
            toast.success('Grupo creado correctamente');
        } catch (error: any) {
            console.error("Create group error:", error);
            toast.error(`Error al crear grupo: ${error.message || 'Error desconocido'}`);
        }
    };

    const handleDeleteGroup = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!commerceId || !confirm('¿Eliminar este grupo y todas sus etiquetas?')) return;
        try {
            await deleteGroup.mutateAsync({ id, commerceId });
            if (selectedGroupId === id) setSelectedGroupId(null);
            toast.success('Grupo eliminado');
        } catch (error) {
            toast.error('Error al eliminar grupo');
        }
    };

    // Label Management inside active group
    const addLabel = () => {
        if (!activeGroup) return;
        const newLabel: DynamicLabel = {
            id: crypto.randomUUID(),
            text: '1000',
            x: 50,
            y: 50,
            color: '#ffffff',
            fontFamily: 'Montserrat',
            fontSize: 4,
            fontWeight: 'bold',
            fontStyle: 'normal',
            animation: 'none'
        };
        const updatedLabels = [...activeGroup.labels, newLabel];
        updateGroup.mutate({ id: activeGroup.id, updates: { labels: updatedLabels } });
        setSelectedLabelId(newLabel.id);
    };



    const duplicateLabel = (id: string) => {
        if (!activeGroup) return;
        const labelToCopy = activeGroup.labels.find(l => l.id === id);
        if (!labelToCopy) return;
        
        const newLabel = {
            ...labelToCopy,
            id: crypto.randomUUID(),
            y: Math.min(labelToCopy.y + 5, 90),
            x: Math.min(labelToCopy.x + 5, 90)
        };
        const updatedLabels = [...activeGroup.labels, newLabel];
        updateGroup.mutate({ id: activeGroup.id, updates: { labels: updatedLabels } });
        setSelectedLabelId(newLabel.id);
    };

    const removeLabel = (id: string) => {
        if (!activeGroup) return;
        const updatedLabels = activeGroup.labels.filter(l => l.id !== id);
        updateGroup.mutate({ id: activeGroup.id, updates: { labels: updatedLabels } });
        if (selectedLabelId === id) setSelectedLabelId(null);
    };

    // Local state for editing without lag
    const [localLabel, setLocalLabel] = useState<DynamicLabel | null>(null);

    const selectedLabel = activeGroup?.labels.find(l => l.id === selectedLabelId);

    // Sync local label when selection changes
    useEffect(() => {
        setLocalLabel(selectedLabel || null);
    }, [selectedLabelId]);

    const handleLocalUpdate = (updates: Partial<DynamicLabel>) => {
        if (!localLabel) return;
        setLocalLabel({ ...localLabel, ...updates });
    };

    const handleSaveLabel = () => {
        if (!activeGroup || !localLabel) return;
        const updatedLabels = activeGroup.labels.map(l => l.id === localLabel.id ? localLabel : l);
        updateGroup.mutate({ id: activeGroup.id, updates: { labels: updatedLabels } });
    };

    return (
        <div className="h-full flex flex-col bg-background">
            
            {/* Descriptive Top Banner */}
            <div className="p-3 md:p-6 md:px-8 pt-3 md:pt-6 pb-2 shrink-0">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/5 border border-indigo-500/20 p-4 md:p-6 lg:p-8">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1 md:space-y-2">
                            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-2 md:gap-3">
                                <Database className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
                                Fuentes de Datos
                            </h1>
                            <p className="text-muted-foreground font-medium max-w-xl text-sm md:text-base">
                                Administrá tus precios y textos de forma centralizada. Vinculá estos datos a tus aplicaciones para actualizar todas tus pantallas a la vez.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Workspace Area (Split) */}
            <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden border-t border-border min-h-0">
                {/* Sidebar: Groups List */}
                <div className="w-full lg:w-80 flex-shrink-0 bg-card border-r border-border flex flex-col lg:overflow-y-auto">
                    <div className="p-4 border-b border-border shrink-0">
                        {isCreatingGroup ? (
                            <div className="space-y-3">
                                <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nombre del grupo..." className="bg-background" />
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsCreatingGroup(false)}>Cancelar</Button>
                                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateGroup}>Guardar</Button>
                                </div>
                            </div>
                        ) : (
                            <Button className="w-full bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 hover:text-indigo-700" variant="ghost" onClick={() => setIsCreatingGroup(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Grupo de Etiquetas
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 p-4 flex flex-col gap-2">
                        {isLoading ? (
                             <p className="text-center text-muted-foreground text-sm py-4">Cargando...</p>
                        ) : groups.length === 0 ? (
                            <div className="text-center p-8 bg-background border border-dashed rounded-xl">
                                <Tags className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                                <p className="text-muted-foreground font-medium">No hay grupos</p>
                                <p className="text-xs text-muted-foreground mt-1">Crea tu primer grupo para empezar.</p>
                            </div>
                        ) : (
                            groups.map(group => (
                                <div 
                                    key={group.id} 
                                    onClick={() => { setSelectedGroupId(group.id); setSelectedLabelId(null); }}
                                    className={cn(
                                        "p-4 rounded-xl cursor-pointer border transition-all duration-200 group relative overflow-hidden",
                                        selectedGroupId === group.id 
                                            ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                                            : "bg-background border-border hover:border-indigo-300 hover:shadow-sm"
                                    )}
                                >
                                    {selectedGroupId === group.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="pr-8">
                                            <h3 className="font-bold text-foreground truncate">{group.name}</h3>
                                            <p className="text-xs text-indigo-500 mt-1 font-medium flex items-center gap-1">
                                                <Database className="w-3 h-3" />
                                                {group.labels?.length || 0} etiquetas
                                            </p>
                                        </div>
                                    </div>
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id, e); }}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Area: Label Editor */}
                <div className="flex-1 bg-background flex flex-col lg:overflow-hidden min-h-0">
                    {activeGroup ? (
                        <div className="flex-1 flex flex-col lg:overflow-hidden">
                            {/* Header */}
                            <div className="border-b border-border bg-card p-4 lg:px-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shrink-0">
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold leading-tight truncate">{activeGroup.name}</h2>
                                    {activeGroup.description && <p className="text-sm text-muted-foreground mt-1 truncate">{activeGroup.description}</p>}
                                </div>
                                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={addLabel}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Agregar Etiqueta
                                </Button>
                            </div>

                            {/* Content Split */}
                            <div className="flex-1 flex flex-col md:flex-row lg:overflow-hidden">
                                {/* List of labels */}
                                <div className="w-full md:w-1/2 lg:w-1/3 border-r border-border bg-card p-4 lg:overflow-y-auto">
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Etiquetas en el grupo</h3>
                                    
                                    <div className="space-y-2">
                                        {activeGroup.labels.length === 0 ? (
                                            <p className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">Este grupo está vacío.<br/>Añade una etiqueta para comenzar.</p>
                                        ) : (
                                            activeGroup.labels.map(label => (
                                                <div 
                                                    key={label.id}
                                                    onClick={() => setSelectedLabelId(label.id)}
                                                    className={cn(
                                                        "p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all",
                                                        selectedLabelId === label.id ? "bg-emerald-500/10 border-emerald-500/50" : "bg-background border-border hover:border-slate-500"
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-foreground truncate text-sm">{label.name || label.text || 'Sin texto'}</h4>
                                                        <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                                                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{backgroundColor: label.color}}></div> {label.color}</span>
                                                            <span>{label.fontSize}px</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 shrink-0">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); duplicateLabel(label.id); }}><Copy className="w-4 h-4" /></Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950" onClick={(e) => { e.stopPropagation(); removeLabel(label.id); }}><Trash2 className="w-4 h-4" /></Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Label Editor Forms */}
                                <div className="flex-1 bg-background p-6 lg:overflow-y-auto pb-20 lg:pb-6">
                                {selectedLabel ? (
                                    <div className="max-w-xl mx-auto space-y-8">
                                        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><Edit className="w-5 h-5 text-emerald-500"/> Propiedades de la Etiqueta</h3>
                                            
                                            {localLabel && (
                                                <div className="space-y-6">
                                                    <div className="col-span-2 space-y-2">
                                                        <Label>Identificador (Nombre interno)</Label>
                                                        <Input placeholder="Ej: Precio Hamburguesa" value={localLabel.name || ''} onChange={e => handleLocalUpdate({ name: e.target.value })} className="bg-background" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Texto / Precio</Label>
                                                        <Textarea 
                                                            value={localLabel.text} 
                                                            onChange={e => handleLocalUpdate({ text: e.target.value })}
                                                            className="bg-background min-h-[100px] resize-none text-lg"
                                                        />
                                                    </div>
                                                
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label>Tipografía</Label>
                                                        <Select value={localLabel.fontFamily} onValueChange={(v) => handleLocalUpdate({ fontFamily: v })}>
                                                            <SelectTrigger className="bg-background"><SelectValue/></SelectTrigger>
                                                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                                                {FONTS.map(f => <SelectItem key={f.value} value={f.value} style={{fontFamily: f.value}}>{f.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Estilo (Grosor)</Label>
                                                        <Select value={localLabel.fontWeight} onValueChange={(v) => handleLocalUpdate({ fontWeight: v })}>
                                                            <SelectTrigger className="bg-background"><SelectValue/></SelectTrigger>
                                                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                                                <SelectItem value="normal">Normal</SelectItem>
                                                                <SelectItem value="bold">Negrita (Bold)</SelectItem>
                                                                <SelectItem value="900">Extrabold</SelectItem>
                                                                <SelectItem value="300">Ligera (Light)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Tamaño ({localLabel.fontSize})</Label>
                                                        <Input type="number" min="1" max="50" step="0.5" value={localLabel.fontSize} onChange={e => handleLocalUpdate({ fontSize: parseFloat(e.target.value) })} className="bg-background" />
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <Label>Color</Label>
                                                        <div className="flex gap-2">
                                                            <input type="color" value={localLabel.color} onChange={e => handleLocalUpdate({ color: e.target.value })} className="h-10 w-10 rounded border border-border bg-transparent p-1 cursor-pointer" />
                                                            <Input value={localLabel.color} onChange={e => handleLocalUpdate({ color: e.target.value })} className="bg-background flex-1 uppercase" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 col-span-2">
                                                        <Label>Animación</Label>
                                                        <Select value={localLabel.animation} onValueChange={(v: any) => handleLocalUpdate({ animation: v })}>
                                                            <SelectTrigger className="bg-background"><SelectValue/></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Sin Animación</SelectItem>
                                                                <SelectItem value="fade-in">Fade In</SelectItem>
                                                                <SelectItem value="slide-up">Slide Up</SelectItem>
                                                                <SelectItem value="pulse">Pulse (Latido)</SelectItem>
                                                                <SelectItem value="bounce">Bounce</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    
                                                    <div className="col-span-2 pt-4 border-t border-border flex justify-end">
                                                        <Button 
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto" 
                                                            onClick={handleSaveLabel}
                                                            disabled={updateGroup.isPending}
                                                        >
                                                            {updateGroup.isPending ? "Guardando..." : "Guardar Cambios"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                            )}
                                        </div>

                                        {/* Live Text Preview Box */}
                                        {localLabel && (
                                            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800 p-12 flex items-center justify-center relative min-h-[300px]">
                                                <div className="absolute top-4 left-4 text-xs font-mono text-slate-500">Vista Previa (Fondo Neutro)</div>
                                                <div
                                                    className="whitespace-pre-wrap text-center"
                                                    style={{
                                                        color: localLabel.color,
                                                        fontFamily: localLabel.fontFamily,
                                                        fontSize: `${localLabel.fontSize * 1.5}vw`, // Scaled for preview 
                                                        fontWeight: localLabel.fontWeight,
                                                        fontStyle: localLabel.fontStyle,
                                                        textShadow: '0px 2px 10px rgba(0,0,0,0.8)'
                                                    }}
                                                >
                                                    {localLabel.text}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                        <PenTool className="w-16 h-16 mb-4 opacity-20" />
                                        <p className="text-lg font-medium text-slate-400">Selecciona una etiqueta para editarla</p>
                                        <p className="text-sm">O crea una nueva desde el botón superior</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <Database className="w-16 h-16 mb-4 opacity-20" />
                        <h2 className="text-xl font-medium text-slate-300">No hay grupo seleccionado</h2>
                        <p className="text-sm mt-2 max-w-sm text-center">Selecciona un grupo del menú lateral o crea uno nuevo para empezar a administrar tus etiquetas y precios.</p>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
