import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, ImagePlus, Loader2, Monitor, MonitorSmartphone, QrCode, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDisplayMedia, useReplaceMediaFile, useUploadDisplayMedia } from '@/hooks/use-display-media';
import { useDisplayCampaigns, useUpdateCampaign } from '@/hooks/use-display-hub';
import type { DisplayMedia } from '@/types/display';
import { QrEditor } from '@/components/display/QrEditor';
import { QR_KINDS, qrData, type QrSpec } from '@/lib/qr';
import {
    FIELD_LABELS, PALETTES, PLACA_TEMPLATES, PLACA_TEMPLATE_IDS,
    defaultPlaca, drawPlaca, loadPlacaFonts, loadPlacaImage, placaFromMetadata, placaName, placaSize,
    playlistsWithNewUrl, renderPlacaBlob,
    type PaletteId, type PlacaData, type PlacaField, type PlacaOrientation, type PlacaTemplateId,
} from '@/lib/placas';

const PLACAS_FOLDER = 'Placas';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    // Placa a editar (un archivo de Medios con metadata.placa).
    editing?: DisplayMedia | null;
    initialTemplate?: PlacaTemplateId;
    initialOrientation?: PlacaOrientation;
    // Después de guardar (por ejemplo, para sumarla a la playlist que se está armando).
    onSaved?: (media: DisplayMedia) => void;
    saveLabel?: string;
}

