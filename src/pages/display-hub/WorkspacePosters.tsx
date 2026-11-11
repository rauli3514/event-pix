import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Edit2, Megaphone, MoreVertical, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PosterEditor } from '@/components/display/posters/PosterEditor';
import { PosterView } from '@/components/display/posters/PosterView';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { useDeleteDisplayMedia, useDisplayMedia } from '@/hooks/use-display-media';
import { usePriceLists } from '@/hooks/use-price-lists';
import { describeDays, describeHours } from '@/lib/itemRules';
import { formatRatio, isPosterItem, type PosterConfig } from '@/lib/posters';
import type { DisplayMedia } from '@/types/display';

// Carteles: avisos armados con plantillas (promo, carta, oferta), con las
// listas de precios vinculadas. Se guardan en Medios como una app más.
export default function WorkspacePosters() {
    const { commerceId } = useParams();
    const { data: media = [], isLoading } = useDisplayMedia(commerceId);
    const { data: listsData } = usePriceLists(commerceId);
    const lists = listsData?.lists ?? [];
    const deleteMedia = useDeleteDisplayMedia();
    const posters = useMemo(() => media.filter(isPosterItem), [media]);

    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<DisplayMedia | null>(null);
    const [sending, setSending] = useState<DisplayMedia | null>(null);

    const openNew = () => { setEditing(null); setEditorOpen(true); };
    const openEdit = (p: DisplayMedia) => { setEditing(p); setEditorOpen(true); };
    const remove = async (p: DisplayMedia) => {
        if (!window.confirm(`¿Eliminar el cartel "${p.name}"? Si está en una playlist, deja de verse.`)) return;
        try {
            await deleteMedia.mutateAsync(p);
            toast.success('Cartel eliminado.');
        } catch {
            toast.error('No se pudo eliminar el cartel.');
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Carteles</h1>
                    <p className="text-sm md:text-base text-muted-foreground">
                        Promos, cartas y ofertas con diseños listos. Si usás una lista de precios, el cartel se actualiza solo cuando cambiás un precio.
                    </p>
                </div>
                <Button onClick={openNew} className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Nuevo cartel</Button>
            </div>

            {!isLoading && posters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <Megaphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium">Todavía no hiciste carteles</p>
                    <p className="text-sm text-muted-foreground mt-1">Elegí un diseño (carta, promo, oferta…), cambiá los textos y listo.</p>
                    <Button className="mt-4" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nuevo cartel</Button>
                </div>
            ) : (
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {posters.map(p => {
                        const config = p.metadata?.config as PosterConfig;
                        const ratio = formatRatio(config?.format);
                        const schedule = config?.schedule;
                        const hasSchedule = !!schedule && ((schedule.showDays?.length || 0) > 0 || !!(schedule.showFrom && schedule.showTo));
                        return (
                            <div key={p.id} className="group">
                                <button type="button" onClick={() => openEdit(p)} className="block w-full text-left">
                                    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black" style={{ paddingTop: `${Math.min(100 / ratio, 100)}%` }}>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-full" style={{ width: ratio < 1 ? `${ratio * 100}%` : '100%' }}>
                                                {config && <PosterView config={config} lists={lists} />}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                                <div className="mt-2 flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{p.name}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            {hasSchedule
                                                ? <><Clock className="w-3 h-3" /> {[describeDays(schedule?.showDays || []), schedule?.showFrom && schedule?.showTo ? describeHours(schedule.showFrom, schedule.showTo) : ''].filter(Boolean).join(' · ')}</>
                                                : 'Todo el día'}
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setSending(p)}><Send className="w-4 h-4 mr-1.5" /> Enviar</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Más opciones"><MoreVertical className="w-4 h-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEdit(p)}><Edit2 className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => remove(p)} className="text-rose-600"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                Los carteles también aparecen en Medios y se pueden sumar a cualquier playlist. Si tienen horario ("Cuándo aparece"), fuera de ese horario no salen y pasa lo demás.
            </p>

            {commerceId && (
                <PosterEditor open={editorOpen} onClose={() => setEditorOpen(false)} commerceId={commerceId} editing={editing} />
            )}
            {commerceId && sending && (
                <SendToScreensModal
                    isOpen={!!sending}
                    onClose={() => setSending(null)}
                    selectedAssets={[sending]}
                    commerceId={commerceId}
                    onSuccess={() => setSending(null)}
                />
            )}
        </div>
    );
}
