import { useState } from 'react';
import { QrCode, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrEditor } from '@/components/display/QrEditor';
import { ScreenQrOverlay } from '@/components/display/ScreenQrOverlay';
import { MissingQrColumnError, useSetScreenQr } from '@/hooks/use-screen-qr';
import { QR_CORNERS, QR_KINDS, QR_SIZES, parseScreenQr, qrData, type QrCorner, type QrSize, type QrSpec } from '@/lib/qr';

interface Screen {
    id: string;
    device_id: string;
    name: string;
    orientation?: string | null;
    qr_overlay?: unknown;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    screen: Screen | null;
    // Las demás pantallas del comercio, para poner el mismo QR en varias.
    others: Screen[];
}

const isVertical = (o?: string | null) => o === 'portrait' || o === '90' || o === '270';

// QR fijo en una esquina de la pantalla (el menú de un bar, el WhatsApp…),
// encima de todo lo que pasa.
export function ScreenQrModal(props: Props) {
    return (
        <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
                {props.isOpen && props.screen && <ScreenQrForm {...props} screen={props.screen} />}
            </DialogContent>
        </Dialog>
    );
}

function ScreenQrForm({ onClose, commerceId, screen, others }: Props & { screen: Screen }) {
    const current = parseScreenQr(screen.qr_overlay);
    const [spec, setSpec] = useState<QrSpec>(() => current?.spec || { kind: 'web' });
    const [caption, setCaption] = useState(() => current?.caption ?? QR_KINDS.web.caption);
    const [corner, setCorner] = useState<QrCorner>(current?.corner || 'br');
    const [size, setSize] = useState<QrSize>(current?.size || 'm');
    const [alsoIds, setAlsoIds] = useState<string[]>([]);
    const save = useSetScreenQr();

    const data = qrData(spec, caption);
    const targets = [screen, ...others.filter(o => alsoIds.includes(o.id))];
    const vertical = isVertical(screen.orientation);

    const run = async (qr: Parameters<typeof save.mutateAsync>[0]['qr'], done: string) => {
        try {
            await save.mutateAsync({ screens: targets, qr });
            toast.success(done);
            onClose();
        } catch (err) {
            if (err instanceof MissingQrColumnError) {
                toast.error('Falta un paso en el servidor: hay que correr el SQL del QR fijo (docs/qr.md).');
            } else {
                toast.error('No se pudo guardar. Revisá la conexión y probá de nuevo.');
            }
        }
    };

    const handleSave = () => {
        if (!data) {
            toast.error('Completá los datos del QR');
            return;
        }
        run({ ...data, corner, size }, targets.length === 1 ? 'QR guardado: aparece en la pantalla en segundos' : `QR guardado en ${targets.length} pantallas`);
    };

    const chip = (active: boolean) =>
        `px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${active
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-border text-muted-foreground hover:text-foreground'}`;

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5 text-indigo-500" /> QR fijo en {screen.name}</DialogTitle>
                <DialogDescription>Queda siempre en una esquina, encima de lo que se esté mostrando. Ideal para el menú, tu web o el WhatsApp.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
                <QrEditor spec={spec} caption={caption} commerceId={commerceId} onChange={(s, c) => { setSpec(s); setCaption(c); }} />

                <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-start">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Dónde va</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(['tl', 'tr', 'bl', 'br'] as QrCorner[]).map(c => (
                                    <button key={c} type="button" onClick={() => setCorner(c)} className={chip(corner === c)}>{QR_CORNERS[c]}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Tamaño</p>
                            <div className="flex gap-1.5">
                                {(Object.keys(QR_SIZES) as QrSize[]).map(k => (
                                    <button key={k} type="button" onClick={() => setSize(k)} className={chip(size === k)}>{QR_SIZES[k].label}</button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Si la pantalla está lejos, mejor grande: así lo leen desde la mesa.</p>
                        </div>
                    </div>
                    {/* Vista previa */}
                    <div className={`relative mx-auto overflow-hidden rounded-lg bg-gradient-to-br from-slate-600 to-slate-900 ${vertical ? 'w-40 aspect-[9/16]' : 'w-72 aspect-video'}`}>
                        <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs text-center px-2">Lo que se está mostrando</span>
                        {data && <ScreenQrOverlay qr={{ value: data.value, caption, corner, size }} />}
                    </div>
                </div>

                {others.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Poner el mismo QR también en</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {others.map(o => (
                                <label key={o.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                                    <input
                                        type="checkbox"
                                        checked={alsoIds.includes(o.id)}
                                        onChange={() => setAlsoIds(prev => (prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id]))}
                                        className="w-4 h-4 accent-indigo-600"
                                    />
                                    <span className="truncate">{o.name}</span>
                                    {parseScreenQr(o.qr_overlay) && <span className="ml-auto text-xs text-muted-foreground shrink-0">ya tiene uno</span>}
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
                {current && (
                    <Button variant="ghost" className="mr-auto text-rose-600 hover:text-rose-700" disabled={save.isPending}
                        onClick={() => run(null, targets.length === 1 ? 'QR quitado' : `QR quitado de ${targets.length} pantallas`)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Quitar QR
                    </Button>
                )}
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={save.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {save.isPending ? 'Guardando…' : 'Guardar QR'}
                </Button>
            </div>
        </>
    );
}
