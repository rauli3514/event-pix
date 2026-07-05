import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Upload, LayoutGrid, List as ListIcon, Image as ImageIcon, Video, FileAudio, FileText, Globe, Trash2, Folder, Move, MoreVertical, Edit2, Clock, ArrowRightCircle, Play } from 'lucide-react';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';
import { useDisplayMedia, useUploadDisplayMedia, useDeleteDisplayMedia, useUpdateDisplayMedia } from '@/hooks/use-display-media';
import { toast } from 'sonner';
import { DisplayMedia } from '@/types/display';
import { MediaFolderSidebar } from '@/components/display/MediaFolderSidebar';
import { MoveMediaModal } from '@/components/display/MoveMediaModal';
import { AppCatalogModal, AppId } from '@/components/display/apps/AppCatalogModal';
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

    const handleUploadFiles = async (fileList: FileList | null) => {
        if (!fileList || !commerceId) return;
        
        // Convertir a array inmediatamente para evitar que se pierdan los archivos si el componente se desmonta
        const files = Array.from(fileList);
        if (files.length === 0) return;

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
        }
        
        setIsUploadModalOpen(false);
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
        <div className="min-h-full md:h-full flex flex-col bg-background text-foreground transition-colors duration-300">
            {/* Descriptive Top Banner */}
            <div className="p-3 md:p-6 md:px-8 pt-3 md:pt-6 pb-2 shrink-0">
                <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-xl flex items-center min-h-[100px] md:min-h-[140px] px-4 md:px-8 py-4 md:py-6 transition-colors duration-300">
                    {/* Decorative Background for Banner */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-background/20 to-secondary/10 pointer-events-none">
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/10 rounded-full blur-[60px] hidden sm:block"></div>
                        <div className="absolute right-32 bottom-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] hidden sm:block"></div>
                    </div>
                    
                    <div className="relative z-10 flex flex-col gap-1 w-full max-w-3xl">
                        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-2 md:gap-3">
                            {activeCategory !== 'apps' && (
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" size="icon" className="md:hidden border-border bg-muted/50 text-muted-foreground hover:text-foreground w-8 h-8 md:w-10 md:h-10 shrink-0">
                                            <Folder className="w-5 h-5" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="left" className="p-0 bg-card border-r-border w-72 flex flex-col transition-colors duration-300">
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
                            {activeCategory === 'apps' ? 'Aplicaciones' : 'Medios y Archivos'}
                        </h1>
                        <p className="text-muted-foreground font-medium max-w-xl text-sm md:text-base">
                            {activeCategory === 'apps' 
                                ? 'Creá y administrá aplicaciones y widgets dinámicos para tus pantallas.' 
                                : 'Gestioná tus imágenes, videos y enlaces, agrupándolos en carpetas para un mayor control al enviarlos.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-3 md:px-8 py-2 md:py-3 flex flex-col sm:flex-row sm:items-center justify-between z-10 gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Placeholder for left-side actions in the future, if needed */}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {activeCategory === 'apps' ? (
                        <Button className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors" onClick={() => setIsAppCatalogOpen(true)}>
                            <LayoutGrid className="w-4 h-4 mr-2" />
                            Crear App
                        </Button>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="bg-muted text-foreground border border-border shadow-sm hover:bg-accent hover:text-accent-foreground">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Subir / Agregar...
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground z-50">
                                <DropdownMenuItem onClick={() => { setUploadCategory('all'); setIsUploadModalOpen(true); }} className="hover:bg-accent cursor-pointer focus:bg-accent focus:text-accent-foreground">
                                    <Upload className="w-4 h-4 mr-2" /> Subir Archivo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setUploadCategory('web'); setIsUploadModalOpen(true); }} className="hover:bg-accent cursor-pointer focus:bg-accent focus:text-accent-foreground">
                                    <Globe className="w-4 h-4 mr-2 text-blue-400" /> Agregar Enlace Web
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <div className="h-8 w-[1px] bg-border mx-1 hidden sm:block"></div>
                    <Button 
                        variant="outline"
                        className="bg-muted text-foreground shadow-sm border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                        disabled={selectedIds.length === 0}
                        onClick={() => setIsMoveModalOpen(true)}
                    >
                        <Move className="w-4 h-4 mr-2 text-indigo-500" />
                        Mover
                    </Button>
                    {selectedIds.length > 0 && (
                        <Button 
                            variant="outline"
                            className="bg-destructive/10 text-destructive shadow-sm border-destructive/20 hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
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

            <div className="flex flex-1 md:overflow-hidden flex-col md:flex-row min-h-0 border-t border-border mt-2">
                {/* Desktop Sidebar */}
                {activeCategory !== 'apps' && (
                    <div className="hidden md:flex w-64 shrink-0 border-r border-border bg-card flex-col transition-colors duration-300">
                        {commerceId && (
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
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-background/50 min-h-0">
                    <div className="p-3 md:p-6 flex-1 flex flex-col md:overflow-hidden min-h-0">
                        
                        {/* Filters and Toolbar */}
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="relative w-full md:w-64">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar archivos..."
                                        className="pl-9 bg-card shadow-sm border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                                        value={search}
                                        onChange={(e: any) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <select 
                                    className="h-9 px-3 rounded-md border border-border bg-card text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
                                    value={sortMode}
                                    onChange={(e) => setSortMode(e.target.value as any)}
                                >
                                    <option value="newest">Más reciente</option>
                                    <option value="oldest">Más antiguo</option>
                                    <option value="az">A-Z</option>
                                    <option value="za">Z-A</option>
                                </select>
                                <div className="flex bg-muted/50 p-1 rounded-md border border-border shadow-sm">
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Breadcrumbs */}
                        {!search && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                <button 
                                    onClick={() => navigateToBreadcrumb(-1)}
                                    className="hover:text-indigo-500 transition-colors font-medium"
                                >
                                    Raíz
                                </button>
                                {breadcrumbs.map((crumb, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-border">/</span>
                                        <button
                                            onClick={() => navigateToBreadcrumb(idx)}
                                            className={`hover:text-indigo-500 transition-colors ${idx === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'font-medium'}`}
                                        >
                                            {crumb}
                                        </button>
                                    </div>
                                ))}
                                <span className="ml-auto text-xs text-muted-foreground font-medium">
                                    {isLoading ? 'Cargando...' : `${filteredFiles.length} elemento(s)`}
                                </span>
                            </div>
                        )}
                        {search && (
                            <div className="mb-4 flex items-center justify-between shrink-0">
                                <h3 className="text-sm font-medium text-foreground">Resultados de búsqueda: "{search}"</h3>
                                <span className="text-xs text-muted-foreground font-medium">{filteredFiles.length} elemento(s)</span>
                            </div>
                        )}

                        {/* Data View */}
                        <div className="flex-1 md:overflow-y-auto pb-6 pr-2 min-h-0">
                            {isLoading ? (
                                <div className="bg-card/50 rounded-xl shadow-sm border border-border p-12 flex flex-col items-center justify-center text-muted-foreground h-full">
                                    <p className="text-lg font-medium text-muted-foreground">Cargando archivos...</p>
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="bg-card/50 rounded-xl shadow-sm border border-border p-12 flex flex-col items-center justify-center text-muted-foreground h-full min-h-[300px]">
                                    <Folder className="w-16 h-16 mb-4 text-muted-foreground/50" />
                                    <p className="text-lg font-medium text-foreground">No hay archivos</p>
                                    <p className="text-sm mt-1 text-center max-w-md">Sube archivos, enlaces web o crea carpetas para organizar tu contenido.</p>
                                    <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setIsUploadModalOpen(true)}>
                                        <Upload className="w-4 h-4 mr-2" /> Subir Archivos
                                    </Button>
                                </div>
                            ) : viewMode === 'list' ? (
                                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead>
                                            <tr className="bg-muted/50 border-b border-border">
                                                <th className="w-10 px-4 py-3">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded border-border text-indigo-500 focus:ring-indigo-500/20 bg-background" 
                                                        checked={selectedIds.length === filteredFiles.length && filteredFiles.length > 0}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</th>
                                                {search && <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ubicación</th>}
                                                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modificado</th>
                                                <th className="px-4 py-3 font-medium text-muted-foreground w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {filteredFiles.map(file => {
                                                const FileIcon = getIconForType(file.type);
                                                const isFolder = file.type === 'folder';
                                                return (
                                                <tr key={file.id} className="hover:bg-muted/50 transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-border text-indigo-500 focus:ring-indigo-500/20 bg-background" 
                                                            checked={selectedIds.includes(file.id)}
                                                            onChange={() => handleToggleSelect(file.id)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 cursor-pointer" onClick={() => {
                                                        if (isFolder) {
                                                            setCurrentFolder(currentFolder === '/' ? `/${file.name}` : `${currentFolder}/${file.name}`);
                                                            setSearch('');
                                                        } else {
                                                            handleToggleSelect(file.id);
                                                        }
                                                    }}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                                                                {file.type === 'image' && file.url ? (
                                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                                ) : file.type === 'video' && file.url ? (
                                                                    <video src={file.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                                                ) : (
                                                                    <FileIcon className={`w-5 h-5 ${isFolder ? 'text-orange-400' : 'text-muted-foreground'}`} />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-foreground truncate max-w-sm" title={file.name}>{file.name}</span>
                                                        </div>
                                                    </td>
                                                    {search && (
                                                        <td className="px-4 py-4 text-xs text-muted-foreground">
                                                            {file.folder_path === '/' ? 'Raíz' : file.folder_path}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(file.created_at)}</td>
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
                                            className={`bg-card/40 backdrop-blur-sm rounded-2xl shadow-lg border overflow-hidden group transition-all duration-300 cursor-pointer flex flex-col relative transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 ${selectedIds.includes(file.id) ? 'border-orange-500 ring-2 ring-orange-500/50 bg-orange-500/5' : 'border-border/60'} ${draggedOverFolder === file.id ? 'border-orange-500 ring-2 ring-orange-500 shadow-md bg-orange-500/10' : 'hover:border-primary/50 hover:bg-muted/60'}`}
                                        >
                                            <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 focus-within:opacity-100">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 shadow-sm bg-background/80 backdrop-blur-md cursor-pointer transition-colors" 
                                                    checked={selectedIds.includes(file.id)}
                                                    onChange={(e) => { e.stopPropagation(); handleToggleSelect(file.id); }}
                                                />
                                            </div>
                                            {/* Si está seleccionado siempre mostramos el checkbox */}
                                            {selectedIds.includes(file.id) && (
                                                <div className="absolute top-3 left-3 z-10">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-primary text-primary focus:ring-primary/20 shadow-sm bg-background cursor-pointer" 
                                                        checked={true}
                                                        onChange={(e) => { e.stopPropagation(); handleToggleSelect(file.id); }}
                                                    />
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-md text-foreground hover:bg-muted rounded-full shadow-sm border border-border" onClick={(e) => e.stopPropagation()}>
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground z-50">
                                                        {file.type === 'app' && (
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingApp(file); }} className="hover:bg-accent cursor-pointer focus:bg-accent focus:text-accent-foreground">
                                                                <Edit2 className="w-4 h-4 mr-2 text-primary" /> Editar App
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setSelectedIds([file.id]);
                                                            setIsSendModalOpen(true);
                                                        }} className="hover:bg-accent cursor-pointer focus:bg-accent focus:text-accent-foreground">
                                                            <Play className="w-4 h-4 mr-2 text-primary" /> Enviar a pantallas
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setSelectedIds([file.id]);
                                                            setIsMoveModalOpen(true);
                                                        }} className="hover:bg-accent cursor-pointer focus:bg-accent focus:text-accent-foreground">
                                                            <Move className="w-4 h-4 mr-2 text-blue-400" /> Mover
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file); }} className="hover:bg-destructive/10 cursor-pointer focus:bg-destructive/10 focus:text-destructive text-destructive">
                                                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            
                                            {/* Preview Area */}
                                            <div className="flex-1 bg-muted/50 relative overflow-hidden flex items-center justify-center p-4">
                                                {file.type === 'image' && file.url ? (
                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                ) : file.type === 'video' && file.url ? (
                                                    <video src={file.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" muted playsInline preload="metadata" />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-2xl bg-card border border-border/50 shadow-inner flex items-center justify-center transform transition-transform group-hover:scale-110 group-hover:-rotate-3">
                                                        <FileIcon className={`w-8 h-8 ${isFolder ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Card Details */}
                                            <div className="p-4 border-t border-border/60 bg-card/40 backdrop-blur-sm flex flex-col justify-center min-h-[4rem] shrink-0">
                                                <h4 className="font-semibold text-foreground text-sm truncate max-w-full" title={file.name}>{file.name}</h4>
                                                {search ? (
                                                    <p className="text-xs font-medium text-primary mt-1 truncate">{file.folder_path === '/' ? 'Raíz' : file.folder_path}</p>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1.5"><Clock className="w-3 h-3" /> {formatDate(file.created_at).split(',')[0]}</p>
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
            {commerceId && (
                <AppEditorModal
                    isOpen={!!editingApp}
                    onClose={() => setEditingApp(null)}
                    onBack={() => setEditingApp(null)}
                    appId={(editingApp?.metadata?.appId as AppId) || 'dynamic-menu'}
                    commerceId={commerceId}
                    currentFolder={currentFolder}
                    editingApp={editingApp || undefined}
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
