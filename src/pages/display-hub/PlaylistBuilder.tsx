import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, GripVertical,
    Maximize2, MonitorPlay, Plus, Search, Send, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useAssignContentToDevice, useDisplayCampaigns, useDisplayDevices, useUpdateCampaign } from '@/hooks/use-display-hub';
import { useDisplayMedia, useUploadDisplayMedia } from '@/hooks/use-display-media';
import { useVideoUploadCheck } from '@/hooks/use-video-upload-check';
import { useLocalDay } from '@/hooks/use-local-day';
import type { DisplayCampaignV2, DisplayFitMode, DisplayMedia, DisplayTransition, UniversalElement } from '@/types/display';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';
import { PlaylistPreviewModal } from '@/components/display/PlaylistPreviewModal';
import { PlaylistMiniPreview } from '@/components/display/PlaylistMiniPreview';
import { HeavyVideoBadge } from '@/components/display/HeavyVideoBadge';
import { ContentThumb } from '@/components/display/ContentThumb';
import { appKindOf } from '@/lib/appCovers';
import {
    DEFAULT_ITEM_DURATION, dayKeyPlus, formatClock, formatDayShort, formatDuration, isVideoItem, itemDateStatus,
    itemSeconds, itemsActiveOn, loopDuration,
    mediaToPlaylistItem, toPlaylistV2, videoSeconds,
} from '@/lib/playlistItems';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

const APP_TYPES = ['app', 'widget', 'layout'];
type Kind = 'all' | 'video' | 'image' | 'web' | 'app';

const kindOf = (type?: string): Exclude<Kind, 'all'> | null => {
    if (type === 'video' || type === 'video_ad') return 'video';
    if (type === 'image' || type === 'image_ad') return 'image';
    if (type === 'web' || type === 'url' || type === 'external_url') return 'web';
    if (type && APP_TYPES.includes(type)) return 'app';
    return null;
};

const KIND_LABEL: Record<Exclude<Kind, 'all'>, string> = { video: 'Video', image: 'Imagen', web: 'Página web', app: 'App' };
// "Imagen", "Video", "Página web" o el tipo de app ("Clima", "Dólar"…).
const kindText = (item: AnyItem) => (kindOf(item?.type) === 'app' ? appKindOf(item).label : KIND_LABEL[kindOf(item?.type) || 'image']);

const CHIPS: { id: Kind; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'video', label: 'Videos' },
    { id: 'image', label: 'Imágenes' },
    { id: 'web', label: 'Webs' },
    { id: 'app', label: 'Apps' },
];

const TRANSITIONS: { value: DisplayTransition; label: string }[] = [
    { value: 'fade', label: 'Fundido suave' },
    { value: 'none', label: 'Corte directo' },
    { value: 'slide', label: 'Deslizar' },
    { value: 'zoom', label: 'Acercar' },
    { value: 'blur', label: 'Desenfocar' },
    { value: 'flip', label: 'Girar' },
    { value: 'bounce', label: 'Rebote' },
];

const FIT_MODES: { value: DisplayFitMode; label: string; hint: string }[] = [
    { value: 'contain', label: 'Entero', hint: 'Se ve completo; pueden quedar bordes negros' },
    { value: 'cover', label: 'Llenar pantalla', hint: 'Ocupa toda la pantalla; puede recortar los bordes' },
    { value: 'fill', label: 'Estirar', hint: 'Ocupa toda la pantalla deformando la imagen' },
];

function Thumb({ item, className = 'w-14 h-9' }: { item: AnyItem; className?: string }) {
    return (
        <div className={`${className} shrink-0 rounded-md overflow-hidden bg-muted border border-border`}>
            <ContentThumb item={item} className="w-full h-full pointer-events-none" iconClassName="w-4 h-4" />
        </div>
    );
}

function StepTitle({ n, children, done }: { n: number; children: React.ReactNode; done?: boolean }) {
    return (
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
            </span>
            {children}
        </h2>
    );
}

// Qué está pasando ahora una pantalla, en palabras.
function nowShowing(device: AnyItem): string {
    const a = device.assignment;
    if (!a) return 'Nada asignado';
    if (a.campaign?.name) return a.campaign.name;
    if (a.media?.name) return a.media.name;
    if (a.schedule?.name) return `Programación "${a.schedule.name}"`;
    return 'Nada asignado';
}

