import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Clock, Link as LinkIcon, Image as ImageIcon, Camera, LayoutList, GripVertical, Upload, Settings2, Type, QrCode, Monitor } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayCampaigns, useUpdateCampaign } from "@/hooks/use-display-hub";
import { DisplayCampaignV2, UniversalElement, UniversalElementType, DisplayFitMode } from '@/types/display';
import { supabase } from '@/lib/supabase';

const LAYOUT_PRESETS = [
    { id: 'full', name: 'Pantalla Completa (1 Zona)', zones: [{ id: 'main', width: '100%', height: '100%', top: 0, left: 0 }] },
    { id: 'split-v', name: 'Mitades (2 Zonas Verticales)', zones: [{ id: 'left', width: '50%', height: '100%', top: 0, left: 0 }, { id: 'right', width: '50%', height: '100%', top: 0, left: '50%' }] },
    { id: 'split-h', name: 'Mitades (2 Zonas Horizontales)', zones: [{ id: 'top', width: '100%', height: '50%', top: 0, left: 0 }, { id: 'bottom', width: '100%', height: '50%', top: '50%', left: 0 }] },
    { id: 'main-bottom', name: 'Principal + Barra Inferior', zones: [{ id: 'main', width: '100%', height: '85%', top: 0, left: 0 }, { id: 'bottom', width: '100%', height: '15%', top: '85%', left: 0 }] },
    { id: 'main-side', name: 'Principal + Barra Lateral', zones: [{ id: 'main', width: '75%', height: '100%', top: 0, left: 0 }, { id: 'side', width: '25%', height: '100%', top: 0, left: '75%' }] },
];

const migrateToV2 = (data: any): DisplayCampaignV2 => {
    if (data?.version === '2.0') return data as DisplayCampaignV2;

    const items = Array.isArray(data) ? data : [];
    const playlist: UniversalElement[] = items.map((item: any, index: number) => {
        let type: UniversalElementType = 'url';
        if (item.type === 'image_ad') type = 'image';
        if (item.type === 'video') type = 'video';

        return {
            id: item.id || crypto.randomUUID(),
            type: type,
            url: item.imageUrl || item.url,
            content: item.title || 'Diapositiva Migrada',
            duration: item.duration || 10,
            transition: 'fade',
            fitMode: 'contain',
        };
    });

    return {
        version: '2.0',
        settings: {
            orientation: 'landscape',
            background: { type: 'color', value: '#050505' }
        },
        zones: [{
            id: 'main',
            name: 'Zona Principal',
            width: '100%',
            height: '100%',
            top: 0, left: 0, zIndex: 1,
            playlist: playlist
        }]
    };
};

