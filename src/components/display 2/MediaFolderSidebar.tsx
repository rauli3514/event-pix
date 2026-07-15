import { useState, useMemo } from 'react';
import { DisplayMedia } from '@/types/display';
import { useUploadDisplayMedia, useUpdateMediaFolder, useDeleteMediaFolder } from '@/hooks/use-display-media';
import { Folder, FolderOpen, FolderPlus, MoreVertical, Edit2, Trash2, HardDrive, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface MediaFolderSidebarProps {
    commerceId: string;
    mediaFiles: DisplayMedia[];
    currentFolder: string;
    onSelectFolder: (path: string) => void;
}

export const MediaFolderSidebar = ({ commerceId, mediaFiles, currentFolder, onSelectFolder }: MediaFolderSidebarProps) => {
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [isCreatingRoot, setIsCreatingRoot] = useState(false);
    const [isCreatingChildFor, setIsCreatingChildFor] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');

    const uploadMedia = useUploadDisplayMedia();
    const updateFolder = useUpdateMediaFolder();
    const deleteFolder = useDeleteMediaFolder();

    const toggleExpand = (path: string) => {
        setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
    };

    // Build the virtual tree
    const tree = useMemo(() => {
        const root: Record<string, any> = {};
        const folders = mediaFiles.filter(m => m.type === 'folder');

        folders.forEach(f => {
            const pathParts = f.folder_path === '/' ? [] : f.folder_path.split('/').filter(Boolean);
            let current = root;
            
            // Navigate/build parent paths if missing
            let builtPath = '';
            pathParts.forEach(part => {
                builtPath += `/${part}`;
                if (!current[part]) {
                    current[part] = { _path: builtPath, _children: {} };
                }
                current = current[part]._children;
            });
            
            // Add the actual folder
            const myPath = f.folder_path === '/' ? `/${f.name}` : `${f.folder_path}/${f.name}`;
            if (!current[f.name]) {
                current[f.name] = { _path: myPath, _children: {} };
            }
        });

        return root;
    }, [mediaFiles]);

    const handleCreate = async (parentPath: string | null) => {
        if (!inputValue.trim()) {
            if (parentPath) setIsCreatingChildFor(null);
            else setIsCreatingRoot(false);
            return;
        }
        try {
            await uploadMedia.mutateAsync({
                commerceId,
                webName: inputValue.trim(),
                folderPath: parentPath || '/',
                isFolder: true
            });
            setInputValue('');
            if (parentPath) {
                setIsCreatingChildFor(null);
                setExpandedFolders(prev => ({ ...prev, [parentPath]: true }));
            } else {
                setIsCreatingRoot(false);
            }
            toast.success('Carpeta creada');
        } catch (error) {
            toast.error('Error al crear carpeta');
        }
    };

    const handleRename = async (oldPath: string) => {
        if (!inputValue.trim()) {
            setIsRenaming(null);
            return;
        }
        try {
            const newName = inputValue.trim();
            const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/';
            const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

            await updateFolder.mutateAsync({
                commerceId,
                oldPath,
                newPath
            });
            setIsRenaming(null);
            setInputValue('');
            if (currentFolder.startsWith(oldPath)) {
                onSelectFolder(newPath + currentFolder.substring(oldPath.length));
            }
            toast.success('Carpeta renombrada');
        } catch (error) {
            toast.error('Error al renombrar');
        }
    };

    const handleDelete = async (folderPath: string) => {
        if (!confirm('¿Estás seguro de eliminar esta carpeta y TODO su contenido (incluyendo subcarpetas)?')) return;
        try {
            await deleteFolder.mutateAsync({ commerceId, folderPath });
            if (currentFolder.startsWith(folderPath)) {
                onSelectFolder('/');
            }
            toast.success('Carpeta eliminada');
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const renderTree = (node: Record<string, any>, depth = 0) => {
        const keys = Object.keys(node).filter(k => !k.startsWith('_')).sort();
        if (keys.length === 0 && !Object.values(node).some(v => isCreatingChildFor === v?._path)) return null;

        return (
            <div className={`space-y-0.5 mt-0.5 relative ${depth > 0 ? 'ml-4 border-l border-border' : ''}`}>
                {keys.map(key => {
                    const child = node[key];
                    const fullPath = child._path;
                    const isExpanded = expandedFolders[fullPath];
                    const isSelected = currentFolder === fullPath;
                    const hasChildren = Object.keys(child._children).filter(k => !k.startsWith('_')).length > 0;

                    return (
                        <div key={fullPath} className="relative">
                            {depth > 0 && (
                                <div className="absolute w-3 border-t border-border left-0 top-4" />
                            )}
                            <div 
                                className={`flex items-center group rounded-lg transition-colors pr-2 py-1 relative ${
                                    depth > 0 ? 'ml-3' : ''
                                } ${
                                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                                }`}
                            >
                                <button 
                                    onClick={() => hasChildren && toggleExpand(fullPath)}
                                    className={`p-1 rounded-md hover:bg-accent transition-colors ${!hasChildren ? 'opacity-0 cursor-default' : ''}`}
                                >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                
                                <button 
                                    onClick={() => onSelectFolder(fullPath)}
                                    className="flex-1 flex items-center gap-2 py-1 text-sm text-left truncate"
                                >
                                    {isExpanded ? <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} /> : <Folder className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />}
                                    
                                    {isRenaming === fullPath ? (
                                        <Input 
                                            autoFocus
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleRename(fullPath)}
                                            onBlur={() => handleRename(fullPath)}
                                            className="h-7 text-xs px-2 bg-background border-primary text-foreground"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={`truncate font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>{key}</span>
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
                                            setIsCreatingChildFor(fullPath);
                                            setInputValue('');
                                            setExpandedFolders(prev => ({ ...prev, [fullPath]: true }));
                                        }}>
                                            <FolderPlus className="w-4 h-4 mr-2" />
                                            Nueva Subcarpeta
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={() => {
                                            setIsRenaming(fullPath);
                                            setInputValue(key);
                                        }}>
                                            <Edit2 className="w-4 h-4 mr-2" />
                                            Renombrar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => handleDelete(fullPath)}>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {isExpanded && renderTree(child._children, depth + 1)}
                            
                            {isCreatingChildFor === fullPath && isExpanded && (
                                <div className={`flex items-center gap-2 py-1.5 pr-2 relative ml-3 ${depth > -1 ? 'ml-7' : ''}`}>
                                    <div className="absolute w-3 border-t border-border left-[-12px] top-1/2" />
                                    <Folder className="w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        autoFocus
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreate(fullPath)}
                                        onBlur={() => handleCreate(fullPath)}
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
                    Carpetas
                </h2>
                <button 
                    onClick={() => { setIsCreatingRoot(true); setInputValue(''); }}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-primary"
                    title="Nueva Carpeta Principal"
                >
                    <FolderPlus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <button
                    onClick={() => onSelectFolder('/')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        currentFolder === '/' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground'
                    }`}
                >
                    <HardDrive className={`w-4 h-4 ${currentFolder === '/' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="flex-1 text-sm">Archivos Sueltos (Raíz)</span>
                </button>

                <div className="pt-4 pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">Estructura</p>
                    
                    {renderTree(tree, 0)}

                    {isCreatingRoot && (
                        <div className="flex items-center gap-2 py-1.5 px-3 ml-2 mt-2 relative">
                            <Folder className="w-4 h-4 text-muted-foreground" />
                            <Input 
                                autoFocus
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate('/')}
                                onBlur={() => handleCreate('/')}
                                placeholder="Nombre de carpeta..."
                                className="h-7 text-xs px-2 bg-background border-primary text-foreground"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
