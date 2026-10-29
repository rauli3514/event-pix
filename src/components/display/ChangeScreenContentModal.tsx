import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAssignContentToDevice, useDisplayCampaigns, useDisplaySchedules } from '@/hooks/use-display-hub';
import { playlistItems } from '@/lib/playlistItems';
import { ContentThumb } from '@/components/display/ContentThumb';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    device: { id: string; name: string } | null;
    // Lo que tiene asignado ahora, para marcarlo.
    currentCampaignId?: string | null;
    currentScheduleId?: string | null;
}

// "Cambiar contenido" desde Inicio: elegir qué playlist (o programación) pasa una pantalla.
export function ChangeScreenContentModal({ isOpen, onClose, commerceId, device, currentCampaignId, currentScheduleId }: Props) {
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const { data: schedules = [] } = useDisplaySchedules(commerceId);
    const assign = useAssignContentToDevice();
    const [busyId, setBusyId] = useState<string | null>(null);

    const choose = async (target: { campaignId?: string; scheduleId?: string; name: string }) => {
        if (!device) return;
        setBusyId(target.campaignId || target.scheduleId || null);
        try {
            await assign.mutateAsync({
                deviceId: device.id,
                campaignId: target.campaignId || null,
                scheduleId: target.scheduleId || null,
                mediaId: null,
            });
            toast.success(`${device.name} pasa "${target.name}" en unos segundos`);
            onClose();
        } catch {
            toast.error('No se pudo cambiar el contenido. Probá de nuevo.');
        } finally {
            setBusyId(null);
        }
    };

    const rowClass = (current: boolean) =>
        `w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${current
            ? 'border-indigo-500/60 bg-indigo-500/5'
            : 'border-border bg-background/60 hover:border-indigo-500/60 hover:bg-indigo-500/5'}`;

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>¿Qué querés que muestre {device?.name}?</DialogTitle>
                    <DialogDescription>Elegí una playlist. La pantalla deja lo que muestra y la pasa en segundos.</DialogDescription>
                </DialogHeader>

                <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
                    {campaigns.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Todavía no tenés playlists.</p>
                    )}
                    {campaigns.map(c => {
                        const items = playlistItems(c.items_json);
                        const current = c.id === currentCampaignId && !currentScheduleId;
                        const empty = items.length === 0;
                        return (
                            <button key={c.id} type="button" disabled={busyId !== null || empty} title={empty ? 'Está vacía: agregale contenido desde Playlists' : undefined} onClick={() => choose({ campaignId: c.id, name: c.name })} className={rowClass(current)}>
                                <span className="flex gap-0.5 shrink-0 rounded-md overflow-hidden">
                                    {[0, 1, 2].map(i => (
                                        items[i]
                                            ? <ContentThumb key={i} item={items[i]} className="w-10 h-7" iconClassName="w-3.5 h-3.5" />
                                            : <span key={i} className="w-10 h-7 bg-muted" />
                                    ))}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-medium truncate">{c.name}</span>
                                    <span className="block text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'elemento' : 'elementos'}</span>
                                </span>
                                {current
                                    ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" /> La pasa ahora</span>
                                    : empty
                                        ? <span className="text-xs text-muted-foreground shrink-0">Vacía</span>
                                        : <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 shrink-0">{busyId === c.id ? 'Cambiando…' : 'Elegir'}</span>}
                            </button>
                        );
                    })}

                    {schedules.length > 0 && (
                        <>
                            <p className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">O una programación (cambia sola según la hora)</p>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {schedules.map((s: any) => {
                                const current = s.id === currentScheduleId;
                                return (
                                    <button key={s.id} type="button" disabled={busyId !== null} onClick={() => choose({ scheduleId: s.id, name: s.name || 'Programación' })} className={rowClass(current)}>
                                        <span className="w-10 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                                            <CalendarClock className="w-4 h-4 text-muted-foreground" />
                                        </span>
                                        <span className="flex-1 min-w-0 text-sm font-medium truncate">{s.name || 'Programación'}</span>
                                        {current
                                            ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" /> La usa ahora</span>
                                            : <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 shrink-0">{busyId === s.id ? 'Cambiando…' : 'Elegir'}</span>}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>

                <Link
                    to={`/admin/display/commerce/${commerceId}/workspace/playlists?nueva=1`}
                    className="flex items-center justify-center gap-1.5 border-t border-border pt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    <Plus className="w-4 h-4" /> Armar una playlist nueva
                </Link>
            </DialogContent>
        </Dialog>
    );
}
