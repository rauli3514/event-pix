import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, PlaySquare, Globe, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { useCreateSchedule, useUpdateSchedule } from '@/hooks/use-display-hub';
import { toast } from 'sonner';
import { AssetSelectorModal } from './AssetSelectorModal';

interface ScheduleBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    existingSchedule?: any; // If editing
    onSaved?: () => void;
}

const DAYS = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'X' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 0, label: 'D' },
];

export const ScheduleBuilderModal = ({ isOpen, onClose, commerceId, existingSchedule, onSaved }: ScheduleBuilderModalProps) => {
    const createSchedule = useCreateSchedule();
    const updateSchedule = useUpdateSchedule();

    const [name, setName] = useState('');
    const [defaultAsset, setDefaultAsset] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);

    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [assetModalTarget, setAssetModalTarget] = useState<'default' | number | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (existingSchedule) {
                setName(existingSchedule.name || '');
                
                // Load default asset
                if (existingSchedule.default_campaign) {
                    setDefaultAsset({ id: existingSchedule.default_campaign.id, type: 'campaign', name: existingSchedule.default_campaign.name });
                } else if (existingSchedule.default_media) {
                    setDefaultAsset({ id: existingSchedule.default_media.id, type: existingSchedule.default_media.type, name: existingSchedule.default_media.name, url: existingSchedule.default_media.url });
                } else {
                    setDefaultAsset(null);
                }

                // Load events
                setEvents((existingSchedule.events || []).map((ev: any) => ({
                    asset: ev.campaign ? { id: ev.campaign.id, type: 'campaign', name: ev.campaign.name } :
                           ev.media ? { id: ev.media.id, type: ev.media.type, name: ev.media.name, url: ev.media.url } : null,
                    startTime: ev.start_time,
                    endTime: ev.end_time,
                    daysOfWeek: ev.days_of_week || []
                })));
            } else {
                setName('');
                setDefaultAsset(null);
                setEvents([]);
            }
        }
    }, [isOpen, existingSchedule]);

    const handleAddEvent = () => {
        setEvents([...events, {
            asset: null,
            startTime: '09:00',
            endTime: '12:00',
            daysOfWeek: [1,2,3,4,5] // Lun-Vie by default
        }]);
    };

    const handleRemoveEvent = (index: number) => {
        setEvents(events.filter((_, i) => i !== index));
    };

    const handleUpdateEvent = (index: number, field: string, value: any) => {
        const newEvents = [...events];
        newEvents[index] = { ...newEvents[index], [field]: value };
        setEvents(newEvents);
    };

    const handleAssetSelect = (asset: any) => {
        if (assetModalTarget === 'default') {
            setDefaultAsset(asset);
        } else if (typeof assetModalTarget === 'number') {
            handleUpdateEvent(assetModalTarget, 'asset', asset);
        }
        setIsAssetModalOpen(false);
    };

    const handleSave = async () => {
        if (!name.trim()) return toast.error("Por favor ingresa un nombre para el horario");
        if (events.some(e => !e.asset)) return toast.error("Todos los eventos deben tener un contenido seleccionado");
        if (events.some(e => e.daysOfWeek.length === 0)) return toast.error("Todos los eventos deben tener al menos un día seleccionado");
        
        try {
            const eventsPayload = events.map(ev => ({
                mediaId: ev.asset.type !== 'campaign' ? ev.asset.id : null,
                campaignId: ev.asset.type === 'campaign' ? ev.asset.id : null,
                startTime: ev.startTime,
                endTime: ev.endTime,
                daysOfWeek: ev.daysOfWeek
            }));

            if (existingSchedule) {
                await updateSchedule.mutateAsync({
                    id: existingSchedule.id,
                    updates: {
                        name,
                        default_media_id: defaultAsset?.type !== 'campaign' ? defaultAsset?.id : null,
                        default_campaign_id: defaultAsset?.type === 'campaign' ? defaultAsset?.id : null,
                    },
                    newEvents: eventsPayload
                });
                toast.success('Horario actualizado correctamente');
            } else {
                await createSchedule.mutateAsync({
                    commerceId,
                    name,
                    defaultMediaId: defaultAsset?.type !== 'campaign' ? defaultAsset?.id : null,
                    defaultCampaignId: defaultAsset?.type === 'campaign' ? defaultAsset?.id : null,
                    events: eventsPayload
                });
                toast.success('Horario creado correctamente');
            }
            onSaved?.();
            onClose();
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        }
    };

    const renderAssetBox = (asset: any, onClick: () => void, placeholder: string) => (
        !asset ? (
            <Button 
                variant="outline" 
                className="w-full h-16 border-dashed border-2 border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-start gap-3 px-4"
                onClick={onClick}
            >
                <LayoutGrid className="w-5 h-5 shrink-0" />
                <span className="truncate">{placeholder}</span>
            </Button>
        ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-2 flex gap-3 items-center group relative shadow-sm hover:border-indigo-300 transition-colors cursor-pointer" onClick={onClick}>
                <div className="w-12 h-12 rounded bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                    {asset.type === 'image' && <img src={asset.url} alt="preview" className="w-full h-full object-cover" />}
                    {asset.type === 'video' && <PlaySquare className="w-5 h-5 text-violet-400" />}
                    {asset.type === 'campaign' && <PlaySquare className="w-5 h-5 text-emerald-400" />}
                    {asset.type === 'web' && <Globe className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{asset.name}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{asset.type === 'campaign' ? 'Playlist' : asset.type}</p>
                </div>
            </div>
        )
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-3xl p-0 overflow-hidden rounded-xl w-[95vw] h-[90dvh] md:h-[80vh] flex flex-col">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <DialogTitle className="text-xl font-bold">{existingSchedule ? 'Editar Horario' : 'Nuevo Horario'}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
                    
                    {/* General */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div>
                            <Label className="text-slate-700 font-semibold mb-1.5 block">Nombre del Horario</Label>
                            <Input 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="Ej: Horario Sucursal Centro" 
                                className="bg-slate-50"
                            />
                        </div>
                        
                        <div>
                            <Label className="text-slate-700 font-semibold mb-1.5 block">Contenido Predeterminado (Para rellenar huecos)</Label>
                            <p className="text-xs text-slate-500 mb-3">Este contenido se reproducirá en la pantalla siempre que no haya un evento activo.</p>
                            {renderAssetBox(defaultAsset, () => {
                                setAssetModalTarget('default');
                                setIsAssetModalOpen(true);
                            }, "Seleccionar contenido predeterminado")}
                        </div>
                    </div>

                    {/* Events */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Eventos Programados</h3>
                                <p className="text-xs text-slate-500">Los eventos interrumpirán el contenido predeterminado en las fechas y horas indicadas.</p>
                            </div>
                            <Button onClick={handleAddEvent} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                <Plus className="w-4 h-4" /> Agregar Evento
                            </Button>
                        </div>

                        {events.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">No hay eventos agregados. La pantalla mostrará siempre el contenido predeterminado.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {events.map((ev, index) => (
                                    <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center relative">
                                        <div className="w-full md:w-1/3 shrink-0">
                                            <Label className="text-xs text-slate-500 mb-1 block">Contenido</Label>
                                            {renderAssetBox(ev.asset, () => {
                                                setAssetModalTarget(index);
                                                setIsAssetModalOpen(true);
                                            }, "Elegir contenido...")}
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col md:flex-row gap-4 w-full">
                                            <div className="flex-1">
                                                <Label className="text-xs text-slate-500 mb-1 block">Días de la semana</Label>
                                                <div className="flex gap-1 flex-wrap">
                                                    {DAYS.map(day => (
                                                        <button
                                                            key={day.value}
                                                            onClick={() => {
                                                                const newDays = ev.daysOfWeek.includes(day.value)
                                                                    ? ev.daysOfWeek.filter((d: number) => d !== day.value)
                                                                    : [...ev.daysOfWeek, day.value];
                                                                handleUpdateEvent(index, 'daysOfWeek', newDays);
                                                            }}
                                                            className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                                                                ev.daysOfWeek.includes(day.value)
                                                                    ? 'bg-indigo-600 text-white'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 shrink-0">
                                                <div>
                                                    <Label className="text-xs text-slate-500 mb-1 block">Desde</Label>
                                                    <Input 
                                                        type="time" 
                                                        value={ev.startTime}
                                                        onChange={e => handleUpdateEvent(index, 'startTime', e.target.value)}
                                                        className="w-[110px]"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-slate-500 mb-1 block">Hasta</Label>
                                                    <Input 
                                                        type="time" 
                                                        value={ev.endTime}
                                                        onChange={e => handleUpdateEvent(index, 'endTime', e.target.value)}
                                                        className="w-[110px]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleRemoveEvent(index)}
                                            className="absolute top-2 right-2 md:static text-slate-400 hover:text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
                    <Button variant="ghost" onClick={onClose} className="text-slate-600">Cancelar</Button>
                    <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]" disabled={createSchedule.isPending || updateSchedule.isPending}>
                        {createSchedule.isPending || updateSchedule.isPending ? 'Guardando...' : 'Guardar Horario'}
                    </Button>
                </div>
            </DialogContent>

            <AssetSelectorModal 
                isOpen={isAssetModalOpen} 
                onClose={() => setIsAssetModalOpen(false)} 
                onSelect={handleAssetSelect}
            />
        </Dialog>
    );
};
