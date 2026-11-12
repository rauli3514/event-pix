import { useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFudoImport, useFudoMenu } from '@/hooks/use-price-lists';
import { LIST_COLORS, fudoErrorText, fudoGroups, isFudoList, parseFudoSlug, type FudoMenu } from '@/lib/fudo';
import { formatPrice, type PriceList } from '@/lib/priceLists';

// "Traer desde Fudo": se pega el link del menú, se eligen las categorías y cada
// una queda como lista de precios (con su color). Si ya estaban, se actualizan.

interface Props {
    open: boolean;
    onClose: () => void;
    commerceId: string;
    lists: PriceList[];
    onImported?: (slug: string) => void;
}

export function FudoImportDialog(props: Props) {
    if (!props.open) return null;
    return <FudoImportInner {...props} />;
}

function FudoImportInner({ onClose, commerceId, lists, onImported }: Props) {
    const existingSlug = lists.find(isFudoList)?.source?.slug as string | undefined;
    const [link, setLink] = useState(existingSlug ? `menu.fu.do/${existingSlug}` : '');
    const [slug, setSlug] = useState<string | null>(null);
    const [menu, setMenu] = useState<FudoMenu | null>(null);
    const [picked, setPicked] = useState<Set<number>>(new Set());
    const readMenu = useFudoMenu();
    const importLists = useFudoImport();

    const groups = useMemo(() => (menu ? fudoGroups(menu) : []), [menu]);
    const leafIds = groups.flatMap(g => g.categories.map(c => c.category.id));
    const already = new Set(lists.filter(isFudoList).filter(l => l.source.slug === slug).map(l => Number(l.source.categoryId)));
    const colorOf = (id: number) => {
        const existing = lists.find(l => isFudoList(l) && l.source.slug === slug && Number(l.source.categoryId) === id);
        return existing?.color || LIST_COLORS[Math.max(0, leafIds.indexOf(id)) % LIST_COLORS.length];
    };

    const search = async () => {
        const s = parseFudoSlug(link);
        if (!s) { toast.error('Pegá el link del menú de Fudo, por ejemplo menu.fu.do/tulocal'); return; }
        try {
            const data = await readMenu.mutateAsync(s);
            setSlug(s);
            setMenu(data);
            // Lo que ya se trajo antes queda marcado (se actualiza).
            const prev = new Set(lists.filter(isFudoList).filter(l => l.source.slug === s).map(l => Number(l.source.categoryId)));
            setPicked(prev);
        } catch (e) {
            toast.error(fudoErrorText((e as Error).message));
        }
    };

    const toggle = (id: number) => setPicked(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const doImport = async () => {
        if (!slug || !menu || picked.size === 0) return;
        const categories = groups.flatMap(g => g.categories
            .filter(c => picked.has(c.category.id))
            .map(c => ({ id: c.category.id, name: c.category.name, parentName: g.parent, color: colorOf(c.category.id) })));
        try {
            const n = await importLists.mutateAsync({ commerceId, slug, categories });
            toast.success(`Listo: ${n} ${n === 1 ? 'lista' : 'listas'} de Fudo. Se actualizan solas una vez por día.`);
            onImported?.(slug);
            onClose();
        } catch (e) {
            toast.error(fudoErrorText((e as Error).message));
        }
    };

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-xl max-h-[92dvh] overflow-y-auto grid-cols-[minmax(0,1fr)]">
                <DialogHeader>
                    <DialogTitle>Traer precios desde Fudo</DialogTitle>
                    <DialogDescription>
                        Pegá el link del menú de Fudo. Cada categoría queda como una lista de precios con su color, y se actualiza sola una vez por día (o cuando tocás "Actualizar desde Fudo").
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2">
                    <Input
                        value={link}
                        onChange={e => setLink(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') search(); }}
                        placeholder="menu.fu.do/tulocal"
                        autoCapitalize="off"
                        aria-label="Link del menú de Fudo"
                    />
                    <Button onClick={search} disabled={readMenu.isPending} className="shrink-0">
                        {readMenu.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-1.5" /> Buscar</>}
                    </Button>
                </div>

                {menu && (
                    <div className="space-y-3 min-w-0">
                        {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">El menú no tiene productos.</p>
                        ) : (
                            <>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Elegí qué categorías traer:</span>
                                    <button type="button" className="text-xs underline text-muted-foreground"
                                        onClick={() => setPicked(picked.size === leafIds.length ? new Set() : new Set(leafIds))}>
                                        {picked.size === leafIds.length ? 'Ninguna' : 'Todas'}
                                    </button>
                                </div>
                                {groups.map(g => (
                                    <div key={g.parent ?? '_'} className="space-y-1.5">
                                        {g.parent && <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.parent}</p>}
                                        {g.categories.map(({ category, products }) => {
                                            const on = picked.has(category.id);
                                            const shown = products.filter(p => p.available).slice(0, 3);
                                            return (
                                                <button key={category.id} type="button" onClick={() => toggle(category.id)}
                                                    className={cn('w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors', on ? 'border-indigo-500 bg-indigo-500/10' : 'border-border hover:bg-muted')}>
                                                    <span className={cn('mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center', on ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-muted-foreground/40')}>
                                                        {on && <Check className="w-3.5 h-3.5" />}
                                                    </span>
                                                    <span className="mt-1.5 w-3 h-3 shrink-0 rounded-full" style={{ background: colorOf(category.id) }} />
                                                    <span className="flex-1 min-w-0">
                                                        <span className="flex items-center gap-2 font-medium">
                                                            <span className="truncate">{category.name}</span>
                                                            <span className="text-xs font-normal text-muted-foreground shrink-0">{products.length} {products.length === 1 ? 'producto' : 'productos'}</span>
                                                            {already.has(category.id) && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Ya está · se actualiza</span>}
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground truncate">
                                                            {shown.length
                                                                ? `${shown.map(p => `${p.name} ${formatPrice(p.price)}`).join(' · ')}${products.length > shown.length ? ' …' : ''}`
                                                                : 'Hoy está todo sin stock en Fudo'}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Los precios se cambian en Fudo. Acá podés cambiar nombres, agregar aclaraciones, marcar "sin stock" y hacer descuentos por tiempo: eso no se pisa al actualizar.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button onClick={doImport} disabled={picked.size === 0 || importLists.isPending}>
                                {importLists.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Traer ${picked.size} ${picked.size === 1 ? 'categoría' : 'categorías'}`}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
