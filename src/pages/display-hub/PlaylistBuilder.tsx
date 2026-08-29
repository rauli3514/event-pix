import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    ArrowLeft, Save, Trash2, Clock, Image as ImageIcon, 
    Video, FileAudio, FileText, Globe, GripVertical, Settings2, Folder, LayoutDashboard, Upload, MonitorPlay
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { useDisplayCampaigns, useUpdateCampaign } from "@/hooks/use-display-hub";
import { useDisplayMedia, useUploadDisplayMedia } from "@/hooks/use-display-media";
import { DisplayCampaignV2, UniversalElement, DisplayFitMode, DisplayTransition } from '@/types/display';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';
import { PlaylistPreviewModal } from '@/components/display/PlaylistPreviewModal';

const migrateToV2 = (data: any): DisplayCampaignV2 => {
    if (data?.version === '2.0') return data as DisplayCampaignV2;

    const items = Array.isArray(data) ? data : [];
    const playlist: UniversalElement[] = items.map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        type: item.type === 'image_ad' ? 'image' : (item.type === 'video' ? 'video' : 'url'),
        url: item.imageUrl || item.url,
        content: item.title || 'Migrado',
        metadata: item.metadata || {},
        duration: item.duration || 10,
        transition: 'fade',
        fitMode: 'contain',
    }));

    return {
        version: '2.0',
        settings: {
            orientation: 'landscape',
            background: { type: 'color', value: '#050505' },
            shuffle: false,
            transition: 'fade',
            defaultDuration: 10
        },
        zones: [{
            id: 'main',
            name: 'Principal',
            width: '100%', height: '100%', top: 0, left: 0, zIndex: 1,
            playlist
        }]
    };
};

export function getIconForType(type: string) {
    switch (type) {
        case 'folder': return Folder;
        case 'image': return ImageIcon;
        case 'video': return Video;
        case 'audio': return FileAudio;
        case 'docs': return FileText;
        case 'web': return Globe;
        default: return FileText;
    }
}

