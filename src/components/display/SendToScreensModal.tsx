import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Monitor, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { useDisplayDevices, useDisplayGroups, useAssignContentToDevice, useCreateCampaign, useUpdateCampaign, SyncMode } from '@/hooks/use-display-hub';
import { supabase } from '@/lib/supabase';
import { WallPreview } from '@/components/display/WallPreview';
import { previewItemsOf } from '@/lib/wallPreview';
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
    // Con varias pantallas: Espejo (todas iguales) u Olas (cada una atrasada).
    const [syncMode, setSyncMode] = useState<SyncMode>('mirror');
    const [waveStep, setWaveStep] = useState(10);
    const [waveOrder, setWaveOrder] = useState<string[]>([]);

    const { data: groups } = useDisplayGroups(commerceId);
    const { data: devices } = useDisplayDevices(commerceId);
    const assignContent = useAssignContentToDevice();
    const createCampaign = useCreateCampaign();
    const updateCampaign = useUpdateCampaign();

    const linkedDevices = useMemo(() => devices?.filter(d => d.derived_status !== 'pending') || [], [devices]);

    // Pantallas de destino, en el orden de la ola (el orden en que se eligieron,
    // o el que se acomode con las flechas).
    const targets = useMemo(() => {
        const list = targetType === 'zone'
            ? linkedDevices.filter(d => d.group_id === selectedZone)
            : selectedScreens.map(id => linkedDevices.find(d => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
        const rank = (id: string) => { const i = waveOrder.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
        return list.map((d, i) => ({ d, i })).sort((a, b) => rank(a.d.id) - rank(b.d.id) || a.i - b.i).map(x => x.d);
    }, [targetType, selectedZone, selectedScreens, linkedDevices, waveOrder]);

    // Mosaico: formas posibles para la cantidad de pantallas (columnas × filas).
    const wallShapes = useMemo(() => {
        const n = targets.length;
        const shapes: { cols: number; rows: number }[] = [];
        for (let rows = 1; rows <= n; rows++) {
            if (n % rows === 0 && n / rows <= 8 && rows <= 8) shapes.push({ cols: n / rows, rows });
        }
        return shapes;
    }, [targets.length]);
    const [wallShapeKey, setWallShapeKey] = useState('');
    const [wallFit, setWallFit] = useState<'cover' | 'contain'>('cover');
    const wallShape = wallShapes.find(sh => `${sh.cols}x${sh.rows}` === wallShapeKey) || wallShapes[0] || null;

    const moveTarget = (index: number, delta: number) => {
        const ids = targets.map(d => d.id);
        const j = index + delta;
        if (j < 0 || j >= ids.length) return;
        [ids[index], ids[j]] = [ids[j], ids[index]];
        setWaveOrder(ids);
    };

    const handleSend = async () => {
        if (selectedAssets.length === 0) return;
        
        const isMultiple = selectedAssets.length > 1;
        let campaignIdToAssign: string | null = null;
        let mediaIdToAssign: string | null = null;
        let scheduleIdToAssign: string | null = null;

        setIsSubmitting(true);

        try {
            const devicesToUpdate = targets;

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

            const synced = devicesToUpdate.length > 1;
            const step = Math.max(1, Math.round(waveStep) || 10);
            const promises = devicesToUpdate.map((device, i) =>
                assignContent.mutateAsync({
                    deviceId: device.id,
                    mediaId: mediaIdToAssign,
                    campaignId: campaignIdToAssign,
                    scheduleId: scheduleIdToAssign,
                    syncMode: synced ? syncMode : null,
                    syncOffsetS: synced && syncMode === 'wave' ? i * step : 0,
                    wall: synced && syncMode === 'wall' && wallShape ? { cols: wallShape.cols, rows: wallShape.rows, index: i, fit: wallFit } : null,
                })
            );

            const results = await Promise.all(promises);
            if (results.some(r => r.fitSkipped)) {
                toast.warning('Se envió en mosaico, pero recortando: para "Ajustar sin recortar" falta un paso en Supabase (ver docs/pantallas-sincronizadas.md).', { duration: 10000 });
            } else if (results.some(r => r.syncSkipped)) {
                toast.warning('Se envió, pero sin sincronizar las pantallas: falta un paso en Supabase (ver docs/pantallas-sincronizadas.md).', { duration: 10000 });
            } else {
                toast.success(`Contenido enviado a ${devicesToUpdate.length} pantalla(s)${synced ? ({ mirror: ' en espejo', wave: ' en olas', wall: ' en mosaico' } as const)[syncMode] : ''}`);
            }
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

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

                    {targets.length > 1 && (
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-slate-300">Cómo se ven las {targets.length} pantallas</p>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { id: 'mirror', label: 'Espejo', desc: 'Todas muestran lo mismo al mismo tiempo.' },
                                    { id: 'wave', label: 'Olas', desc: 'La misma lista, cada una unos segundos después.' },
                                    { id: 'wall', label: 'Mosaico', desc: 'Una imagen repartida entre todas.' },
                                ] as const).map(option => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSyncMode(option.id)}
                                        className={`rounded-xl border p-3 text-left transition-colors ${syncMode === option.id ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}
                                    >
                                        <span className={`block font-medium ${syncMode === option.id ? 'text-orange-400' : 'text-slate-200'}`}>{option.label}</span>
                                        <span className="block text-xs text-slate-400 mt-1">{option.desc}</span>
                                    </button>
                                ))}
                            </div>
                            {syncMode === 'wave' && (
                                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3">
                                    <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                                        Cada pantalla va
                                        <input
                                            type="number"
                                            min={1}
                                            max={600}
                                            value={waveStep}
                                            onChange={e => setWaveStep(Number(e.target.value))}
                                            className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                        />
                                        segundos después de la anterior
                                    </label>
                                    <ol className="space-y-1">
                                        {targets.map((device, i) => (
                                            <li key={device.id} className="flex items-center gap-2 text-sm">
                                                <span className="w-5 text-slate-500">{i + 1}.</span>
                                                <span className="flex-1 truncate text-slate-200">{device.name}</span>
                                                <span className="text-xs text-slate-400">{i === 0 ? 'primera' : `+${i * (Math.max(1, Math.round(waveStep) || 10))} s`}</span>
                                                <button type="button" onClick={() => moveTarget(i, -1)} disabled={i === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30" title="Subir">
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => moveTarget(i, 1)} disabled={i === targets.length - 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30" title="Bajar">
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ol>
                                    <p className="text-xs text-slate-500">Si ponés el mismo tiempo que dura cada foto, cada pantalla muestra una foto distinta.</p>
                                </div>
                            )}
                            {syncMode === 'wall' && wallShape && (
                                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {wallShapes.map(sh => {
                                            const key = `${sh.cols}x${sh.rows}`;
                                            const active = sh.cols === wallShape.cols && sh.rows === wallShape.rows;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setWallShapeKey(key)}
                                                    className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? 'border-orange-500/60 bg-orange-500/10 text-orange-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                                >
                                                    {sh.cols} × {sh.rows}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Cómo queda: la foto recortada como en las TV, con el lugar de cada pantalla. */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { id: 'cover', label: 'Llenar todo', desc: 'Sin franjas; recorta lo que sobra.' },
                                            { id: 'contain', label: 'Ajustar sin recortar', desc: 'Se ve completa, con franjas negras.' },
                                        ] as const).map(option => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setWallFit(option.id)}
                                                className={`rounded-lg border px-3 py-2 text-left ${wallFit === option.id ? 'border-orange-500/60 bg-orange-500/10' : 'border-slate-700 hover:bg-slate-800'}`}
                                            >
                                                <span className={`block text-xs font-medium ${wallFit === option.id ? 'text-orange-300' : 'text-slate-200'}`}>{option.label}</span>
                                                <span className="block text-[11px] text-slate-400">{option.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <WallPreview cols={wallShape.cols} rows={wallShape.rows} screens={targets} items={previewItemsOf(selectedAssets)} commerceId={commerceId} fit={wallFit} />
                                    <ol className="space-y-1">
                                        {targets.map((device, i) => (
                                            <li key={device.id} className="flex items-center gap-2 text-sm">
                                                <span className="w-5 text-slate-500">{i + 1}.</span>
                                                <span className="flex-1 truncate text-slate-200">{device.name}</span>
                                                <button type="button" onClick={() => moveTarget(i, -1)} disabled={i === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30" title="Antes">
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => moveTarget(i, 1)} disabled={i === targets.length - 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30" title="Después">
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
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
