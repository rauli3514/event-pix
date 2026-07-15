import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Layers, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { DisplayGroup } from '@/types/display';
import { toast } from 'sonner';
import { useCreateDisplayGroup, useUpdateDisplayGroup, useDeleteDisplayGroup } from '@/hooks/use-display-hub';

interface ZoneManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    zones: DisplayGroup[];
    commerceId: string;
}

export const ZoneManagerModal = ({ isOpen, onClose, zones, commerceId }: ZoneManagerModalProps) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [newName, setNewName] = useState('');

    const createGroup = useCreateDisplayGroup();
    const updateGroup = useUpdateDisplayGroup();
    const deleteGroup = useDeleteDisplayGroup();

    useEffect(() => {
        if (!isOpen) {
            setIsCreating(false);
            setEditingId(null);
            setNewName('');
        }
    }, [isOpen]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            await createGroup.mutateAsync({ commerceId, name: newName.trim() });
            setNewName('');
            setIsCreating(false);
            toast.success('Zona creada con éxito');
        } catch (error) {
            toast.error('Error al crear zona');
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await updateGroup.mutateAsync({ id, updates: { name: editName.trim() } });
            setEditingId(null);
            toast.success('Zona actualizada');
        } catch (error) {
            toast.error('Error al actualizar zona');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta zona? Las pantallas asignadas a esta zona quedarán sin zona asignada.')) return;
        try {
            await deleteGroup.mutateAsync({ id });
            toast.success('Zona eliminada');
        } catch (error) {
            toast.error('Error al eliminar zona');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-950 border-slate-800 text-white shadow-2xl max-w-lg p-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex flex-row items-center justify-between">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-400" />
                        Gestión de Zonas
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-sm text-slate-400">Las zonas te permiten agrupar pantallas para enviarles contenido simultáneamente.</p>
                        {!isCreating && (
                            <Button 
                                onClick={() => setIsCreating(true)} 
                                size="sm" 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Nueva Zona
                            </Button>
                        )}
                    </div>

                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {isCreating && (
                            <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl border border-indigo-500/30">
                                <Input 
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Nombre de la nueva zona..."
                                    className="bg-slate-950 border-slate-700 h-9"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                                <Button size="sm" variant="ghost" onClick={handleCreate} disabled={!newName.trim()} className="h-9 w-9 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                                    <Check className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} className="h-9 w-9 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-800">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        {zones.length === 0 && !isCreating ? (
                            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                No hay zonas creadas.
                            </div>
                        ) : (
                            zones.map(zone => (
                                <div key={zone.id} className="flex items-center justify-between bg-slate-900/50 hover:bg-slate-900 p-3 rounded-xl border border-slate-800 transition-colors group">
                                    {editingId === zone.id ? (
                                        <div className="flex items-center gap-2 w-full">
                                            <Input 
                                                autoFocus
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="bg-slate-950 border-slate-700 h-9"
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdate(zone.id)}
                                            />
                                            <Button size="sm" variant="ghost" onClick={() => handleUpdate(zone.id)} className="h-9 w-9 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                                                <Check className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-9 w-9 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-800">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-medium text-slate-200">{zone.name}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => { setEditingId(zone.id); setEditName(zone.name); }}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => handleDelete(zone.id)}
                                                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex justify-end">
                    <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
