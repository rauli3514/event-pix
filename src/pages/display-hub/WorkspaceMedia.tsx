import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FolderPlus, Upload, LayoutGrid, List as ListIcon, Image as ImageIcon, Video, FileAudio, FileText, Globe, Box, ListVideo, ArrowRightCircle, Tag, HardDrive, Trash2 } from 'lucide-react';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';
import { useDisplayMedia, useUploadDisplayMedia, useDeleteDisplayMedia } from '@/hooks/use-display-media';
import { toast } from 'sonner';
import { DisplayMedia } from '@/types/display';

type CategoryId = 'all' | 'images' | 'videos' | 'audio' | 'docs' | 'web' | 'apps' | 'playlists';

const CATEGORY_MAP: Record<CategoryId, { title: string, icon: any }> = {
    all: { title: 'Todos los artículos', icon: HardDrive },
    images: { title: 'Imágenes', icon: ImageIcon },
    videos: { title: 'Vídeos', icon: Video },
    audio: { title: 'Audio', icon: FileAudio },
    docs: { title: 'Documentos', icon: FileText },
    web: { title: 'Páginas web', icon: Globe },
    apps: { title: 'Aplicaciones', icon: Box },
    playlists: { title: 'Listas de reproducción', icon: ListVideo }
};

export function WorkspaceMedia() {
    const { commerceId } = useParams<{ commerceId: string }>();
    const [viewMode, setViewMode] = useState<'list'|'grid'>('list');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
    const [search, setSearch] = useState('');

    const { data: mediaFiles = [], isLoading } = useDisplayMedia(commerceId);
    const { mutateAsync: uploadMedia } = useUploadDisplayMedia();
    const { mutateAsync: deleteMedia } = useDeleteDisplayMedia();

    const currentCategory = CATEGORY_MAP[activeCategory];

    const filteredFiles = useMemo(() => {
        return mediaFiles.filter(file => {
            // Text Search
            if (search && !file.name.toLowerCase().includes(search.toLowerCase())) return false;
            // Category Filter
            if (activeCategory === 'all') return true;
            if (activeCategory === 'images' && file.type === 'image') return true;
            if (activeCategory === 'videos' && file.type === 'video') return true;
            if (activeCategory === 'audio' && file.type === 'audio') return true;
            if (activeCategory === 'docs' && file.type === 'docs') return true;
            if (activeCategory === 'web' && file.type === 'web') return true;
            return false;
        });
    }, [activeCategory, search, mediaFiles]);

    const handleUploadFiles = async (files: FileList | null) => {
        if (!files || !commerceId) return;
        
        let successCount = 0;
        let failCount = 0;
        
        const toastId = toast.loading(`Subiendo ${files.length} archivo(s)...`);

        for (let i = 0; i < files.length; i++) {
            try {
                await uploadMedia({ commerceId, file: files[i] });
                successCount++;
            } catch (error) {
                console.error("Upload error:", error);
                failCount++;
            }
        }

        if (failCount > 0) {
            toast.error(`Se subieron ${successCount} archivos, pero fallaron ${failCount}.`, { id: toastId });
        } else {
            toast.success(`Se subieron ${successCount} archivo(s) correctamente.`, { id: toastId });
        }
    };

    const handleDelete = async (file: DisplayMedia) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar "${file.name}"?`)) return;
        
        try {
            await deleteMedia(file);
            toast.success(`Archivo eliminado: ${file.name}`);
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error("Ocurrió un error al eliminar el archivo.");
        }
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 text-slate-900">
            {/* Top Bar for sending to screens */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <currentCategory.icon className="w-6 h-6 text-orange-500" />
                        {currentCategory.title}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Gestiona y organiza tus recursos para las pantallas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="bg-white text-slate-600 border-slate-200 shadow-sm" onClick={() => setIsUploadModalOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Subir Archivos
                    </Button>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white shadow-md">
                        Enviar a las pantallas
                        <ArrowRightCircle className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Categories */}
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 space-y-6">
                        {/* Todos los medios section */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Medios del Sistema</h3>
                            <div className="space-y-1">
                                <CategoryButton 
                                    icon={HardDrive} label="Todos los artículos" active={activeCategory === 'all'} 
                                    onClick={() => setActiveCategory('all')} 
                                />
                                <CategoryButton 
                                    icon={ImageIcon} label="Imágenes" active={activeCategory === 'images'} 
                                    onClick={() => setActiveCategory('images')} 
                                />
                                <CategoryButton 
                                    icon={Video} label="Vídeos" active={activeCategory === 'videos'} 
                                    onClick={() => setActiveCategory('videos')} 
                                />
                                <CategoryButton 
                                    icon={FileAudio} label="Audio" active={activeCategory === 'audio'} 
                                    onClick={() => setActiveCategory('audio')} 
                                />
                                <CategoryButton 
                                    icon={FileText} label="Documentos" active={activeCategory === 'docs'} 
                                    onClick={() => setActiveCategory('docs')} 
                                />
                                <CategoryButton 
                                    icon={Globe} label="Páginas web" active={activeCategory === 'web'} 
                                    onClick={() => setActiveCategory('web')} 
                                />
                            </div>
                        </div>

                        {/* Other sections */}
                        <div className="border-t border-slate-100 pt-6">
                            <div className="space-y-1">
                                <CategoryButton icon={Box} label="Aplicaciones" active={activeCategory === 'apps'} onClick={() => setActiveCategory('apps')} />
                                <CategoryButton icon={ListVideo} label="Listas de reproducción" active={activeCategory === 'playlists'} onClick={() => setActiveCategory('playlists')} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-slate-50/50">
                    <div className="p-6">
                        {/* Toolbar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3 flex-1 max-w-xl">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <Input 
                                        placeholder={`Buscar en ${currentCategory.title.toLowerCase()}...`}
                                        className="pl-9 bg-white shadow-sm border-slate-200"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" className="bg-white shadow-sm border-slate-200 text-slate-600">
                                    <Tag className="w-4 h-4 mr-2" /> Etiquetas
                                </Button>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="bg-white shadow-sm border-slate-200 text-slate-700">
                                    <FolderPlus className="w-4 h-4 mr-2" />
                                    Agregar carpeta
                                </Button>
                                <div className="flex bg-slate-200/50 p-1 rounded-md border border-slate-200">
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* List Header */}
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-slate-800">{currentCategory.title}</h2>
                            <p className="text-sm text-slate-500 mt-1">{isLoading ? 'Cargando...' : `${filteredFiles.length} artículo(s) encontrados`}</p>
                        </div>

                        {/* Data View */}
                        {isLoading ? (
                             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
                                <p className="text-lg font-medium text-slate-600">Cargando archivos...</p>
                             </div>
                        ) : filteredFiles.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
                                <currentCategory.icon className="w-12 h-12 mb-4 text-slate-300" />
                                <p className="text-lg font-medium text-slate-600">No hay archivos para mostrar</p>
                                <p className="text-sm">Sube nuevos recursos usando el botón de la esquina superior.</p>
                                <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setIsUploadModalOpen(true)}>
                                    <Upload className="w-4 h-4 mr-2" /> Subir Archivos
                                </Button>
                            </div>
                        ) : viewMode === 'list' ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-200">
                                            <th className="px-4 py-3 w-12"><input type="checkbox" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/20" /></th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modificado</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredFiles.map(file => {
                                            const FileIcon = getIconForType(file.type);
                                            return (
                                            <tr key={file.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-4 py-4"><input type="checkbox" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/20" /></td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {file.type === 'image' && file.url ? (
                                                                <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <FileIcon className="w-5 h-5 text-slate-400" />
                                                            )}
                                                        </div>
                                                        <span className="font-medium text-slate-700">{file.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-500">{formatDate(file.created_at)}</td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(file)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {filteredFiles.map(file => {
                                    const FileIcon = getIconForType(file.type);
                                    return (
                                    <div key={file.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:border-orange-300 transition-colors cursor-pointer flex flex-col relative">
                                        <div className="absolute top-2 left-2 z-10">
                                            <input type="checkbox" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/20 shadow-sm" />
                                        </div>
                                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/80 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-full shadow-sm" onClick={(e) => { e.stopPropagation(); handleDelete(file); }}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                            {file.type === 'image' && file.url ? (
                                                <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            ) : (
                                                <FileIcon className="w-10 h-10 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="p-3 border-t border-slate-100">
                                            <h4 className="font-medium text-slate-700 text-sm truncate">{file.name}</h4>
                                            <p className="text-xs text-slate-400 mt-1">{formatDate(file.created_at).split(',')[0]}</p>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <UploadMediaModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onUpload={handleUploadFiles}
            />
        </div>
    );
}

// Sidebar Button Helper
function CategoryButton({ icon: Icon, label, active, onClick, color }: any) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
        >
            <Icon className={`w-4 h-4 ${active ? color || 'text-orange-500' : 'text-slate-400'}`} />
            {label}
        </button>
    );
}

function getIconForType(type: string) {
    switch (type) {
        case 'image': return ImageIcon;
        case 'video': return Video;
        case 'audio': return FileAudio;
        case 'docs': return FileText;
        case 'web': return Globe;
        default: return FileText;
    }
}
