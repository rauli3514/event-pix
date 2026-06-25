import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, MapPin, MonitorPlay } from 'lucide-react';
import { DisplayDeviceWithStatus, useDisplayCampaigns } from '@/hooks/use-display-hub';
import { AssetSelectorModal } from './AssetSelectorModal';
import { ScheduleContentModal } from './ScheduleContentModal';
import { toast } from 'sonner';

interface EditScreenModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: DisplayDeviceWithStatus | null;
    linkGroups: any[];
    commerceId?: string;
    onSave: (deviceId: string, updates: any, asset: any | null) => void;
}

export const EditScreenModal = ({ isOpen, onClose, device, linkGroups, commerceId, onSave }: EditScreenModalProps) => {
    const [name, setName] = useState('');
    const [groupId, setGroupId] = useState('none');
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const [contentType, setContentType] = useState('asset');
    const [selectedPlaylistId, setSelectedPlaylistId] = useState('none');
    const [orientation, setOrientation] = useState('0');
    const [location, setLocation] = useState('');
    const [showDownloading, setShowDownloading] = useState(true);
    const [preloadAssets, setPreloadAssets] = useState(true);

    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // Load campaigns for playlist dropdown
    const { data: campaigns } = useDisplayCampaigns(commerceId || device?.commerce_id || '');

    useEffect(() => {
        if (device) {
            setName(device.name || '');
            setGroupId(device.group_id || 'none');
            if (device.assignment?.campaign) {
                setSelectedAsset({ ...device.assignment.campaign, type: 'campaign' });
                setSelectedPlaylistId(device.assignment.campaign.id);
                setContentType('playlist');
            } else if (device.assignment?.media) {
                setSelectedAsset({ ...device.assignment.media, type: device.assignment.media.type || 'asset' });
                setSelectedPlaylistId('none');
                setContentType('asset');
            } else {
                setSelectedAsset(null);
                setSelectedPlaylistId('none');
                setContentType('asset');
            }
            setOrientation(device.orientation || '0');
            setShowAdvanced(false);
        }
    }, [device]);

    const handlePlaylistChange = (id: string) => {
        setSelectedPlaylistId(id);
        if (id === 'none') {
            setSelectedAsset(null);
        } else {
            const campaign = campaigns?.find(c => c.id === id);
            if (campaign) setSelectedAsset({ ...campaign, type: 'campaign' });
        }
    };

    const handleSave = () => {
        if (!device) return;
        if (contentType !== 'stop' && !selectedAsset) {
            toast.error("Por favor, selecciona un contenido");
            return;
        }
        
        onSave(device.id, {
            name,
            group_id: groupId === 'none' ? null : groupId,
            orientation
        }, contentType === 'stop' ? null : selectedAsset);
    };

    if (!device) return null;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-2xl p-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-row items-center justify-between">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <MonitorPlay className="w-5 h-5 text-slate-500" />
                        Editar Pantalla "{device.name}"
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                    {/* General Section */}
                    <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Nombre del Dispositivo <span className="text-rose-500">*</span></Label>
                        <Input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="border-emerald-500 focus-visible:ring-emerald-500 shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Etiquetas (Zona)</Label>
                        <Select value={groupId} onValueChange={setGroupId}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue placeholder="Seleccionar zona..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin Zona Asignada</SelectItem>
                                {linkGroups?.map(g => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Tipo de Contenido <span className="text-rose-500">*</span></Label>
                        <Select value={contentType} onValueChange={(v) => { setContentType(v); setSelectedAsset(null); setSelectedPlaylistId('none'); }}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="asset">Archivo</SelectItem>
                                <SelectItem value="playlist">Lista de Reproducción</SelectItem>
                                <SelectItem value="schedule">Programación</SelectItem>
                                <SelectItem value="stop">Detener Reproducción</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Contenido - varía según el tipo */}
                    <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Contenido Seleccionado <span className="text-rose-500">*</span></Label>
                        {contentType === 'playlist' ? (
                            // Playlist: dropdown directo con campañas disponibles
                            <Select value={selectedPlaylistId} onValueChange={handlePlaylistChange}>
                                <SelectTrigger className="w-full shadow-sm bg-white">
                                    <SelectValue placeholder="Seleccionar lista..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Sin Asignar --</SelectItem>
                                    {campaigns?.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : contentType === 'asset' ? (
                            // Archivo: botón Cambiar que abre el selector
                            <div className="flex gap-2">
                                <Input 
                                    value={selectedAsset ? selectedAsset.name : "Sin asignar"} 
                                    readOnly 
                                    className="shadow-sm bg-slate-50 text-slate-600" 
                                />
                                <Button 
                                    onClick={() => setIsAssetModalOpen(true)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 shadow-sm"
                                >
                                    Cambiar
                                </Button>
                            </div>
                        ) : (
                            // Programación / Detener: mensaje informativo
                            <div className="text-sm text-slate-400 italic py-2">
                                {contentType === 'stop' ? 'La pantalla dejará de reproducir contenido.' : 'Configura el horario en la sección de abajo.'}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                        <Label className="text-right text-slate-500 font-medium">Rotación de Pantalla (Grados)</Label>
                        <Select value={orientation} onValueChange={setOrientation}>
                            <SelectTrigger className="w-full shadow-sm bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">0° (Horizontal/Normal)</SelectItem>
                                <SelectItem value="90">90° (Vertical Derecha)</SelectItem>
                                <SelectItem value="180">180° (Horizontal Invertido)</SelectItem>
                                <SelectItem value="270">270° (Vertical Izquierda)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Operational Schedule Section */}
                    <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
                        <button className="w-full px-4 py-3 bg-slate-50 flex items-center gap-2 hover:bg-slate-100 transition-colors">
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                            <span className="font-semibold text-slate-700">Horario de Funcionamiento</span>
                            <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center ml-1">
                                <span className="text-[10px] text-slate-400">i</span>
                            </div>
                        </button>
                    </div>

                    {/* Advanced Section */}
                    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full px-4 py-3 bg-slate-50 flex items-center gap-2 hover:bg-slate-100 transition-colors border-b border-slate-100"
                        >
                            {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            <span className="font-semibold text-slate-700">Avanzado</span>
                        </button>
                        
                        {showAdvanced && (
                            <div className="p-6 space-y-6 bg-white">
                                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium">Ubicación Funcional</Label>
                                    <div className="flex gap-2">
                                        <Input defaultValue="Ubicación Principal" className="shadow-sm" />
                                        <Button variant="outline" className="shrink-0 bg-white shadow-sm border-slate-200">Cambiar</Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium">Ubicación Geográfica</Label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                        <Input 
                                            placeholder="ej. Mendoza, AR" 
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="pl-9 shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium">Tipo de Fondo</Label>
                                    <Select defaultValue="default">
                                        <SelectTrigger className="shadow-sm bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Predeterminado</SelectItem>
                                            <SelectItem value="color">Color Sólido</SelectItem>
                                            <SelectItem value="image">Imagen Personalizada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-[160px_1fr] items-center gap-4 pt-4 border-t border-slate-100">
                                    <Label className="text-right text-slate-500 font-medium leading-tight">Mostrar Estado de Descarga</Label>
                                    <Switch 
                                        checked={showDownloading} 
                                        onCheckedChange={setShowDownloading} 
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                                    <Label className="text-right text-slate-500 font-medium leading-tight">Precargar Archivos en Playlist</Label>
                                    <Switch 
                                        checked={preloadAssets} 
                                        onCheckedChange={setPreloadAssets} 
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex sm:justify-between items-center w-full">
                    <div className="flex items-center text-slate-400 cursor-help hover:text-slate-600">
                        <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center font-bold text-xs mr-2">
                            ?
                        </div>
                        <Button variant="ghost" size="sm" className="px-0 hover:bg-transparent">Vista Previa</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                            Cerrar
                        </Button>
                        <Button 
                            variant="outline" 
                            className="border-slate-200 shadow-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            disabled={!selectedAsset}
                            onClick={() => setIsScheduleModalOpen(true)}
                        >
                            Programar
                        </Button>
                        <div className="flex rounded-md shadow-sm">
                            <Button onClick={handleSave} className="bg-emerald-400 hover:bg-emerald-500 text-white rounded-r-none px-6 shadow-sm border-r border-emerald-500/20">
                                Guardar
                            </Button>
                            <Button className="bg-emerald-400 hover:bg-emerald-500 text-white rounded-l-none px-2 shadow-sm border-l border-emerald-300">
                                <ChevronDown className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AssetSelectorModal 
            isOpen={isAssetModalOpen} 
            onClose={() => setIsAssetModalOpen(false)} 
            onSelect={(asset) => setSelectedAsset(asset)}
        />
        <ScheduleContentModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            asset={selectedAsset}
            device={device}
            commerceId={commerceId || device?.commerce_id || ''}
            onScheduled={() => setIsScheduleModalOpen(false)}
        />
        </>
    );
};
