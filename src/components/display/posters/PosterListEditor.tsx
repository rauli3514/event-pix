import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { emptyItem, formatPrice, parsePrice, type DraftRow } from '@/lib/priceLists';

// Los productos del cartel, editables ahí mismo. Lo que se cambia acá se
// guarda en Listas de precios al guardar el cartel.

export function PosterListEditor({ rows, onChange }: { rows: DraftRow[]; onChange: (rows: DraftRow[]) => void }) {
    const patch = (id: string, p: Partial<DraftRow>) => onChange(rows.map(r => (r.id === id ? { ...r, ...p } : r)));
    return (
        <div className="rounded-lg border border-border divide-y divide-border">
            {rows.map(r => (
                <div key={r.id} className={cn('flex items-center gap-1.5 px-2 py-1.5', !r.available && 'opacity-60')}>
                    <Input
                        value={r.name}
                        onChange={e => patch(r.id, { name: e.target.value })}
                        placeholder="Producto"
                        className={cn('h-8 flex-1 min-w-0 text-sm', !r.available && 'line-through')}
                        aria-label="Producto"
                    />
                    <Input
                        value={r.priceText}
                        onChange={e => patch(r.id, { priceText: e.target.value })}
                        onBlur={() => {
                            const price = parsePrice(r.priceText);
                            if (price !== null) patch(r.id, { priceText: formatPrice(price) });
                        }}
                        placeholder="$ 0"
                        inputMode="decimal"
                        className="h-8 w-[5.5rem] px-2 text-right font-mono text-sm"
                        aria-label="Precio"
                    />
                    <button type="button" onClick={() => patch(r.id, { available: !r.available })}
                        title={r.available ? 'Hay stock (tocá para ocultarlo)' : 'Sin stock: no se muestra'}
                        aria-label={r.available ? 'Ocultar: sin stock' : 'Mostrar: hay stock'}
                        className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted">
                        {r.available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                    </button>
                    <button type="button" onClick={() => onChange(rows.filter(x => x.id !== r.id))} aria-label="Quitar"
                        className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-rose-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...rows, { ...emptyItem(), priceText: '' }])}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-indigo-600 dark:text-indigo-300 hover:bg-muted/50">
                <Plus className="w-4 h-4" /> Agregar producto
            </button>
        </div>
    );
}
