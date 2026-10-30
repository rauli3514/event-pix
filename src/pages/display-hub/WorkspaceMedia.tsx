import { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Upload, LayoutGrid, List as ListIcon, Image as ImageIcon, Video, FileAudio, FileText, Globe, Trash2, Folder, FolderPlus, Move, MoreVertical, Edit2, Play, Calendar, ListPlus, X, ChevronRight, Check, Sparkles } from 'lucide-react';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';
import { AddToPlaylistModal } from '@/components/display/AddToPlaylistModal';
import { useDisplayMedia, useUploadDisplayMedia, useDeleteDisplayMedia, useUpdateDisplayMedia, useUpdateMediaFolder, useDeleteMediaFolder } from '@/hooks/use-display-media';
import { useDisplayCampaigns } from '@/hooks/use-display-hub';
import { useVideoUploadCheck } from '@/hooks/use-video-upload-check';
import { AppCover, WebCover } from '@/components/display/AppCover';
import { contentKindLabel, isAppItem, isWebItem } from '@/lib/appCovers';
import { HeavyVideoBadge } from '@/components/display/HeavyVideoBadge';
import { toast } from 'sonner';
import { DisplayMedia } from '@/types/display';
import { MoveMediaModal } from '@/components/display/MoveMediaModal';
import { AppCatalogModal, AppId } from '@/components/display/apps/AppCatalogModal';
import { AppEditorModal } from '@/components/display/apps/AppEditorModal';
import { PlacaMakerModal } from '@/components/display/PlacaMakerModal';
import { PLACA_TEMPLATE_IDS as PLACA_IDS, placaFromMetadata, type PlacaTemplateId } from '@/lib/placas';
import { itemIsMedia, playlistItems } from '@/lib/playlistItems';

export type CategoryId = 'all' | 'images' | 'videos' | 'audio' | 'docs' | 'web' | 'apps';

const APP_TYPES = ['app', 'widget', 'layout'];

const matchesCategory = (file: DisplayMedia, category: CategoryId) => {
    switch (category) {
        case 'all': return true;
        case 'images': return file.type === 'image';
        case 'videos': return file.type === 'video';
        case 'audio': return file.type === 'audio';
        case 'docs': return file.type === 'docs';
        case 'web': return file.type === 'web';
        case 'apps': return APP_TYPES.includes(file.type);
    }
};

const TYPE_LABEL: Record<string, string> = {
    image: 'Imagen', video: 'Video', web: 'Web', app: 'App', widget: 'App', layout: 'App', audio: 'Audio', docs: 'Documento',
};

const joinPath = (parent: string, name: string) => (parent === '/' ? `/${name}` : `${parent}/${name}`);

