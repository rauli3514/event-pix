import { useMemo, useRef } from 'react';
import { FileText, Globe, Instagram, Loader2, MessageCircle, Upload, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useUploadDisplayMedia } from '@/hooks/use-display-media';
import { QR_KINDS, qrSvgPath, qrValue, whatsappNumber, type QrKind, type QrSpec } from '@/lib/qr';

const KIND_ICONS: Record<QrKind, typeof Globe> = { web: Globe, whatsapp: MessageCircle, instagram: Instagram, wifi: Wifi, pdf: FileText };
const KIND_ORDER: QrKind[] = ['web', 'whatsapp', 'instagram', 'wifi', 'pdf'];

interface Props {
    spec: QrSpec;
    caption: string;
    onChange: (spec: QrSpec, caption: string) => void;
    commerceId: string;
}

// Qué abre el QR (web, WhatsApp, Instagram, Wi-Fi o la carta en PDF) y la
// leyenda que va debajo. Muestra el QR en vivo para probarlo con el celular.
export function QrEditor({ spec, caption, onChange, commerceId }: Props) {
    const upload = useUploadDisplayMedia();
    const fileRef = useRef<HTMLInputElement>(null);
    const value = qrValue(spec);
    const preview = useMemo(() => (value ? qrSvgPath(value) : null), [value]);

    const set = (patch: Partial<QrSpec>) => onChange({ ...spec, ...patch }, caption);
    const pickKind = (kind: QrKind) => {
        if (kind === spec.kind) return;
        // La leyenda sugerida cambia con el tipo, salvo que la hayan escrito.
        const suggested = Object.values(QR_KINDS).some(k => k.caption === caption) || !caption;
        onChange({ ...spec, kind }, suggested ? QR_KINDS[kind].caption : caption);
    };

    const uploadPdf = async (file: File | undefined) => {
        if (!file) return;
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Elegí un archivo PDF');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            toast.error('El PDF es muy pesado (máximo 20 MB)');
            return;
        }
        try {
            const saved = await upload.mutateAsync({ commerceId, file, folderPath: '/' });
            onChange({ ...spec, kind: 'pdf', url: saved.url, fileName: file.name }, caption);
        } catch {
            toast.error('No se pudo subir el PDF. Probá de nuevo.');
        }
    };

    const chip = (active: boolean) =>
        `px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${active
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-border text-muted-foreground hover:text-foreground'}`;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
                {KIND_ORDER.map(kind => {
                    const Icon = KIND_ICONS[kind];
                    return (
                        <button key={kind} type="button" onClick={() => pickKind(kind)} className={chip(spec.kind === kind)}>
                            <Icon className="w-3.5 h-3.5" /> {QR_KINDS[kind].label}
                        </button>
                    );
                })}
            </div>

            <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0 space-y-2">
                    {spec.kind === 'web' && (
                        <Input value={spec.url || ''} onChange={e => set({ url: e.target.value })} placeholder="tunegocio.com/menu" aria-label="Dirección de la página" className="bg-background border-border" />
                    )}
                    {spec.kind === 'whatsapp' && (
                        <>
                            <Input value={spec.phone || ''} onChange={e => set({ phone: e.target.value })} placeholder="341 123 4567" inputMode="tel" aria-label="Número de WhatsApp" className="bg-background border-border" />
                            <Input value={spec.message || ''} onChange={e => set({ message: e.target.value.slice(0, 120) })} placeholder="Mensaje que queda escrito (opcional)" aria-label="Mensaje" className="bg-background border-border" />
                            {spec.phone && whatsappNumber(spec.phone).length >= 8 && (
                                <p className="text-xs text-muted-foreground">Abre el chat con +{whatsappNumber(spec.phone)}</p>
                            )}
                        </>
                    )}
                    {spec.kind === 'instagram' && (
                        <Input value={spec.user || ''} onChange={e => set({ user: e.target.value })} placeholder="@tunegocio" aria-label="Usuario de Instagram" className="bg-background border-border" />
                    )}
                    {spec.kind === 'wifi' && (
                        <>
                            <Input value={spec.ssid || ''} onChange={e => set({ ssid: e.target.value })} placeholder="Nombre de la red" aria-label="Nombre de la red Wi-Fi" className="bg-background border-border" />
                            <Input value={spec.password || ''} onChange={e => set({ password: e.target.value })} placeholder="Contraseña (vacío si es abierta)" aria-label="Contraseña del Wi-Fi" className="bg-background border-border" />
                        </>
                    )}
                    {spec.kind === 'pdf' && (
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={upload.isPending}
                                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm hover:border-indigo-500/60"
                            >
                                {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {spec.url ? `Cambiar PDF (${spec.fileName || 'subido'})` : 'Subir la carta en PDF'}
                            </button>
                            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { uploadPdf(e.target.files?.[0]); e.target.value = ''; }} />
                            <p className="text-xs text-muted-foreground">Si cambiás la carta, subí el PDF nuevo acá: el QR cambia solo.</p>
                        </div>
                    )}
                    <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Texto debajo del QR</span>
                        <Input value={caption} onChange={e => onChange(spec, e.target.value.slice(0, 40))} placeholder={QR_KINDS[spec.kind].caption} className="bg-background border-border" />
                    </label>
                </div>
                <div className="shrink-0 w-24 text-center">
                    <div className="w-24 h-24 rounded-lg bg-white p-1 border border-border flex items-center justify-center">
                        {preview ? (
                            <svg viewBox={`0 0 ${preview.size} ${preview.size}`} className="w-full h-full" shapeRendering="crispEdges" aria-label="Vista previa del QR">
                                <path d={preview.path} fill="#000" />
                            </svg>
                        ) : (
                            <span className="text-[10px] text-slate-500 px-1">Completá los datos</span>
                        )}
                    </div>
                    {preview && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Probalo con el celular</p>}
                </div>
            </div>
        </div>
    );
}