const DisplayCampaignBuilder = () => {
    const { commerceId, campaignId } = useParams<{ commerceId: string, campaignId: string }>();
    const navigate = useNavigate();
    const isSuperAdmin = useIsSuperAdmin();

    const { data: campaigns, isLoading } = useDisplayCampaigns(commerceId);
    const updateCampaign = useUpdateCampaign();

    const campaign = campaigns?.find(c => c.id === campaignId);

    const [campaignV2, setCampaignV2] = useState<DisplayCampaignV2>(migrateToV2(null));
    const [activeZoneIndex, setActiveZoneIndex] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    
    // Formulario Nueva Diapositiva
    const [isAdding, setIsAdding] = useState(false);
    const [newType, setNewType] = useState<UniversalElementType>('url');
    const [newDuration, setNewDuration] = useState('15');
    const [newUrl, setNewUrl] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newFitMode, setNewFitMode] = useState<DisplayFitMode>('contain');
    const [newColor, setNewColor] = useState('#ffffff');
    const [newBgColor, setNewBgColor] = useState('#000000');

    if (isSuperAdmin === false) {
        navigate('/admin', { replace: true });
        return null;
    }

    useEffect(() => {
        if (campaign && campaign.items_json) {
            setCampaignV2(migrateToV2(campaign.items_json));
        }
    }, [campaign]);

    const handleSave = () => {
        if (!campaignId) return;
        updateCampaign.mutate({ id: campaignId, updates: { items_json: campaignV2 } }, {
            onSuccess: () => toast.success('Campaña guardada. Las pantallas se actualizarán en segundos.'),
            onError: () => toast.error('Error al guardar la campaña')
        });
    };

    const handleLayoutChange = (presetId: string) => {
        const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        const updatedZones = preset.zones.map((pz, idx) => ({
            id: pz.id,
            name: `Zona ${idx + 1} (${pz.width}x${pz.height})`,
            width: pz.width,
            height: pz.height,
            top: pz.top,
            left: pz.left,
            zIndex: idx + 1,
            playlist: campaignV2.zones[idx]?.playlist || [] // Preservar playlist si existe
        }));

        setCampaignV2({ ...campaignV2, zones: updatedZones });
        setActiveZoneIndex(0);
        toast.success(`Layout cambiado a ${preset.name}`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `display_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(`campaigns/${fileName}`, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl(`campaigns/${fileName}`);

            setNewUrl(publicUrl);
            if (!newContent) setNewContent(file.name.split('.')[0]);
            toast.success('Archivo subido correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al subir el archivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const durationNum = parseInt(newDuration, 10) || 15;
        
        const newItem: UniversalElement = {
            id: crypto.randomUUID(),
            type: newType,
            duration: durationNum,
            content: newContent || (newType === 'text' ? 'Texto Nuevo' : 'Widget Nuevo'),
            url: newUrl,
            fitMode: newFitMode,
            transition: 'fade',
            color: newType === 'text' ? newColor : undefined,
            backgroundColor: (newType === 'text' || newType === 'qr') ? newBgColor : undefined,
        };

        const updatedZones = [...campaignV2.zones];
        updatedZones[activeZoneIndex].playlist.push(newItem);

        setCampaignV2({ ...campaignV2, zones: updatedZones });
        
        setIsAdding(false);
        setNewUrl('');
        setNewContent('');
    };

    const handleRemoveItem = (id: string) => {
        const updatedZones = [...campaignV2.zones];
        updatedZones[activeZoneIndex].playlist = updatedZones[activeZoneIndex].playlist.filter(i => i.id !== id);
        setCampaignV2({ ...campaignV2, zones: updatedZones });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'url': return <LinkIcon className="w-5 h-5 text-blue-400" />;
            case 'image': return <ImageIcon className="w-5 h-5 text-emerald-400" />;
            case 'video': return <Camera className="w-5 h-5 text-purple-400" />;
            case 'text': return <Type className="w-5 h-5 text-amber-400" />;
            case 'qr': return <QrCode className="w-5 h-5 text-rose-400" />;
            default: return <LayoutList className="w-5 h-5 text-slate-400" />;
        }
    };

    const getTypeName = (type: string) => {
        switch (type) {
            case 'url': return 'Sitio Web Externo';
            case 'image': return 'Imagen Local';
            case 'video': return 'Video MP4';
            case 'text': return 'Texto Simple';
            case 'qr': return 'Código QR';
            default: return type;
        }
    };

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!campaign) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white flex-col gap-4">
            <h2 className="text-2xl font-bold">Campaña no encontrada</h2>
            <Button asChild><Link to={`/admin/display/commerce/${commerceId}/campaigns`}>Volver</Link></Button>
        </div>
    );

    const activePlaylist = campaignV2.zones[activeZoneIndex]?.playlist || [];
    const totalDuration = activePlaylist.reduce((acc, item) => acc + item.duration, 0);

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-slate-200">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <Button variant="ghost" asChild className="mb-2 text-slate-400 hover:text-white hover:bg-slate-800 -ml-4">
                            <Link to={`/admin/display/commerce/${commerceId}/campaigns`}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Campañas
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <Monitor className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                    Display OS Builder: {campaign.name}
                                </h1>
                                <p className="text-slate-400 text-sm mt-1">Configuración Avanzada de Cartelería Digital</p>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={updateCampaign.isPending} className="bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                        <Save className="w-4 h-4 mr-2" /> {updateCampaign.isPending ? 'Guardando...' : 'Guardar y Sincronizar TVs'}
                    </Button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    
                    {/* Left Col: Global Settings */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Settings2 className="w-5 h-5 text-indigo-400" /> Ajustes Globales
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-slate-300">Layout (Pantalla Dividida)</Label>
                                    <Select 
                                        value={LAYOUT_PRESETS.find(p => p.zones.length === campaignV2.zones.length)?.id || 'full'} 
                                        onValueChange={handleLayoutChange}
                                    >
                                        <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            {LAYOUT_PRESETS.map(preset => (
                                                <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500 mt-2">Cuidado: Cambiar la estructura moverá tus playlists a la nueva zona correspondiente.</p>
                                </div>

                                <div>
                                    <Label className="text-slate-300">Color de Fondo Base</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input 
                                            type="color" 
                                            value={campaignV2.settings.background.value} 
                                            onChange={(e) => setCampaignV2({
                                                ...campaignV2, 
                                                settings: { ...campaignV2.settings, background: { type: 'color', value: e.target.value } }
                                            })}
                                            className="w-10 h-10 rounded cursor-pointer bg-slate-950 border border-slate-700"
                                        />
                                        <Input 
                                            value={campaignV2.settings.background.value}
                                            onChange={(e) => setCampaignV2({
                                                ...campaignV2, 
                                                settings: { ...campaignV2.settings, background: { type: 'color', value: e.target.value } }
                                            })}
                                            className="bg-slate-950 border-slate-700 text-white flex-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mini Preview del Layout */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Previsualización Layout</h3>
                            <div className="aspect-video bg-slate-950 border border-slate-700 rounded-lg relative overflow-hidden">
                                {campaignV2.zones.map((zone, idx) => (
                                    <div 
                                        key={zone.id}
                                        style={{
                                            position: 'absolute',
                                            width: zone.width,
                                            height: zone.height,
                                            top: zone.top,
                                            left: zone.left,
                                            borderWidth: 1,
                                            borderColor: activeZoneIndex === idx ? '#4f46e5' : '#3f3f46',
                                            backgroundColor: activeZoneIndex === idx ? 'rgba(79,70,229,0.2)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onClick={() => setActiveZoneIndex(idx)}
                                        className="cursor-pointer transition-colors"
                                    >
                                        <Text className={`font-bold ${activeZoneIndex === idx ? 'text-indigo-400' : 'text-slate-600'}`}>Zona {idx + 1}</Text>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Middle Col: Timeline / Slides */}
                    <div className="lg:col-span-2 space-y-4">
                        
                        <Tabs value={activeZoneIndex.toString()} onValueChange={(val) => setActiveZoneIndex(parseInt(val))}>
                            <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start overflow-x-auto">
                                {campaignV2.zones.map((zone, idx) => (
                                    <TabsTrigger key={idx} value={idx.toString()} className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                        {zone.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center justify-between mt-4 mb-2">
                            <div>
                                <h2 className="text-xl font-bold text-white">Línea de Tiempo</h2>
                                <p className="text-sm text-slate-400">{activePlaylist.length} elementos • {totalDuration}s</p>
                            </div>
                            {!isAdding && (
                                <Button onClick={() => setIsAdding(true)} variant="outline" className="border-indigo-500 text-indigo-400 hover:bg-indigo-950">
                                    <Plus className="w-4 h-4 mr-2" /> Añadir a esta Zona
                                </Button>
                            )}
                        </div>

                        {activePlaylist.length === 0 && !isAdding && (
                            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center mt-4">
                                <LayoutList className="w-12 h-12 text-slate-600 mb-4" />
                                <h3 className="text-xl font-bold text-white">Zona Vacía</h3>
                                <p className="text-slate-400 mt-2 max-w-sm">Añade imágenes, videos, textos o códigos QR a esta sección de la pantalla.</p>
                                <Button onClick={() => setIsAdding(true)} className="mt-6 bg-indigo-600 hover:bg-indigo-700">
                                    Añadir Contenido
                                </Button>
                            </div>
                        )}

                        <div className="space-y-3 mt-4">
                            {activePlaylist.map((item, index) => (
                                <div key={item.id} className="flex items-stretch bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-slate-700 transition-colors">
                                    <div className="w-10 bg-slate-950 border-r border-slate-800 flex items-center justify-center cursor-grab text-slate-600 group-hover:text-slate-400">
                                        <GripVertical className="w-4 h-4" />
                                    </div>
                                    <div className="w-16 bg-slate-900/50 flex flex-col items-center justify-center border-r border-slate-800">
                                        <span className="text-2xl font-bold font-mono text-slate-700">{index + 1}</span>
                                    </div>
                                    <div className="flex-1 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden">
                                                {item.type === 'image' && item.url ? (
                                                    <img src={item.url} alt="thumb" className="w-full h-full object-cover" />
                                                ) : (
                                                    getTypeIcon(item.type)
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold">{item.content || 'Sin Título'}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{getTypeName(item.type)}</span>
                                                    {item.fitMode && (
                                                        <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{item.fitMode}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-1.5 text-sm font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-md border border-indigo-500/20">
                                                <Clock className="w-4 h-4" />
                                                {item.duration}s
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Col: Add Form */}
                    {isAdding && (
                        <div className="lg:col-span-1">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-6">
                                <h3 className="text-lg font-bold text-white mb-6">Añadir a {campaignV2.zones[activeZoneIndex]?.name}</h3>
                                <form onSubmit={handleAddItem} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Tipo de Contenido</Label>
                                        <Select value={newType} onValueChange={(val) => setNewType(val as UniversalElementType)}>
                                            <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                <SelectItem value="image">Imagen Directa</SelectItem>
                                                <SelectItem value="video">Video (MP4)</SelectItem>
                                                <SelectItem value="qr">Código QR Automático</SelectItem>
                                                <SelectItem value="text">Texto Simple</SelectItem>
                                                <SelectItem value="url">Sitio Web / URL Externa</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(newType === 'image' || newType === 'video' || newType === 'url') && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Título / Nombre Interno</Label>
                                            <Input
                                                value={newContent}
                                                onChange={(e) => setNewContent(e.target.value)}
                                                placeholder="Ej: Promo de Verano"
                                                className="bg-slate-950 border-slate-700 text-white"
                                                required={newType !== 'text'}
                                            />
                                        </div>
                                    )}

                                    {newType === 'text' && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Mensaje a mostrar</Label>
                                            <Input
                                                value={newContent}
                                                onChange={(e) => setNewContent(e.target.value)}
                                                placeholder="Ej: ¡Bienvenidos al evento!"
                                                className="bg-slate-950 border-slate-700 text-white"
                                                required
                                            />
                                            <div className="flex gap-2 mt-2">
                                                <div className="flex-1">
                                                    <Label className="text-slate-500 text-xs">Color de Texto</Label>
                                                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-full h-8 rounded bg-slate-950 border border-slate-700 mt-1" />
                                                </div>
                                                <div className="flex-1">
                                                    <Label className="text-slate-500 text-xs">Fondo</Label>
                                                    <input type="color" value={newBgColor} onChange={e => setNewBgColor(e.target.value)} className="w-full h-8 rounded bg-slate-950 border border-slate-700 mt-1" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {newType === 'qr' && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Dirección Web del QR</Label>
                                            <Input
                                                value={newUrl}
                                                onChange={(e) => setNewUrl(e.target.value)}
                                                placeholder="https://menu.restaurante.com"
                                                className="bg-slate-950 border-slate-700 text-white"
                                                required
                                            />
                                            <div className="space-y-2 mt-2">
                                                <Label className="text-slate-300">Subtítulo (Opcional)</Label>
                                                <Input
                                                    value={newContent}
                                                    onChange={(e) => setNewContent(e.target.value)}
                                                    placeholder="Escanea el Menú"
                                                    className="bg-slate-950 border-slate-700 text-white"
                                                />
                                            </div>
                                            <div className="flex-1 mt-2">
                                                <Label className="text-slate-500 text-xs">Fondo del QR</Label>
                                                <input type="color" value={newBgColor} onChange={e => setNewBgColor(e.target.value)} className="w-full h-8 rounded bg-slate-950 border border-slate-700 mt-1" />
                                            </div>
                                        </div>
                                    )}

                                    {(newType === 'image' || newType === 'video') && (
                                        <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <Label className="text-slate-300 font-bold flex items-center gap-2">
                                                <Upload className="w-4 h-4 text-indigo-400" />
                                                Subir Archivo a la Nube
                                            </Label>
                                            <input 
                                                type="file" 
                                                accept={newType === 'image' ? "image/*" : "video/mp4"}
                                                onChange={handleFileUpload}
                                                className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                                disabled={isUploading}
                                            />
                                            {isUploading && <p className="text-indigo-400 text-xs animate-pulse">Subiendo...</p>}
                                            {newUrl && !isUploading && <p className="text-emerald-400 text-xs flex items-center gap-1">✅ Archivo listo</p>}
                                        </div>
                                    )}

                                    {newType === 'url' && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Dirección Web (URL)</Label>
                                            <Input
                                                value={newUrl}
                                                onChange={(e) => setNewUrl(e.target.value)}
                                                placeholder="https://..."
                                                className="bg-slate-950 border-slate-700 text-white"
                                                required
                                            />
                                        </div>
                                    )}

                                    {(newType === 'image' || newType === 'video') && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300 flex items-center gap-2">
                                                <Settings2 className="w-4 h-4" /> Adaptación de Pantalla
                                            </Label>
                                            <Select value={newFitMode} onValueChange={(val) => setNewFitMode(val as DisplayFitMode)}>
                                                <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                    <SelectItem value="contain">CONTENER: Mostrar imagen completa</SelectItem>
                                                    <SelectItem value="cover">CUBRIR: Llenar pantalla completa</SelectItem>
                                                    <SelectItem value="fill">ESTIRAR: Deformar imagen al 100%</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Duración en Pantalla</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min="5"
                                                max="3600"
                                                value={newDuration}
                                                onChange={(e) => setNewDuration(e.target.value)}
                                                className="bg-slate-950 border-slate-700 text-white font-mono"
                                                required
                                            />
                                            <span className="text-slate-500 text-sm">segundos</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <Button type="button" variant="outline" onClick={() => setIsAdding(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                                            Cancelar
                                        </Button>
                                        <Button type="submit" disabled={((newType === 'image' || newType === 'video' || newType === 'url' || newType === 'qr') && !newUrl) || isUploading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                            Añadir
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default DisplayCampaignBuilder;