// Editor de una playlist en 3 pasos: agregar contenido, ordenarlo y elegir
// cuánto dura cada uno, y elegir en qué pantallas se ve.
const PlaylistBuilder = () => {
    const navigate = useNavigate();
    const { commerceId, playlistId } = useParams<{ commerceId: string; playlistId: string }>();

    const { data: playlists, isLoading: loadingPlaylists } = useDisplayCampaigns(commerceId);
    const { data: mediaFiles = [], isLoading: loadingMedia } = useDisplayMedia(commerceId);
    const { data: devices = [] } = useDisplayDevices(commerceId);
    const { mutateAsync: uploadMedia } = useUploadDisplayMedia();
    const updateCampaign = useUpdateCampaign();
    const assignContent = useAssignContentToDevice();
    const { prepare: prepareUploads, dialog: videoCheckDialog } = useVideoUploadCheck();

    const playlistRecord = playlists?.find(c => c.id === playlistId);

    // Lo que se edita y lo último guardado (para saber si hay cambios).
    const [campaignV2, setCampaignV2] = useState<DisplayCampaignV2>(toPlaylistV2(null));
    const [name, setName] = useState('');
    const [saved, setSaved] = useState<{ json: string; name: string } | null>(null);
    const [loadedId, setLoadedId] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [kind, setKind] = useState<Kind>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pickedScreens, setPickedScreens] = useState<string[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Se carga una sola vez por playlist: si la lista se vuelve a pedir
    // (cambio de pestaña, otra pantalla), no pisa lo que se está editando.
    useEffect(() => {
        if (!playlistRecord || loadedId === playlistRecord.id) return;
        const v2 = toPlaylistV2(playlistRecord.items_json);
        setCampaignV2(v2);
        setName(playlistRecord.name);
        setSaved({ json: JSON.stringify(v2), name: playlistRecord.name });
        setLoadedId(playlistRecord.id);
        setPickedScreens([]);
    }, [playlistRecord, loadedId]);

    const dirty = !!saved && (JSON.stringify(campaignV2) !== saved.json || name.trim() !== saved.name);

    // Avisar antes de cerrar la pestaña con cambios sin guardar.
    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const items: AnyItem[] = campaignV2.zones[0]?.playlist || [];
    const settings = campaignV2.settings;

    const setItems = (next: UniversalElement[] | ((prev: UniversalElement[]) => UniversalElement[])) => {
        setCampaignV2(prev => {
            const zones = [...prev.zones];
            if (!zones[0]) return prev;
            zones[0] = { ...zones[0], playlist: typeof next === 'function' ? next(zones[0].playlist) : next };
            return { ...prev, zones };
        });
    };
    const setSettings = (updates: Partial<DisplayCampaignV2['settings']>) =>
        setCampaignV2(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }));

    // ---- Paso 1: biblioteca ----
    const library = useMemo(() => (mediaFiles as DisplayMedia[])
        .filter(m => kindOf(m.type))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')), [mediaFiles]);
    const counts = useMemo(() => {
        const c: Record<Kind, number> = { all: library.length, video: 0, image: 0, web: 0, app: 0 };
        for (const m of library) c[kindOf(m.type)!]++;
        return c;
    }, [library]);
    const visibleLibrary = library.filter(m =>
        (kind === 'all' || kindOf(m.type) === kind) &&
        m.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    const timesInPlaylist = (media: DisplayMedia) =>
        items.filter(i => i.source_id === media.id || (!!media.url && i.url === media.url)).length;

    const addMedia = (list: DisplayMedia[]) => {
        if (list.length === 0) return;
        const added = list.map(m => mediaToPlaylistItem(m, settings));
        setItems(prev => [...prev, ...added]);
        if (list.length === 1) toast.success(`Agregado: ${list[0].name}`, { duration: 1500 });
    };

    const handleUploadFiles = async (fileList: FileList | null) => {
        if (!fileList || !commerceId) return;
        const list = Array.from(fileList);
        if (list.length === 0) return;
        const prepared = await prepareUploads(list);
        if (!prepared) return;

        const uploaded: DisplayMedia[] = [];
        let failCount = 0;
        const toastId = toast.loading(`Subiendo ${list.length === 1 ? '1 archivo' : `${list.length} archivos`}…`);
        for (const { file, metadata } of prepared) {
            try {
                uploaded.push(await uploadMedia({ commerceId, file, folderPath: '/', metadata }));
            } catch (error) {
                console.error('Upload error:', error);
                failCount++;
            }
        }
        addMedia(uploaded);
        if (failCount > 0) toast.error(`Se subieron ${uploaded.length}, pero fallaron ${failCount}.`, { id: toastId });
        else toast.success(uploaded.length === 1 ? 'Subido y agregado a la playlist' : `Se subieron y agregaron ${uploaded.length} archivos`, { id: toastId });
        setIsUploadModalOpen(false);
    };

    const handleAddWebLink = async (url: string, webName: string) => {
        if (!commerceId) return;
        const toastId = toast.loading('Agregando la página…');
        try {
            const media = await uploadMedia({ commerceId, webUrl: url, webName, folderPath: '/' });
            addMedia([media]);
            toast.success('Página agregada a la playlist', { id: toastId });
        } catch (error) {
            console.error('Web link error:', error);
            toast.error('No se pudo agregar la página', { id: toastId });
        }
    };

    // ---- Paso 2: lista ----
    const updateItem = (id: string, updates: Partial<UniversalElement>) =>
        setItems(items.map(i => (i.id === id ? { ...i, ...updates } : i)));
    const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
    const moveItem = (from: number, to: number) => {
        if (to < 0 || to >= items.length || from === to) return;
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setItems(next);
    };

    // El paso entre uno y otro se aplica a todos (cada uno se puede cambiar después).
    const setTransitionForAll = (value: DisplayTransition) => {
        setCampaignV2(prev => {
            const zones = [...prev.zones];
            if (zones[0]) zones[0] = { ...zones[0], playlist: zones[0].playlist.map(i => ({ ...i, transition: value })) };
            return { ...prev, settings: { ...prev.settings, transition: value }, zones };
        });
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex !== null) moveItem(draggedIndex, dropIndex);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Lo que se ve hoy (sin lo vencido ni lo que todavía no empieza).
    const today = useLocalDay();
    const activeItems = itemsActiveOn(items, today);
    const offDate = items.length - activeItems.length;
    const loop = loopDuration(activeItems);

    // ---- Paso 3: pantallas ----
    const screens = (devices as AnyItem[]).filter(d => d.pairing_status === 'linked');
    const alreadyShowing = new Set(screens.filter(d => d.assignment?.campaign_id === playlistId).map(d => d.id));
    const isChecked = (id: string) => alreadyShowing.has(id) || pickedScreens.includes(id);
    const checkedCount = screens.filter(d => isChecked(d.id)).length;
    const newScreens = screens.filter(d => !alreadyShowing.has(d.id) && pickedScreens.includes(d.id));
    const toggleScreen = (id: string) =>
        setPickedScreens(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
    const pickAll = () => setPickedScreens(screens.filter(d => !alreadyShowing.has(d.id)).map(d => d.id));

    const save = async () => {
        if (!playlistId) return false;
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error('Poné un nombre para la playlist');
            return false;
        }
        if (!dirty) return true;
        try {
            await updateCampaign.mutateAsync({ id: playlistId, updates: { items_json: campaignV2, name: trimmed } });
            setSaved({ json: JSON.stringify(campaignV2), name: trimmed });
            return true;
        } catch {
            toast.error('No se pudo guardar. Revisá la conexión y probá de nuevo.');
            return false;
        }
    };

    const handleSend = async () => {
        if (items.length === 0 && checkedCount > 0) {
            toast.error('La playlist está vacía: agregá contenido antes de enviarla');
            return;
        }
        setSending(true);
        try {
            if (!(await save())) return;
            if (newScreens.length > 0) {
                await Promise.all(newScreens.map(d => assignContent.mutateAsync({
                    deviceId: d.id, campaignId: playlistId, mediaId: null, scheduleId: null,
                })));
                setPickedScreens([]);
            }
            if (checkedCount === 0) toast.success('Cambios guardados');
            else toast.success(checkedCount === 1
                ? 'Listo: la pantalla pasa esta playlist en unos segundos'
                : `Listo: ${checkedCount} pantallas pasan esta playlist en unos segundos`);
        } catch {
            toast.error('Se guardó la playlist, pero no se pudo enviar a alguna pantalla. Probá de nuevo.');
        } finally {
            setSending(false);
        }
    };

    const goBack = () => {
        if (dirty && !window.confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
        navigate(`/admin/display/commerce/${commerceId}/workspace/playlists`);
    };

    if (loadingPlaylists) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cargando…</div>;
    if (!playlistRecord) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-foreground">
                <p>No encontramos esta playlist.</p>
                <Button variant="outline" asChild>
                    <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`}>Volver a Playlists</Link>
                </Button>
            </div>
        );
    }

    const status = sending || updateCampaign.isPending
        ? { text: 'Guardando…', dot: 'bg-indigo-500 animate-pulse' }
        : dirty
            ? { text: 'Cambios sin guardar', dot: 'bg-amber-500' }
            : { text: 'Cambios guardados', dot: 'bg-emerald-500' };

    const sendLabel = checkedCount > 0
        ? `Enviar a ${checkedCount} ${checkedCount === 1 ? 'pantalla' : 'pantallas'}`
        : 'Guardar';

    return (
        <div className="min-h-screen lg:h-screen bg-background flex flex-col text-foreground lg:overflow-hidden">
            {/* Barra superior */}
            <header className="bg-card border-b border-border px-3 md:px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
                <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
                    <ArrowLeft className="w-4 h-4" /> Playlists
                </button>
                <div className="h-8 w-px bg-border hidden sm:block" />
                <div className="flex-1 min-w-[180px]">
                    <label htmlFor="playlist-name" className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nombre de la playlist</label>
                    <input
                        id="playlist-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full max-w-md bg-transparent text-base md:text-lg font-semibold outline-none border-b border-transparent hover:border-border focus:border-indigo-500"
                    />
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <span className={`w-2 h-2 rounded-full ${status.dot}`} /> {status.text}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setIsPreviewModalOpen(true)}>
                        <MonitorPlay className="w-4 h-4 mr-1.5" /> Ver cómo queda
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSend}
                        disabled={sending || (!dirty && newScreens.length === 0 && checkedCount === 0)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <Send className="w-4 h-4 mr-1.5" /> {sending ? 'Enviando…' : sendLabel}
                    </Button>
                </div>
            </header>

            {/* Los 3 pasos */}
            <div className="bg-card/60 border-b border-border px-3 md:px-5 py-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground shrink-0">
                {['Agregá contenido', 'Ordenalo y elegí cuánto dura cada uno', 'Elegí en qué pantallas se ve'].map((text, i) => (
                    <span key={text} className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        {text}
                    </span>
                ))}
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:overflow-hidden">
                {/* Paso 1 */}
                <section className="bg-card border-b lg:border-b-0 lg:border-r border-border flex flex-col lg:overflow-hidden max-h-[60vh] lg:max-h-none">
                    <div className="p-4 space-y-3 border-b border-border">
                        <StepTitle n={1} done={items.length > 0}>Agregá contenido</StepTitle>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar en Medios…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 h-9 bg-background border-border"
                            />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {CHIPS.filter(c => c.id === 'all' || counts[c.id] > 0).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setKind(c.id)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${kind === c.id
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {loadingMedia ? (
                            <p className="text-sm text-muted-foreground p-3">Cargando…</p>
                        ) : visibleLibrary.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-3">
                                {library.length === 0 ? 'Todavía no subiste nada. Subí fotos o videos con el botón de abajo.' : 'No hay nada con ese nombre.'}
                            </p>
                        ) : visibleLibrary.map(media => {
                            const times = timesInPlaylist(media);
                            const real = videoSeconds({ type: media.type, metadata: media.metadata });
                            return (
                                <button
                                    key={media.id}
                                    onClick={() => addMedia([media])}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-muted group"
                                    title="Agregar a la playlist"
                                >
                                    <Thumb item={media} />
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-medium truncate">{media.name}</span>
                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
                                            {kindText(media)}{real ? ` · ${formatClock(real)}` : ''}
                                            {times > 0 && (
                                                <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" title={times > 1 ? `Está ${times} veces en la playlist` : 'Ya está en la playlist'}>
                                                    <Check className="w-3.5 h-3.5" />{times > 1 ? `×${times}` : ''}
                                                </span>
                                            )}
                                            <HeavyVideoBadge media={media} />
                                        </span>
                                    </span>
                                    <span className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white shrink-0">
                                        <Plus className="w-4 h-4" />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="p-3 border-t border-border">
                        <button onClick={() => setIsUploadModalOpen(true)} className="w-full flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline py-1">
                            <Upload className="w-4 h-4" /> Subir un archivo nuevo
                        </button>
                    </div>
                </section>

                {/* Paso 2 */}
                <section className="flex flex-col lg:overflow-hidden border-b lg:border-b-0 border-border">
                    <div className="p-4 md:px-6 space-y-3 border-b border-border bg-background">
                        <StepTitle n={2}>Ordená y elegí cuánto dura cada uno</StepTitle>
                        <p className="text-sm text-muted-foreground">
                            {items.length === 0
                                ? 'Todavía no hay nada en la playlist.'
                                : <>
                                    {items.length} {items.length === 1 ? 'elemento' : 'elementos'} · una vuelta dura <strong className="text-foreground">{loop.exact ? '' : '~'}{formatDuration(loop.seconds)}</strong> · se repite sin parar
                                    {offDate > 0 && <span className="text-amber-600 dark:text-amber-400"> · {offDate === 1 ? '1 está fuera de fecha y hoy no se ve' : `${offDate} están fuera de fecha y hoy no se ven`}</span>}
                                </>}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            <label className="flex items-center gap-2">
                                <span className="text-muted-foreground">Paso entre uno y otro</span>
                                <Select value={settings.transition || 'fade'} onValueChange={v => setTransitionForAll(v as DisplayTransition)}>
                                    <SelectTrigger className="h-8 w-[150px] bg-card border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground">
                                        {TRANSITIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!settings.shuffle}
                                    onChange={e => setSettings({ shuffle: e.target.checked })}
                                    className="w-4 h-4 accent-indigo-600"
                                />
                                Orden al azar
                            </label>
                            <label className="flex items-center gap-2" title="Lo que dura cada foto o página que agregues de ahora en más">
                                <span className="text-muted-foreground">Las fotos nuevas duran</span>
                                <Input
                                    type="number" min={1} max={300}
                                    value={settings.defaultDuration || DEFAULT_ITEM_DURATION}
                                    onChange={e => setSettings({ defaultDuration: Math.max(1, parseInt(e.target.value) || DEFAULT_ITEM_DURATION) })}
                                    className="h-8 w-16 text-center bg-card border-border"
                                />
                                <span className="text-muted-foreground">s</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:px-6 bg-muted/30">
                        {items.length === 0 ? (
                            <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
                                <Plus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="font-medium">La playlist está vacía</p>
                                <p className="text-sm text-muted-foreground mt-1">Tocá <strong>+</strong> en el paso 1 para agregar fotos, videos o páginas.</p>
                            </div>
                        ) : (
                            <>
                                <ol className="space-y-2">
                                    {items.map((item, index) => {
                                        const itemKind = kindOf(item.type);
                                        const video = isVideoItem(item);
                                        const real = videoSeconds(item);
                                        const repeats = video && real && (Number(item.duration) || 0) > real;
                                        const expanded = expandedId === item.id;
                                        const dateStatus = itemDateStatus(item, today);
                                        const isDragOver = dragOverIndex === index && draggedIndex !== index;
                                        return (
                                            <li
                                                key={item.id}
                                                onDragEnter={() => setDragOverIndex(index)}
                                                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                                onDrop={e => handleDrop(e, index)}
                                                className={`bg-card border rounded-xl transition-all ${draggedIndex === index ? 'opacity-50 border-indigo-500' : isDragOver ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-border'}`}
                                            >
                                                <div className="flex items-center gap-2 sm:gap-3 p-2 pr-3">
                                                    <span
                                                        draggable
                                                        onDragStart={e => { setDraggedIndex(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); }}
                                                        onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                                                        className="hidden sm:flex cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
                                                        title="Arrastrá para cambiar el orden"
                                                    >
                                                        <GripVertical className="w-4 h-4" />
                                                    </span>
                                                    <span className="w-4 sm:w-5 text-center text-sm font-semibold text-muted-foreground shrink-0">{index + 1}</span>
                                                    <Thumb item={item} className="w-12 h-8 sm:w-16 sm:h-10" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="flex items-center gap-2 min-w-0">
                                                            <span className={`text-sm font-medium truncate ${dateStatus === 'active' ? '' : 'text-muted-foreground'}`}>{item.content || 'Sin nombre'}</span>
                                                            {dateStatus === 'expired' && <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400">Vencido</span>}
                                                            {dateStatus === 'upcoming' && <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300">Empieza el {formatDayShort(item.validFrom)}</span>}
                                                            {dateStatus === 'active' && item.validUntil && <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">Hasta el {formatDayShort(item.validUntil)}</span>}
                                                        </p>
                                                        <button onClick={() => setExpandedId(expanded ? null : item.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                                            <span className="hidden sm:inline">{itemKind ? kindText(item) : 'Contenido'} · más opciones</span>
                                                            <span className="sm:hidden">Opciones</span>
                                                            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className="text-xs text-muted-foreground hidden sm:inline">Dura</span>
                                                        {video ? (
                                                            <span
                                                                className="text-sm font-medium px-2 py-1 rounded-md bg-muted whitespace-nowrap"
                                                                title="Los videos se ven enteros. Si querés que uno corto se repita, cambialo en las opciones."
                                                            >
                                                                {real ? formatClock(itemSeconds(item).seconds) : 'Lo que dure'}
                                                                <span className="text-muted-foreground font-normal"> {repeats ? '(repetido)' : '(entero)'}</span>
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <Input
                                                                    type="number" min={1} max={3600}
                                                                    aria-label="Segundos en pantalla"
                                                                    value={item.duration}
                                                                    onChange={e => updateItem(item.id, { duration: Math.max(1, parseInt(e.target.value) || DEFAULT_ITEM_DURATION) })}
                                                                    className="h-8 w-16 text-center bg-background border-border"
                                                                />
                                                                <span className="text-sm text-muted-foreground">s</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col sm:hidden">
                                                        <button onClick={() => moveItem(index, index - 1)} disabled={index === 0} className="p-0.5 text-muted-foreground disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => moveItem(index, index + 1)} disabled={index === items.length - 1} className="p-0.5 text-muted-foreground disabled:opacity-30" aria-label="Bajar"><ArrowDown className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                    <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10" title="Quitar de la playlist" aria-label="Quitar">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {expanded && (
                                                    <div className="border-t border-border px-3 py-3 sm:pl-[88px] grid gap-3 sm:grid-cols-2 text-sm">
                                                        <div className="space-y-1.5">
                                                            <p className="text-xs font-medium text-muted-foreground">Cómo ocupa la pantalla</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {FIT_MODES.map(f => (
                                                                    <button
                                                                        key={f.value}
                                                                        title={f.hint}
                                                                        onClick={() => updateItem(item.id, { fitMode: f.value })}
                                                                        className={`px-2.5 py-1 rounded-md border text-xs ${(item.fitMode || 'contain') === f.value
                                                                            ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300'
                                                                            : 'border-border text-muted-foreground hover:text-foreground'}`}
                                                                    >
                                                                        {f.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-xs font-medium text-muted-foreground">Cómo entra</p>
                                                            <Select
                                                                value={TRANSITIONS.some(t => t.value === item.transition) ? item.transition : (settings.transition || 'fade')}
                                                                onValueChange={v => updateItem(item.id, { transition: v as DisplayTransition })}
                                                            >
                                                                <SelectTrigger className="h-8 w-[160px] bg-background border-border"><SelectValue /></SelectTrigger>
                                                                <SelectContent className="bg-card border-border text-foreground">
                                                                    {TRANSITIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5 sm:col-span-2">
                                                            <p className="text-xs font-medium text-muted-foreground">Fechas (para promos que vencen)</p>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-muted-foreground">Mostrar desde</span>
                                                                <Input
                                                                    type="date" value={item.validFrom || ''} max={item.validUntil || undefined}
                                                                    onChange={e => updateItem(item.id, { validFrom: e.target.value || undefined })}
                                                                    className="h-8 w-[150px] bg-background border-border"
                                                                    aria-label="Mostrar desde"
                                                                />
                                                                <span className="text-muted-foreground">hasta</span>
                                                                <Input
                                                                    type="date" value={item.validUntil || ''} min={item.validFrom || undefined}
                                                                    onChange={e => updateItem(item.id, { validUntil: e.target.value || undefined })}
                                                                    className="h-8 w-[150px] bg-background border-border"
                                                                    aria-label="Mostrar hasta"
                                                                />
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                                                <button onClick={() => updateItem(item.id, { validUntil: dayKeyPlus((7 - new Date().getDay()) % 7) })} className="text-indigo-600 dark:text-indigo-400 hover:underline">Hasta este domingo</button>
                                                                <button onClick={() => updateItem(item.id, { validUntil: dayKeyPlus(6) })} className="text-indigo-600 dark:text-indigo-400 hover:underline">Por una semana</button>
                                                                <button onClick={() => updateItem(item.id, { validUntil: dayKeyPlus(29) })} className="text-indigo-600 dark:text-indigo-400 hover:underline">Por un mes</button>
                                                                {(item.validFrom || item.validUntil) && (
                                                                    <button onClick={() => updateItem(item.id, { validFrom: undefined, validUntil: undefined })} className="text-muted-foreground hover:text-foreground hover:underline">Sin fechas (siempre)</button>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">Fuera de estas fechas no se muestra: no hace falta acordarse de sacarlo.</p>
                                                        </div>
                                                        {video && (
                                                            <div className="space-y-1.5 sm:col-span-2">
                                                                <p className="text-xs font-medium text-muted-foreground">Si el video es corto, repetirlo hasta cumplir</p>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number" min={1} max={3600}
                                                                        value={item.duration}
                                                                        onChange={e => updateItem(item.id, { duration: Math.max(1, parseInt(e.target.value) || 1) })}
                                                                        className="h-8 w-20 text-center bg-background border-border"
                                                                    />
                                                                    <span className="text-muted-foreground">segundos</span>
                                                                    {real && (
                                                                        <button onClick={() => updateItem(item.id, { duration: Math.max(1, Math.floor(real)) })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                                                            Que pase una sola vez ({formatClock(real)})
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">Nunca se corta a la mitad: si dura más, se ve entero.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ol>
                                <p className="text-xs text-muted-foreground mt-3">
                                    <span className="hidden sm:inline">Arrastrá desde los puntitos para cambiar el orden.</span>
                                    <span className="sm:hidden">Usá las flechitas para cambiar el orden.</span>
                                    {' '}Los videos duran lo que dura el video.
                                </p>
                            </>
                        )}
                    </div>
                </section>

                {/* Vista previa + Paso 3 */}
                <section className="bg-card lg:border-l border-border lg:overflow-y-auto">
                    <div className="p-4 border-b border-border space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold">Así se ve</h2>
                            <button onClick={() => setIsPreviewModalOpen(true)} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                <Maximize2 className="w-3 h-3" /> Ver en grande
                            </button>
                        </div>
                        <PlaylistMiniPreview
                            items={activeItems}
                            commerceId={commerceId}
                            portrait={settings.orientation === 'portrait'}
                            shuffle={settings.shuffle}
                            transition={settings.transition}
                            enabled={!isPreviewModalOpen}
                        />
                    </div>

                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <StepTitle n={3} done={checkedCount > 0}>¿En qué pantallas se ve?</StepTitle>
                            {screens.length > 1 && screens.some(d => !isChecked(d.id)) && (
                                <button onClick={pickAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">Elegir todas</button>
                            )}
                        </div>
                        {screens.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Todavía no tenés pantallas vinculadas. Agregalas desde{' '}
                                <Link to={`/admin/display/commerce/${commerceId}/workspace/screens`} className="text-indigo-600 dark:text-indigo-400 hover:underline">Pantallas</Link>.
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {screens.map(device => {
                                    const showing = alreadyShowing.has(device.id);
                                    const online = device.derived_status === 'online';
                                    return (
                                        <li key={device.id}>
                                            <label className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${isChecked(device.id) ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-border hover:bg-muted'} ${showing ? 'cursor-default' : 'cursor-pointer'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked(device.id)}
                                                    disabled={showing}
                                                    onChange={() => toggleScreen(device.id)}
                                                    className="mt-0.5 w-4 h-4 accent-indigo-600"
                                                />
                                                <span className="flex-1 min-w-0">
                                                    <span className="flex items-center gap-1.5 text-sm font-medium">
                                                        <span className={`w-2 h-2 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-rose-500'}`} title={online ? 'Conectada' : 'Sin señal'} />
                                                        <span className="truncate">{device.name || `Pantalla ${device.device_id}`}</span>
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground truncate">
                                                        {showing ? 'Ya está pasando esta playlist' : `Ahora: ${nowShowing(device)}`}
                                                        {!online && ' · sin señal'}
                                                    </span>
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Al enviar, las pantallas elegidas dejan lo que muestran y pasan esta playlist en segundos.
                            {alreadyShowing.size > 0 && ' Las que ya la pasan se actualizan solas cuando guardás.'}
                        </p>
                    </div>
                </section>
            </div>

            <UploadMediaModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                activeCategory="all"
                onUpload={handleUploadFiles}
                onAddWebLink={handleAddWebLink}
            />
            {videoCheckDialog}

            <PlaylistPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                items={activeItems}
            />
        </div>
    );
};

export default PlaylistBuilder;
