import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, ClipboardPaste, Copy, DownloadCloud, Eye, EyeOff, ListOrdered, Loader2, MoreVertical, Percent, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePriceLists, useCreatePriceList, useUpdatePriceList, useDeletePriceList, useFudoRefresh } from '@/hooks/use-price-lists';
import { FudoImportDialog } from '@/components/display/FudoImportDialog';
import { LIST_COLORS, fudoErrorText, isFudoList, timeAgo } from '@/lib/fudo';
import { useDisplayLabelGroups } from '@/hooks/use-display-labels';
import {
    PriceList, PriceListItem, PriceListPromo, activePromo, emptyItem, formatPercent, formatPrice, formatRemaining, increasePrice,
    formatEnd, fudoFields, newItemId, normalizeItemName, parsePastedList, parsePrice, promoPrice,
} from '@/lib/priceLists';
import { useNow } from '@/hooks/use-now';

// Listas de precios: el comerciante carga sus precios una vez ("Pizzas",
// "Oferta de la tarde") y se actualizan en todas las pantallas que los usan.
// Reemplaza a la página Etiquetas (que sigue existiendo para lo ya armado).

// Renglón en edición: el precio se escribe libre ("5.000", "$ 5000") y se
// interpreta al guardar.
type DraftItem = PriceListItem & { priceText: string };
interface Draft { listId: string; name: string; items: DraftItem[] }

const toDraft = (list: PriceList): Draft => ({
    listId: list.id,
    name: list.name,
    items: (list.items || []).map(item => ({ ...item, detail: item.detail || '', priceText: formatPrice(item.price) })),
});

const fromDraft = (draft: Draft): PriceListItem[] =>
    draft.items
        .filter(item => item.name.trim() || item.priceText.trim())
        .map(({ priceText, ...item }) => ({
            id: item.id,
            name: item.name.trim(),
            detail: (item.detail || '').trim() || undefined,
            // Lo que viene de Fudo mantiene su precio (se cambia en Fudo).
            price: item.fudoId != null ? item.price : parsePrice(priceText),
            available: item.available !== false,
            ...fudoFields(item),
        }));

// Postgres reordena las claves del JSON: se compara campo por campo.
const canonical = (items: PriceListItem[]) =>
    JSON.stringify(items.map(i => [i.id, i.name || '', i.detail || '', i.price ?? null, i.available !== false, i.fudoId ?? null]));
const sameItems = (a: PriceListItem[], b: PriceListItem[]) => canonical(a) === canonical(b);

const ROUND_OPTIONS = [1, 10, 50, 100, 500];

// Campos "fantasma": se ven como texto y se editan con un toque.
const GHOST = 'border-transparent bg-transparent shadow-none px-2 hover:border-border focus-visible:border-input focus-visible:bg-background';

