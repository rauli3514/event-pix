import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ImagePlus, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { MediaPickerModal } from '@/components/display/MediaPickerModal';
import { PosterView } from './PosterView';
import { usePriceLists } from '@/hooks/use-price-lists';
import { useUploadDisplayMedia, useUpdateDisplayMedia } from '@/hooks/use-display-media';
import { useDisplayCampaigns, useUpdateCampaign } from '@/hooks/use-display-hub';
import { formatPrice } from '@/lib/priceLists';
import { DAY_LETTER, WEEK_ORDER } from '@/lib/itemRules';
import {
    POSTER_APP_ID, POSTER_FONTS, POSTER_FORMATS, POSTER_LAYOUTS, POSTER_TEMPLATES, POSTER_THEMES,
    configFromTemplate, formatRatio, playlistsWithNewMetadata, scheduleBadge,
    type PosterConfig, type PosterFont, type PosterFormat, type PosterLayout, type PosterTemplate, type TextStyle,
} from '@/lib/posters';
import type { DisplayMedia } from '@/types/display';

interface Props {
    open: boolean;
    onClose: () => void;
    commerceId: string;
    // Cartel existente (Medios › app 'poster'); sin esto se arranca eligiendo plantilla.
    editing?: DisplayMedia | null;
}

type Tab = 'design' | 'content' | 'settings';

const TEXT_COLORS = ['', '#ffffff', '#111827', '#fbbf24', '#f26b3a', '#38bdf8', '#c6f432', '#f9a8d4'];

// Se monta de cero cada vez que se abre (así arranca con el cartel que se edita
// o con la galería de plantillas).
export function PosterEditor(props: Props) {
    if (!props.open) return null;
    return <PosterEditorDialog key={props.editing?.id ?? 'new'} {...props} />;
}

