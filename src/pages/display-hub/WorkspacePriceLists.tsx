import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, ClipboardPaste, ListOrdered, Loader2, MoreVertical, Percent, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePriceLists, useCreatePriceList, useUpdatePriceList, useDeletePriceList } from '@/hooks/use-price-lists';
import { useDisplayLabelGroups } from '@/hooks/use-display-labels';
import {
    PriceList, PriceListItem, emptyItem, formatPrice, increasePrice, parsePastedList, parsePrice,
} from '@/lib/priceLists';

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
            price: parsePrice(priceText),
            available: item.available !== false,
        }));

// Postgres reordena las claves del JSON: se compara campo por campo.
const canonical = (items: PriceListItem[]) =>
    JSON.stringify(items.map(i => [i.id, i.name || '', i.detail || '', i.price ?? null, i.available !== false]));
const sameItems = (a: PriceListItem[], b: PriceListItem[]) => canonical(a) === canonical(b);

const ROUND_OPTIONS = [1, 10, 50, 100, 500];

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
    const addItem = () => {
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
                <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                    {/* Listas */}
                    <div className="space-y-2">
                        <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
                            {lists.map(list => {
                                const active = list.id === selectedId;
                                const count = (list.items || []).filter(i => i.name).length;
                                return (
                                    <button
                                        key={list.id}
                                        type="button"
                                        onClick={() => selectList(list.id)}
                                        className={cn(
                                            'shrink-0 rounded-xl border px-4 py-3 text-left transition-colors md:w-full',
                                            active ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:bg-muted'
                                        )}
                                    >
                                        <span className={cn('block font-semibold truncate', active && 'text-indigo-600 dark:text-indigo-400')}>{list.name}</span>
                                        <span className="block text-xs text-muted-foreground">{count} {count === 1 ? 'producto' : 'productos'}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <Button variant="outline" className="w-full" onClick={addList} disabled={createList.isPending}>
                            <Plus className="w-4 h-4 mr-2" /> Nueva lista
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
                            <p className="text-sm mt-1">Creá la primera, por ejemplo "Pizzas" o "Cafetería".</p>
                            <Button className="mt-4" onClick={addList} disabled={createList.isPending}>
                                <Plus className="w-4 h-4 mr-2" /> Nueva lista
                            </Button>
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
                                        <DropdownMenuItem onClick={() => setPasteOpen(true)}><ClipboardPaste className="w-4 h-4 mr-2" /> Pegar una lista</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setRaiseOpen(true)}><Percent className="w-4 h-4 mr-2" /> Aumentar precios</DropdownMenuItem>
                                        <DropdownMenuItem onClick={removeList} className="text-rose-600"><Trash2 className="w-4 h-4 mr-2" /> Eliminar lista</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex flex-wrap gap-2 px-4 pt-3">
                                <Button variant="outline" size="sm" onClick={() => setRaiseOpen(true)}><Percent className="w-4 h-4 mr-1.5" /> Aumentar precios</Button>
                                <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}><ClipboardPaste className="w-4 h-4 mr-1.5" /> Pegar una lista</Button>
                            </div>

                            <ul className="divide-y divide-border">
                                {draft.items.map((item, i) => (
                                    <li key={item.id} className={cn('p-4 space-y-2', !item.available && 'bg-muted/40')}>
                                        <div className="flex gap-2">
                                            <div className="flex-1 min-w-0 space-y-1.5">
                                                <Input
                                                    value={item.name}
                                                    onChange={e => patchItem(item.id, { name: e.target.value })}
                                                    placeholder="Producto (ej: Muzzarella)"
                                                    className={cn('font-medium', !item.available && 'line-through opacity-60')}
                                                    autoFocus={focusRowRef.current === item.id}
                                                    aria-label="Producto"
                                                />
                                                <Input
                                                    value={item.detail || ''}
                                                    onChange={e => patchItem(item.id, { detail: e.target.value })}
                                                    placeholder="Aclaración (opcional, ej: grande, 8 porciones)"
                                                    className="h-8 text-xs"
                                                    aria-label="Aclaración"
                                                />
                                            </div>
                                            <Input
                                                value={item.priceText}
                                                onChange={e => patchItem(item.id, { priceText: e.target.value })}
                                                onBlur={() => {
                                                    const price = parsePrice(item.priceText);
                                                    patchItem(item.id, { priceText: price === null ? item.priceText : formatPrice(price) });
                                                }}
                                                placeholder="$ 0"
                                                inputMode="decimal"
                                                className="w-28 sm:w-32 text-right font-mono font-semibold"
                                                aria-label="Precio"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 text-xs">
                                            <label className="flex items-center gap-2 mr-auto cursor-pointer select-none">
                                                <Switch checked={item.available} onCheckedChange={checked => patchItem(item.id, { available: checked })} />
                                                <span className={item.available ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                                                    {item.available ? 'Hay stock' : 'Sin stock: no se muestra'}
                                                </span>
                                            </label>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveItem(i, 1)} disabled={i === draft.items.length - 1} aria-label="Bajar"><ArrowDown className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => removeItem(item.id)} aria-label="Quitar"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="p-4 border-t border-border">
                                <Button variant="outline" className="w-full" onClick={addItem}><Plus className="w-4 h-4 mr-2" /> Agregar producto</Button>
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

            <PasteListDialog open={pasteOpen} onClose={() => setPasteOpen(false)} onAdd={items => { appendItems(items); setPasteOpen(false); }} />
            {draft && (
                <RaisePricesDialog
                    open={raiseOpen}
                    onClose={() => setRaiseOpen(false)}
                    items={draft.items}
                    onApply={(percent, roundTo) => { applyIncrease(percent, roundTo); setRaiseOpen(false); }}
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

// Aumentar (o bajar) todos los precios de la lista en un %, redondeando hacia arriba.
function RaisePricesDialog({ open, onClose, items, onApply }: {
    open: boolean;
    onClose: () => void;
    items: DraftItem[];
    onApply: (percent: number, roundTo: number) => void;
}) {
    const [percentText, setPercentText] = useState('10');
    const [roundTo, setRoundTo] = useState(50);
    const percent = Number(percentText.replace(',', '.'));
    const valid = Number.isFinite(percent) && percent !== 0 && percent > -100;
    const sample = items.filter(i => parsePrice(i.priceText) !== null).slice(0, 4);
    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Aumentar precios</DialogTitle>
                    <DialogDescription>Cambia todos los precios de la lista de una vez. Para bajarlos, poné un número negativo (ej: -10).</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 text-sm">
                        <span className="w-28">Porcentaje</span>
                        <Input value={percentText} onChange={e => setPercentText(e.target.value)} inputMode="decimal" className="w-24 text-right" />
                        <span>%</span>
                    </label>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="w-28">Redondear a</span>
                        <div className="flex flex-wrap gap-1.5">
                            {ROUND_OPTIONS.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRoundTo(r)}
                                    className={cn('rounded-full border px-3 py-1 text-xs', roundTo === r ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-border')}
                                >
                                    {r === 1 ? 'Sin redondear' : `$ ${r}`}
                                </button>
                            ))}
                        </div>
                    </div>
                    {valid && sample.length > 0 && (
                        <ul className="rounded-lg border border-border divide-y divide-border text-sm">
                            {sample.map(item => {
                                const before = parsePrice(item.priceText);
                                return (
                                    <li key={item.id} className="flex justify-between gap-3 px-3 py-1.5">
                                        <span className="truncate">{item.name || 'Sin nombre'}</span>
                                        <span className="font-mono whitespace-nowrap">
                                            <span className="text-muted-foreground">{formatPrice(before)}</span> → <strong>{formatPrice(increasePrice(before, percent, roundTo))}</strong>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">Se aplica a la lista y después tocás Guardar.</p>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button disabled={!valid} onClick={() => onApply(percent, roundTo)}>Aplicar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
