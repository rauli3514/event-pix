import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Folder, FolderPlus, Search, ChevronRight, X, Loader2, HardDrive } from 'lucide-react';
import { DisplayMedia } from '@/types/display';
import { useUploadDisplayMedia, useUpdateDisplayMedia } from '@/hooks/use-display-media';
import { toast } from 'sonner';

interface MoveMediaModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAssets: DisplayMedia[];
    allMedia: DisplayMedia[];
    commerceId: string;
    onSuccess?: () => void;
}

export const MoveMediaModal = ({ isOpen, onClose, selectedAssets, allMedia, commerceId, onSuccess }: MoveMediaModalProps) => {
    const [currentPath, setCurrentPath] = useState<string>('/');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isMoving, setIsMoving] = useState(false);
    
    const updateMedia = useUpdateDisplayMedia();
    const uploadMedia = useUploadDisplayMedia();

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            // Default destination is the folder of the first selected item, or root
            const defaultPath = selectedAssets.length > 0 ? selectedAssets[0].folder_path || '/' : '/';
            setCurrentPath(defaultPath);
            setSearchQuery('');
            setIsCreatingFolder(false);
            setNewFolderName('');
            setIsMoving(false);
        }
    }, [isOpen, selectedAssets]);

    if (selectedAssets.length === 0) return null;

    // Build breadcrumbs path from currentPath (e.g. "/Navidad/2026")
    const breadcrumbs = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

    // Get all virtual folders from allMedia
    const virtualFolders = useMemo(() => {
        const folders = new Set<string>();
        allMedia.forEach(m => {
            if (m.type === 'folder') {
                const p = m.folder_path === '/' ? `/${m.name}` : `${m.folder_path}/${m.name}`;
                folders.add(p);
            }
        });
        return Array.from(folders).sort();
    }, [allMedia]);

    // Subfolders of currentPath
    const subfolders = virtualFolders.filter(f => {
        const parent = f.substring(0, f.lastIndexOf('/')) || '/';
        return parent === currentPath;
    }).map(f => f.split('/').pop() || '');
    
    const filteredFolders = searchQuery.trim() 
        ? subfolders.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
        : subfolders;

    const handleMove = async () => {
        setIsMoving(true);
        try {
            for (const asset of selectedAssets) {
                if (asset.folder_path !== currentPath) {
                    await updateMedia.mutateAsync({
                        id: asset.id,
                        updates: { folder_path: currentPath }
                    });
                }
            }
            toast.success(`${selectedAssets.length} archivo(s) movidos exitosamente`);
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error al mover los archivos');
        } finally {
            setIsMoving(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await uploadMedia.mutateAsync({
                commerceId,
                webName: newFolderName.trim(),
                folderPath: currentPath,
                isFolder: true
            });
            toast.success(`Carpeta "${newFolderName.trim()}" creada`);
            setIsCreatingFolder(false);
            
            // Go into the new folder
            const nextPath = currentPath === '/' ? `/${newFolderName.trim()}` : `${currentPath}/${newFolderName.trim()}`;
            setCurrentPath(nextPath);
            setNewFolderName('');
        } catch (error: any) {
            toast.error('Error al crear la carpeta');
        }
    };

    const navigateToBreadcrumb = (index: number) => {
        if (index === -1) {
            setCurrentPath('/');
            return;
        }
        const newPath = '/' + breadcrumbs.slice(0, index + 1).join('/');
        setCurrentPath(newPath);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-md p-0 overflow-hidden sm:rounded-2xl">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                            <MoveIcon className="w-5 h-5 text-slate-400" />
                            Mover {selectedAssets.length} elemento(s)
                        </h2>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <span>Ubicación actual:</span>
                            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-medium border border-slate-200">
                                {currentPath === '/' ? <HardDrive className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5 text-orange-500" />}
                                <span>{currentPath === '/' ? 'Raíz' : currentPath.split('/').pop()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-1.5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 pb-2 space-y-4">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 overflow-x-auto pb-2 scrollbar-hide whitespace-nowrap">
                        <button 
                            onClick={() => navigateToBreadcrumb(-1)}
                            className="flex items-center gap-1.5 hover:text-orange-600 hover:bg-orange-50 px-2 py-1 rounded-md transition-colors"
                        >
                            <HardDrive className="w-4 h-4" />
                            <span className={currentPath === '/' ? 'font-semibold text-slate-800' : ''}>Raíz</span>
                        </button>
                        
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                <button
                                    onClick={() => navigateToBreadcrumb(idx)}
                                    className={`hover:text-orange-600 hover:bg-orange-50 px-2 py-1 rounded-md transition-colors truncate max-w-[120px] ${idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-800' : ''}`}
                                >
                                    {crumb}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input 
                            placeholder="Buscar subcarpetas..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 border-slate-200 focus-visible:ring-orange-500 rounded-xl"
                        />
                    </div>

                    {/* Folder List */}
                    <div className="border border-slate-200 rounded-xl bg-slate-50/50 min-h-[160px] max-h-[240px] overflow-y-auto">
                        {filteredFolders.length === 0 ? (
                            <div className="h-[160px] flex items-center justify-center text-sm text-slate-400">
                                {searchQuery ? 'No se encontraron resultados' : 'No se encontraron subcarpetas'}
                            </div>
                        ) : (
                            <div className="p-1">
                                {filteredFolders.map(folderName => (
                                    <button
                                        key={folderName}
                                        onClick={() => {
                                            const nextPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
                                            setCurrentPath(nextPath);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white hover:shadow-sm rounded-lg text-left group transition-all"
                                    >
                                        <Folder className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{folderName}</span>
                                        <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-slate-50 mt-4">
                    <div className="flex-1">
                        {isCreatingFolder ? (
                            <div className="flex items-center gap-2">
                                <Input 
                                    autoFocus
                                    placeholder="Nombre" 
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    className="h-9 text-sm"
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                />
                                <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim() || uploadMedia.isPending}>
                                    {uploadMedia.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsCreatingFolder(false)}>Cancelar</Button>
                            </div>
                        ) : (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setIsCreatingFolder(true)}
                                className="text-slate-600 border-slate-200 gap-2 hover:bg-slate-100"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Nueva carpeta
                            </Button>
                        )}
                    </div>

                    {!isCreatingFolder && (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleMove}
                                disabled={isMoving || uploadMedia.isPending}
                                className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm px-6"
                            >
                                {isMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mover aquí'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Custom Move Icon
const MoveIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 9l-3 3 3 3" />
        <path d="M2 12h14" />
        <path d="M14 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
    </svg>
);
