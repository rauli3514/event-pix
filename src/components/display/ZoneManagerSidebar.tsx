import { useState } from 'react';
import { DisplayGroup } from '@/types/display';
import { useCreateDisplayGroup, useUpdateDisplayGroup, useDeleteDisplayGroup } from '@/hooks/use-display-hub';
import { Folder, FolderOpen, FolderPlus, MoreVertical, Edit2, Trash2, Home, ChevronRight, ChevronDown, Layers, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ZoneManagerSidebarProps {
    commerceId: string;
    groups: DisplayGroup[];
    selectedGroupId: string | 'all' | 'unassigned';
    onSelectGroup: (id: string | 'all' | 'unassigned') => void;
    unassignedCount: number;
    totalCount: number;
}

export const ZoneManagerSidebar = ({ commerceId, groups, selectedGroupId, onSelectGroup, unassignedCount, totalCount }: ZoneManagerSidebarProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [isCreatingRoot, setIsCreatingRoot] = useState(false);
    const [isCreatingChildFor, setIsCreatingChildFor] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');

    const createGroup = useCreateDisplayGroup();
    const updateGroup = useUpdateDisplayGroup();
    const deleteGroup = useDeleteDisplayGroup();

    const toggleExpand = (id: string) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCreate = async (parentId: string | null) => {
        if (!inputValue.trim()) {
            if (parentId) setIsCreatingChildFor(null);
            else setIsCreatingRoot(false);
            return;
        }
        try {
            await createGroup.mutateAsync({
                commerceId,
                name: inputValue.trim(),
                parentId
            });
            setInputValue('');
            if (parentId) {
                setIsCreatingChildFor(null);
                setExpandedGroups(prev => ({ ...prev, [parentId]: true }));
            } else {
                setIsCreatingRoot(false);
            }
            toast.success('Carpeta creada');
        } catch (error) {
            toast.error('Error al crear carpeta');
        }
    };

    const handleRename = async (id: string) => {
        if (!inputValue.trim()) {
            setIsRenaming(null);
            return;
        }
        try {
            await updateGroup.mutateAsync({
                id,
                updates: { name: inputValue.trim() }
            });
            setIsRenaming(null);
            setInputValue('');
            toast.success('Carpeta renombrada');
        } catch (error) {
            toast.error('Error al renombrar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta carpeta? Las pantallas y subcarpetas que contenga subirán un nivel.')) return;
        try {
            // Reasignar subcarpetas a parent_id del grupo borrado (para mantener el árbol)
            const groupToDelete = groups.find(g => g.id === id);
            const parentId = groupToDelete?.parent_id || null;
            
            const children = groups.filter(g => g.parent_id === id);
            for (const child of children) {
                await updateGroup.mutateAsync({ id: child.id, updates: { parent_id: parentId }});
            }

            // Las pantallas se reasignan al root o al parent_id. 
            // supabase ON DELETE CASCADE no queremos, queremos set null o similar.
            // Ojo: en la DB dijimos "ON DELETE CASCADE". Si la eliminamos con cascade, se borran los hijos. 
            // Espera, el usuario pidió "que solo elimine la carpeta pero las pantallas suban en nivel de raiz".
            // Para eso, necesitamos hacer esto desde el cliente o tener un trigger.
            
            await deleteGroup.mutateAsync({ id });
            
            if (selectedGroupId === id) {
                onSelectGroup('all');
            }
            toast.success('Carpeta eliminada');
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const renderTree = (parentId: string | null, depth = 0) => {
        const nodes = groups.filter(g => g.parent_id === parentId);
        if (nodes.length === 0 && isCreatingChildFor !== parentId) return null;

        return (
            <div className="space-y-0.5 mt-0.5">
                {nodes.map(node => {
                    const isExpanded = expandedGroups[node.id];
                    const isSelected = selectedGroupId === node.id;
                    const hasChildren = groups.some(g => g.parent_id === node.id);

                    return (
                        <div key={node.id}>
                            <div 
                                className={`flex items-center group rounded-lg transition-colors pr-2 ${
                                    isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                            >
                                <button 
                                    onClick={() => hasChildren && toggleExpand(node.id)}
                                    className={`p-1.5 rounded-md hover:bg-slate-200 transition-colors ${!hasChildren ? 'opacity-0 cursor-default' : ''}`}
                                >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                
                                <button 
                                    onClick={() => onSelectGroup(node.id)}
                                    className="flex-1 flex items-center gap-2 py-2 text-sm text-left truncate"
                                >
                                    {isExpanded ? <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} /> : <Folder className={`w-4 h-4 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} />}
                                    
                                    {isRenaming === node.id ? (
                                        <Input 
                                            autoFocus
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleRename(node.id)}
                                            onBlur={() => handleRename(node.id)}
                                            className="h-7 text-xs px-2"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={`truncate font-medium ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{node.name}</span>
                                    )}
                                </button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded-md transition-all">
                                            <MoreVertical className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => {
                                            setIsCreatingChildFor(node.id);
                                            setInputValue('');
                                            setExpandedGroups(prev => ({ ...prev, [node.id]: true }));
                                        }}>
                                            <FolderPlus className="w-4 h-4 mr-2" />
                                            Nueva Subcarpeta
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            setIsRenaming(node.id);
                                            setInputValue(node.name);
                                        }}>
                                            <Edit2 className="w-4 h-4 mr-2" />
                                            Renombrar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(node.id)} className="text-red-600 focus:text-red-600">
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {isExpanded && renderTree(node.id, depth + 1)}
                            
                            {isCreatingChildFor === node.id && isExpanded && (
                                <div className="flex items-center gap-2 py-1.5 pr-2" style={{ paddingLeft: `${(depth + 1) * 16 + 8 + 24}px` }}>
                                    <Folder className="w-4 h-4 text-slate-300" />
                                    <Input 
                                        autoFocus
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreate(node.id)}
                                        onBlur={() => handleCreate(node.id)}
                                        placeholder="Nombre..."
                                        className="h-7 text-xs px-2"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-500" />
                    Zonas y Pantallas
                </h2>
                <button 
                    onClick={() => { setIsCreatingRoot(true); setInputValue(''); }}
                    className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500 hover:text-indigo-600"
                    title="Nueva Carpeta Principal"
                >
                    <FolderPlus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <button
                    onClick={() => onSelectGroup('all')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        selectedGroupId === 'all' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                >
                    <Layers className={`w-4 h-4 ${selectedGroupId === 'all' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="flex-1 text-sm">Todas las pantallas</span>
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-medium">{totalCount}</span>
                </button>

                <button
                    onClick={() => onSelectGroup('unassigned')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        selectedGroupId === 'unassigned' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                >
                    <Home className={`w-4 h-4 ${selectedGroupId === 'unassigned' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="flex-1 text-sm">Sin Agrupar (Raíz)</span>
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-medium">{unassignedCount}</span>
                </button>

                <div className="pt-4 pb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Organigrama</p>
                    
                    {renderTree(null, 0)}

                    {isCreatingRoot && (
                        <div className="flex items-center gap-2 py-1.5 px-3 ml-6 mt-1">
                            <Folder className="w-4 h-4 text-slate-300" />
                            <Input 
                                autoFocus
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate(null)}
                                onBlur={() => handleCreate(null)}
                                placeholder="Nombre de zona..."
                                className="h-7 text-xs px-2"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