// Arma una placa (promo, precio, aviso…) con un diseño listo y la guarda como
// imagen en Medios, en la carpeta "Placas".
export function PlacaMakerModal(props: Props) {
    return (
        <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground max-w-6xl w-[96vw] h-[94dvh] p-0 gap-0 flex flex-col overflow-hidden">
                {props.isOpen && <PlacaMaker {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function PlacaMaker({ onClose, commerceId, editing, initialTemplate, initialOrientation, onSaved, saveLabel }: Props) {
    const [data, setData] = useState<PlacaData>(() =>
        placaFromMetadata(editing?.metadata) || defaultPlaca(initialTemplate || 'oferta', initialOrientation || 'landscape'));
    // Textos que la persona ya escribió: al cambiar de diseño se conservan; el
    // resto toma el ejemplo del diseño nuevo.
    const [touched, setTouched] = useState<Set<PlacaField>>(() => new Set(editing ? (Object.keys(data.fields) as PlacaField[]) : []));
    const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
    const [photoError, setPhotoError] = useState(false);
    const [pickingPhoto, setPickingPhoto] = useState(false);
    const [fontsReady, setFontsReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    // Código QR: el borrador se guarda aunque lo apaguen, por si lo vuelven a prender.
    const [qrOn, setQrOn] = useState(() => !!data.qr);
    const [qrSpec, setQrSpec] = useState<QrSpec>(() => data.qr?.spec || { kind: 'web' });
    const [qrCaption, setQrCaption] = useState(() => data.qr?.caption ?? QR_KINDS.web.caption);
    const updateQr = (on: boolean, spec: QrSpec, caption: string) => {
        setQrOn(on);
        setQrSpec(spec);
        setQrCaption(caption);
        setData(prev => ({ ...prev, qr: on ? qrData(spec, caption) : null }));
    };

    const { data: media = [] } = useDisplayMedia(commerceId);
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const upload = useUploadDisplayMedia();
    const replace = useReplaceMediaFile();
    const updateCampaign = useUpdateCampaign();

    const template = PLACA_TEMPLATES[data.template];
    const photos = useMemo(
        () => media.filter(m => m.type === 'image' && !placaFromMetadata(m.metadata)).slice(0, 60),
        [media],
    );

    useEffect(() => {
        let cancelled = false;
        loadPlacaFonts().then(() => { if (!cancelled) setFontsReady(true); });
        return () => { cancelled = true; };
    }, []);

    // Carga la foto elegida.
    const photoUrl = data.photo?.url || null;
    useEffect(() => {
        if (!photoUrl) return;
        let cancelled = false;
        loadPlacaImage(photoUrl)
            .then(img => { if (!cancelled) { setPhotoImg(img); setPhotoError(false); } })
            .catch(() => { if (!cancelled) { setPhotoImg(null); setPhotoError(true); } });
        return () => { cancelled = true; };
    }, [photoUrl]);
    const activePhoto = photoUrl ? photoImg : null;

    // Vista previa grande.
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const size = placaSize(data.orientation);
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const frame = requestAnimationFrame(() => drawPlaca(ctx, data, activePhoto));
        return () => cancelAnimationFrame(frame);
    }, [data, activePhoto, fontsReady, size.width, size.height]);

    const setField = (field: PlacaField, value: string) => {
        setTouched(prev => new Set(prev).add(field));
        setData(prev => ({ ...prev, fields: { ...prev.fields, [field]: value.slice(0, FIELD_LABELS[field].max) } }));
    };

    const pickTemplate = (id: PlacaTemplateId) => {
        if (id === data.template) return;
        setData(prev => {
            const next = PLACA_TEMPLATES[id];
            const fields = { ...prev.fields };
            for (const key of Object.keys(fields) as PlacaField[]) {
                if (!touched.has(key)) fields[key] = next.defaults[key] ?? '';
            }
            // El color de ejemplo del diseño, salvo que ya hayan elegido otro.
            const palette = prev.palette === PLACA_TEMPLATES[prev.template].palette ? next.palette : prev.palette;
            return { ...prev, template: id, fields, palette };
        });
    };

    const pickPhoto = (m: { url: string; name?: string } | null) => {
        setPickingPhoto(false);
        setPhotoError(false);
        if (!m) setPhotoImg(null);
        setData(prev => ({ ...prev, photo: m ? { url: m.url, name: m.name } : null }));
    };

    const uploadPhoto = async (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Elegí una foto (JPG o PNG)');
            return;
        }
        try {
            const saved = await upload.mutateAsync({ commerceId, file, folderPath: '/' });
            pickPhoto({ url: saved.url, name: saved.name });
        } catch {
            toast.error('No se pudo subir la foto. Probá de nuevo.');
        }
    };

    const ensureFolder = async () => {
        const exists = media.some(m => m.type === 'folder' && m.name === PLACAS_FOLDER && (m.folder_path || '/') === '/');
        if (!exists) await upload.mutateAsync({ commerceId, isFolder: true, webName: PLACAS_FOLDER, folderPath: '/' });
    };

    const handleSave = async () => {
        if (!data.fields.title.trim() && !data.fields.badge.trim()) {
            toast.error('Escribí al menos el título');
            return;
        }
        if (qrOn && !data.qr) {
            toast.error('Completá los datos del QR o destildá "Con QR"');
            return;
        }
        setSaving(true);
        try {
            let blob: Blob;
            try {
                blob = await renderPlacaBlob(data, activePhoto);
            } catch {
                toast.error('No se pudo usar esa foto. Probá subirla de nuevo desde acá.');
                return;
            }
            const name = placaName(data);
            const file = new File([blob], 'placa.jpg', { type: 'image/jpeg' });
            const metadata = { ...(editing?.metadata as Record<string, unknown> || {}), placa: data, width: size.width, height: size.height };

            if (editing) {
                const updated = await replace.mutateAsync({ media: editing, file, name, metadata });
                // Las playlists guardan la dirección de la imagen: se actualizan
                // para que las pantallas pasen la versión nueva.
                const changed = playlistsWithNewUrl(campaigns, editing, updated.url);
                await Promise.all(changed.map(c => updateCampaign.mutateAsync({ id: c.id, updates: { items_json: c.items_json as never } })));
                toast.success(changed.length
                    ? `Placa actualizada en ${changed.length === 1 ? '1 playlist' : `${changed.length} playlists`}`
                    : 'Placa actualizada');
                onSaved?.(updated);
            } else {
                await ensureFolder();
                const saved = await upload.mutateAsync({ commerceId, file, displayName: name, folderPath: `/${PLACAS_FOLDER}`, metadata });
                toast.success('Placa guardada en Medios › Placas');
                onSaved?.(saved);
            }
            onClose();
        } catch {
            toast.error('No se pudo guardar la placa. Revisá la conexión y probá de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const chip = (active: boolean) =>
        `px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${active
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-border text-muted-foreground hover:text-foreground'}`;

    return (
        <>
            <DialogHeader className="px-5 py-4 border-b border-border text-left space-y-0.5">
                <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> {editing ? 'Editar placa' : 'Crear placa'}</DialogTitle>
                <DialogDescription>Elegí un diseño, escribí tus textos y guardala: queda como imagen en Medios, lista para tus playlists.</DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 grid content-start lg:content-stretch lg:grid-cols-[1fr_380px] overflow-y-auto lg:overflow-hidden">
                {/* Vista previa y diseños */}
                <div className="flex flex-col lg:min-h-0 bg-muted/40 lg:overflow-y-auto">
                    <div className="flex-1 flex items-center justify-center p-4 md:p-6">
                        <canvas
                            ref={canvasRef}
                            width={size.width}
                            height={size.height}
                            aria-label="Vista previa de la placa"
                            className={`rounded-lg shadow-xl bg-black ${data.orientation === 'portrait' ? 'h-[46vh] lg:h-[56vh] w-auto' : 'w-full max-w-[760px] h-auto'}`}
                        />
                    </div>
                    <div className="px-4 md:px-6 pb-4">
                        <p className="text-sm font-medium mb-2">Diseño</p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {PLACA_TEMPLATE_IDS.map(id => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => pickTemplate(id)}
                                    title={PLACA_TEMPLATES[id].hint}
                                    className={`rounded-lg border-2 p-1 text-left transition-colors ${data.template === id ? 'border-indigo-600 bg-indigo-600/10' : 'border-transparent hover:border-indigo-500/40'}`}
                                >
                                    <TemplateThumb id={id} data={data} photo={activePhoto} fontsReady={fontsReady} />
                                    <span className="block text-xs font-medium mt-1 truncate">{PLACA_TEMPLATES[id].label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Datos */}
                <div className="border-t lg:border-t-0 lg:border-l border-border lg:overflow-y-auto p-4 md:p-5 space-y-5">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Formato</p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setData(prev => ({ ...prev, orientation: 'landscape' }))} className={chip(data.orientation === 'landscape')}>
                                <Monitor className="w-4 h-4" /> Horizontal
                            </button>
                            <button type="button" onClick={() => setData(prev => ({ ...prev, orientation: 'portrait' }))} className={chip(data.orientation === 'portrait')}>
                                <MonitorSmartphone className="w-4 h-4" /> Vertical
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {template.fields.map(field => {
                            const info = FIELD_LABELS[field];
                            const value = data.fields[field];
                            return (
                                <label key={field} className="block space-y-1">
                                    <span className="text-sm font-medium">{info.label}</span>
                                    {field === 'lines' ? (
                                        <Textarea value={value} onChange={e => setField(field, e.target.value)} placeholder={info.placeholder} rows={4} className="bg-background border-border" />
                                    ) : (
                                        <Input value={value} onChange={e => setField(field, e.target.value)} placeholder={info.placeholder} className="bg-background border-border" />
                                    )}
                                </label>
                            );
                        })}
                    </div>

                    {template.usesPhoto && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{data.template === 'bienvenida' ? 'Logo o foto' : 'Foto'}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                {data.photo && !photoError && (
                                    <img src={data.photo.url} alt="" className="w-16 h-10 rounded object-cover border border-border" />
                                )}
                                <Button type="button" variant="outline" size="sm" onClick={() => setPickingPhoto(v => !v)}>
                                    <ImagePlus className="w-4 h-4 mr-1.5" /> {data.photo ? 'Cambiar' : 'Elegir de Medios'}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                                    {upload.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />} Subir
                                </Button>
                                {data.photo && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => pickPhoto(null)} className="text-muted-foreground">
                                        <ImageOff className="w-4 h-4 mr-1.5" /> Sin foto
                                    </Button>
                                )}
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                            </div>
                            {photoError && <p className="text-xs text-rose-600 dark:text-rose-400">No se pudo cargar esa foto. Elegí otra o subila de nuevo.</p>}
                            {pickingPhoto && (
                                photos.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Todavía no hay fotos en Medios. Usá "Subir".</p>
                                ) : (
                                    <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto rounded-lg border border-border p-1.5 bg-background">
                                        {photos.map(m => (
                                            <button key={m.id} type="button" onClick={() => pickPhoto({ url: m.url, name: m.name })} title={m.name}
                                                className={`aspect-video rounded overflow-hidden border-2 ${data.photo?.url === m.url ? 'border-indigo-600' : 'border-transparent hover:border-indigo-500/50'}`}>
                                                <img src={m.url} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium flex items-center gap-1.5"><QrCode className="w-4 h-4" /> Código QR</p>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={qrOn} onChange={e => updateQr(e.target.checked, qrSpec, qrCaption)} className="w-4 h-4 accent-indigo-600" />
                                {qrOn ? 'Con QR' : 'Agregar'}
                            </label>
                        </div>
                        {qrOn ? (
                            <QrEditor spec={qrSpec} caption={qrCaption} commerceId={commerceId} onChange={(spec, caption) => updateQr(true, spec, caption)} />
                        ) : (
                            <p className="text-xs text-muted-foreground">Para que escaneen el menú, tu web, WhatsApp o Instagram.</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Colores</p>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(PALETTES) as PaletteId[]).map(id => {
                                const p = PALETTES[id];
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setData(prev => ({ ...prev, palette: id }))}
                                        title={p.label}
                                        aria-label={p.label}
                                        aria-pressed={data.palette === id}
                                        className={`w-10 h-10 rounded-full border-2 overflow-hidden relative ${data.palette === id ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-border'}`}
                                        style={{ background: `linear-gradient(135deg, ${p.bg} 0 60%, ${p.accent} 60% 100%)` }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground hidden sm:block">
                    {editing ? 'Al guardar, las pantallas que la usan pasan la versión nueva.' : 'Después la podés editar para cambiar el precio o el texto.'}
                </p>
                <div className="flex gap-2 ml-auto">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…</> : (saveLabel || (editing ? 'Guardar cambios' : 'Guardar placa'))}
                    </Button>
                </div>
            </div>
        </>
    );
}

// Miniatura de un diseño con los textos y colores actuales.
function TemplateThumb({ id, data, photo, fontsReady }: { id: PlacaTemplateId; data: PlacaData; photo: HTMLImageElement | null; fontsReady: boolean }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const thumbData = useMemo<PlacaData>(() => {
        const info = PLACA_TEMPLATES[id];
        // Si el diseño usa campos que esta placa no tiene, se ve con su ejemplo.
        const fields = { ...data.fields };
        for (const key of info.fields) if (!fields[key]) fields[key] = info.defaults[key] ?? '';
        return { ...data, template: id, fields };
    }, [id, data]);
    const { width, height } = placaSize(data.orientation);
    const scale = 0.12;

    useEffect(() => {
        const timer = setTimeout(() => {
            const ctx = ref.current?.getContext('2d');
            if (!ctx) return;
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            drawPlaca(ctx, thumbData, photo);
        }, 250);
        return () => clearTimeout(timer);
    }, [thumbData, photo, fontsReady]);

    return (
        <canvas
            ref={ref}
            width={Math.round(width * scale)}
            height={Math.round(height * scale)}
            className={`w-full rounded bg-black ${data.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'}`}
        />
    );
}