const PlaylistBuilder = () => {
    const { commerceId, playlistId } = useParams<{ commerceId: string, playlistId: string }>();

    const { data: playlists, isLoading: loadingPlaylists } = useDisplayCampaigns(commerceId);
    const { data: mediaFiles = [], isLoading: loadingMedia } = useDisplayMedia(commerceId);
    const { mutateAsync: uploadMedia } = useUploadDisplayMedia();
    const updateCampaign = useUpdateCampaign();

    const playlistRecord = playlists?.find(c => c.id === playlistId);

    const [campaignV2, setCampaignV2] = useState<DisplayCampaignV2>(migrateToV2(null));
    const [mediaFolder, setMediaFolder] = useState<string>('/');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    
    // Drag and Drop state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (playlistRecord && playlistRecord.items_json) {
            setCampaignV2(migrateToV2(playlistRecord.items_json));
        }
    }, [playlistRecord]);

    const handleSave = () => {
        if (!playlistId) return;
        updateCampaign.mutate({ id: playlistId, updates: { items_json: campaignV2 } }, {
            onSuccess: () => toast.success('Playlist guardada. Las pantallas se actualizarán.'),
            onError: () => toast.error('Error al guardar la playlist')
        });
    };

    const handleUploadFiles = async (files: FileList | null) => {
        if (!files || !commerceId) return;
        
        let successCount = 0;
        let failCount = 0;
        const toastId = toast.loading(`Subiendo ${files.length} archivo(s)...`);

        for (let i = 0; i < files.length; i++) {
            try {
                await uploadMedia({ commerceId, file: files[i], folderPath: mediaFolder });
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
            await uploadMedia({ commerceId, webUrl: url, webName: name, folderPath: mediaFolder });
            toast.success("Enlace agregado correctamente.", { id: toastId });
        } catch (error) {
            console.error("Web link error:", error);
            toast.error("Error al agregar el enlace.", { id: toastId });
        }
    };

    // --- Media Right Column Logic ---
    const currentMediaFiles = useMemo(() => {
        return mediaFiles.filter(f => (f.folder_path || '/') === mediaFolder);
    }, [mediaFiles, mediaFolder]);

    const handleAddMediaToPlaylist = (media: any) => {
        if (media.type === 'folder') {
            setMediaFolder(mediaFolder === '/' ? `/${media.name}` : `${mediaFolder}/${media.name}`);
            return;
        }

        const defaultDuration = campaignV2.settings.defaultDuration || 15;
        const defaultTransition = campaignV2.settings.transition || 'fade';

        const newItem = {
            id: crypto.randomUUID(),
            type: media.type,
            url: media.url,
            content: media.name,
            metadata: media.metadata || {},
            duration: defaultDuration,
            transition: defaultTransition,
            fitMode: 'contain',
            source_id: media.id
        } as any;

        const updatedZones = [...campaignV2.zones];
        if (!updatedZones[0]) return;
        updatedZones[0] = { ...updatedZones[0], playlist: [...updatedZones[0].playlist, newItem] };
        setCampaignV2({ ...campaignV2, zones: updatedZones });
        toast.success(`Añadido: ${media.name}`);
    };

    const handleRemoveItem = (id: string) => {
        const updatedZones = [...campaignV2.zones];
        if (!updatedZones[0]) return;
        updatedZones[0] = { ...updatedZones[0], playlist: updatedZones[0].playlist.filter(i => i.id !== id) };
        setCampaignV2({ ...campaignV2, zones: updatedZones });
    };

    const handleUpdateItem = (id: string, updates: Partial<UniversalElement>) => {
        const updatedZones = [...campaignV2.zones];
        if (!updatedZones[0]) return;
        updatedZones[0] = { ...updatedZones[0], playlist: updatedZones[0].playlist.map(i => i.id === id ? { ...i, ...updates } : i) };
        setCampaignV2({ ...campaignV2, zones: updatedZones });
    };
    
    // --- Drag and Drop Logic ---
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
    };

    const handleDragEnter = (index: number) => {
        setDragOverIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }
        
        const updatedZones = [...campaignV2.zones];
        if (!updatedZones[0]) return;
        
        const newPlaylist = [...updatedZones[0].playlist];
        const draggedItem = newPlaylist[draggedIndex];
        
        newPlaylist.splice(draggedIndex, 1);
        newPlaylist.splice(dropIndex, 0, draggedItem);
        
        updatedZones[0] = { ...updatedZones[0], playlist: newPlaylist };
        setCampaignV2({ ...campaignV2, zones: updatedZones });
        
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    if (loadingPlaylists) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Cargando...</div>;
    if (!playlistRecord) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Playlist no encontrada</div>;

    const activePlaylist = campaignV2.zones[0]?.playlist || [];
    const totalDuration = activePlaylist.reduce((acc, item) => acc + item.duration, 0);

    return (
        <div className="h-screen bg-background flex flex-col font-sans overflow-hidden text-foreground transition-colors duration-300">
            {/* Topbar */}
            <header className="h-14 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-2 md:px-4 shrink-0 transition-colors duration-300">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-1 md:-ml-2 hover:bg-accent shrink-0 px-2 md:px-3">
                        <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`}>
                            <ArrowLeft className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Volver</span>
                        </Link>
                    </Button>
                    <div className="h-4 w-px bg-border shrink-0" />
                    <h1 className="font-bold text-foreground text-sm md:text-lg flex items-center gap-2 truncate">
                        {playlistRecord.name}
                    </h1>
                </div>

                <div className="flex items-center gap-1 md:gap-3 shrink-0 ml-2">
                    <Button variant="secondary" size="sm" className="font-semibold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 px-2 md:px-3" onClick={() => setIsPreviewModalOpen(true)}>
                        <MonitorPlay className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Vista Previa</span>
                    </Button>
                    {/* Settings Gear Modal */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-accent">
                                <Settings2 className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-foreground">Configuración de la Playlist</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Orden Aleatorio (Shuffle)</Label>
                                    <Select 
                                        value={campaignV2.settings.shuffle ? 'yes' : 'no'} 
                                        onValueChange={v => setCampaignV2({ ...campaignV2, settings: { ...campaignV2.settings, shuffle: v === 'yes' }})}
                                    >
                                        <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground">
                                            <SelectItem value="no">No (Orden secuencial)</SelectItem>
                                            <SelectItem value="yes">Sí (Aleatorio)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Transición por Defecto</Label>
                                    <Select 
                                        value={campaignV2.settings.transition || 'fade'} 
                                        onValueChange={v => setCampaignV2({ ...campaignV2, settings: { ...campaignV2.settings, transition: v as DisplayTransition }})}
                                    >
                                        <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground z-50">
                                            <SelectItem value="fade">✨ Desvanecer (Fade)</SelectItem>
                                            <SelectItem value="slide">↔️ Deslizar (Slide)</SelectItem>
                                            <SelectItem value="zoom">🔍 Zoom In (Escala)</SelectItem>
                                            <SelectItem value="flip">🔄 Giro 3D (Flip)</SelectItem>
                                            <SelectItem value="blur">💧 Desenfoque (Blur)</SelectItem>
                                            <SelectItem value="bounce">🏀 Rebote (Bounce)</SelectItem>
                                            <SelectItem value="none">⚡ Ninguna (Corte seco)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Tiempo por Defecto (Segundos)</Label>
                                    <Input 
                                        type="number" min={5} max={300}
                                        className="bg-background border-border text-foreground"
                                        value={campaignV2.settings.defaultDuration || 15}
                                        onChange={e => setCampaignV2({ ...campaignV2, settings: { ...campaignV2.settings, defaultDuration: parseInt(e.target.value) || 15 }})}
                                    />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button onClick={handleSave} disabled={updateCampaign.isPending} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-medium px-2 md:px-3">
                        <Save className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Guardar y Enviar</span>
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                
                {/* LEFT COLUMN: Folders & Playlists */}
                <div className="w-64 bg-card border-r border-border hidden xl:flex flex-col shrink-0 transition-colors duration-300">
                    <div className="p-4 border-b border-border/50">
                        <Button className="w-full bg-accent hover:bg-accent/80 text-foreground justify-start border border-border" asChild>
                            <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`}><LayoutDashboard className="w-4 h-4 mr-2"/> Ir a Playlists</Link>
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-4">
                        <div className="mb-4">
                            <h3 className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tus Playlists</h3>
                            {playlists?.map(p => (
                                <Link key={p.id} to={`/admin/display/commerce/${commerceId}/playlists/${p.id}`} 
                                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${p.id === playlistId ? 'bg-primary/10 text-primary border border-primary/30 font-medium shadow-inner' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{p.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CENTER COLUMN: The Blackboard (Pizarra) */}
                <div className="flex-1 bg-background/50 flex flex-col overflow-y-auto">
                    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Contenido de la Playlist</h2>
                                <p className="text-sm text-muted-foreground">Arrastra o haz clic en los medios para agregarlos aquí.</p>
                            </div>
                            <div className="bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-4 text-sm font-medium text-muted-foreground w-full sm:w-auto overflow-x-auto">
                                <div className="flex items-center gap-1.5 whitespace-nowrap"><LayoutDashboard className="w-4 h-4 text-primary shrink-0"/> {activePlaylist.length} items</div>
                                <div className="flex items-center gap-1.5 whitespace-nowrap"><Clock className="w-4 h-4 text-primary shrink-0"/> {totalDuration}s total</div>
                            </div>
                        </div>

                        {activePlaylist.length === 0 ? (
                            <div className="bg-card/30 border-2 border-dashed border-border rounded-2xl p-8 md:p-16 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">La playlist está vacía</h3>
                                <p className="text-muted-foreground max-w-sm mt-2 text-sm md:text-base">Haz clic en cualquier imagen o video para agregarlo inmediatamente a esta playlist.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activePlaylist.map((item, index) => {
                                    const TypeIcon = getIconForType(item.type);
                                    const isDragging = draggedIndex === index;
                                    const isDragOver = dragOverIndex === index && draggedIndex !== index;
                                    
                                    return (
                                        <div 
                                            key={item.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnter={() => handleDragEnter(index)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, index)}
                                            onDragEnd={handleDragEnd}
                                            className={`bg-card border ${isDragging ? 'border-primary shadow-md opacity-70' : isDragOver ? 'border-primary border-t-4 shadow-lg scale-[1.02]' : 'border-border'} rounded-xl shadow-sm flex flex-col sm:flex-row items-stretch group hover:border-primary/50 transition-all overflow-hidden cursor-grab active:cursor-grabbing`}
                                        >
                                            <div className="hidden sm:flex w-10 bg-muted/50 border-r border-border items-center justify-center text-muted-foreground group-hover:text-foreground">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                            
                                            <div className="p-3 md:p-4 flex-1 flex items-center gap-3 md:gap-4 overflow-hidden">
                                                <div className="w-14 h-14 md:w-16 md:h-16 bg-muted rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-border">
                                                    {item.type === 'image' && item.url ? (
                                                        <img src={item.url} alt="thumb" className="w-full h-full object-cover pointer-events-none" />
                                                    ) : (
                                                        <TypeIcon className="w-6 h-6 text-muted-foreground pointer-events-none" />
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h4 className="font-bold text-foreground truncate text-sm md:text-base">{item.content || 'Sin Título'}</h4>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <Select value={item.fitMode || 'contain'} onValueChange={v => handleUpdateItem(item.id, { fitMode: v as DisplayFitMode })}>
                                                            <SelectTrigger className="h-7 text-xs px-2 w-[90px] md:w-[110px] bg-background border-border text-muted-foreground">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-card border-border text-foreground">
                                                                <SelectItem value="contain">Ajustar</SelectItem>
                                                                <SelectItem value="cover">Rellenar</SelectItem>
                                                                <SelectItem value="fill">Estirar</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        
                                                        <Select value={item.transition || 'default'} onValueChange={v => handleUpdateItem(item.id, { transition: v as DisplayTransition })}>
                                                            <SelectTrigger className="h-7 text-xs px-2 w-[100px] md:w-[125px] bg-background border-border text-muted-foreground">
                                                                <SelectValue placeholder="Transición" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-card border-border text-foreground z-50">
                                                                <SelectItem value="default">⚙️ Por Defecto</SelectItem>
                                                                <SelectItem value="fade">✨ Desvanecer</SelectItem>
                                                                <SelectItem value="slide">↔️ Deslizar</SelectItem>
                                                                <SelectItem value="zoom">🔍 Zoom In</SelectItem>
                                                                <SelectItem value="flip">🔄 Giro 3D</SelectItem>
                                                                <SelectItem value="blur">💧 Desenfoque</SelectItem>
                                                                <SelectItem value="bounce">🏀 Rebote</SelectItem>
                                                                <SelectItem value="none">⚡ Corte</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="p-3 md:p-4 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-border bg-muted/30 gap-2 sm:gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" min={5} className="w-14 md:w-16 h-8 text-center px-1 font-mono text-xs md:text-sm bg-background border-border text-foreground"
                                                        value={item.duration}
                                                        onChange={e => handleUpdateItem(item.id, { duration: parseInt(e.target.value) || 10 })}
                                                    />
                                                    <span className="text-[10px] md:text-xs text-muted-foreground font-medium">segs</span>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)} className="h-8 sm:h-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                    <Trash2 className="w-3.5 h-3.5 sm:mr-1" /> <span className="sm:inline hidden">Quitar</span>
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Media Library Picker */}
                <div className="w-full lg:w-72 h-[50vh] lg:h-auto bg-card border-t lg:border-t-0 lg:border-l border-border flex flex-col shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-10 overflow-hidden transition-colors duration-300">
                    <div className="p-3 md:p-4 border-b border-border flex items-center justify-between bg-muted/50 shrink-0">
                        <h3 className="font-bold text-foreground text-sm flex items-center gap-2 truncate">
                            {mediaFolder !== '/' && (
                                <Button variant="ghost" size="icon" className="w-6 h-6 -ml-2 text-muted-foreground hover:text-foreground shrink-0" onClick={() => {
                                    const parts = mediaFolder.split('/');
                                    parts.pop();
                                    setMediaFolder(parts.length === 1 ? '/' : parts.join('/'));
                                }}>
                                    <ArrowLeft className="w-3 h-3" />
                                </Button>
                            )}
                            Medios {mediaFolder !== '/' && <span className="text-muted-foreground font-normal truncate">/ {mediaFolder.split('/').pop()}</span>}
                        </h3>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground bg-accent border border-border hover:text-foreground hover:bg-accent/80 shrink-0" onClick={() => setIsUploadModalOpen(true)}>
                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Subir
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3">
                        {loadingMedia ? (
                            <div className="text-center text-sm text-muted-foreground py-4">Cargando medios...</div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                                {currentMediaFiles.map(file => {
                                    const Icon = getIconForType(file.type);
                                    return (
                                        <div 
                                            key={file.id} 
                                            onClick={() => handleAddMediaToPlaylist(file)}
                                            className="bg-card border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary hover:ring-2 hover:ring-primary/20 transition-all group aspect-square flex flex-col relative"
                                        >
                                            <div className="flex-1 bg-muted/50 flex items-center justify-center overflow-hidden">
                                                {file.type === 'image' && file.url ? (
                                                    <img src={file.url} alt="thumb" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : file.type === 'video' && file.url ? (
                                                    <video src={file.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" muted playsInline preload="metadata" />
                                                ) : (
                                                    <Icon className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                )}
                                            </div>
                                            <div className="p-1 md:p-2 bg-card border-t border-border">
                                                <p className="text-[9px] md:text-[10px] font-medium text-muted-foreground truncate group-hover:text-foreground transition-colors" title={file.name}>{file.name}</p>
                                            </div>
                                            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-background text-primary border border-primary/30 text-[10px] font-bold px-2 py-1 rounded shadow-lg">
                                                    {file.type === 'folder' ? 'Abrir' : 'Añadir'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {currentMediaFiles.length === 0 && (
                                    <div className="col-span-full text-center text-xs text-muted-foreground py-8">
                                        Carpeta vacía
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <UploadMediaModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                activeCategory="images"
                onUpload={handleUploadFiles}
                onAddWebLink={handleAddWebLink}
            />
            
            <PlaylistPreviewModal 
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                items={activePlaylist}
            />
        </div>
    );
};

export default PlaylistBuilder;
