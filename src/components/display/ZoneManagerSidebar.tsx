import { useState } from 'react';
import { DisplayGroup } from '@/types/display';
import { useCreateDisplayGroup, useUpdateDisplayGroup, useDeleteDisplayGroup } from '@/hooks/use-display-hub';
import { Folder, FolderOpen, FolderPlus, MoreVertical, Edit2, Trash2, Home, ChevronRight, ChevronDown, Layers } from 'lucide-react';
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
            const groupToDelete = groups.find(g => g.id === id);
            const parentId = groupToDelete?.parent_id || null;
            
            const children = groups.filter(g => g.parent_id === id);
            for (const child of children) {
                await updateGroup.mutateAsync({ id: child.id, updates: { parent_id: parentId }});
            }
            
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
            <div className={`space-y-0.5 mt-0.5 relative ${depth > 0 ? 'ml-4 border-l border-border' : ''}`}>
                {nodes.map(node => {
                    const isExpanded = expandedGroups[node.id];
                    const isSelected = selectedGroupId === node.id;
                    const hasChildren = groups.some(g => g.parent_id === node.id);

                    return (
                        <div key={node.id} className="relative">
                            {depth > 0 && (
                                <div className="absolute w-3 border-t border-border left-0 top-4" />
                            )}
                            <div 
                                className={`flex items-center group rounded-lg transition-colors pr-2 py-1 relative ${
                                    depth > 0 ? 'ml-3' : ''
                                } ${
                                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <button 
                                    onClick={() => hasChildren && toggleExpand(node.id)}
                                    className={`p-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors ${!hasChildren ? 'opacity-0 cursor-default' : ''}`}
                                >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                
                                <button 
                                    onClick={() => onSelectGroup(node.id)}
                                    className="flex-1 flex items-center gap-2 py-1 text-sm text-left truncate"
                                >
                                    {isExpanded ? <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} /> : <Folder className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />}
                                    
                                    {isRenaming === node.id ? (
                                        <Input 
                                            autoFocus
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleRename(node.id)}
                                            onBlur={() => handleRename(node.id)}
                                            className="h-7 text-xs px-2 bg-background border-primary text-foreground"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={`truncate font-medium ${isSelected ? 'text-primary' : ''}`}>{node.name}</span>
                                    )}
                                </button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-accent rounded-md transition-all text-muted-foreground hover:text-foreground">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground">
                                        <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={() => {
                                            setIsCreatingChildFor(node.id);
                                            setInputValue('');
                                            setExpandedGroups(prev => ({ ...prev, [node.id]: true }));
                                        }}>
                                            <FolderPlus className="w-4 h-4 mr-2" />
                                            Nueva Subcarpeta
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={() => {
                                            setIsRenaming(node.id);
                                            setInputValue(node.name);
                                        }}>
                                            <Edit2 className="w-4 h-4 mr-2" />
                                            Renombrar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => handleDelete(node.id)}>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {isExpanded && renderTree(node.id, depth + 1)}
                            
                            {isCreatingChildFor === node.id && isExpanded && (
                                <div className={`flex items-center gap-2 py-1.5 pr-2 relative ml-3 ${depth > -1 ? 'ml-7' : ''}`}>
                                    <div className="absolute w-3 border-t border-border left-[-12px] top-1/2" />
                                    <Folder className="w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        autoFocus
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreate(node.id)}
                                        onBlur={() => handleCreate(node.id)}
                                        placeholder="Nombre..."
                                        className="h-7 text-xs px-2 bg-background border-primary text-foreground"
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
        <div className="w-64 bg-card border-r border-border flex flex-col h-full overflow-hidden shrink-0 text-foreground transition-colors duration-300">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Zonas y Pantallas
                </h2>
                <button 
                    onClick={() => { setIsCreatingRoot(true); setInputValue(''); }}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-primary"
                    title="Nueva Carpeta Principal"
                >
                    <FolderPlus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <button
                    onClick={() => onSelectGroup('all')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        selectedGroupId === 'all' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Layers className={`w-4 h-4 ${selectedGroupId === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="flex-1 text-sm">Todas las pantallas</span>
                    <span className="text-xs bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">{totalCount}</span>
                </button>

                <button
                    onClick={() => onSelectGroup('unassigned')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        selectedGroupId === 'unassigned' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Home className={`w-4 h-4 ${selectedGroupId === 'unassigned' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="flex-1 text-sm">Sin Agrupar (Raíz)</span>
                    <span className="text-xs bg-muted border border-border px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">{unassignedCount}</span>
                </button>

                <div className="pt-4 pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">Organigrama</p>
                    
                    {renderTree(null, 0)}

                    {isCreatingRoot && (
                        <div className="flex items-center gap-2 py-1.5 px-3 ml-2 mt-2 relative">
                            <Folder className="w-4 h-4 text-muted-foreground" />
                            <Input 
                                autoFocus
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate(null)}
                                onBlur={() => handleCreate(null)}
                                placeholder="Nombre de zona..."
                                className="h-7 text-xs px-2 bg-background border-primary text-foreground"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
