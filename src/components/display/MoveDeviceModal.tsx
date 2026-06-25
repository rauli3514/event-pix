import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Folder, FolderPlus, Home, Search, ChevronRight, X, Loader2 } from 'lucide-react';
import { DisplayDevice, DisplayGroup } from '@/types/display';
import { useUpdateDisplayDevice, useCreateDisplayGroup } from '@/hooks/use-display-hub';
import { toast } from 'sonner';

interface MoveDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: DisplayDevice | null;
    groups: DisplayGroup[];
    commerceId: string;
}

export const MoveDeviceModal = ({ isOpen, onClose, device, groups, commerceId }: MoveDeviceModalProps) => {
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    
    const updateDevice = useUpdateDisplayDevice();
    const createGroup = useCreateDisplayGroup();

    // Reset state when modal opens
    useMemo(() => {
        if (isOpen && device) {
            setCurrentFolderId(device.group_id);
            setSearchQuery('');
            setIsCreatingFolder(false);
            setNewFolderName('');
        }
    }, [isOpen, device]);

    if (!device) return null;

    // Get current location name
    const currentLocationName = device.group_id 
        ? groups.find(g => g.id === device.group_id)?.name || 'Desconocido'
        : 'Hogar (Raíz)';

    // Build breadcrumbs path
    const buildPath = (folderId: string | null): DisplayGroup[] => {
        if (!folderId) return [];
        const folder = groups.find(g => g.id === folderId);
        if (!folder) return [];
        return [...buildPath(folder.parent_id), folder];
    };
    const breadcrumbs = buildPath(currentFolderId);

    // Get subfolders of current view
    const subfolders = groups.filter(g => g.parent_id === currentFolderId);
    
    // Filter by search query if present (search globally or locally? Usually locally, but globally is better for quick find)
    const filteredFolders = searchQuery.trim() 
        ? groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : subfolders;

    const handleMove = async () => {
        try {
            await updateDevice.mutateAsync({
                id: device.id,
                updates: { group_id: currentFolderId }
            });
            toast.success(`Pantalla movida exitosamente`);
            onClose();
        } catch (error: any) {
            toast.error('Error al mover la pantalla');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const newGroup = await createGroup.mutateAsync({
                commerceId,
                name: newFolderName.trim(),
                parentId: currentFolderId
            });
            toast.success(`Carpeta "${newGroup.name}" creada`);
            setIsCreatingFolder(false);
            setNewFolderName('');
            // Go into the new folder automatically
            setCurrentFolderId(newGroup.id);
        } catch (error: any) {
            toast.error('Error al crear la carpeta');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-md p-0 overflow-hidden sm:rounded-2xl">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                            <MoveIcon className="w-5 h-5 text-slate-400" />
                            Mover "{device.name || device.device_id}"
                        </h2>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <span>Ubicación actual:</span>
                            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-medium border border-slate-200">
                                {device.group_id ? <Folder className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                                <span>{currentLocationName}</span>
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
                            onClick={() => setCurrentFolderId(null)}
                            className="flex items-center gap-1.5 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            <span className={!currentFolderId ? 'font-semibold text-slate-800' : ''}>Hogar</span>
                        </button>
                        
                        {breadcrumbs.map((crumb) => (
                            <div key={crumb.id} className="flex items-center gap-1.5">
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                <button
                                    onClick={() => setCurrentFolderId(crumb.id)}
                                    className={`hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors truncate max-w-[120px] ${currentFolderId === crumb.id ? 'font-semibold text-slate-800' : ''}`}
                                >
                                    {crumb.name}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input 
                            placeholder="Buscar carpetas..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500 rounded-xl"
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
                                {filteredFolders.map(folder => (
                                    <button
                                        key={folder.id}
                                        onClick={() => setCurrentFolderId(folder.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white hover:shadow-sm rounded-lg text-left group transition-all"
                                    >
                                        <Folder className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{folder.name}</span>
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
                                    placeholder="Nombre de la carpeta" 
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    className="h-9 text-sm"
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                />
                                <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim() || createGroup.isPending}>
                                    {createGroup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
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
                                disabled={updateDevice.isPending || device.group_id === currentFolderId}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm px-6"
                            >
                                {updateDevice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mover'}
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
