import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Upload, LayoutGrid, List as ListIcon, Image as ImageIcon, Video, FileAudio, FileText, Globe, ArrowRightCircle, HardDrive, Trash2, Folder, Move, MoreVertical, Edit2, Play } from 'lucide-react';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';
import { useDisplayMedia, useUploadDisplayMedia, useDeleteDisplayMedia, useUpdateDisplayMedia } from '@/hooks/use-display-media';
import { toast } from 'sonner';
import { DisplayMedia } from '@/types/display';
import { MediaFolderSidebar } from '@/components/display/MediaFolderSidebar';
import { MoveMediaModal } from '@/components/display/MoveMediaModal';
import { AppCatalogModal, APPS, AppId } from '@/components/display/apps/AppCatalogModal';
import { AppEditorModal } from '@/components/display/apps/AppEditorModal';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

export type CategoryId = 'all' | 'images' | 'videos' | 'audio' | 'docs' | 'web' | 'apps';

export function WorkspaceMedia({ initialCategory = 'all' }: { initialCategory?: CategoryId }) {
    const { commerceId } = useParams<{ commerceId: string }>();
    const [viewMode, setViewMode] = useState<'list'|'grid'>('grid');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadCategory, setUploadCategory] = useState<CategoryId>('all');
    const [isAppCatalogOpen, setIsAppCatalogOpen] = useState(false);
    const [activeCategory] = useState<CategoryId>(initialCategory);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [currentFolder, setCurrentFolder] = useState<string>('/');
    const [sortMode, setSortMode] = useState<'newest'|'oldest'|'az'|'za'>('newest');
    const [draggedOverFolder, setDraggedOverFolder] = useState<string | null>(null);
    const [editingApp, setEditingApp] = useState<DisplayMedia | null>(null);

    const { data: mediaFiles = [], isLoading } = useDisplayMedia(commerceId);
    const { mutateAsync: uploadMedia } = useUploadDisplayMedia();
    const { mutateAsync: deleteMedia } = useDeleteDisplayMedia();
    const { mutateAsync: updateMedia } = useUpdateDisplayMedia();

    const filteredFiles = useMemo(() => {
        return mediaFiles.filter(file => {
            // Text Search overrides folder filtering
            if (search) {
                if (!file.name.toLowerCase().includes(search.toLowerCase())) return false;
            } else {
                // Folder Filter
                if ((file.folder_path || '/') !== currentFolder) return false;
            }
            // Category Filter
            if (activeCategory === 'all') return true;
            if (activeCategory === 'images' && file.type === 'image') return true;
            if (activeCategory === 'videos' && file.type === 'video') return true;
            if (activeCategory === 'audio' && file.type === 'audio') return true;
            if (activeCategory === 'docs' && file.type === 'docs') return true;
            if (activeCategory === 'web' && file.type === 'web') return true;
            if (activeCategory === 'apps' && (file.type === 'app' || file.type === 'widget' || file.type === 'layout')) return true;
            return false;
        }).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;

            if (sortMode === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortMode === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortMode === 'az') return a.name.localeCompare(b.name);
            if (sortMode === 'za') return b.name.localeCompare(a.name);
            return 0;
        });
    }, [activeCategory, search, mediaFiles, currentFolder, sortMode]);

    const handleUploadFiles = async (files: FileList | null) => {
        if (!files || !commerceId) return;
        
        let successCount = 0;
        let failCount = 0;
        
        const toastId = toast.loading(`Subiendo ${files.length} archivo(s)...`);

        for (let i = 0; i < files.length; i++) {
            try {
                await uploadMedia({ commerceId, file: files[i], folderPath: currentFolder });
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
            setIsUploadModalOpen(false);
        }
    };

    const handleAddWebLink = async (url: string, name: string) => {
        if (!commerceId) return;
        const toastId = toast.loading("Agregando enlace...");
        try {
            await uploadMedia({ commerceId, webUrl: url, webName: name, folderPath: currentFolder });
            toast.success("Enlace agregado correctamente.", { id: toastId });
        } catch (error) {
            console.error("Web link error:", error);
            toast.error("Error al agregar el enlace.", { id: toastId });
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

    const handleBulkDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar los ${selectedIds.length} elementos seleccionados?`)) return;
        const toDelete = mediaFiles.filter(f => selectedIds.includes(f.id));
        for (const f of toDelete) {
            try {
                await deleteMedia(f);
            } catch (error) {
                console.error("Error deleting", f.name);
            }
        }
        toast.success(`${selectedIds.length} elementos eliminados`);
        setSelectedIds([]);
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredFiles.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredFiles.map(f => f.id));
        }
    };

    const breadcrumbs = currentFolder === '/' ? [] : currentFolder.split('/').filter(Boolean);

    const navigateToBreadcrumb = (index: number) => {
        if (index === -1) {
            setCurrentFolder('/');
            return;
        }
        const newPath = '/' + breadcrumbs.slice(0, index + 1).join('/');
        setCurrentFolder(newPath);
    };

    return (
        <div className="h-full flex flex-col bg-[#0A101D] text-slate-200">
            {/* Top Bar for sending to screens */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm z-10 gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        {activeCategory !== 'apps' && (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="icon" className="md:hidden border-slate-700 bg-slate-800 text-slate-300 w-9 h-9 shrink-0">
                                        <Folder className="w-4 h-4" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="p-0 bg-slate-900 border-slate-800 w-72 flex flex-col">
                                    <SheetTitle className="sr-only">Carpetas de Medios</SheetTitle>
                                    <MediaFolderSidebar 
                                        commerceId={commerceId!}
                                        mediaFiles={mediaFiles}
                                        currentFolder={currentFolder}
                                        onSelectFolder={(path) => {
                                            setCurrentFolder(path);
                                            setSearch('');
                                            setSelectedIds([]);
                                        }}
                                    />
                                </SheetContent>
                            </Sheet>
                        )}
                        {activeCategory === 'apps' ? <LayoutGrid className="w-6 h-6 text-indigo-400 hidden md:block" /> : <Folder className="w-6 h-6 text-orange-400 hidden md:block" />}
                        {activeCategory === 'apps' ? 'Aplicaciones' : 'Librería de Contenidos'}
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {activeCategory === 'apps' ? 'Crea y administra aplicaciones y widgets.' : 'Sube, organiza en carpetas y envía medios a tus pantallas.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {activeCategory === 'apps' ? (
                        <Button variant="outline" className="bg-indigo-900/40 text-indigo-300 border-indigo-500/50 shadow-sm hover:bg-indigo-900/60 hover:text-indigo-200" onClick={() => setIsAppCatalogOpen(true)}>
                            <LayoutGrid className="w-4 h-4 mr-2" />
                            Crear App
                        </Button>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="bg-slate-800 text-slate-200 border border-slate-700 shadow-sm hover:bg-slate-700 hover:text-white">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Subir / Agregar...
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200 z-50">
                                <DropdownMenuItem onClick={() => { setUploadCategory('all'); setIsUploadModalOpen(true); }} className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white">
                                    <Upload className="w-4 h-4 mr-2" /> Subir Archivo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setUploadCategory('web'); setIsUploadModalOpen(true); }} className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white">
                                    <Globe className="w-4 h-4 mr-2 text-blue-400" /> Agregar Enlace Web
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <div className="h-8 w-[1px] bg-slate-700 mx-1 hidden sm:block"></div>
                    <Button 
                        variant="outline"
                        className="bg-slate-800 text-slate-200 shadow-sm border-slate-700 hover:bg-slate-700 hover:text-white disabled:opacity-50"
                        disabled={selectedIds.length === 0}
                        onClick={() => setIsMoveModalOpen(true)}
                    >
                        <Move className="w-4 h-4 mr-2 text-indigo-400" />
                        Mover
                    </Button>
                    {selectedIds.length > 0 && (
                        <Button 
                            variant="outline"
                            className="bg-red-950/50 text-red-400 shadow-sm border-red-900 hover:bg-red-900/50 hover:text-red-300"
                            onClick={handleBulkDelete}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar ({selectedIds.length})
                        </Button>
                    )}
                    <Button 
                        className="bg-orange-500 hover:bg-orange-600 text-white shadow-md disabled:opacity-50"
                        disabled={selectedIds.length === 0}
                        onClick={() => setIsSendModalOpen(true)}
                    >
                        Enviar a pantallas
                        <ArrowRightCircle className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                {/* Left Sidebar - Media Folders */}
                <div className="hidden md:block shrink-0 h-full">
                    {commerceId && activeCategory !== 'apps' && (
                        <MediaFolderSidebar 
                            commerceId={commerceId}
                            mediaFiles={mediaFiles}
                            currentFolder={currentFolder}
                            onSelectFolder={(path) => {
                                setCurrentFolder(path);
                                setSearch('');
                                setSelectedIds([]);
                            }}
                        />
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-[#0A101D]">
                    <div className="p-6 flex-1 flex flex-col overflow-hidden">
                        
                        {/* Filters and Toolbar */}
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 shrink-0">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 flex-1">
                                <div className="relative w-full md:w-64 shrink-0">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                                    <Input 
                                        placeholder="Buscar..."
                                        className="pl-9 bg-slate-900 shadow-sm border-slate-800 text-slate-200 placeholder:text-slate-500"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>

                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <select 
                                    className="h-9 px-3 rounded-md border border-slate-800 bg-slate-900 text-sm text-slate-300 outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm"
                                    value={sortMode}
                                    onChange={(e) => setSortMode(e.target.value as any)}
                                >
                                    <option value="newest">Más reciente</option>
                                    <option value="oldest">Más antiguo</option>
                                    <option value="az">A-Z</option>
                                    <option value="za">Z-A</option>
                                </select>
                                <div className="flex bg-slate-900/50 p-1 rounded-md border border-slate-800 shadow-sm">
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'grid' ? 'bg-slate-800 text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'list' ? 'bg-slate-800 text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Breadcrumbs */}
                        {!search && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-slate-400 shrink-0">
                                <button 
                                    onClick={() => navigateToBreadcrumb(-1)}
                                    className="hover:text-orange-400 transition-colors font-medium"
                                >
                                    Raíz
                                </button>
                                {breadcrumbs.map((crumb, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-slate-600">/</span>
                                        <button
                                            onClick={() => navigateToBreadcrumb(idx)}
                                            className={`hover:text-orange-400 transition-colors ${idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-200' : 'font-medium'}`}
                                        >
                                            {crumb}
                                        </button>
                                    </div>
                                ))}
                                <span className="ml-auto text-xs text-slate-500 font-medium">
                                    {isLoading ? 'Cargando...' : `${filteredFiles.length} elemento(s)`}
                                </span>
                            </div>
                        )}
                        {search && (
                            <div className="mb-4 flex items-center justify-between shrink-0">
                                <h3 className="text-sm font-medium text-slate-200">Resultados de búsqueda: "{search}"</h3>
                                <span className="text-xs text-slate-500 font-medium">{filteredFiles.length} elemento(s)</span>
                            </div>
                        )}

                        {/* Data View */}
                        <div className="flex-1 overflow-y-auto pb-6 pr-2">
                            {isLoading ? (
                                <div className="bg-slate-900/50 rounded-xl shadow-sm border border-slate-800 p-12 flex flex-col items-center justify-center text-slate-500 h-full">
                                    <p className="text-lg font-medium text-slate-400">Cargando archivos...</p>
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="bg-slate-900/50 rounded-xl shadow-sm border border-slate-800 p-12 flex flex-col items-center justify-center text-slate-500 h-full">
                                    <HardDrive className="w-12 h-12 mb-4 text-slate-600" />
                                    <p className="text-lg font-medium text-slate-400">Carpeta vacía</p>
                                    <p className="text-sm text-slate-500">Sube archivos a esta ubicación.</p>
                                    <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setIsUploadModalOpen(true)}>
                                        <Upload className="w-4 h-4 mr-2" /> Subir Archivos
                                    </Button>
                                </div>
                            ) : viewMode === 'list' ? (
                                <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-950/50 border-b border-slate-800">
                                                <th className="px-4 py-3 w-12">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded border-slate-700 text-orange-500 focus:ring-orange-500/20 bg-slate-900" 
                                                        checked={selectedIds.length === filteredFiles.length && filteredFiles.length > 0}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                                                {search && <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ubicación</th>}
                                                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Modificado</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {filteredFiles.map(file => {
                                                const FileIcon = getIconForType(file.type);
                                                const isFolder = file.type === 'folder';
                                                return (
                                                <tr key={file.id} className="hover:bg-slate-800/50 transition-colors group">
                                                    <td className="px-4 py-4">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-slate-700 text-orange-500 focus:ring-orange-500/20 bg-slate-900" 
                                                            checked={selectedIds.includes(file.id)}
                                                            onChange={() => handleToggleSelect(file.id)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 cursor-pointer" onClick={() => {
                                                        if (isFolder) {
                                                            setCurrentFolder(currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`);
                                                            setSearch('');
                                                        } else {
                                                            handleToggleSelect(file.id);
                                                        }
                                                    }}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                                                {file.type === 'image' && file.url ? (
                                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <FileIcon className={`w-5 h-5 ${isFolder ? 'text-orange-400 fill-orange-400/20' : 'text-slate-500'}`} />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-slate-200 truncate max-w-sm" title={file.name}>{file.name}</span>
                                                        </div>
                                                    </td>
                                                    {search && (
                                                        <td className="px-4 py-4 text-xs text-slate-500">
                                                            {file.folder_path === '/' ? 'Raíz' : file.folder_path}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4 text-sm text-slate-400">{formatDate(file.created_at)}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-950/50" onClick={(e) => { e.stopPropagation(); handleDelete(file); }}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {filteredFiles.map(file => {
                                        const FileIcon = getIconForType(file.type);
                                        const isFolder = file.type === 'folder';
                                        const appData = file.type === 'app' ? APPS.find(a => a.id === file.metadata?.appId) : null;
                                        return (
                                        <div 
                                            key={file.id} 
                                            draggable={!isFolder}
                                            onDragStart={(e) => {
                                                if (!isFolder) {
                                                    e.dataTransfer.setData('mediaId', file.id);
                                                }
                                            }}
                                            onDragOver={(e) => {
                                                if (isFolder) {
                                                    e.preventDefault();
                                                    setDraggedOverFolder(file.id);
                                                }
                                            }}
                                            onDragLeave={() => {
                                                if (isFolder) setDraggedOverFolder(null);
                                            }}
                                            onDrop={async (e) => {
                                                e.preventDefault();
                                                setDraggedOverFolder(null);
                                                if (isFolder) {
                                                    const droppedId = e.dataTransfer.getData('mediaId');
                                                    if (droppedId && droppedId !== file.id) {
                                                        const newPath = currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`;
                                                        try {
                                                            await updateMedia({ id: droppedId, updates: { folder_path: newPath } });
                                                            toast.success('Archivo movido a la carpeta');
                                                        } catch (err) {
                                                            toast.error('Error al mover el archivo');
                                                        }
                                                    }
                                                }
                                            }}
                                            onClick={() => {
                                                if (isFolder) {
                                                    setCurrentFolder(currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`);
                                                    setSearch('');
                                                } else {
                                                    handleToggleSelect(file.id);
                                                }
                                            }} 
                                            className={`bg-slate-900 rounded-xl shadow-sm border overflow-hidden group transition-colors cursor-pointer flex flex-col relative ${selectedIds.includes(file.id) ? 'border-orange-500 ring-2 ring-orange-500/50' : 'border-slate-800'} ${draggedOverFolder === file.id ? 'border-orange-500 ring-2 ring-orange-500 shadow-md bg-orange-500/10' : 'hover:border-slate-700'}`}
                                        >
                                            <div className="absolute top-2 left-2 z-10">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-700 text-orange-500 focus:ring-orange-500/20 shadow-sm bg-slate-900" 
                                                    checked={selectedIds.includes(file.id)}
                                                    onChange={(e) => { e.stopPropagation(); handleToggleSelect(file.id); }}
                                                />
                                            </div>
                                            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white rounded-full shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200 z-50">
                                                        {file.type === 'app' && (
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingApp(file); }} className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white">
                                                                <Edit2 className="w-4 h-4 mr-2 text-indigo-400" /> Editar App
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setSelectedIds([file.id]);
                                                            setIsSendModalOpen(true);
                                                        }} className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white">
                                                            <Play className="w-4 h-4 mr-2 text-orange-400" /> Enviar a pantallas
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setSelectedIds([file.id]);
                                                            setIsMoveModalOpen(true);
                                                        }} className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white">
                                                            <Move className="w-4 h-4 mr-2 text-blue-400" /> Mover
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file); }} className="hover:bg-red-900/50 cursor-pointer focus:bg-red-900/50 focus:text-red-300 text-red-400">
                                                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="aspect-[4/3] bg-slate-950 relative overflow-hidden flex items-center justify-center p-2">
                                                {file.type === 'image' && file.url ? (
                                                    <img src={file.url} alt={file.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                                                ) : appData ? (
                                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${appData.bg} group-hover:scale-110 transition-transform shadow-inner`}>
                                                        <appData.icon className={`w-8 h-8 ${appData.color}`} />
                                                    </div>
                                                ) : (
                                                    <FileIcon className={`w-12 h-12 ${isFolder ? 'text-orange-400 fill-orange-400/20 group-hover:scale-110 transition-transform' : 'text-slate-600'}`} />
                                                )}
                                            </div>
                                            <div className="p-3 border-t border-slate-800 bg-slate-900">
                                                <h4 className="font-medium text-slate-200 text-sm truncate" title={file.name}>{file.name}</h4>
                                                {search ? (
                                                    <p className="text-xs text-orange-400 mt-0.5 truncate">{file.folder_path === '/' ? 'Raíz' : file.folder_path}</p>
                                                ) : (
                                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{formatDate(file.created_at).split(',')[0]}</p>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <UploadMediaModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onUpload={handleUploadFiles}
                onAddWebLink={handleAddWebLink}
                activeCategory={uploadCategory}
            />
            {commerceId && (
                <MoveMediaModal
                    isOpen={isMoveModalOpen}
                    onClose={() => setIsMoveModalOpen(false)}
                    selectedAssets={mediaFiles.filter(f => selectedIds.includes(f.id))}
                    allMedia={mediaFiles}
                    commerceId={commerceId}
                    onSuccess={() => setSelectedIds([])}
                />
            )}
            <SendToScreensModal
                isOpen={isSendModalOpen}
                onClose={() => setIsSendModalOpen(false)}
                selectedAssets={mediaFiles.filter(f => selectedIds.includes(f.id))}
                commerceId={commerceId || ''}
                onSuccess={() => setSelectedIds([])}
            />
            {commerceId && (
                <AppCatalogModal
                    isOpen={isAppCatalogOpen}
                    onClose={() => setIsAppCatalogOpen(false)}
                    commerceId={commerceId}
                    currentFolder={currentFolder}
                />
            )}
            {commerceId && editingApp && (
                <AppEditorModal
                    isOpen={!!editingApp}
                    onClose={() => setEditingApp(null)}
                    onBack={() => setEditingApp(null)}
                    appId={editingApp.metadata?.appId as AppId}
                    commerceId={commerceId}
                    currentFolder={currentFolder}
                    editingApp={editingApp}
                />
            )}
        </div>
    );
}

export function getIconForType(type: string) {
    switch (type) {
        case 'folder': return Folder;
        case 'image': return ImageIcon;
        case 'video': return Video;
        case 'audio': return FileAudio;
        case 'docs': return FileText;
        case 'web': return Globe;
        case 'app': 
        case 'widget': 
        case 'layout': return LayoutGrid;
        default: return FileText;
    }
}
