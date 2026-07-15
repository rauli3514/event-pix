import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Monitor, Layers } from 'lucide-react';
import { useDisplayDevices, useDisplayGroups, useAssignContentToDevice, useCreateCampaign } from '@/hooks/use-display-hub';
import { toast } from 'sonner';

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

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];

    const handleSend = async () => {
        if (selectedAssets.length === 0) return;
        
        const isMultiple = selectedAssets.length > 1;
        let campaignIdToAssign: string | null = null;
        let mediaIdToAssign: string | null = null;
        let scheduleIdToAssign: string | null = null;

        setIsSubmitting(true);

        try {
            if (isMultiple) {
                // Crear campaña automáticamente en formato V2
                const campaignName = `Lista Rápida ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                
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
                    version: '2.0',
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

                const campaign = await createCampaign.mutateAsync({
                    commerceId,
                    name: campaignName,
                    description: 'Generada desde la biblioteca de medios',
                    items_json
                });
                
                campaignIdToAssign = campaign.id;
            } else {
                if (selectedAssets[0].type === 'schedule') {
                    scheduleIdToAssign = selectedAssets[0].id;
                } else if (selectedAssets[0].type === 'campaign') {
                    campaignIdToAssign = selectedAssets[0].id;
                } else {
                    mediaIdToAssign = selectedAssets[0].id;
                }
            }

            // Asignar
            const devicesToUpdate = targetType === 'zone' 
                ? linkedDevices.filter(d => d.group_id === selectedZone)
                : linkedDevices.filter(d => selectedScreens.includes(d.id));

            if (devicesToUpdate.length === 0) {
                toast.error('No hay pantallas en el destino seleccionado.');
                setIsSubmitting(false);
                return;
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
                            <strong>Nota:</strong> Al seleccionar múltiples archivos, se creará automáticamente una Lista de Reproducción con estos medios para que vayan rotando en las pantallas elegidas.
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
