import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ImagePlus, Loader2, Minus, Move, Play, Plus, RotateCcw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { MediaPickerModal } from '@/components/display/MediaPickerModal';
import { PosterView } from './PosterView';
import { PosterListEditor } from './PosterListEditor';
import { QrBuilder } from './QrBuilder';
import { useCreatePriceList, usePriceLists, useUpdatePriceList } from '@/hooks/use-price-lists';
import { useUploadDisplayMedia, useUpdateDisplayMedia } from '@/hooks/use-display-media';
import { useDisplayCampaigns, useUpdateCampaign } from '@/hooks/use-display-hub';
import { formatPrice, fromDraftRows, newItemId, parsePrice, toDraftRows, type DraftRow, type PriceList } from '@/lib/priceLists';
import { DAY_LETTER, WEEK_ORDER } from '@/lib/itemRules';
import {
    POSTER_ANIMATIONS, POSTER_APP_ID, POSTER_FONTS, POSTER_FORMATS, POSTER_LAYOUTS, POSTER_PARTS, POSTER_TEMPLATES, POSTER_THEMES,
    configFromTemplate, formatInfo, playlistsWithNewMetadata, posterColors, scheduleBadge,
    type PosterConfig, type PosterFont, type PosterFormat, type PosterLayout, type PosterPart, type PosterTemplate, type TextStyle,
} from '@/lib/posters';
import type { DisplayMedia } from '@/types/display';

interface Props {
    open: boolean;
    onClose: () => void;
    commerceId: string;
    // Cartel existente (Medios › app 'poster'); sin esto se arranca eligiendo plantilla.
    editing?: DisplayMedia | null;
    // Arrancar directo con un diseño (el banner de Carteles).
    initialTemplate?: PosterTemplate | null;
    initialFormat?: PosterFormat;
}

type Tab = 'design' | 'content' | 'settings';

const TEXT_COLORS = ['', '#ffffff', '#111827', '#fbbf24', '#f26b3a', '#38bdf8', '#c6f432', '#f9a8d4'];
const PANEL_COLORS = ['#15171c', '#2b1c14', '#7a1d1d', '#0f2a44', '#4a1d3a', '#14532d', '#ffffff', '#f6efe2', '#c6f432', '#fde047'];
const ACCENT_COLORS = ['#f26b3a', '#fbbf24', '#e8a85a', '#ef4444', '#38bdf8', '#16a34a', '#f9a8d4', '#a78bfa', '#ffffff', '#111827'];

// Los productos de ejemplo de la plantilla, como renglones editables.
const sampleRows = (t?: PosterTemplate | null): DraftRow[] =>
    (t?.sampleList || []).map(r => {
        const price = parsePrice(r.price);
        return { id: newItemId(), name: r.name, detail: r.detail, price, available: true, priceText: formatPrice(price) || r.price };
    });

const DRAFT_LIST_ID = '__draft';

// Se monta de cero cada vez que se abre (así arranca con el cartel que se edita
// o con la galería de plantillas).
export function PosterEditor(props: Props) {
    if (!props.open) return null;
    return <PosterEditorDialog key={props.editing?.id ?? props.initialTemplate?.id ?? 'new'} {...props} />;
}

