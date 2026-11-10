import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Monitor, Layers } from 'lucide-react';
import { useDisplayDevices, useDisplayGroups, useAssignContentToDevice, useCreateCampaign, useUpdateCampaign } from '@/hooks/use-display-hub';
import { supabase } from '@/lib/supabase';
import type { DisplayCampaign } from '@/types/display';
import { toast } from 'sonner';

// Marca de las listas que se arman solas al mandar varios archivos juntos.
const QUICK_LIST_DESCRIPTION = 'Generada desde la biblioteca de medios';

// "Lista rápida 10/11 20:18"
const quickListName = (d = new Date()) =>
    `Lista rápida ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

// La lista rápida que ya tienen las pantallas elegidas, si se puede reemplazar:
// asignada directo a todas ellas y a ninguna otra pantalla.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reusableQuickList = (targets: any[], all: any[]): { id: string } | null => {
    const campaign = targets[0]?.assignment?.campaign;
    if (!campaign || campaign.description !== QUICK_LIST_DESCRIPTION) return null;
    const onAllTargets = targets.every(d => d.assignment?.device_id === d.id && d.assignment?.campaign_id === campaign.id);
    const onOthers = all.some(d => !targets.includes(d) && d.assignment?.campaign_id === campaign.id);
    return onAllTargets && !onOthers ? campaign : null;
};

// Si la lista está en alguna programación no se toca (se arma otra).
const usedInSchedules = async (campaignId: string): Promise<boolean> => {
    const [events, schedules] = await Promise.all([
        supabase.from('display_schedule_events').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
        supabase.from('display_schedules').select('id', { count: 'exact', head: true }).eq('default_campaign_id', campaignId),
    ]);
    if (events.error || schedules.error) return true;
    return (events.count || 0) + (schedules.count || 0) > 0;
};

interface SendToScreensModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAssets: any[];
    commerceId: string;
    onSuccess: () => void;
}

export const SendToScreensModal = ({ isOpen, onClose, selectedAssets, commerceId, onSuccess }: SendToScreensModalProps) => {
    const [targetType, setTargetType] = useState<'zone' | 'screens'>('zone');
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: groups } = useDisplayGroups(commerceId);
    const { data: devices } = useDisplayDevices(commerceId);
    const assignContent = useAssignContentToDevice();
    const createCampaign = useCreateCampaign();
    const updateCampaign = useUpdateCampaign();

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];

    const handleSend = async () => {
        if (selectedAssets.length === 0) return;
        
        const isMultiple = selectedAssets.length > 1;
        let campaignIdToAssign: string | null = null;
        let mediaIdToAssign: string | null = null;
        let scheduleIdToAssign: string | null = null;

        setIsSubmitting(true);

        try {
            const devicesToUpdate = targetType === 'zone'
                ? linkedDevices.filter(d => d.group_id === selectedZone)
                : linkedDevices.filter(d => selectedScreens.includes(d.id));

            if (devicesToUpdate.length === 0) {
                toast.error('No hay pantallas en el destino seleccionado.');
                setIsSubmitting(false);
                return;
            }

            if (isMultiple) {
                const playlist = selectedAssets.map(asset => ({
                    id: crypto.randomUUID(),
                    type: asset.type === 'web' ? 'url' : asset.type,
                    url: asset.url,
                    content: asset.name,
                    metadata: asset.metadata || {},
                    duration: asset.type === 'video' ? 15 : 10,
                    transition: 'fade',
                    fitMode: 'contain'
                }));

                const items_json = {
                    version: '2.0' as const,
                    settings: {
                        orientation: 'landscape',
                        background: { type: 'color', value: '#000000' },
                        shuffle: false,
                        transition: 'fade',
                        defaultDuration: 10
                    },
                    zones: [{
                        id: 'main',
                        playlist
                    }]
                };

                // Si esas pantallas ya pasan una lista rápida, se reemplaza su
                // contenido en vez de crear otra (antes se acumulaban listas sin usar).
                const previous = reusableQuickList(devicesToUpdate, devices || []);
                if (previous && !(await usedInSchedules(previous.id))) {
                    await updateCampaign.mutateAsync({ id: previous.id, updates: { name: quickListName(), items_json: items_json as unknown as DisplayCampaign['items_json'] } });
                    campaignIdToAssign = previous.id;
                } else {
                    const campaign = await createCampaign.mutateAsync({
                        commerceId,
                        name: quickListName(),
                        description: QUICK_LIST_DESCRIPTION,
                        items_json
                    });
                    campaignIdToAssign = campaign.id;
                }
            } else {
                if (selectedAssets[0].type === 'schedule') {
                    scheduleIdToAssign = selectedAssets[0].id;
                } else if (selectedAssets[0].type === 'campaign') {
                    campaignIdToAssign = selectedAssets[0].id;
                } else {
                    mediaIdToAssign = selectedAssets[0].id;
                }
            }

            const promises = devicesToUpdate.map(device => 
                assignContent.mutateAsync({
                    deviceId: device.id,
                    mediaId: mediaIdToAssign,
                    campaignId: campaignIdToAssign,
                    scheduleId: scheduleIdToAssign
                })
            );

            await Promise.all(promises);
            toast.success(`Contenido enviado a ${devicesToUpdate.length} pantalla(s)`);
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Error al enviar a las pantallas');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleScreen = (id: string) => {
        setSelectedScreens(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-950 border-slate-800 text-white shadow-2xl max-w-lg p-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex flex-row items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                        <Send className="w-5 h-5" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-semibold">Enviar a Pantallas</DialogTitle>
                        <p className="text-sm text-slate-400 mt-1">Seleccionaste {selectedAssets.length} archivo(s).</p>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button 
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${targetType === 'zone' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            onClick={() => setTargetType('zone')}
                        >
                            <Layers className="w-4 h-4" /> A una Zona
                        </button>
                        <button 
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${targetType === 'screens' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            onClick={() => setTargetType('screens')}
                        >
                            <Monitor className="w-4 h-4" /> Pantallas Específicas
                        </button>
                    </div>

                    {targetType === 'zone' ? (
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                            {groups?.length === 0 && (
                                <p className="text-center text-slate-500 py-4">No hay zonas creadas.</p>
                            )}
                            {groups?.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => setSelectedZone(group.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${selectedZone === group.id ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <span className="font-medium">{group.name}</span>
                                    <span className="text-xs opacity-50 bg-slate-950 px-2 py-1 rounded-full">
                                        {linkedDevices.filter(d => d.group_id === group.id).length} pantallas
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                            {linkedDevices.length === 0 && (
                                <p className="text-center text-slate-500 py-4">No hay pantallas vinculadas.</p>
                            )}
                            {linkedDevices.map(device => (
                                <button
                                    key={device.id}
                                    onClick={() => toggleScreen(device.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${selectedScreens.includes(device.id) ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <div>
                                        <span className="font-medium block">{device.name}</span>
                                        <span className="text-xs opacity-50 block mt-1">{device.group?.name || 'Sin Zona'}</span>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedScreens.includes(device.id) ? 'border-orange-500 bg-orange-500 text-slate-950' : 'border-slate-700'}`}>
                                        {selectedScreens.includes(device.id) && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedAssets.length > 1 && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 p-4 rounded-xl text-sm">
                            <strong>Nota:</strong> con varios archivos se arma una lista rápida que los pasa uno tras otro. Si la pantalla ya tenía una lista rápida, se reemplaza (no se acumulan listas).
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white" disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSend} 
                        className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                        disabled={isSubmitting || (targetType === 'zone' ? !selectedZone : selectedScreens.length === 0)}
                    >
                        {isSubmitting ? 'Enviando...' : 'Confirmar Envío'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
