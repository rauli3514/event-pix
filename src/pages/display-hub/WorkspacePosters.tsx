import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, Clock, Edit2, LayoutGrid, MoreVertical, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PosterEditor } from '@/components/display/posters/PosterEditor';
import { PosterView } from '@/components/display/posters/PosterView';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { useDeleteDisplayMedia, useDisplayMedia } from '@/hooks/use-display-media';
import { usePriceLists } from '@/hooks/use-price-lists';
import { describeDays, describeHours } from '@/lib/itemRules';
import { cn } from '@/lib/utils';
import {
    BLANK_TEMPLATE, POSTER_TEMPLATES, configFromTemplate, formatRatio, isPosterItem,
    type PosterConfig, type PosterTemplate,
} from '@/lib/posters';

// Los diseños que se muestran en el banner (los demás, en "Ver todos").
const FEATURED = ['hamburguesas', 'pintas', 'helados-precios', 'nueva-temporada', 'ofertas-semana', 'consolas', 'vinos', 'gym-planes', 'liquidacion'];
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
    const [startTemplate, setStartTemplate] = useState<PosterTemplate | null>(null);
    const [sending, setSending] = useState<DisplayMedia | null>(null);

    const openNew = (t: PosterTemplate | null = null) => { setEditing(null); setStartTemplate(t); setEditorOpen(true); };
    const openEdit = (p: DisplayMedia) => { setEditing(p); setStartTemplate(null); setEditorOpen(true); };
    const featured = FEATURED.map(id => POSTER_TEMPLATES.find(t => t.id === id)).filter(Boolean) as PosterTemplate[];
    const compact = posters.length > 0;
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
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Carteles</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    Promos, cartas y ofertas para tus pantallas. Si usás una lista de precios, el cartel se actualiza solo cuando cambiás un precio.
                </p>
            </div>

            {/* Banner: invita a armar el propio, con algunos de nuestros diseños. */}
            <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg">
                <div className={cn('relative space-y-4', compact ? 'p-4 md:p-5' : 'p-5 md:p-8')}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <div className="space-y-1">
                            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold"><Sparkles className="w-3.5 h-3.5" /> Diseños listos</p>
                            <h2 className={cn('font-extrabold tracking-tight', compact ? 'text-xl' : 'text-2xl md:text-3xl')}>Armá tu cartel en un minuto</h2>
                            <p className="text-sm text-white/85 max-w-xl">Hay más de 50 diseños para comidas, bares, heladerías, moda, almacenes, videojuegos, vinotecas y gimnasios. Tocá uno y cambiá los textos, las fotos y los precios, o empezá de cero.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <Button onClick={() => openNew(BLANK_TEMPLATE)} className="bg-white text-indigo-700 hover:bg-white/90"><Plus className="w-4 h-4 mr-1.5" /> Empezar de cero</Button>
                            <Button variant="ghost" onClick={() => openNew(null)} className="text-white hover:bg-white/15 hover:text-white border border-white/40"><LayoutGrid className="w-4 h-4 mr-1.5" /> Ver todos los diseños</Button>
                        </div>
                    </div>
                    <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 px-1 snap-x">
                        {featured.map(t => (
                            <button key={t.id} type="button" onClick={() => openNew(t)}
                                className={cn('group shrink-0 snap-start text-left', compact ? 'w-44 md:w-52' : 'w-56 md:w-64')}>
                                <div className="relative w-full overflow-hidden rounded-xl ring-1 ring-white/25 shadow-md transition group-hover:ring-2 group-hover:ring-white group-hover:-translate-y-0.5" style={{ paddingTop: '56.25%' }}>
                                    <div className="absolute inset-0">
                                        <PosterView config={configFromTemplate(t, '16:9')} lists={[]} sampleList={t.sampleList} />
                                    </div>
                                </div>
                                <p className="mt-1.5 text-sm font-semibold">{t.name}</p>
                                <p className="text-xs text-white/75">{t.rubro}</p>
                            </button>
                        ))}
                        <button type="button" onClick={() => openNew(null)}
                            className={cn('shrink-0 snap-start rounded-xl border border-dashed border-white/50 hover:bg-white/10 flex flex-col items-center justify-center gap-1.5 text-sm font-semibold', compact ? 'w-36 h-[6.2rem] md:h-[7.3rem]' : 'w-44 h-[7.9rem] md:h-36')}>
                            <LayoutGrid className="w-5 h-5" />
                            Ver todos los diseños
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </section>

            {!isLoading && posters.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold">Tus carteles</h2>
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
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                Los carteles también aparecen en Medios y se pueden sumar a cualquier playlist. Si tienen horario ("Cuándo aparece"), fuera de ese horario no salen y pasa lo demás.
            </p>

            {commerceId && (
                <PosterEditor open={editorOpen} onClose={() => setEditorOpen(false)} commerceId={commerceId} editing={editing} initialTemplate={startTemplate} />
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
