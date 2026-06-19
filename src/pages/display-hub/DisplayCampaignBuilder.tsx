import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Clock, Link as LinkIcon, Image as ImageIcon, Camera, LayoutList, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayCampaigns, useUpdateCampaign } from "@/hooks/use-display-hub";
import { CampaignItem, CampaignItemType } from '@/types/display';

const DisplayCampaignBuilder = () => {
    const { commerceId, campaignId } = useParams<{ commerceId: string, campaignId: string }>();
    const navigate = useNavigate();
    const isSuperAdmin = useIsSuperAdmin();

    const { data: campaigns, isLoading } = useDisplayCampaigns(commerceId);
    const updateCampaign = useUpdateCampaign();

    const campaign = campaigns?.find(c => c.id === campaignId);

    const [items, setItems] = useState<CampaignItem[]>([]);
    
    // New Slide Form State
    const [isAdding, setIsAdding] = useState(false);
    const [newType, setNewType] = useState<CampaignItemType>('external_url');
    const [newDuration, setNewDuration] = useState('30');
    const [newUrl, setNewUrl] = useState('');
    const [newTitle, setNewTitle] = useState('');

    if (isSuperAdmin === false) {
        navigate('/admin', { replace: true });
        return null;
    }

    useEffect(() => {
        if (campaign && campaign.items_json) {
            setItems(campaign.items_json);
        }
    }, [campaign]);

    const handleSave = () => {
        if (!campaignId) return;
        updateCampaign.mutate({ id: campaignId, updates: { items_json: items } }, {
            onSuccess: () => toast.success('Campaña guardada. Las pantallas se actualizarán pronto.'),
            onError: () => toast.error('Error al guardar la campaña')
        });
    };

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const durationNum = parseInt(newDuration, 10) || 30;
        
        const newItem: CampaignItem = {
            id: crypto.randomUUID(),
            type: newType,
            duration: durationNum,
            title: newTitle || 'Nueva Diapositiva',
            url: newType === 'external_url' ? newUrl : undefined,
            imageUrl: newType === 'image_ad' ? newUrl : undefined, // Simplification for now
        };

        setItems([...items, newItem]);
        setIsAdding(false);
        setNewUrl('');
        setNewTitle('');
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'external_url': return <LinkIcon className="w-5 h-5 text-blue-400" />;
            case 'image_ad': return <ImageIcon className="w-5 h-5 text-emerald-400" />;
            case 'event_photos': return <Camera className="w-5 h-5 text-purple-400" />;
            default: return <LayoutList className="w-5 h-5 text-slate-400" />;
        }
    };

    const getTypeName = (type: string) => {
        switch (type) {
            case 'external_url': return 'Sitio Web Externo';
            case 'image_ad': return 'Banner Publicitario (Imagen)';
            case 'event_photos': return 'Galería de EventPix';
            case 'event_ranking': return 'Ranking de EventPix';
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

    const totalDuration = items.reduce((acc, item) => acc + item.duration, 0);

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-slate-200">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <Button variant="ghost" asChild className="mb-2 text-slate-400 hover:text-white hover:bg-slate-800 -ml-4">
                            <Link to={`/admin/display/commerce/${commerceId}/campaigns`}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Campañas
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <LayoutList className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                    Editor: {campaign.name}
                                </h1>
                                <p className="text-slate-400 text-sm mt-1">{items.length} diapositivas • {totalDuration} segundos en total</p>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={updateCampaign.isPending} className="bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                        <Save className="w-4 h-4 mr-2" /> {updateCampaign.isPending ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Col: Timeline / Slides */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold text-white">Línea de Tiempo (Playlist)</h2>
                            {!isAdding && (
                                <Button onClick={() => setIsAdding(true)} variant="outline" className="border-indigo-500 text-indigo-400 hover:bg-indigo-950">
                                    <Plus className="w-4 h-4 mr-2" /> Añadir Diapositiva
                                </Button>
                            )}
                        </div>

                        {items.length === 0 && !isAdding && (
                            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center">
                                <LayoutList className="w-12 h-12 text-slate-600 mb-4" />
                                <h3 className="text-xl font-bold text-white">Tu campaña está vacía</h3>
                                <p className="text-slate-400 mt-2 max-w-sm">Añade diapositivas (fotos, publicidad, URLs) para comenzar a armar tu rotación.</p>
                                <Button onClick={() => setIsAdding(true)} className="mt-6 bg-indigo-600 hover:bg-indigo-700">
                                    Comenzar ahora
                                </Button>
                            </div>
                        )}

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={item.id} className="flex items-stretch bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-slate-700 transition-colors">
                                    <div className="w-10 bg-slate-950 border-r border-slate-800 flex items-center justify-center cursor-grab text-slate-600 group-hover:text-slate-400">
                                        <GripVertical className="w-4 h-4" />
                                    </div>
                                    <div className="w-16 bg-slate-900/50 flex flex-col items-center justify-center border-r border-slate-800">
                                        <span className="text-2xl font-bold font-mono text-slate-700">{index + 1}</span>
                                    </div>
                                    <div className="flex-1 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                                                {getTypeIcon(item.type)}
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold">{item.title || 'Diapositiva'}</h4>
                                                <p className="text-xs text-slate-400">{getTypeName(item.type)}</p>
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
                                <h3 className="text-lg font-bold text-white mb-6">Añadir Diapositiva</h3>
                                <form onSubmit={handleAddItem} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Tipo de Contenido</Label>
                                        <Select value={newType} onValueChange={(val) => setNewType(val as CampaignItemType)}>
                                            <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                <SelectItem value="external_url">Sitio Web Externo</SelectItem>
                                                <SelectItem value="image_ad">Imagen / Publicidad</SelectItem>
                                                <SelectItem value="event_photos">Galería de EventPix (Próximamente)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Nombre / Título Interno</Label>
                                        <Input
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            placeholder="Ej: Promo 2x1 Cerveza"
                                            className="bg-slate-950 border-slate-700 text-white"
                                            required
                                        />
                                    </div>

                                    {(newType === 'external_url' || newType === 'image_ad') && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">{newType === 'image_ad' ? 'URL de la Imagen' : 'URL del Sitio Web'}</Label>
                                            <Input
                                                value={newUrl}
                                                onChange={(e) => setNewUrl(e.target.value)}
                                                placeholder="https://..."
                                                className="bg-slate-950 border-slate-700 text-white"
                                                required
                                            />
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
                                        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
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