function PosterEditorDialog({ onClose, commerceId, editing }: Props) {
    const existing = editing?.metadata?.config as PosterConfig | undefined;
    const [step, setStep] = useState<'pick' | 'edit'>(existing ? 'edit' : 'pick');
    const [format, setFormat] = useState<PosterFormat>(existing?.format || '16:9');
    const [config, setConfig] = useState<PosterConfig | null>(existing || null);
    const [template, setTemplate] = useState<PosterTemplate | null>(null);
    const [name, setName] = useState(editing?.name || '');
    const [tab, setTab] = useState<Tab>('content');
    const [search, setSearch] = useState('');
    const [pickingPhoto, setPickingPhoto] = useState<number | null>(null);

    const { data: listsData } = usePriceLists(commerceId);
    const lists = useMemo(() => listsData?.lists ?? [], [listsData]);
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const upload = useUploadDisplayMedia();
    const update = useUpdateDisplayMedia();
    const updateCampaign = useUpdateCampaign();

    const set = (patch: Partial<PosterConfig>) => setConfig(c => (c ? { ...c, ...patch } : c));
    const setStyle = (key: 'title' | 'list' | 'price', patch: Partial<TextStyle>) =>
        setConfig(c => (c ? { ...c, styles: { ...c.styles, [key]: { ...c.styles?.[key], ...patch } } } : c));

    const pickTemplate = (t: PosterTemplate) => {
        setTemplate(t);
        setConfig(configFromTemplate(t, format));
        setName(t.name);
        setStep('edit');
    };

    const filtered = POSTER_TEMPLATES.filter(t => {
        const q = search.trim().toLowerCase();
        return !q || `${t.name} ${t.rubro} ${POSTER_LAYOUTS[t.config.layout].label}`.toLowerCase().includes(q);
    });

    const save = async () => {
        if (!config) return;
        const finalName = name.trim() || config.title || 'Cartel';
        const metadata = { appId: POSTER_APP_ID, config: { ...config, format } };
        try {
            if (editing) {
                await update.mutateAsync({ id: editing.id, updates: { name: finalName, metadata } });
                // Las playlists guardan una copia: se actualiza para que las pantallas vean el cambio.
                const changed = playlistsWithNewMetadata(campaigns, editing.id, metadata, finalName);
                await Promise.all(changed.map(c => updateCampaign.mutateAsync({ id: c.id, updates: { items_json: c.items_json as never } })));
            } else {
                await upload.mutateAsync({
                    commerceId,
                    folderPath: '/',
                    webUrl: `app://${POSTER_APP_ID}`,
                    webName: finalName,
                    type: 'app',
                    metadata,
                });
            }
            toast.success('Cartel guardado. Las pantallas lo toman en menos de un minuto.');
            onClose();
        } catch {
            toast.error('No se pudo guardar el cartel.');
        }
    };

    const saving = upload.isPending || update.isPending;
    const ratio = formatRatio(format);
    const previewConfig = config ? { ...config, format } : null;
    const linkedList = config?.listId ? lists.find(l => l.id === config.listId) : undefined;
    const days = config?.schedule?.showDays || [];

    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-6xl w-[100vw] h-[100dvh] sm:h-[92vh] p-0 overflow-hidden sm:rounded-2xl flex flex-col gap-0">
                {/* Encabezado */}
                <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 pr-12 shrink-0">
                    {step === 'edit' && !editing && (
                        <Button variant="ghost" size="icon" onClick={() => setStep('pick')} aria-label="Elegir otra plantilla"><ArrowLeft className="w-5 h-5" /></Button>
                    )}
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base font-semibold truncate">{step === 'pick' ? 'Nuevo cartel' : editing ? 'Editar cartel' : 'Nuevo cartel'}</DialogTitle>
                        <p className="text-xs text-muted-foreground">Al guardar, se ve en las pantallas en menos de un minuto.</p>
                    </div>
                    {step === 'edit' && (
                        <Button onClick={save} disabled={saving} className="shrink-0">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Guardar</>}
                        </Button>
                    )}
                </div>

                {step === 'pick' ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar un diseño o rubro (pizza, café, gimnasio…)" className="pl-9" />
                            </div>
                            <select
                                value={format}
                                onChange={e => setFormat(e.target.value as PosterFormat)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                aria-label="Formato de la pantalla"
                            >
                                {POSTER_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                        </div>
                        <p className="text-xs text-muted-foreground">{POSTER_FORMATS.find(f => f.id === format)?.hint} El cartel se acomoda solo si después lo pasás en otra pantalla.</p>
                        <div className={cn('grid gap-4', ratio < 1 ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
                            {filtered.map(t => (
                                <button key={t.id} type="button" onClick={() => pickTemplate(t)} className="group text-left">
                                    <div className="relative w-full overflow-hidden rounded-xl border border-border group-hover:border-indigo-500 transition-colors" style={{ paddingTop: `${100 / ratio}%` }}>
                                        <div className="absolute inset-0">
                                            <PosterView config={configFromTemplate(t, format)} lists={[]} sampleList={t.sampleList} />
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-sm font-medium">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.rubro} · {POSTER_LAYOUTS[t.config.layout].label}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : config && previewConfig && (
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        {/* Vista previa */}
                        <div className="shrink-0 lg:flex-1 bg-muted/40 p-3 lg:p-6 flex items-center justify-center">
                            <div className="w-full" style={{ maxWidth: ratio < 1 ? 240 : 760 }}>
                                <div className="relative w-full overflow-hidden rounded-xl shadow-lg" style={{ paddingTop: `${100 / ratio}%` }}>
                                    <div className="absolute inset-0">
                                        <PosterView config={previewConfig} lists={lists} sampleList={!config.listId ? template?.sampleList : undefined} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Controles */}
                        <div className="flex-1 lg:flex-none lg:w-[400px] lg:border-l border-border flex flex-col min-h-0">
                            <div className="grid grid-cols-3 border-b border-border shrink-0">
                                {([['design', 'Diseño'], ['content', 'Contenido'], ['settings', 'Ajustes']] as [Tab, string][]).map(([id, label]) => (
                                    <button key={id} type="button" onClick={() => setTab(id)} className={cn('py-2.5 text-sm font-medium border-b-2', tab === id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-muted-foreground')}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
                                {tab === 'design' && (
                                    <>
                                        <Field label="Cómo se arma">
                                            <div className="grid grid-cols-2 gap-2">
                                                {(Object.keys(POSTER_LAYOUTS) as PosterLayout[]).map(l => (
                                                    <Choice key={l} active={config.layout === l} onClick={() => set({ layout: l })} title={POSTER_LAYOUTS[l].label} hint={POSTER_LAYOUTS[l].description} />
                                                ))}
                                            </div>
                                        </Field>
                                        <Field label="Pantalla">
                                            <select value={format} onChange={e => setFormat(e.target.value as PosterFormat)} className="h-10 w-full rounded-md border border-input bg-background px-3">
                                                {POSTER_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                            </select>
                                        </Field>
                                        <Field label="Colores">
                                            <div className="flex flex-wrap gap-2">
                                                {POSTER_THEMES.map(t => (
                                                    <button key={t.id} type="button" onClick={() => set({ themeId: t.id })} title={t.label}
                                                        className={cn('w-11 h-11 rounded-full border-2 flex items-center justify-center', config.themeId === t.id ? 'border-indigo-500' : 'border-border')}
                                                        style={{ background: t.panel }}>
                                                        <span className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                                                    </button>
                                                ))}
                                            </div>
                                        </Field>
                                        <Field label="Letra del título">
                                            <div className="flex flex-wrap gap-2">
                                                {(Object.keys(POSTER_FONTS) as PosterFont[]).map(f => (
                                                    <button key={f} type="button" onClick={() => set({ font: f })}
                                                        className={cn('rounded-lg border px-3 py-2', config.font === f ? 'border-indigo-500 bg-indigo-500/10' : 'border-border')}
                                                        style={{ fontFamily: POSTER_FONTS[f].family, fontWeight: POSTER_FONTS[f].weight }}>
                                                        {POSTER_FONTS[f].label}
                                                    </button>
                                                ))}
                                            </div>
                                        </Field>
                                        {config.layout === 'card' && (
                                            <Toggle label="Tarjeta inclinada" checked={!!config.tilt} onChange={v => set({ tilt: v })} />
                                        )}
                                    </>
                                )}

                                {tab === 'content' && (
                                    <>
                                        <Field label="Etiqueta (arriba, chiquita)">
                                            <Input value={config.badge || ''} onChange={e => set({ badge: e.target.value })} placeholder={config.autoBadge && scheduleBadge(config.schedule) ? scheduleBadge(config.schedule)! : 'HOY, OFERTA, NUEVO…'} maxLength={30} />
                                            <Toggle label="Mostrar el horario si está vacía (DE 15 A 19 H)" checked={!!config.autoBadge} onChange={v => set({ autoBadge: v })} />
                                        </Field>
                                        <Field label="Título">
                                            <Input value={config.title || ''} onChange={e => set({ title: e.target.value })} placeholder="Café + medialuna" maxLength={80} />
                                            <StyleControls style={config.styles?.title} onChange={p => setStyle('title', p)} />
                                        </Field>
                                        <Field label="Subtítulo">
                                            <Input value={config.subtitle || ''} onChange={e => set({ subtitle: e.target.value })} placeholder="la promo de la tarde" maxLength={80} />
                                        </Field>
                                        <Field label="Fotos">
                                            <div className="flex gap-2">
                                                {[0, 1].map(i => {
                                                    const url = config.photos?.[i];
                                                    return (
                                                        <div key={i} className="relative w-28 h-20 rounded-lg border border-dashed border-border overflow-hidden flex items-center justify-center bg-muted/40">
                                                            {url ? (
                                                                <>
                                                                    <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                                                    <button type="button" onClick={() => set({ photos: (config.photos || []).filter((_, j) => j !== i) })} className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white" aria-label="Quitar foto"><X className="w-3 h-3" /></button>
                                                                </>
                                                            ) : (i === 0 || config.photos?.[0]) && (
                                                                <button type="button" onClick={() => setPickingPhoto(i)} className="flex flex-col items-center text-xs text-muted-foreground">
                                                                    <ImagePlus className="w-5 h-5 mb-1" /> {i === 0 ? 'Foto' : 'Segunda foto'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-muted-foreground">De tus Medios. Con dos fotos se ven una al lado de la otra.</p>
                                        </Field>
                                        <Field label="Lista de precios">
                                            <select
                                                value={config.listId || ''}
                                                onChange={e => set({ listId: e.target.value || null })}
                                                className="h-10 w-full rounded-md border border-input bg-background px-3"
                                            >
                                                <option value="">Sin lista</option>
                                                {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.items.filter(i => i.name).length})</option>)}
                                            </select>
                                            {lists.length === 0 && (
                                                <p className="text-xs text-muted-foreground">Todavía no tenés listas. <Link to={`/admin/display/commerce/${commerceId}/workspace/price-lists`} className="underline">Crear una en Listas de precios</Link></p>
                                            )}
                                            {config.listId && (
                                                <>
                                                    <p className="text-xs text-muted-foreground">Queda vinculada: si cambiás un precio en "{linkedList?.name}", el cartel se actualiza solo.</p>
                                                    <div className="flex gap-2">
                                                        {(['auto', 1, 2] as const).map(c => (
                                                            <button key={String(c)} type="button" onClick={() => set({ listColumns: c })} className={cn('rounded-full border px-3 py-1 text-xs', (config.listColumns || 'auto') === c ? 'border-indigo-500 bg-indigo-500/10' : 'border-border')}>
                                                                {c === 'auto' ? 'Columnas solas' : c === 1 ? '1 columna' : '2 columnas'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <Toggle label="Mostrar aclaraciones" checked={config.showDetails !== false} onChange={v => set({ showDetails: v })} />
                                                    <StyleControls style={config.styles?.list} onChange={p => setStyle('list', p)} />
                                                </>
                                            )}
                                        </Field>
                                        <Field label="Precio grande">
                                            <select
                                                value={config.priceRef ? `${config.priceRef.listId}|${config.priceRef.itemId}` : ''}
                                                onChange={e => {
                                                    const [listId, itemId] = e.target.value.split('|');
                                                    set({ priceRef: listId && itemId ? { listId, itemId } : null });
                                                }}
                                                className="h-10 w-full rounded-md border border-input bg-background px-3"
                                            >
                                                <option value="">Escrito a mano</option>
                                                {lists.map(l => (
                                                    <optgroup key={l.id} label={l.name}>
                                                        {l.items.filter(i => i.name).map(i => <option key={i.id} value={`${l.id}|${i.id}`}>{i.name} · {formatPrice(i.price)}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            {!config.priceRef && (
                                                <Input value={config.price || ''} onChange={e => set({ price: e.target.value })} placeholder="$ 3.900, 2×1, 30% OFF…" maxLength={20} />
                                            )}
                                            <StyleControls style={config.styles?.price} onChange={p => setStyle('price', p)} />
                                        </Field>
                                        <Field label="Código QR (opcional)">
                                            <Input value={config.qrUrl || ''} onChange={e => set({ qrUrl: e.target.value })} placeholder="https://… (menú, WhatsApp, Instagram)" />
                                        </Field>
                                        <Toggle label="Mostrar la hora" checked={!!config.showClock} onChange={v => set({ showClock: v })} />
                                    </>
                                )}

                                {tab === 'settings' && (
                                    <>
                                        <Field label="Nombre (para encontrarlo en Medios)">
                                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Promo de la tarde" maxLength={80} />
                                        </Field>
                                        <Field label="Cuánto dura en pantalla">
                                            <div className="flex items-center gap-2">
                                                <Input type="number" min={3} max={300} value={config.durationS || 10} onChange={e => set({ durationS: Number(e.target.value) || 10 })} className="w-24" />
                                                <span className="text-muted-foreground">segundos (cuando va en una playlist)</span>
                                            </div>
                                        </Field>
                                        <Field label="Cuándo aparece">
                                            <div className="flex gap-1.5">
                                                {WEEK_ORDER.map(d => {
                                                    const on = days.includes(d);
                                                    return (
                                                        <button key={d} type="button"
                                                            onClick={() => set({ schedule: { ...config.schedule, showDays: on ? days.filter(x => x !== d) : [...days, d] } })}
                                                            className={cn('w-9 h-9 rounded-full border text-xs font-semibold', on ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-border')}>
                                                            {DAY_LETTER[d]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Ningún día marcado = todos los días.</p>
                                            <div className="flex items-center gap-2">
                                                <label className="flex-1">
                                                    <span className="text-xs text-muted-foreground">Desde la hora</span>
                                                    <Input type="time" value={config.schedule?.showFrom || ''} onChange={e => set({ schedule: { ...config.schedule, showFrom: e.target.value } })} />
                                                </label>
                                                <label className="flex-1">
                                                    <span className="text-xs text-muted-foreground">Hasta la hora</span>
                                                    <Input type="time" value={config.schedule?.showTo || ''} onChange={e => set({ schedule: { ...config.schedule, showTo: e.target.value } })} />
                                                </label>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Sin horario = todo el día. Fuera de este horario el cartel no sale y pasa lo demás de la playlist.</p>
                                            {(days.length > 0 || config.schedule?.showFrom) && (
                                                <button type="button" onClick={() => set({ schedule: null })} className="text-xs underline text-muted-foreground">Quitar el horario</button>
                                            )}
                                        </Field>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <MediaPickerModal
                    isOpen={pickingPhoto !== null}
                    onClose={() => setPickingPhoto(null)}
                    commerceId={commerceId}
                    onSelect={(item, type) => {
                        const url = type === 'media' && 'url' in item ? (item as DisplayMedia).url : null;
                        if (!url || !['image', 'image_ad'].includes((item as DisplayMedia).type)) {
                            toast.error('Elegí una foto.');
                            return;
                        }
                        const photos = [...(config?.photos || [])];
                        photos[pickingPhoto ?? 0] = url;
                        set({ photos: photos.filter(Boolean).slice(0, 2) });
                        setPickingPhoto(null);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="font-medium">{label}</p>
            {children}
        </div>
    );
}

function Choice({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }) {
    return (
        <button type="button" onClick={onClick} className={cn('rounded-xl border p-3 text-left', active ? 'border-indigo-500 bg-indigo-500/10' : 'border-border hover:bg-muted')}>
            <span className="block font-medium">{title}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
        </button>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-muted-foreground">{label}</span>
            <Switch checked={checked} onCheckedChange={onChange} />
        </label>
    );
}

// Tamaño, color y sombra de un texto.
function StyleControls({ style, onChange }: { style?: TextStyle; onChange: (p: Partial<TextStyle>) => void }) {
    const scale = style?.scale || 1;
    return (
        <div className="rounded-lg border border-border p-2.5 space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14">Tamaño</span>
                <input type="range" min={0.6} max={1.8} step={0.1} value={scale} onChange={e => onChange({ scale: Number(e.target.value) })} className="flex-1" />
                <span className="text-xs w-10 text-right">{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14">Color</span>
                <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.map(c => (
                        <button key={c || 'auto'} type="button" onClick={() => onChange({ color: c || undefined })} title={c ? c : 'El de la plantilla'}
                            className={cn('w-6 h-6 rounded-full border', (style?.color || '') === c ? 'ring-2 ring-indigo-500 ring-offset-1' : 'border-border')}
                            style={{ background: c || 'conic-gradient(#f26b3a,#fbbf24,#38bdf8,#f26b3a)' }} />
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sombra</span>
                <Switch checked={!!style?.shadow} onCheckedChange={v => onChange({ shadow: v })} />
            </div>
        </div>
    );
}