function PosterEditorDialog({ onClose, commerceId, editing, initialTemplate, initialFormat }: Props) {
    const existing = editing?.metadata?.config as PosterConfig | undefined;
    const startFormat = existing?.format || initialFormat || '16:9';
    const [step, setStep] = useState<'pick' | 'edit'>(existing || initialTemplate ? 'edit' : 'pick');
    const [format, setFormat] = useState<PosterFormat>(startFormat);
    const [config, setConfig] = useState<PosterConfig | null>(() => existing || (initialTemplate ? configFromTemplate(initialTemplate, startFormat) : null));
    const [name, setName] = useState(editing?.name || initialTemplate?.name || '');
    const [tab, setTab] = useState<Tab>('content');
    const [search, setSearch] = useState('');
    const [pickingPhoto, setPickingPhoto] = useState<number | null>(null);
    const [replay, setReplay] = useState(0);
    const [selectedPart, setSelectedPart] = useState<PosterPart | null>(null);
    // Productos: lista nueva (los de la plantilla o desde cero) o una lista existente.
    const [newList, setNewList] = useState(() => !existing && !!initialTemplate?.sampleList?.length);
    const [newRows, setNewRows] = useState<DraftRow[]>(() => sampleRows(initialTemplate));
    const [newListName, setNewListName] = useState(initialTemplate?.config.title || initialTemplate?.name || '');
    const [linkedRows, setLinkedRows] = useState<DraftRow[] | null>(null); // cambios a la lista vinculada

    const { data: listsData } = usePriceLists(commerceId);
    const lists = useMemo(() => listsData?.lists ?? [], [listsData]);
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const upload = useUploadDisplayMedia();
    const update = useUpdateDisplayMedia();
    const updateCampaign = useUpdateCampaign();
    const createList = useCreatePriceList();
    const updateList = useUpdatePriceList();

    const set = (patch: Partial<PosterConfig>) => setConfig(c => (c ? { ...c, ...patch } : c));
    const setStyle = (key: PosterPart, patch: Partial<TextStyle>) =>
        setConfig(c => (c ? { ...c, styles: { ...c.styles, [key]: { ...c.styles?.[key], ...patch } } } : c));

    const pickTemplate = (t: PosterTemplate) => {
        setConfig(configFromTemplate(t, format));
        setName(t.name);
        setNewList(!!t.sampleList?.length);
        setNewRows(sampleRows(t));
        setNewListName(t.config.title || t.name);
        setLinkedRows(null);
        setStep('edit');
    };

    const linkedList = config?.listId ? lists.find(l => l.id === config.listId) : undefined;
    const rows: DraftRow[] = newList ? newRows : linkedRows ?? (linkedList ? toDraftRows(linkedList.items || []) : []);
    const setRows = (next: DraftRow[]) => (newList ? setNewRows(next) : setLinkedRows(next));

    const chooseList = (value: string) => {
        setLinkedRows(null);
        if (value === DRAFT_LIST_ID) {
            setNewList(true);
            if (!newRows.length) setNewRows(toDraftRows([{ id: newItemId(), name: '', price: null, available: true }]));
            if (!newListName) setNewListName(config?.title || name || 'Lista nueva');
            set({ listId: null });
        } else {
            setNewList(false);
            set({ listId: value || null });
        }
    };

    const filtered = POSTER_TEMPLATES.filter(t => {
        const q = search.trim().toLowerCase();
        return !q || `${t.name} ${t.rubro} ${POSTER_LAYOUTS[t.config.layout].label}`.toLowerCase().includes(q);
    });

    const save = async () => {
        if (!config) return;
        const finalName = name.trim() || config.title || 'Cartel';
        const finalConfig: PosterConfig = { ...config, format };
        try {
            // Los productos se guardan en Listas de precios (y el cartel queda vinculado).
            if (newList) {
                const items = fromDraftRows(newRows);
                if (items.length) {
                    const created = await createList.mutateAsync({ commerceId, name: newListName.trim() || config.title || finalName, items });
                    finalConfig.listId = created.id;
                } else {
                    finalConfig.listId = null;
                }
            } else if (config.listId && linkedRows) {
                await updateList.mutateAsync({ commerceId, id: config.listId, items: fromDraftRows(linkedRows) });
            }
            const metadata = { appId: POSTER_APP_ID, config: finalConfig };
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

    const saving = upload.isPending || update.isPending || createList.isPending || updateList.isPending;
    const fmt = formatInfo(format);
    const ratio = fmt.ratio;
    const landscape = ratio >= 1.2;
    const previewConfig = config ? { ...config, format, listId: newList ? DRAFT_LIST_ID : config.listId } : null;
    // La vista previa usa los productos como están en el editor, aunque no se hayan guardado.
    const linkedId = config?.listId;
    const previewLists: PriceList[] = useMemo(() => {
        if (newList) {
            const now = new Date().toISOString();
            return [...lists, { id: DRAFT_LIST_ID, commerce_id: commerceId, name: newListName, items: fromDraftRows(newRows), sort_order: null, created_at: now, updated_at: now }];
        }
        if (linkedRows && linkedId) return lists.map(l => (l.id === linkedId ? { ...l, items: fromDraftRows(linkedRows) } : l));
        return lists;
    }, [lists, newList, newRows, newListName, linkedRows, linkedId, commerceId]);
    const days = config?.schedule?.showDays || [];
    const colors = config ? posterColors(config) : null;

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
                            <FormatSelect value={format} onChange={setFormat} className="h-10 text-sm sm:w-80" />
                        </div>
                        <p className="text-xs text-muted-foreground">{fmt.hint} Son las mismas medidas que los mosaicos de "Enviar a pantallas".</p>
                        <div className={cn('grid gap-4', ratio < 0.6 ? 'grid-cols-3 sm:grid-cols-6 lg:grid-cols-8' : ratio < 1 ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5' : ratio > 2.5 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
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
                        <div className="shrink-0 h-[44dvh] lg:h-auto lg:flex-1 min-h-0 bg-muted/40 p-3 lg:p-6 flex flex-col gap-2">
                            <FitBox ratio={ratio}>
                                <div className="relative w-full h-full overflow-hidden rounded-xl shadow-lg">
                                    <PosterView
                                        key={replay}
                                        config={previewConfig}
                                        lists={previewLists}
                                        onCardMove={config.layout === 'card' ? pos => set({ cardPos: pos }) : undefined}
                                        editParts={{
                                            selected: selectedPart,
                                            onSelect: setSelectedPart,
                                            onMove: (part, offset) => setConfig(c => (c ? { ...c, offsets: { ...c.offsets, [part]: offset } } : c)),
                                        }}
                                    />
                                    {/* Uniones de las TV en un mosaico */}
                                    {Array.from({ length: fmt.cols - 1 }, (_, i) => (
                                        <div key={`c${i}`} className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-white/70 mix-blend-difference" style={{ left: `${((i + 1) / fmt.cols) * 100}%` }} />
                                    ))}
                                    {Array.from({ length: fmt.rows - 1 }, (_, i) => (
                                        <div key={`r${i}`} className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-white/70 mix-blend-difference" style={{ top: `${((i + 1) / fmt.rows) * 100}%` }} />
                                    ))}
                                </div>
                            </FitBox>
                            <PartToolbar
                                part={selectedPart}
                                scale={selectedPart ? config.styles?.[selectedPart]?.scale || 1 : 1}
                                moved={!!selectedPart && !!config.offsets?.[selectedPart]}
                                anyMoved={Object.values(config.offsets || {}).some(o => o && (o.x || o.y)) || !!config.cardPos}
                                isCard={config.layout === 'card'}
                                onScale={v => selectedPart && setStyle(selectedPart, { scale: v })}
                                onReset={() => selectedPart && setConfig(c => {
                                    if (!c) return c;
                                    const offsets = { ...c.offsets };
                                    delete offsets[selectedPart];
                                    return { ...c, offsets };
                                })}
                                onResetAll={() => set({ offsets: {}, cardPos: null })}
                                onClose={() => setSelectedPart(null)}
                            />
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
                                        <Field label="Acomodar">
                                            {config.layout === 'card' ? (
                                                <>
                                                    <p className="text-xs text-muted-foreground">Arrastrá la tarjeta en la vista previa para moverla.</p>
                                                    <Slider label="Tamaño de la tarjeta" min={0.6} max={1.5} step={0.05} value={config.cardSize || 1} onChange={v => set({ cardSize: v })} />
                                                    <div className="flex items-center justify-between gap-2">
                                                        <Toggle label="Tarjeta inclinada" checked={!!config.tilt} onChange={v => set({ tilt: v })} />
                                                    </div>
                                                    {(config.cardPos || (config.cardSize && config.cardSize !== 1)) && (
                                                        <button type="button" onClick={() => set({ cardPos: null, cardSize: 1 })} className="text-xs underline text-muted-foreground">Volver al centro y al tamaño original</button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Toggle
                                                        label={config.layout === 'band' ? 'Franja arriba' : !landscape ? 'Foto abajo' : config.layout === 'menu' ? 'Foto a la izquierda' : 'Foto a la derecha'}
                                                        checked={!!config.flip}
                                                        onChange={v => set({ flip: v })}
                                                    />
                                                    <Slider
                                                        label="Tamaño de la foto"
                                                        min={0.25} max={0.75} step={0.05}
                                                        value={config.photoShare || (config.layout === 'split' ? (landscape ? 0.5 : 0.42) : config.layout === 'menu' ? (landscape ? 0.4 : 0.28) : (landscape ? 0.68 : 0.64))}
                                                        onChange={v => set({ photoShare: v })}
                                                    />
                                                </>
                                            )}
                                        </Field>
                                        <Field label="Pantalla">
                                            <FormatSelect value={format} onChange={setFormat} className="h-10 w-full" />
                                            <p className="text-xs text-muted-foreground">{fmt.hint}{fmt.cols * fmt.rows > 1 ? ' Las líneas punteadas de la vista previa marcan dónde se juntan las TV: conviene no dejar textos ahí.' : ''}</p>
                                        </Field>
                                        <Field label="Colores">
                                            <div className="flex flex-wrap gap-2">
                                                {POSTER_THEMES.map(t => (
                                                    <button key={t.id} type="button" onClick={() => set({ themeId: t.id, panelColor: undefined, accentColor: undefined })} title={t.label}
                                                        className={cn('w-11 h-11 rounded-full border-2 flex items-center justify-center', config.themeId === t.id && !config.panelColor && !config.accentColor ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-border')}
                                                        style={{ background: t.panel }}>
                                                        <span className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                                                    </button>
                                                ))}
                                            </div>
                                        </Field>
                                        <Field label="Colores propios">
                                            <ColorRow label="Fondo" colors={PANEL_COLORS} value={config.panelColor} current={colors?.panel} onChange={c => set({ panelColor: c })} />
                                            <ColorRow label="Precios y etiqueta" colors={ACCENT_COLORS} value={config.accentColor} current={colors?.accent} onChange={c => set({ accentColor: c })} />
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
                                        <Field label="Animación">
                                            <div className="flex flex-wrap gap-1.5">
                                                {POSTER_ANIMATIONS.map(a => (
                                                    <button key={a.id} type="button" onClick={() => { set({ animation: a.id }); setReplay(r => r + 1); }}
                                                        className={cn('rounded-full border px-3 py-1 text-xs', (config.animation || 'none') === a.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-border')}>
                                                        {a.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <Toggle label="La foto se acerca despacio" checked={!!config.photoMotion} onChange={v => set({ photoMotion: v })} />
                                            <Toggle label="El precio grande late" checked={!!config.pricePulse} onChange={v => set({ pricePulse: v })} />
                                            <Button variant="outline" size="sm" onClick={() => setReplay(r => r + 1)}><Play className="w-4 h-4 mr-1.5" /> Ver la animación</Button>
                                            <p className="text-xs text-muted-foreground">Se ve cada vez que el cartel aparece en la pantalla.</p>
                                        </Field>
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
                                                value={newList ? DRAFT_LIST_ID : config.listId || ''}
                                                onChange={e => chooseList(e.target.value)}
                                                className="h-10 w-full rounded-md border border-input bg-background px-3"
                                            >
                                                <option value="">Sin lista</option>
                                                <option value={DRAFT_LIST_ID}>{newList && newRows.length ? 'Productos de este cartel (lista nueva)' : '+ Lista nueva'}</option>
                                                {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.items.filter(i => i.name).length})</option>)}
                                            </select>
                                            {newList && (
                                                <label className="block space-y-1">
                                                    <span className="text-xs text-muted-foreground">Nombre de la lista (así aparece en Listas de precios)</span>
                                                    <Input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Pizzas, Promos de la tarde…" maxLength={80} />
                                                </label>
                                            )}
                                            {(newList || config.listId) && (
                                                <>
                                                    <PosterListEditor rows={rows} onChange={setRows} />
                                                    <p className="text-xs text-muted-foreground">
                                                        {newList
                                                            ? 'Al guardar, estos productos quedan en Listas de precios. Si después cambiás un precio ahí, el cartel se actualiza solo.'
                                                            : <>Se guarda en la lista "{linkedList?.name}". Si otros carteles la usan, también cambian. <Link to={`/admin/display/commerce/${commerceId}/workspace/price-lists?lista=${config.listId}`} className="underline">Abrir en Listas de precios</Link></>}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
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
                                            <QrBuilder url={config.qrUrl} label={config.qrLabel} onChange={set} />
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

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
    return (
        <label className="flex items-center gap-3">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-indigo-500" />
            <span className="text-xs w-10 text-right">{Math.round(value * 100)}%</span>
        </label>
    );
}

// Muestras de color + "otro color" (el selector del sistema).
function ColorSwatches({ colors, value, onChange, auto }: { colors: string[]; value?: string; onChange: (c: string | undefined) => void; auto?: boolean }) {
    const custom = !!value && !colors.includes(value.toLowerCase());
    return (
        <div className="flex flex-wrap items-center gap-1">
            {auto && (
                <button type="button" onClick={() => onChange(undefined)} title="El de la plantilla" aria-label="Color de la plantilla"
                    className={cn('w-6 h-6 rounded-full border border-border', !value && 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-background')}
                    style={{ background: 'conic-gradient(#f26b3a,#fbbf24,#38bdf8,#f26b3a)' }} />
            )}
            {colors.map(c => (
                <button key={c} type="button" onClick={() => onChange(c)} title={c} aria-label={`Color ${c}`}
                    className={cn('w-6 h-6 rounded-full border border-border', value?.toLowerCase() === c && 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-background')}
                    style={{ background: c }} />
            ))}
            <label title="Otro color" className={cn('relative w-6 h-6 rounded-full border border-dashed border-muted-foreground/60 flex items-center justify-center cursor-pointer overflow-hidden', custom && 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-background')}
                style={custom ? { background: value } : undefined}>
                {!custom && <Plus className="w-3.5 h-3.5 text-muted-foreground" />}
                <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Elegir otro color" />
            </label>
        </div>
    );
}

function ColorRow({ label, colors, value, current, onChange }: { label: string; colors: string[]; value?: string; current?: string; onChange: (c: string | undefined) => void }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                {value ? (
                    <button type="button" onClick={() => onChange(undefined)} className="text-xs underline text-muted-foreground">Usar el de la paleta</button>
                ) : current ? <span className="w-4 h-4 rounded-full border border-border" style={{ background: current }} title="Color actual" /> : null}
            </div>
            <ColorSwatches colors={colors} value={value} onChange={onChange} />
        </div>
    );
}

// Tamaño, color y sombra de un texto.
function StyleControls({ style, onChange }: { style?: TextStyle; onChange: (p: Partial<TextStyle>) => void }) {
    const scale = style?.scale || 1;
    return (
        <div className="rounded-lg border border-border p-2.5 space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14">Tamaño</span>
                <input type="range" min={0.4} max={1.8} step={0.05} value={scale} onChange={e => onChange({ scale: Number(e.target.value) })} className="flex-1 accent-indigo-500" />
                <span className="text-xs w-10 text-right">{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-14 pt-1.5">Color</span>
                <ColorSwatches auto colors={TEXT_COLORS.filter(Boolean)} value={style?.color} onChange={c => onChange({ color: c })} />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sombra</span>
                <Switch checked={!!style?.shadow} onCheckedChange={v => onChange({ shadow: v })} />
            </div>
        </div>
    );
}

// Elegir el formato: las mismas medidas que los mosaicos.
function FormatSelect({ value, onChange, className }: { value: PosterFormat; onChange: (f: PosterFormat) => void; className?: string }) {
    const groups = ['TV horizontal', 'TV vertical', 'Otros'] as const;
    return (
        <select value={value} onChange={e => onChange(e.target.value as PosterFormat)} aria-label="Formato de la pantalla"
            className={cn('rounded-md border border-input bg-background px-3', className)}>
            {groups.map(g => {
                const options = POSTER_FORMATS.filter(f => f.group === g && (!f.legacy || f.id === value));
                if (!options.length) return null;
                return (
                    <optgroup key={g} label={g}>
                        {options.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </optgroup>
                );
            })}
        </select>
    );
}

// La vista previa entra entera en el espacio que hay (ancho y alto).
function FitBox({ ratio, children }: { ratio: number; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const read = () => setBox(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const width = Math.min(box.w, box.h * ratio, 1100);
    return (
        <div ref={ref} className="flex-1 min-h-0 flex items-center justify-center">
            {width > 0 && <div style={{ width, height: width / ratio }}>{children}</div>}
        </div>
    );
}

// Debajo de la vista previa: la parte elegida, su tamaño y volver a su lugar.
function PartToolbar({ part, scale, moved, anyMoved, isCard, onScale, onReset, onResetAll, onClose }: {
    part: PosterPart | null; scale: number; moved: boolean; anyMoved: boolean; isCard: boolean;
    onScale: (v: number) => void; onReset: () => void; onResetAll: () => void; onClose: () => void;
}) {
    if (!part) {
        return (
            <div className="shrink-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Move className="w-3.5 h-3.5" /> Tocá una parte (título, precio, lista, QR…) para moverla o cambiarle el tamaño.{isCard ? ' La tarjeta se arrastra desde el borde.' : ''}</span>
                {anyMoved && <button type="button" onClick={onResetAll} className="underline inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Volver todo a su lugar</button>}
            </div>
        );
    }
    const step = (d: number) => onScale(Math.round(Math.min(2.5, Math.max(0.4, scale + d)) * 100) / 100);
    return (
        <div className="shrink-0 mx-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-background px-3 py-1.5 text-sm shadow-sm">
            <span className="font-semibold text-indigo-600 dark:text-indigo-300">{POSTER_PARTS[part]}</span>
            <span className="text-muted-foreground text-xs">Tamaño</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-0.1)} aria-label="Más chico"><Minus className="w-4 h-4" /></Button>
            <span className="w-11 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(0.1)} aria-label="Más grande"><Plus className="w-4 h-4" /></Button>
            {(moved || scale !== 1) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { onReset(); onScale(1); }}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Como estaba</Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Listo"><X className="w-4 h-4" /></Button>
        </div>
    );
}