export default function WorkspacePriceLists() {
    const { commerceId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data, isLoading } = usePriceLists(commerceId);
    const lists = useMemo(() => data?.lists ?? [], [data]);
    const missing = data?.missing ?? false;
    const { data: oldLabelGroups = [] } = useDisplayLabelGroups(commerceId);
    const createList = useCreatePriceList();
    const updateList = useUpdatePriceList();
    const deleteList = useDeletePriceList();

    const selectedId = searchParams.get('lista') || lists[0]?.id || null;
    const selected = lists.find(l => l.id === selectedId) || null;

    const [draft, setDraft] = useState<Draft | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [pasteOpen, setPasteOpen] = useState(false);
    const [raiseOpen, setRaiseOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [fudoOpen, setFudoOpen] = useState(false);
    const [listFilter, setListFilter] = useState<'all' | 'fudo' | 'mine'>('all');
    const refreshFudo = useFudoRefresh();
    const focusRowRef = useRef<string | null>(null);

    const dirty = !!draft && !!selected && draft.listId === selected.id
        && (draft.name.trim() !== selected.name || !sameItems(fromDraft(draft), selected.items || []));

    // Al cambiar de lista (o si llega una versión nueva y no hay cambios sin guardar).
    useEffect(() => {
        if (!selected) { setDraft(null); return; }
        setDraft(prev => (prev && prev.listId === selected.id && dirty ? prev : toDraft(selected)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id, selected?.updated_at]);

    const selectList = (id: string) => {
        if (dirty && !window.confirm('Tenés cambios sin guardar en esta lista. ¿Descartarlos?')) return;
        setSavedAt(null);
        setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('lista', id); return p; }, { replace: true });
    };

    const addList = async () => {
        if (!commerceId) return;
        if (dirty && !window.confirm('Tenés cambios sin guardar en esta lista. ¿Descartarlos?')) return;
        try {
            const created = await createList.mutateAsync({ commerceId, name: 'Lista nueva', items: [emptyItem()] });
            setSavedAt(null);
            setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('lista', created.id); return p; }, { replace: true });
        } catch {
            toast.error('No se pudo crear la lista.');
        }
    };

    const save = async () => {
        if (!draft || !commerceId) return;
        const name = draft.name.trim();
        if (!name) { toast.error('Ponele un nombre a la lista.'); return; }
        try {
            await updateList.mutateAsync({ commerceId, id: draft.listId, name, items: fromDraft(draft) });
            setSavedAt(Date.now());
        } catch {
            toast.error('No se pudo guardar. Revisá la conexión y probá de nuevo.');
        }
    };

    const removeList = async () => {
        if (!draft || !commerceId) return;
        if (!window.confirm(`¿Eliminar la lista "${draft.name}"? Las pantallas que la muestran dejan de tener esos precios.`)) return;
        try {
            await deleteList.mutateAsync({ commerceId, id: draft.listId });
            setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('lista'); return p; }, { replace: true });
            toast.success('Lista eliminada.');
        } catch {
            toast.error('No se pudo eliminar la lista.');
        }
    };

    const patchItem = (id: string, patch: Partial<DraftItem>) => {
        setSavedAt(null);
        setDraft(d => d && ({ ...d, items: d.items.map(item => (item.id === id ? { ...item, ...patch } : item)) }));
    };
    const moveItem = (index: number, delta: number) => {
        setDraft(d => {
            if (!d) return d;
            const items = [...d.items];
            const j = index + delta;
            if (j < 0 || j >= items.length) return d;
            [items[index], items[j]] = [items[j], items[index]];
            return { ...d, items };
        });
    };
    const removeItem = (id: string) => setDraft(d => d && ({ ...d, items: d.items.filter(item => item.id !== id) }));
    const duplicateItem = (index: number) => {
        setSavedAt(null);
        setDraft(d => {
            if (!d) return d;
            const items = [...d.items];
            const copy = { ...items[index], id: newItemId() };
            focusRowRef.current = copy.id;
            items.splice(index + 1, 0, copy);
            return { ...d, items };
        });
    };
    const addItem = () => {
        setSearch('');
        const item = { ...emptyItem(), priceText: '' };
        focusRowRef.current = item.id;
        setSavedAt(null);
        setDraft(d => d && ({ ...d, items: [...d.items, item] }));
    };
    const appendItems = (items: PriceListItem[]) => {
        setSavedAt(null);
        setDraft(d => {
            if (!d) return d;
            const keep = d.items.filter(item => item.name.trim() || item.priceText.trim());
            return { ...d, items: [...keep, ...items.map(item => ({ ...item, detail: item.detail || '', priceText: formatPrice(item.price) }))] };
        });
    };
    const applyIncrease = (percent: number, roundTo: number) => {
        setSavedAt(null);
        setDraft(d => d && ({
            ...d,
            items: d.items.map(item => {
                const price = increasePrice(parsePrice(item.priceText), percent, roundTo);
                return { ...item, price, priceText: formatPrice(price) };
            }),
        }));
    };

    // Descuento (o aumento) temporal: se guarda aparte, sin tocar los precios.
    const now = useNow(30000);
    const promo = activePromo(selected, now);
    const setPromo = async (next: PriceListPromo | null) => {
        if (!selected || !commerceId) return false;
        try {
            await updateList.mutateAsync({ commerceId, id: selected.id, promo: next });
            toast.success(next ? `Listo: ${formatPercent(next.percent)} hasta ${formatEnd(next.endsAt)}. Las pantallas lo toman en menos de un minuto.` : 'Volvieron los precios de siempre.');
            return true;
        } catch (e) {
            toast.error((e as Error).message === 'promo_missing'
                ? 'Falta un paso en Supabase: correr supabase/migrations/20261114000000_display_price_list_promo.sql en el SQL Editor.'
                : 'No se pudo guardar. Revisá la conexión y probá de nuevo.');
            return false;
        }
    };

    const setColor = async (color: string | null) => {
        if (!selected || !commerceId) return;
        try {
            await updateList.mutateAsync({ commerceId, id: selected.id, color });
        } catch {
            toast.error('No se pudo guardar el color. Si recién se agregó Fudo, falta correr el paso en Supabase.');
        }
    };
    const doRefreshFudo = async () => {
        if (!commerceId) return;
        try {
            const n = await refreshFudo.mutateAsync({ commerceId });
            toast.success(`Listo: ${n} ${n === 1 ? 'lista actualizada' : 'listas actualizadas'} desde Fudo.`);
        } catch (e) {
            toast.error(fudoErrorText((e as Error).message));
        }
    };

    const base = `/admin/display/commerce/${commerceId}/workspace`;

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-28">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Listas de precios</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    Cargá tus precios una sola vez ("Pizzas", "Oferta de la tarde"). Cuando cambiás uno acá, se actualiza en todas las pantallas que lo muestran.
                </p>
            </div>

            {missing && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                    Falta un paso en Supabase para usar las listas: correr una vez{' '}
                    <code className="text-xs">supabase/migrations/20261113000000_display_price_lists.sql</code> en el SQL Editor.
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : !missing && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                    {/* Listas */}
                    <div className="space-y-2 min-w-0">
                        {lists.some(isFudoList) && (
                            <div className="flex gap-1.5">
                                {([['all', 'Todas'], ['fudo', 'De Fudo'], ['mine', 'Mías']] as const).map(([id, label]) => (
                                    <button key={id} type="button" onClick={() => setListFilter(id)}
                                        className={cn('rounded-full border px-3 py-1 text-xs', listFilter === id ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-border hover:bg-muted')}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:max-h-[60vh] md:overflow-y-auto">
                            {lists.filter(l => listFilter === 'all' || (listFilter === 'fudo') === isFudoList(l)).map(list => {
                                const active = list.id === selectedId;
                                const count = (list.items || []).filter(i => i.name).length;
                                return (
                                    <button
                                        key={list.id}
                                        type="button"
                                        onClick={() => selectList(list.id)}
                                        className={cn(
                                            'shrink-0 max-w-[15rem] md:max-w-none rounded-xl border px-4 py-3 text-left transition-colors md:w-full',
                                            active ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:bg-muted'
                                        )}
                                    >
                                        <span className={cn('flex items-center gap-1.5 font-semibold', active && 'text-indigo-600 dark:text-indigo-400')}>
                                            {list.color && <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ background: list.color }} />}
                                            <span className="truncate">{list.name}</span>
                                            {isFudoList(list) && <span className="shrink-0 rounded bg-orange-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-orange-600 dark:text-orange-400">Fudo</span>}
                                            {activePromo(list, now) && <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{formatPercent(list.promo!.percent)}</span>}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">{count} {count === 1 ? 'producto' : 'productos'}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <Button variant="outline" className="w-full" onClick={addList} disabled={createList.isPending}>
                            <Plus className="w-4 h-4 mr-2" /> Nueva lista
                        </Button>
                        <Button variant="outline" className="w-full border-orange-500/40 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600 dark:text-orange-400" onClick={() => setFudoOpen(true)}>
                            <DownloadCloud className="w-4 h-4 mr-2" /> Traer desde Fudo
                        </Button>
                        {oldLabelGroups.length > 0 && (
                            <p className="text-xs text-muted-foreground px-1">
                                ¿Buscás lo que tenías en Etiquetas? <Link to={`${base}/labels`} className="underline">Ver etiquetas anteriores</Link>
                            </p>
                        )}
                    </div>

                    {/* Lista elegida */}
                    {!draft ? (
                        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                            <ListOrdered className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="font-medium text-foreground">Todavía no tenés listas</p>
                            <p className="text-sm mt-1">Creá la primera, por ejemplo "Pizzas" o "Cafetería", o traé tus precios desde Fudo.</p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                <Button onClick={addList} disabled={createList.isPending}>
                                    <Plus className="w-4 h-4 mr-2" /> Nueva lista
                                </Button>
                                <Button variant="outline" onClick={() => setFudoOpen(true)}>
                                    <DownloadCloud className="w-4 h-4 mr-2" /> Traer desde Fudo
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-card">
                            <div className="flex items-center gap-2 border-b border-border p-4">
                                <Input
                                    value={draft.name}
                                    onChange={e => { setSavedAt(null); setDraft({ ...draft, name: e.target.value }); }}
                                    placeholder="Nombre de la lista"
                                    className="text-lg font-semibold h-11"
                                    maxLength={80}
                                    aria-label="Nombre de la lista"
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" aria-label="Más opciones"><MoreVertical className="w-5 h-5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setRaiseOpen(true)}><Percent className="w-4 h-4 mr-2" /> Aumentar precios</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setPasteOpen(true)}><ClipboardPaste className="w-4 h-4 mr-2" /> Pegar una lista</DropdownMenuItem>
                                        <div className="px-2 py-1.5">
                                            <p className="mb-1.5 text-xs text-muted-foreground">Color de la lista</p>
                                            <div className="flex flex-wrap gap-1.5 max-w-[11rem]">
                                                {LIST_COLORS.map(c => (
                                                    <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)}
                                                        className={cn('w-5 h-5 rounded-full border border-border', selected?.color === c && 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-background')}
                                                        style={{ background: c }} />
                                                ))}
                                                {selected?.color && <button type="button" onClick={() => setColor(null)} className="text-[11px] underline text-muted-foreground">Sin color</button>}
                                            </div>
                                        </div>
                                        <DropdownMenuItem onClick={removeList} className="text-rose-600"><Trash2 className="w-4 h-4 mr-2" /> Eliminar lista</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {isFudoList(selected) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-orange-500/10 px-4 py-3 text-sm">
                                    <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Fudo</span>
                                    <span className="flex-1 min-w-[12rem]">
                                        Viene de <strong>menu.fu.do/{selected.source.slug}</strong>{selected.source.parentName ? ` · ${selected.source.parentName}` : ''}
                                        <span className="text-muted-foreground"> · actualizada {timeAgo(selected.source.syncedAt, now) || 'nunca'}. Los precios se cambian en Fudo; acá podés cambiar nombres, aclaraciones, sin stock y descuentos.</span>
                                        {selected.source.lastError && <span className="block text-xs text-amber-600 dark:text-amber-400">La última vez Fudo no respondió: se siguen mostrando los precios anteriores.</span>}
                                    </span>
                                    <Button size="sm" variant="outline" onClick={doRefreshFudo} disabled={refreshFudo.isPending || dirty}
                                        title={dirty ? 'Guardá los cambios primero' : undefined}>
                                        {refreshFudo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1.5" /> Actualizar desde Fudo</>}
                                    </Button>
                                </div>
                            )}

                            {promo && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-rose-500/10 px-4 py-3 text-sm">
                                    <span className="inline-flex items-center justify-center rounded-full bg-rose-600 px-2.5 py-1 text-xs font-extrabold text-white">{formatPercent(promo.percent)}</span>
                                    <span className="flex-1 min-w-[12rem]">
                                        <strong>{promo.percent < 0 ? 'Descuento activo' : 'Aumento temporal activo'}</strong> hasta {formatEnd(promo.endsAt)}
                                        <span className="text-muted-foreground"> · faltan {formatRemaining(Date.parse(promo.endsAt) - now)}. Después vuelven solos los precios de siempre.</span>
                                    </span>
                                    <Button size="sm" variant="outline" onClick={() => setPromo(null)} disabled={updateList.isPending}>Terminar ahora</Button>
                                </div>
                            )}

                            {/* Barra: buscar y atajos */}
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                                <div className="relative flex-1 min-w-0">
                                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto" className="h-9 pl-8" aria-label="Buscar producto" />
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setRaiseOpen(true)} title="Aumentar o bajar todos los precios en %" className="h-9 px-2.5 text-muted-foreground hover:text-foreground">
                                    <Percent className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Aumentar</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setPasteOpen(true)} title="Pegar una lista de WhatsApp o Excel" className="h-9 px-2.5 text-muted-foreground hover:text-foreground">
                                    <ClipboardPaste className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Pegar</span>
                                </Button>
                                <Button size="sm" onClick={addItem} className="h-9 px-3"><Plus className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Producto</span></Button>
                            </div>

                            {/* Encabezado de columnas (compu) */}
                            <div className="hidden md:flex items-center gap-2 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <span className="flex-1 pl-2">Producto</span>
                                <span className="w-36 pl-2">Aclaración</span>
                                <span className="w-32 text-right pr-2">Precio</span>
                                <span className="w-[4.5rem]" />
                            </div>

                            <ul className="divide-y divide-border">
                                {draft.items.map((item, i) => {
                                    const q = normalizeItemName(search);
                                    if (q && !normalizeItemName(`${item.name} ${item.detail || ''}`).includes(q)) return null;
                                    return (
                                        <li key={item.id} className={cn('px-3 py-1 hover:bg-muted/30 focus-within:bg-muted/40', !item.available && 'bg-muted/40')}>
                                            {/* Compu: todo en una línea. Celular: el nombre arriba y abajo aclaración, precio y opciones. */}
                                            <div className="flex flex-wrap md:flex-nowrap items-center gap-x-2">
                                                <Input
                                                    value={item.name}
                                                    onChange={e => patchItem(item.id, { name: e.target.value })}
                                                    placeholder="Producto (ej: Muzzarella)"
                                                    className={cn(GHOST, 'h-9 w-full md:w-auto md:flex-1 font-medium', !item.available && 'line-through opacity-60')}
                                                    autoFocus={focusRowRef.current === item.id}
                                                    aria-label="Producto"
                                                />
                                                <Input
                                                    value={item.detail || ''}
                                                    onChange={e => patchItem(item.id, { detail: e.target.value })}
                                                    placeholder="Aclaración"
                                                    className={cn(GHOST, 'h-8 md:h-9 flex-1 min-w-0 md:flex-none md:w-36 text-xs md:text-sm text-muted-foreground')}
                                                    aria-label="Aclaración"
                                                />
                                                <Input
                                                    value={item.priceText}
                                                    readOnly={item.fudoId != null}
                                                    title={item.fudoId != null ? 'Este precio viene de Fudo: se cambia en Fudo' : undefined}
                                                    onChange={e => patchItem(item.id, { priceText: e.target.value })}
                                                    onBlur={() => {
                                                        const price = parsePrice(item.priceText);
                                                        patchItem(item.id, { priceText: price === null ? item.priceText : formatPrice(price) });
                                                    }}
                                                    placeholder="$ 0"
                                                    inputMode="decimal"
                                                    className={cn(GHOST, 'h-8 md:h-9 w-28 md:w-32 text-right font-mono font-semibold', item.fudoId != null && 'text-orange-600 dark:text-orange-400 cursor-default')}
                                                    aria-label="Precio"
                                                />
                                                {promo && (
                                                    <span className="w-20 shrink-0 text-right font-mono text-xs font-semibold text-rose-600 dark:text-rose-400" title="Precio mientras dura el descuento">
                                                        {formatPrice(promoPrice(parsePrice(item.priceText), promo)) || '—'}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => patchItem(item.id, { available: !item.available })}
                                                    title={item.available ? 'Hay stock (tocá si se terminó)' : 'Sin stock: no se muestra en las pantallas'}
                                                    aria-label={item.available ? 'Marcar sin stock' : 'Marcar con stock'}
                                                    className={cn('h-8 md:h-9 w-8 shrink-0 rounded-md flex items-center justify-center hover:bg-muted', item.available ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400')}
                                                >
                                                    {item.available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 md:h-9 w-8 shrink-0 text-muted-foreground" aria-label="Opciones del producto"><MoreVertical className="w-4 h-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => moveItem(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4 mr-2" /> Subir</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => moveItem(i, 1)} disabled={i === draft.items.length - 1}><ArrowDown className="w-4 h-4 mr-2" /> Bajar</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => duplicateItem(i)}><Copy className="w-4 h-4 mr-2" /> Duplicar</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => removeItem(item.id)} className="text-rose-600"><Trash2 className="w-4 h-4 mr-2" /> Quitar</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            {!item.available && <p className="pl-2 text-[11px] text-amber-600 dark:text-amber-400">Sin stock: no se muestra en las pantallas</p>}
                                        </li>
                                    );
                                })}
                            </ul>
                            {search && !draft.items.some(item => normalizeItemName(`${item.name} ${item.detail || ''}`).includes(normalizeItemName(search))) && (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay productos con "{search}".</p>
                            )}

                            <div className="p-2 border-t border-border">
                                <button type="button" onClick={addItem} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-muted/60">
                                    <Plus className="w-4 h-4" /> Agregar producto
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Guardar, siempre a mano (en el celular queda abajo). */}
            {draft && !missing && (
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
                    <div className="max-w-5xl mx-auto flex items-center justify-end gap-3">
                        <span className="text-xs text-muted-foreground mr-auto md:mr-0">
                            {dirty ? 'Cambios sin guardar' : savedAt ? <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Guardado: las pantallas lo toman en menos de un minuto</span> : ''}
                        </span>
                        <Button onClick={save} disabled={!dirty || updateList.isPending} className="min-w-32">
                            {updateList.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </div>
                </div>
            )}

            {commerceId && (
                <FudoImportDialog
                    open={fudoOpen}
                    onClose={() => setFudoOpen(false)}
                    commerceId={commerceId}
                    lists={lists}
                    onImported={() => setListFilter('fudo')}
                />
            )}
            <PasteListDialog open={pasteOpen} onClose={() => setPasteOpen(false)} onAdd={items => { appendItems(items); setPasteOpen(false); }} />
            {draft && (
                <RaisePricesDialog
                    open={raiseOpen}
                    onClose={() => setRaiseOpen(false)}
                    items={draft.items}
                    onApply={(percent, roundTo) => { applyIncrease(percent, roundTo); setRaiseOpen(false); }}
                    onTemporary={async (percent, roundTo, endsAt) => { if (await setPromo({ percent, roundTo, startsAt: new Date().toISOString(), endsAt: endsAt.toISOString() })) setRaiseOpen(false); }}
                    saving={updateList.isPending}
                />
            )}
        </div>
    );
}

// Pegar una lista de WhatsApp o Excel: un producto por renglón, con el precio al final.
function PasteListDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (items: PriceListItem[]) => void }) {
    const [text, setText] = useState('');
    const parsed = useMemo(() => parsePastedList(text), [text]);
    return (
        <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setText(''); } }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Pegar una lista</DialogTitle>
                    <DialogDescription>Un producto por renglón, con el precio al final. Sirve copiar de WhatsApp o de Excel.</DialogDescription>
                </DialogHeader>
                <Textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={8}
                    placeholder={'Muzzarella 5000\nNapolitana $ 6.000\nFugazzeta 6500'}
                />
                {parsed.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border text-sm">
                        {parsed.map(item => (
                            <li key={item.id} className="flex justify-between gap-3 px-3 py-1.5">
                                <span className="truncate">{item.name}</span>
                                <span className="font-mono text-muted-foreground">{formatPrice(item.price) || 'sin precio'}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { onClose(); setText(''); }}>Cancelar</Button>
                    <Button disabled={parsed.length === 0} onClick={() => { onAdd(parsed); setText(''); }}>
                        Agregar {parsed.length || ''} {parsed.length === 1 ? 'producto' : 'productos'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Aumentar o bajar todos los precios de la lista en un %, redondeando hacia arriba.
// Para siempre (cambia los precios) o solo por un tiempo (los precios no se
// tocan: las pantallas muestran el original tachado y vuelve solo al terminar).
const DURATIONS: { id: string; label: string; ends: (now: number) => Date }[] = [
    { id: '1h', label: '1 hora', ends: now => new Date(now + 3600e3) },
    { id: '2h', label: '2 horas', ends: now => new Date(now + 2 * 3600e3) },
    { id: '4h', label: '4 horas', ends: now => new Date(now + 4 * 3600e3) },
    { id: 'today', label: 'Hasta el final del día', ends: now => { const d = new Date(now); d.setHours(23, 59, 0, 0); return d; } },
    { id: '24h', label: '24 horas', ends: now => new Date(now + 24 * 3600e3) },
    { id: '7d', label: '7 días', ends: now => new Date(now + 7 * 24 * 3600e3) },
];

const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function RaisePricesDialog({ open, onClose, items, onApply, onTemporary, saving }: {
    open: boolean;
    onClose: () => void;
    items: DraftItem[];
    onApply: (percent: number, roundTo: number) => void;
    onTemporary: (percent: number, roundTo: number, endsAt: Date) => void;
    saving?: boolean;
}) {
    const [percentText, setPercentText] = useState('-10');
    const [roundTo, setRoundTo] = useState(50);
    const [mode, setMode] = useState<'temporary' | 'permanent'>('temporary');
    const [duration, setDuration] = useState('2h');
    const now = useNow(30000);
    const [customEnd, setCustomEnd] = useState(() => toLocalInput(new Date(Date.now() + 3 * 3600e3)));
    const percent = Number(percentText.replace(',', '.').replace(/\s/g, ''));
    const valid = Number.isFinite(percent) && percent !== 0 && percent > -100;
    const endsAt = duration === 'custom' ? new Date(customEnd) : DURATIONS.find(d => d.id === duration)!.ends(now);
    const endValid = mode === 'permanent' || (Number.isFinite(endsAt.getTime()) && endsAt.getTime() > now + 60e3);
    const sample = items.filter(i => parsePrice(i.priceText) !== null).slice(0, 4);
    const chip = (active: boolean) => cn('rounded-full border px-3 py-1 text-xs', active ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-border');
    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Aumentar o bajar precios</DialogTitle>
                    <DialogDescription>Cambia todos los precios de la lista de una vez. Para bajarlos, poné un número negativo (ej: -10).</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
                        {([['temporary', 'Solo por un tiempo'], ['permanent', 'Para siempre']] as const).map(([id, label]) => (
                            <button key={id} type="button" onClick={() => setMode(id)}
                                className={cn('rounded-lg py-2 font-medium', mode === id ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {mode === 'temporary'
                            ? 'Los precios de la lista no se tocan. Mientras dura, las pantallas muestran el precio de antes tachado, el nuevo y un cartelito con el %; cuando termina vuelve solo. Lo podés terminar antes cuando quieras.'
                            : 'Cambia los precios de la lista; después tocás Guardar.'}
                    </p>
                    <label className="flex items-center gap-3 text-sm">
                        <span className="w-28">Porcentaje</span>
                        <Input value={percentText} onChange={e => setPercentText(e.target.value)} inputMode="decimal" className="w-24 text-right" />
                        <span>%</span>
                    </label>
                    <div className="flex items-start gap-3 text-sm">
                        <span className="w-28 pt-1">Redondear a</span>
                        <div className="flex flex-wrap gap-1.5">
                            {ROUND_OPTIONS.map(r => (
                                <button key={r} type="button" onClick={() => setRoundTo(r)} className={chip(roundTo === r)}>
                                    {r === 1 ? 'Sin redondear' : `$ ${r}`}
                                </button>
                            ))}
                        </div>
                    </div>
                    {mode === 'temporary' && (
                        <div className="flex items-start gap-3 text-sm">
                            <span className="w-28 pt-1">Por cuánto</span>
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {DURATIONS.map(d => (
                                        <button key={d.id} type="button" onClick={() => setDuration(d.id)} className={chip(duration === d.id)}>{d.label}</button>
                                    ))}
                                    <button type="button" onClick={() => setDuration('custom')} className={chip(duration === 'custom')}>Hasta…</button>
                                </div>
                                {duration === 'custom' && (
                                    <Input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-56" aria-label="Termina" />
                                )}
                                <p className="text-xs text-muted-foreground">{endValid ? `Termina ${formatEnd(endsAt.toISOString())}.` : 'Elegí una fecha y hora que todavía no pasó.'}</p>
                            </div>
                        </div>
                    )}
                    {valid && sample.length > 0 && (
                        <ul className="rounded-lg border border-border divide-y divide-border text-sm">
                            {sample.map(item => {
                                const before = parsePrice(item.priceText);
                                return (
                                    <li key={item.id} className="flex justify-between gap-3 px-3 py-1.5">
                                        <span className="truncate">{item.name || 'Sin nombre'}</span>
                                        <span className="font-mono whitespace-nowrap">
                                            <span className={cn('text-muted-foreground', mode === 'temporary' && 'line-through')}>{formatPrice(before)}</span> → <strong>{formatPrice(increasePrice(before, percent, roundTo))}</strong>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        disabled={!valid || !endValid || saving}
                        onClick={() => (mode === 'temporary' ? onTemporary(percent, roundTo, endsAt) : onApply(percent, roundTo))}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'temporary' ? `Activar ${formatPercent(percent)}` : 'Aplicar'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
