import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Save, Trash2, Clock, Image as ImageIcon, 
    Video, FileAudio, FileText, Globe, GripVertical, Settings2, Folder, LayoutDashboard, Upload
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayCampaigns, useUpdateCampaign } from "@/hooks/use-display-hub";
import { useDisplayMedia, useUploadDisplayMedia } from "@/hooks/use-display-media";
import { DisplayCampaignV2, UniversalElement, DisplayFitMode, DisplayTransition } from '@/types/display';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';

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
    const navigate = useNavigate();
    const isSuperAdmin = useIsSuperAdmin();

    const { data: playlists, isLoading: loadingPlaylists } = useDisplayCampaigns(commerceId);
    const { data: mediaFiles = [], isLoading: loadingMedia } = useDisplayMedia(commerceId);
    const { mutateAsync: uploadMedia } = useUploadDisplayMedia();
    const updateCampaign = useUpdateCampaign();

    const playlistRecord = playlists?.find(c => c.id === playlistId);

    const [campaignV2, setCampaignV2] = useState<DisplayCampaignV2>(migrateToV2(null));
    const [mediaFolder, setMediaFolder] = useState<string>('/');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    if (isSuperAdmin === false) {
        navigate('/admin', { replace: true });
        return null;
    }

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

        const newItem: UniversalElement = {
            id: crypto.randomUUID(),
            type: media.type,
            url: media.url,
            content: media.name,
            metadata: media.metadata || {},
            duration: defaultDuration,
            transition: defaultTransition,
            fitMode: 'contain',
        };

        const updatedZones = [...campaignV2.zones];
        if (!updatedZones[0]) return;
        updatedZones[0].playlist.push(newItem);
        setCampaignV2({ ...campaignV2, zones: updatedZones });
        toast.success(`Añadido: ${media.name}`);
    };

    const handleRemoveItem = (id: string) => {
        const updatedZones = [...campaignV2.zones];
        updatedZones[0].playlist = updatedZones[0].playlist.filter(i => i.id !== id);
        setCampaignV2({ ...campaignV2, zones: updatedZones });
    };

    const handleUpdateItem = (id: string, updates: Partial<UniversalElement>) => {
        const updatedZones = [...campaignV2.zones];
        updatedZones[0].playlist = updatedZones[0].playlist.map(i => i.id === id ? { ...i, ...updates } : i);
        setCampaignV2({ ...campaignV2, zones: updatedZones });
    };

    if (loadingPlaylists) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Cargando...</div>;
    if (!playlistRecord) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Playlist no encontrada</div>;

    const activePlaylist = campaignV2.zones[0]?.playlist || [];
    const totalDuration = activePlaylist.reduce((acc, item) => acc + item.duration, 0);

    return (
        <div className="h-screen bg-[#0A101D] flex flex-col font-sans overflow-hidden text-slate-200">
            {/* Topbar */}
            <header className="h-14 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white -ml-2 hover:bg-slate-800">
                        <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                        </Link>
                    </Button>
                    <div className="h-4 w-px bg-slate-800" />
                    <h1 className="font-bold text-white text-lg flex items-center gap-2">
                        {playlistRecord.name}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* Settings Gear Modal */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900">
                                <Settings2 className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#0A101D] border-slate-800 text-slate-200 sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-white">Configuración de la Playlist</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Orden Aleatorio (Shuffle)</Label>
                                    <Select 
                                        value={campaignV2.settings.shuffle ? 'yes' : 'no'} 
                                        onValueChange={v => setCampaignV2({ ...campaignV2, settings: { ...campaignV2.settings, shuffle: v === 'yes' }})}
                                    >
                                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            <SelectItem value="no">No (Orden secuencial)</SelectItem>
                                            <SelectItem value="yes">Sí (Aleatorio)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Transición por Defecto</Label>
                                    <Select 
                                        value={campaignV2.settings.transition || 'fade'} 
                                        onValueChange={v => setCampaignV2({ ...campaignV2, settings: { ...campaignV2.settings, transition: v as DisplayTransition }})}
                                    >
                                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            <SelectItem value="none">Ninguna (Corte seco)</SelectItem>
                                            <SelectItem value="fade">Desvanecer (Fade)</SelectItem>
                                            <SelectItem value="slide">Deslizar (Slide)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Tiempo por Defecto (Segundos)</Label>
                                    <Input 
                                        type="number" min={5} max={300}
                                        className="bg-slate-950 border-slate-800 text-slate-200"
                                        value={campaignV2.settings.defaultDuration || 15}
                                        onChange={e => setCampaignV2({ ...campaignV2, settings: { ...campaignV2.settings, defaultDuration: parseInt(e.target.value) || 15 }})}
                                    />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button onClick={handleSave} disabled={updateCampaign.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-medium">
                        <Save className="w-4 h-4 mr-2" /> Guardar y Enviar
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT COLUMN: Folders & Playlists */}
                <div className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
                    <div className="p-4 border-b border-slate-800/50">
                        <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white justify-start" asChild>
                            <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`}><LayoutDashboard className="w-4 h-4 mr-2"/> Ir a Playlists</Link>
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-4">
                        <div className="mb-4">
                            <h3 className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tus Playlists</h3>
                            {playlists?.map(p => (
                                <Link key={p.id} to={`/admin/display/commerce/${commerceId}/playlists/${p.id}`} 
                                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${p.id === playlistId ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'}`}>
                                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{p.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CENTER COLUMN: The Blackboard (Pizarra) */}
                <div className="flex-1 bg-black flex flex-col overflow-y-auto">
                    <div className="p-8 max-w-4xl mx-auto w-full">
                        
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">Contenido de la Playlist</h2>
                                <p className="text-sm text-slate-400">Arrastra o haz clic en los medios de la derecha para agregarlos aquí.</p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 flex items-center gap-4 text-sm font-medium text-slate-300">
                                <div className="flex items-center gap-1.5"><LayoutDashboard className="w-4 h-4 text-indigo-400"/> {activePlaylist.length} items</div>
                                <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-indigo-400"/> {totalDuration}s total</div>
                            </div>
                        </div>

                        {activePlaylist.length === 0 ? (
                            <div className="bg-slate-900/30 border-2 border-dashed border-slate-700 rounded-2xl p-16 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                    <ImageIcon className="w-8 h-8 text-slate-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-300">La playlist está vacía</h3>
                                <p className="text-slate-500 max-w-sm mt-2">Haz clic en cualquier imagen o video del panel derecho para agregarlo inmediatamente a esta playlist.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activePlaylist.map((item) => {
                                    const TypeIcon = getIconForType(item.type);
                                    return (
                                        <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-stretch group hover:border-indigo-500/50 transition-colors">
                                            <div className="w-10 bg-slate-950/50 border-r border-slate-800 flex items-center justify-center cursor-grab text-slate-500 group-hover:text-slate-300 rounded-l-xl">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                            
                                            <div className="p-4 flex-1 flex items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-slate-800">
                                                    {item.type === 'image' && item.url ? (
                                                        <img src={item.url} alt="thumb" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <TypeIcon className="w-6 h-6 text-slate-500" />
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-200 truncate">{item.content || 'Sin Título'}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Select value={item.fitMode || 'contain'} onValueChange={v => handleUpdateItem(item.id, { fitMode: v as DisplayFitMode })}>
                                                            <SelectTrigger className="h-7 text-xs px-2 w-[110px] bg-slate-950 border-slate-800 text-slate-300">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                                <SelectItem value="contain">Ajustar</SelectItem>
                                                                <SelectItem value="cover">Rellenar</SelectItem>
                                                                <SelectItem value="fill">Estirar</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        
                                                        <Select value={item.transition || 'fade'} onValueChange={v => handleUpdateItem(item.id, { transition: v as DisplayTransition })}>
                                                            <SelectTrigger className="h-7 text-xs px-2 w-[110px] bg-slate-950 border-slate-800 text-slate-300">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                                <SelectItem value="fade">Fade</SelectItem>
                                                                <SelectItem value="slide">Slide</SelectItem>
                                                                <SelectItem value="none">Corte</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="p-4 flex flex-col items-end justify-center border-l border-slate-800 bg-slate-950/30 rounded-r-xl">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Input 
                                                        type="number" min={5} className="w-16 h-8 text-center px-1 font-mono text-sm bg-slate-950 border-slate-800 text-slate-200"
                                                        value={item.duration}
                                                        onChange={e => handleUpdateItem(item.id, { duration: parseInt(e.target.value) || 10 })}
                                                    />
                                                    <span className="text-xs text-slate-500 font-medium">segs</span>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)} className="h-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 w-full">
                                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Quitar
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
                <div className="w-72 bg-slate-900/50 border-l border-slate-800 flex flex-col shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-10">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                        <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                            {mediaFolder !== '/' && (
                                <Button variant="ghost" size="icon" className="w-6 h-6 -ml-2 text-slate-400 hover:text-white" onClick={() => {
                                    const parts = mediaFolder.split('/');
                                    parts.pop();
                                    setMediaFolder(parts.length === 1 ? '/' : parts.join('/'));
                                }}>
                                    <ArrowLeft className="w-3 h-3" />
                                </Button>
                            )}
                            Medios {mediaFolder !== '/' && <span className="text-slate-500 font-normal">/ {mediaFolder.split('/').pop()}</span>}
                        </h3>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-300 bg-slate-800 border border-slate-700 hover:text-white hover:bg-slate-700" onClick={() => setIsUploadModalOpen(true)}>
                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Subir
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3">
                        {loadingMedia ? (
                            <div className="text-center text-sm text-slate-500 py-4">Cargando medios...</div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {currentMediaFiles.map(file => {
                                    const Icon = getIconForType(file.type);
                                    return (
                                        <div 
                                            key={file.id} 
                                            onClick={() => handleAddMediaToPlaylist(file)}
                                            className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden cursor-pointer hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20 transition-all group aspect-square flex flex-col relative"
                                        >
                                            <div className="flex-1 bg-slate-900/50 flex items-center justify-center overflow-hidden">
                                                {file.type === 'image' && file.url ? (
                                                    <img src={file.url} alt="thumb" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <Icon className="w-8 h-8 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                                )}
                                            </div>
                                            <div className="p-2 bg-slate-950 border-t border-slate-800">
                                                <p className="text-[10px] font-medium text-slate-400 truncate group-hover:text-slate-200 transition-colors" title={file.name}>{file.name}</p>
                                            </div>
                                            <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-[#0A101D] text-indigo-400 border border-indigo-500/30 text-[10px] font-bold px-2 py-1 rounded shadow-lg">
                                                    {file.type === 'folder' ? 'Abrir' : 'Añadir'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {currentMediaFiles.length === 0 && (
                                    <div className="col-span-2 text-center text-xs text-slate-600 py-8">
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
                onUpload={handleUploadFiles}
                onAddWebLink={handleAddWebLink}
                activeCategory="images"
            />
        </div>
    );
};

export default PlaylistBuilder;
