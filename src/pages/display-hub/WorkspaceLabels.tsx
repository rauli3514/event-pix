import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDisplayLabelGroups, useCreateLabelGroup, useUpdateLabelGroup, useDeleteLabelGroup } from '@/hooks/use-display-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy, Database, Edit, ListTree, PenTool } from 'lucide-react';
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
            text: 'Nuevo Item $0',
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

    const updateLabel = (id: string, updates: Partial<DynamicLabel>) => {
        if (!activeGroup) return;
        const updatedLabels = activeGroup.labels.map(l => l.id === id ? { ...l, ...updates } : l);
        updateGroup.mutate({ id: activeGroup.id, updates: { labels: updatedLabels } });
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

    const selectedLabel = activeGroup?.labels.find(l => l.id === selectedLabelId);

    return (
        <div className="h-full flex flex-col lg:flex-row bg-background">
            
            {/* Sidebar: Group List */}
            <div className="w-full lg:w-80 border-r border-border bg-card flex flex-col">
                <div className="p-4 border-b border-border shrink-0">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-500" />
                        Fuentes de Datos
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Administra tus etiquetas y precios globalmente.</p>
                </div>

                <div className="p-4 shrink-0">
                    {isCreatingGroup ? (
                        <div className="bg-muted p-4 rounded-lg space-y-3 border border-border">
                            <Label>Nombre del grupo</Label>
                            <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ej: Precios Hamburguesas" className="bg-background" />
                            <Label>Descripción (opcional)</Label>
                            <Input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Ej: Pantalla principal" className="bg-background" />
                            <div className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setIsCreatingGroup(false)}>Cancelar</Button>
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateGroup}>Guardar</Button>
                            </div>
                        </div>
                    ) : (
                        <Button className="w-full bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600 hover:text-white" onClick={() => setIsCreatingGroup(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Grupo de Etiquetas
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <p className="text-center text-muted-foreground text-sm py-4">Cargando...</p>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-8">
                            <ListTree className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No tienes grupos creados.</p>
                        </div>
                    ) : (
                        groups.map(group => (
                            <div 
                                key={group.id}
                                onClick={() => { setSelectedGroupId(group.id); setSelectedLabelId(null); }}
                                className={cn(
                                    "p-3 rounded-xl border transition-all cursor-pointer relative group",
                                    selectedGroupId === group.id ? "bg-indigo-600/10 border-indigo-500/50" : "bg-card border-border hover:border-slate-500"
                                )}
                            >
                                <h4 className="font-semibold text-foreground text-sm">{group.name}</h4>
                                {group.description && <p className="text-xs text-muted-foreground mt-1 truncate">{group.description}</p>}
                                <div className="text-xs text-indigo-400 mt-2 flex items-center gap-1">
                                    <Database className="w-3 h-3" /> {group.labels?.length || 0} etiquetas
                                </div>

                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                                    onClick={(e) => handleDeleteGroup(group.id, e)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Area: Label Editor */}
            <div className="flex-1 bg-background flex flex-col min-h-0">
                {activeGroup ? (
                    <div className="flex-1 flex flex-col h-full">
                        {/* Header */}
                        <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-bold">{activeGroup.name}</h2>
                                {activeGroup.description && <p className="text-sm text-muted-foreground">{activeGroup.description}</p>}
                            </div>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={addLabel}>
                                <Plus className="w-4 h-4 mr-2" />
                                Agregar Etiqueta
                            </Button>
                        </div>

                        {/* Content Split */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            {/* List of labels */}
                            <div className="w-full md:w-1/2 lg:w-1/3 border-r border-border bg-card p-4 overflow-y-auto">
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
                            <div className="flex-1 bg-background p-6 overflow-y-auto">
                                {selectedLabel ? (
                                    <div className="max-w-xl mx-auto space-y-8">
                                        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><Edit className="w-5 h-5 text-emerald-500"/> Propiedades de la Etiqueta</h3>
                                            
                                            <div className="space-y-6">
                                                <div className="col-span-2 space-y-2">
                                                    <Label>Identificador (Nombre interno)</Label>
                                                    <Input placeholder="Ej: Precio Hamburguesa" value={selectedLabel.name || ''} onChange={e => updateLabel(selectedLabel.id, { name: e.target.value })} className="bg-background" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Texto / Precio</Label>
                                                    <Textarea 
                                                        value={selectedLabel.text} 
                                                        onChange={e => updateLabel(selectedLabel.id, { text: e.target.value })} 
                                                        className="bg-background min-h-[100px] text-lg font-medium" 
                                                    />
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label>Tipografía</Label>
                                                        <Select value={selectedLabel.fontFamily} onValueChange={(v) => updateLabel(selectedLabel.id, { fontFamily: v })}>
                                                            <SelectTrigger className="bg-background"><SelectValue/></SelectTrigger>
                                                            <SelectContent>
                                                                {FONTS.map(f => <SelectItem key={f.value} value={f.value} style={{fontFamily: f.value}}>{f.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Estilo (Grosor)</Label>
                                                        <Select value={selectedLabel.fontWeight} onValueChange={(v) => updateLabel(selectedLabel.id, { fontWeight: v })}>
                                                            <SelectTrigger className="bg-background"><SelectValue/></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="normal">Normal</SelectItem>
                                                                <SelectItem value="bold">Negrita (Bold)</SelectItem>
                                                                <SelectItem value="900">Extrabold</SelectItem>
                                                                <SelectItem value="300">Ligera (Light)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <Label>Tamaño ({selectedLabel.fontSize})</Label>
                                                        <Input type="number" min="1" max="50" step="0.5" value={selectedLabel.fontSize} onChange={e => updateLabel(selectedLabel.id, { fontSize: parseFloat(e.target.value) })} className="bg-background" />
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <Label>Color</Label>
                                                        <div className="flex gap-2">
                                                            <input type="color" value={selectedLabel.color} onChange={e => updateLabel(selectedLabel.id, { color: e.target.value })} className="h-10 w-10 rounded border border-border bg-transparent p-1 cursor-pointer" />
                                                            <Input value={selectedLabel.color} onChange={e => updateLabel(selectedLabel.id, { color: e.target.value })} className="bg-background flex-1 uppercase" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 col-span-2">
                                                        <Label>Animación</Label>
                                                        <Select value={selectedLabel.animation} onValueChange={(v: any) => updateLabel(selectedLabel.id, { animation: v })}>
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
                                                </div>
                                            </div>
                                        </div>

                                        {/* Live Text Preview Box */}
                                        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800 p-12 flex items-center justify-center relative min-h-[300px]">
                                            <div className="absolute top-4 left-4 text-xs font-mono text-slate-500">Vista Previa (Fondo Neutro)</div>
                                            <div
                                                className="whitespace-pre-wrap text-center"
                                                style={{
                                                    color: selectedLabel.color,
                                                    fontFamily: selectedLabel.fontFamily,
                                                    fontSize: `${selectedLabel.fontSize * 1.5}vw`, // Scaled for preview 
                                                    fontWeight: selectedLabel.fontWeight,
                                                    fontStyle: selectedLabel.fontStyle,
                                                    textShadow: '0px 2px 10px rgba(0,0,0,0.8)'
                                                }}
                                            >
                                                {selectedLabel.text}
                                            </div>
                                        </div>
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
    );
}