// Medios: la biblioteca de fotos, videos, webs y apps del negocio.
// Una sola fila para buscar y filtrar, las carpetas como fichas (una sola vez)
// y, al elegir archivos, una barra con lo que se puede hacer con ellos.
export function WorkspaceMedia({ initialCategory = 'all' }: { initialCategory?: CategoryId }) {
    const { commerceId } = useParams<{ commerceId: string }>();
    const isAppsPage = initialCategory === 'apps';
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    // ?subir=1 (botón "Subir contenido" de Inicio) abre directo la subida.
    const [searchParams] = useSearchParams();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(() => searchParams.get('subir') === '1');
    const [uploadCategory, setUploadCategory] = useState<CategoryId>('all');
    const [isAppCatalogOpen, setIsAppCatalogOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<CategoryId>(initialCategory);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [currentFolder, setCurrentFolder] = useState<string>('/');
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
    const [draggedOverFolder, setDraggedOverFolder] = useState<string | null>(null);
    const [editingApp, setEditingApp] = useState<DisplayMedia | null>(null);
    const [newFolderName, setNewFolderName] = useState<string | null>(null);
    // Crear placa: ?placa=1 (o ?placa=<diseño>) la abre directo (desde Plantillas o Inicio).
    const [placaOpen, setPlacaOpen] = useState(() => !!searchParams.get('placa'));
    const [placaTemplate] = useState(() => (searchParams.get('placa') || '') as PlacaTemplateId);
    const [editingPlaca, setEditingPlaca] = useState<DisplayMedia | null>(null);

    const { data: mediaFiles = [], isLoading } = useDisplayMedia(commerceId);
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const { mutateAsync: uploadMedia } = useUploadDisplayMedia();
    // Aviso si un video es pesado para los TV box (4K, H.265, mucho bitrate).
    const { prepare: prepareUploads, dialog: videoCheckDialog } = useVideoUploadCheck();
    const { mutateAsync: deleteMedia } = useDeleteDisplayMedia();
    const { mutateAsync: updateMedia } = useUpdateDisplayMedia();
    const updateFolder = useUpdateMediaFolder();
    const deleteFolder = useDeleteMediaFolder();

    const files = useMemo(() => mediaFiles.filter(f => f.type !== 'folder'), [mediaFiles]);

    // Archivos del lugar actual (carpeta o búsqueda), antes de filtrar por tipo:
    // sirve para los números de cada filtro.
    const inScope = useMemo(() => files.filter(file => {
        if (search) return file.name.toLowerCase().includes(search.toLowerCase());
        // Las apps no se organizan en carpetas: se muestran todas.
        if (isAppsPage) return true;
        return (file.folder_path || '/') === currentFolder;
    }), [files, search, currentFolder, isAppsPage]);

    const filteredFiles = useMemo(() => inScope
        .filter(file => matchesCategory(file, activeCategory))
        .sort((a, b) => {
            if (sortMode === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortMode === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortMode === 'az') return a.name.localeCompare(b.name);
            return b.name.localeCompare(a.name);
        }), [inScope, activeCategory, sortMode]);

    // Carpetas dentro de la actual, con cuántos archivos tienen (contando subcarpetas).
    const folders = useMemo(() => {
        if (search || isAppsPage) return [];
        return mediaFiles
            .filter(f => f.type === 'folder' && (f.folder_path || '/') === currentFolder)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(f => {
                const path = joinPath(currentFolder, f.name);
                const count = files.filter(m => m.folder_path === path || (m.folder_path || '').startsWith(`${path}/`)).length;
                return { media: f, path, count };
            });
    }, [mediaFiles, files, currentFolder, search, isAppsPage]);

    // En cuántas playlists está cada archivo ("En 2 playlists" / "Sin usar").
    const usage = useMemo(() => {
        const map = new Map<string, number>();
        const lists = campaigns.map(c => playlistItems(c.items_json));
        for (const file of files) {
            map.set(file.id, lists.filter(items => items.some(item => itemIsMedia(item, file))).length);
        }
        return map;
    }, [campaigns, files]);

    const categoryChips: { id: CategoryId; label: string }[] = [
        { id: 'all', label: 'Todo' },
        { id: 'images', label: 'Imágenes' },
        { id: 'videos', label: 'Videos' },
        { id: 'web', label: 'Webs' },
        { id: 'apps', label: 'Apps' },
    ];

    const selectedMedia = mediaFiles.filter(f => selectedIds.includes(f.id));

    const openFolder = (path: string) => {
        setCurrentFolder(path);
        setSearch('');
        setSelectedIds([]);
    };

    const handleUploadFiles = async (fileList: FileList | null) => {
        if (!fileList || !commerceId) return;

        // Convertir a array inmediatamente para evitar que se pierdan los archivos si el componente se desmonta
        const list = Array.from(fileList);
        if (list.length === 0) return;

        const prepared = await prepareUploads(list);
        if (!prepared) return;

        let successCount = 0;
        let failCount = 0;
        const toastId = toast.loading(`Subiendo ${list.length} archivo(s)...`);

        for (const { file, metadata } of prepared) {
            try {
                await uploadMedia({ commerceId, file, folderPath: currentFolder, metadata });
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
        if (!confirm(`¿Seguro que querés eliminar "${file.name}"?`)) return;
        try {
            await deleteMedia(file);
            setSelectedIds(prev => prev.filter(id => id !== file.id));
            toast.success(`Archivo eliminado: ${file.name}`);
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error("Ocurrió un error al eliminar el archivo.");
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`¿Seguro que querés eliminar ${selectedIds.length === 1 ? 'el archivo elegido' : `los ${selectedIds.length} archivos elegidos`}?`)) return;
        for (const f of selectedMedia) {
            try {
                await deleteMedia(f);
            } catch {
                console.error("Error deleting", f.name);
            }
        }
        toast.success(`${selectedIds.length} elemento(s) eliminados`);
        setSelectedIds([]);
    };

    const handleCreateFolder = async () => {
        const name = (newFolderName || '').trim();
        setNewFolderName(null);
        if (!name || !commerceId) return;
        try {
            await uploadMedia({ commerceId, webName: name, folderPath: currentFolder, isFolder: true });
            toast.success('Carpeta creada');
        } catch {
            toast.error('No se pudo crear la carpeta');
        }
    };

    const handleRenameFolder = async (path: string, currentName: string) => {
        const name = window.prompt('Nuevo nombre de la carpeta', currentName)?.trim();
        if (!name || name === currentName || !commerceId) return;
        try {
            await updateFolder.mutateAsync({ commerceId, oldPath: path, newPath: joinPath(currentFolder, name) });
            toast.success('Carpeta renombrada');
        } catch {
            toast.error('No se pudo renombrar la carpeta');
        }
    };

    const handleDeleteFolder = async (path: string, name: string) => {
        if (!confirm(`¿Eliminar la carpeta "${name}" y TODO lo que tiene adentro?`) || !commerceId) return;
        try {
            await deleteFolder.mutateAsync({ commerceId, folderPath: path });
            toast.success('Carpeta eliminada');
        } catch {
            toast.error('No se pudo eliminar la carpeta');
        }
    };

    const moveToFolder = async (mediaId: string, path: string) => {
        try {
            await updateMedia({ id: mediaId, updates: { folder_path: path } });
            toast.success('Archivo movido a la carpeta');
        } catch {
            toast.error('Error al mover el archivo');
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const allSelected = filteredFiles.length > 0 && filteredFiles.every(f => selectedIds.includes(f.id));
    const handleSelectAll = () => setSelectedIds(allSelected ? [] : filteredFiles.map(f => f.id));

    const breadcrumbs = currentFolder === '/' ? [] : currentFolder.split('/').filter(Boolean);
    const usageText = (file: DisplayMedia) => {
        const n = usage.get(file.id) || 0;
        return n === 0 ? 'Sin usar' : n === 1 ? 'En 1 playlist' : `En ${n} playlists`;
    };

    const renderThumb = (file: DisplayMedia, className: string, compact = false) => {
        if (isAppItem(file)) return <AppCover item={file} className={className} compact={compact} />;
        if (isWebItem(file)) return <WebCover item={file} className={className} compact={compact} />;
        const FileIcon = getIconForType(file.type);
        if (file.type === 'image' && file.url) return <img src={file.url} alt="" loading="lazy" className={`${className} object-cover`} />;
        if (file.type === 'video' && file.url) return <video src={file.url} className={`${className} object-cover`} muted playsInline preload="metadata" />;
        return (
            <div className={`${className} flex items-center justify-center bg-muted`}>
                <FileIcon className="w-8 h-8 text-muted-foreground" />
            </div>
        );
    };

    return (
        <div className="min-h-full flex flex-col bg-background text-foreground">
            {videoCheckDialog}

            <div className="px-4 md:px-8 pt-6 pb-10 flex flex-col gap-5">
                {/* Encabezado */}
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{isAppsPage ? 'Apps' : 'Medios'}</h1>
                        <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                            {isAppsPage
                                ? 'Relojes, clima, menús, reseñas y más, para sumar a tus playlists.'
                                : 'Las fotos, videos y webs que podés mostrar. Elegí varios y sumalos a una playlist.'}
                        </p>
                    </div>
                    {isAppsPage ? (
                        <Button className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsAppCatalogOpen(true)}>
                            <LayoutGrid className="w-4 h-4 mr-2" /> Crear app
                        </Button>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="h-11 px-5" onClick={() => { setEditingPlaca(null); setPlacaOpen(true); }}>
                            <Sparkles className="w-4 h-4 mr-2 text-indigo-500" /> Crear placa
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                                    <Upload className="w-4 h-4 mr-2" /> Subir archivos
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-card border-border text-foreground z-50">
                                <DropdownMenuItem onClick={() => { setUploadCategory('all'); setIsUploadModalOpen(true); }} className="cursor-pointer">
                                    <Upload className="w-4 h-4 mr-2" /> Fotos o videos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setUploadCategory('web'); setIsUploadModalOpen(true); }} className="cursor-pointer">
                                    <Globe className="w-4 h-4 mr-2" /> Una página web
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                    )}
                </header>

                {/* Buscar y filtrar: una sola fila */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            aria-label="Buscar archivos"
                            placeholder="Buscar por nombre…"
                            className="h-11 pl-9 bg-card border-border"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {!isAppsPage && (
                        <div role="group" aria-label="Tipo de archivo" className="flex flex-wrap gap-1.5">
                            {categoryChips.map(chip => {
                                const count = inScope.filter(f => matchesCategory(f, chip.id)).length;
                                const active = activeCategory === chip.id;
                                return (
                                    <button
                                        key={chip.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setActiveCategory(chip.id)}
                                        className={`h-10 px-3.5 rounded-full text-sm border transition-colors ${active
                                            ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-semibold'
                                            : 'border-border text-muted-foreground hover:text-foreground hover:border-indigo-500/40'}`}
                                    >
                                        {chip.label} · {count}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="hidden sm:inline">Ordenar</span>
                            <select
                                className="h-10 px-3 rounded-md border border-border bg-card text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500/50"
                                value={sortMode}
                                onChange={e => setSortMode(e.target.value as typeof sortMode)}
                            >
                                <option value="newest">Más recientes</option>
                                <option value="oldest">Más antiguos</option>
                                <option value="az">Nombre A–Z</option>
                                <option value="za">Nombre Z–A</option>
                            </select>
                        </label>
                        <div className="flex bg-card p-1 rounded-md border border-border" role="group" aria-label="Vista">
                            <Button variant="ghost" size="sm" aria-label="Ver como grilla" aria-pressed={viewMode === 'grid'}
                                className={`h-8 px-2 ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                                onClick={() => setViewMode('grid')}>
                                <LayoutGrid className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" aria-label="Ver como lista" aria-pressed={viewMode === 'list'}
                                className={`h-8 px-2 ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                                onClick={() => setViewMode('list')}>
                                <ListIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Dónde estoy */}
                {!isAppsPage && (
                    <nav aria-label="Carpeta actual" className="flex flex-wrap items-center gap-1.5 text-sm">
                        {search ? (
                            <span className="text-muted-foreground">Resultados para "<span className="text-foreground font-medium">{search}</span>" en todas las carpetas</span>
                        ) : (
                            <>
                                <button type="button" onClick={() => openFolder('/')}
                                    className={`hover:text-indigo-500 ${breadcrumbs.length === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                    Todos los archivos
                                </button>
                                {breadcrumbs.map((crumb, idx) => (
                                    <span key={idx} className="flex items-center gap-1.5">
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                        <button type="button" onClick={() => openFolder('/' + breadcrumbs.slice(0, idx + 1).join('/'))}
                                            className={`hover:text-indigo-500 ${idx === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                            {crumb}
                                        </button>
                                    </span>
                                ))}
                            </>
                        )}
                    </nav>
                )}

                {/* Carpetas: una sola vez, como fichas. Se pueden soltar archivos encima. */}
                {!isAppsPage && !search && (
                    <section aria-label="Carpetas" className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
                        {folders.map(({ media, path, count }) => (
                            <div
                                key={media.id}
                                onDragOver={e => { e.preventDefault(); setDraggedOverFolder(media.id); }}
                                onDragLeave={() => setDraggedOverFolder(null)}
                                onDrop={async e => {
                                    e.preventDefault();
                                    setDraggedOverFolder(null);
                                    const droppedId = e.dataTransfer.getData('mediaId');
                                    if (droppedId) await moveToFolder(droppedId, path);
                                }}
                                className={`group shrink-0 flex items-center rounded-xl border bg-card transition-colors ${draggedOverFolder === media.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-border hover:border-indigo-500/40'}`}
                            >
                                <button type="button" onClick={() => openFolder(path)} className="flex items-center gap-2 h-10 pl-3.5 pr-2 text-sm font-medium">
                                    <Folder className="w-4 h-4 text-indigo-500" />
                                    {media.name}
                                    <span className="text-muted-foreground font-normal">{count}</span>
                                </button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button type="button" aria-label={`Opciones de la carpeta ${media.name}`} className="h-10 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                                        <DropdownMenuItem onClick={() => handleRenameFolder(path, media.name)} className="cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2" /> Renombrar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteFolder(path, media.name)} className="cursor-pointer text-destructive focus:text-destructive">
                                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                        {newFolderName === null ? (
                            <button type="button" onClick={() => setNewFolderName('')}
                                className="shrink-0 flex items-center gap-2 h-10 px-3.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-indigo-500/50">
                                <FolderPlus className="w-4 h-4" /> Nueva carpeta
                            </button>
                        ) : (
                            <form onSubmit={e => { e.preventDefault(); handleCreateFolder(); }} className="shrink-0 flex items-center gap-2">
                                <Input autoFocus aria-label="Nombre de la carpeta" placeholder="Nombre de la carpeta" value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onBlur={() => { if (!newFolderName?.trim()) setNewFolderName(null); }}
                                    onKeyDown={e => { if (e.key === 'Escape') setNewFolderName(null); }}
                                    className="h-10 w-56 bg-card border-border" />
                                <Button type="submit" className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white">Crear</Button>
                            </form>
                        )}
                    </section>
                )}

                {/* Barra al elegir archivos */}
                {selectedIds.length > 0 && (
                    <div role="region" aria-label="Archivos elegidos"
                        className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/90 text-white backdrop-blur px-4 py-2.5 shadow-lg">
                        <strong className="text-sm mr-1">{selectedIds.length === 1 ? '1 elegido' : `${selectedIds.length} elegidos`}</strong>
                        <Button size="sm" className="h-10 bg-indigo-500 hover:bg-indigo-400 text-white" onClick={() => setIsPlaylistModalOpen(true)}>
                            <ListPlus className="w-4 h-4 mr-2" /> Agregar a una playlist
                        </Button>
                        <Button size="sm" variant="outline" className="h-10 bg-transparent border-indigo-400/50 text-white hover:bg-white/10 hover:text-white" onClick={() => setIsSendModalOpen(true)}>
                            <Play className="w-4 h-4 mr-2" /> Mostrar ya en pantallas
                        </Button>
                        {!isAppsPage && (
                            <Button size="sm" variant="outline" className="h-10 bg-transparent border-indigo-400/50 text-white hover:bg-white/10 hover:text-white" onClick={() => setIsMoveModalOpen(true)}>
                                <Move className="w-4 h-4 mr-2" /> Mover a carpeta
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-10 bg-transparent border-indigo-400/50 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200" onClick={handleBulkDelete}>
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                        </Button>
                        <div className="ml-auto flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-10 text-white/80 hover:text-white hover:bg-white/10" onClick={handleSelectAll}>
                                {allSelected ? 'Ninguno' : 'Elegir todos'}
                            </Button>
                            <Button size="sm" variant="ghost" aria-label="Cancelar selección" className="h-10 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setSelectedIds([])}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Archivos */}
                {isLoading ? (
                    <div className="rounded-xl border border-border bg-card/50 p-12 text-center text-muted-foreground">Cargando archivos…</div>
                ) : filteredFiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 flex flex-col items-center text-center gap-2">
                        <Folder className="w-12 h-12 text-muted-foreground/60" />
                        <p className="text-lg font-semibold">{search ? 'No encontramos archivos con ese nombre' : folders.length > 0 ? 'Esta carpeta no tiene archivos sueltos' : 'Todavía no hay nada acá'}</p>
                        <p className="text-sm text-muted-foreground max-w-md">
                            {isAppsPage ? 'Creá una app (reloj, clima, menú…) para sumarla a tus playlists.' : 'Subí fotos o videos, o agregá una página web.'}
                        </p>
                        {!search && (
                            <Button className="mt-4 h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => (isAppsPage ? setIsAppCatalogOpen(true) : setIsUploadModalOpen(true))}>
                                {isAppsPage ? <><LayoutGrid className="w-4 h-4 mr-2" /> Crear app</> : <><Upload className="w-4 h-4 mr-2" /> Subir archivos</>}
                            </Button>
                        )}
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="rounded-xl border border-border bg-card overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    <th className="w-10 px-4 py-3">
                                        <input type="checkbox" aria-label="Elegir todos" className="w-4 h-4 accent-indigo-600" checked={allSelected} onChange={handleSelectAll} />
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uso</th>
                                    {search && <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Carpeta</th>}
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subido</th>
                                    <th className="px-4 py-3 w-12"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredFiles.map(file => (
                                    <tr key={file.id} className={`transition-colors ${selectedIds.includes(file.id) ? 'bg-indigo-500/5' : 'hover:bg-muted/40'}`}>
                                        <td className="px-4 py-3">
                                            <input type="checkbox" aria-label={`Elegir ${file.name}`} className="w-4 h-4 accent-indigo-600"
                                                checked={selectedIds.includes(file.id)} onChange={() => handleToggleSelect(file.id)} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <button type="button" onClick={() => handleToggleSelect(file.id)} className="flex items-center gap-3 text-left">
                                                <span className="w-12 h-9 rounded-md overflow-hidden border border-border shrink-0 block">{renderThumb(file, 'w-full h-full', true)}</span>
                                                <span className="font-medium truncate max-w-xs" title={file.name}>{file.name}</span>
                                                <HeavyVideoBadge media={file} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{(isAppItem(file) && contentKindLabel(file)) || TYPE_LABEL[file.type] || file.type}</td>
                                        <td className={`px-4 py-3 ${usage.get(file.id) ? 'text-foreground' : 'text-muted-foreground'}`}>{usageText(file)}</td>
                                        {search && <td className="px-4 py-3 text-muted-foreground">{file.folder_path === '/' ? 'Sin carpeta' : file.folder_path}</td>}
                                        <td className="px-4 py-3 text-muted-foreground">{formatDate(file.created_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" size="icon" aria-label={`Eliminar ${file.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(file)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {filteredFiles.map(file => {
                            const selected = selectedIds.includes(file.id);
                            const used = (usage.get(file.id) || 0) > 0;
                            return (
                                <div
                                    key={file.id}
                                    draggable
                                    onDragStart={e => e.dataTransfer.setData('mediaId', file.id)}
                                    className={`group relative rounded-xl overflow-hidden border bg-card flex flex-col transition-all ${selected ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-border hover:border-indigo-500/40'}`}
                                >
                                    <button type="button" onClick={() => handleToggleSelect(file.id)} aria-pressed={selected}
                                        aria-label={`${selected ? 'Quitar' : 'Elegir'} ${file.name}`}
                                        className="relative aspect-[4/3] bg-muted block w-full">
                                        {renderThumb(file, 'absolute inset-0 w-full h-full')}
                                        <span className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center ${selected ? 'bg-indigo-600 border-indigo-600' : 'bg-black/40 border-white/80'}`}>
                                            {selected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                        </span>
                                        <span className="absolute bottom-2 right-2 text-[11px] font-semibold rounded-md bg-black/70 text-white px-1.5 py-0.5">
                                            {(isAppItem(file) && contentKindLabel(file)) || TYPE_LABEL[file.type] || file.type}
                                        </span>
                                        <HeavyVideoBadge media={file} className="absolute bottom-2 left-2" />
                                    </button>
                                    <div className="absolute top-2 right-2 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" aria-label={`Opciones de ${file.name}`} className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52 bg-card border-border text-foreground z-50">
                                                {APP_TYPES.includes(file.type) && (
                                                    <DropdownMenuItem onClick={() => setEditingApp(file)} className="cursor-pointer">
                                                        <Edit2 className="w-4 h-4 mr-2" /> Editar app
                                                    </DropdownMenuItem>
                                                )}
                                                {placaFromMetadata(file.metadata) && (
                                                    <DropdownMenuItem onClick={() => { setEditingPlaca(file); setPlacaOpen(true); }} className="cursor-pointer">
                                                        <Edit2 className="w-4 h-4 mr-2" /> Editar placa
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => { setSelectedIds([file.id]); setIsPlaylistModalOpen(true); }} className="cursor-pointer">
                                                    <ListPlus className="w-4 h-4 mr-2" /> Agregar a una playlist
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setSelectedIds([file.id]); setIsSendModalOpen(true); }} className="cursor-pointer">
                                                    <Play className="w-4 h-4 mr-2" /> Mostrar ya en pantallas
                                                </DropdownMenuItem>
                                                {!isAppsPage && (
                                                    <DropdownMenuItem onClick={() => { setSelectedIds([file.id]); setIsMoveModalOpen(true); }} className="cursor-pointer">
                                                        <Move className="w-4 h-4 mr-2" /> Mover a carpeta
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => handleDelete(file)} className="cursor-pointer text-destructive focus:text-destructive">
                                                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
                                        <h3 className="text-sm font-semibold truncate" title={file.name}>{file.name}</h3>
                                        <span className={`text-xs truncate ${used ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                            {search ? `${usageText(file)} · ${file.folder_path === '/' ? 'Sin carpeta' : file.folder_path}` : usageText(file)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {commerceId && (
                <PlacaMakerModal
                    isOpen={placaOpen}
                    onClose={() => { setPlacaOpen(false); setEditingPlaca(null); }}
                    commerceId={commerceId}
                    editing={editingPlaca}
                    initialTemplate={PLACA_IDS.includes(placaTemplate) ? placaTemplate : undefined}
                    onSaved={saved => { if (!editingPlaca) setCurrentFolder(saved.folder_path || '/'); }}
                />
            )}
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
                    selectedAssets={selectedMedia}
                    allMedia={mediaFiles}
                    commerceId={commerceId}
                    onSuccess={() => setSelectedIds([])}
                />
            )}
            {commerceId && (
                <AddToPlaylistModal
                    isOpen={isPlaylistModalOpen}
                    onClose={() => setIsPlaylistModalOpen(false)}
                    commerceId={commerceId}
                    media={selectedMedia}
                    onSuccess={() => setSelectedIds([])}
                />
            )}
            <SendToScreensModal
                isOpen={isSendModalOpen}
                onClose={() => setIsSendModalOpen(false)}
                selectedAssets={selectedMedia}
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
        case 'schedule': return Calendar;
        default: return FileText;
    }
}
