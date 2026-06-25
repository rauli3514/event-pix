import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, Folder, Image as ImageIcon, Video, FileAudio, FileText, Globe, LayoutGrid } from 'lucide-react';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { DisplayMedia } from '@/types/display';

interface MediaPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    onSelect: (media: DisplayMedia) => void;
}

export const MediaPickerModal = ({ isOpen, onClose, commerceId, onSelect }: MediaPickerModalProps) => {
    const { data: mediaFiles = [], isLoading } = useDisplayMedia(commerceId);
    const [search, setSearch] = useState('');
    const [currentFolder, setCurrentFolder] = useState('/');

    const filteredFiles = useMemo(() => {
        return mediaFiles.filter(file => {
            if (search) {
                if (!file.name.toLowerCase().includes(search.toLowerCase())) return false;
            } else {
                if ((file.folder_path || '/') !== currentFolder) return false;
            }
            // Exclude folders themselves from being selected, but show them for navigation
            return true;
        }).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [mediaFiles, search, currentFolder]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'folder': return Folder;
            case 'image': return ImageIcon;
            case 'video': return Video;
            case 'audio': return FileAudio;
            case 'web': return Globe;
            case 'app':
            case 'layout':
            case 'widget': return LayoutGrid;
            default: return FileText;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0A101D] text-slate-200 border-slate-800 shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-2xl h-[80vh] flex flex-col z-[100]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
                    <DialogTitle className="text-xl text-white font-semibold">Seleccionar Contenido</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-4 border-b border-slate-800 flex gap-2 items-center bg-slate-900/30">
                    <Search className="w-4 h-4 text-slate-400" />
                    <Input 
                        placeholder="Buscar archivos..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-transparent border-0 focus-visible:ring-0 px-0 text-slate-200"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {currentFolder !== '/' && !search && (
                        <div 
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/50 rounded-lg text-slate-300"
                            onClick={() => {
                                const parts = currentFolder.split('/');
                                parts.pop();
                                setCurrentFolder(parts.join('/') || '/');
                            }}
                        >
                            <Folder className="w-5 h-5 text-indigo-400" />
                            <span>.. (Volver)</span>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-2">
                        {filteredFiles.map(file => {
                            const Icon = getIcon(file.type);
                            const isFolder = file.type === 'folder';

                            return (
                                <div 
                                    key={file.id}
                                    className="group flex flex-col gap-2 cursor-pointer"
                                    onClick={() => {
                                        if (isFolder) {
                                            setCurrentFolder(currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`);
                                            setSearch('');
                                        } else {
                                            onSelect(file);
                                        }
                                    }}
                                >
                                    <div className="aspect-square bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden group-hover:border-indigo-500 transition-colors relative">
                                        {file.type === 'image' ? (
                                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                        ) : file.type === 'video' ? (
                                            <video src={file.url} className="w-full h-full object-cover" />
                                        ) : (
                                            <Icon className={`w-8 h-8 ${isFolder ? 'text-indigo-400' : 'text-slate-500'}`} />
                                        )}
                                    </div>
                                    <span className="text-xs text-center text-slate-300 truncate px-1">{file.name}</span>
                                </div>
                            );
                        })}
                    </div>

                    {filteredFiles.length === 0 && !isLoading && (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            No hay archivos en esta carpeta.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
