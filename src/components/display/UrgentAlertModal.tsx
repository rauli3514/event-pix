import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateUrgentAlert } from '@/hooks/use-urgent-alerts';
import { URGENT_ALERT_COLORS, type UrgentAlertColor, type UrgentAlertLayout } from '@/lib/urgentAlerts';
import { UrgentAlertOverlay } from '@/components/display/UrgentAlertOverlay';

const MAX_LENGTH = 120;

const TEMPLATES = [
    'Hoy cerramos a las 18 h',
    'Volvemos en 15 minutos',
    'Oferta relámpago: 2x1 por 30 minutos',
    'Nos quedamos sin stock de ',
];

const DURATIONS = [
    { minutes: 15, label: '15 min' },
    { minutes: 30, label: '30 min' },
    { minutes: 60, label: '1 hora' },
    { minutes: 120, label: '2 horas' },
];

interface Screen {
    id: string;
    device_id: string;
    name: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    screens: Screen[];
}

// Mensaje que aparece al instante en las pantallas, encima de lo programado,
// y se va solo a la hora elegida.
export function UrgentAlertModal({ isOpen, onClose, commerceId, screens }: Props) {
    const create = useCreateUrgentAlert();
    const [message, setMessage] = useState('');
    const [layout, setLayout] = useState<UrgentAlertLayout>('banner');
    const [color, setColor] = useState<UrgentAlertColor>('red');
    const [duration, setDuration] = useState<number | 'until'>(30);
    const [untilTime, setUntilTime] = useState('18:00');
    const [allScreens, setAllScreens] = useState(true);
    const [picked, setPicked] = useState<string[]>([]);

    const targets = allScreens ? screens : screens.filter(s => picked.includes(s.id));

    const endsAt = (): Date | null => {
        if (duration !== 'until') return new Date(Date.now() + duration * 60_000);
        const [h, m] = untilTime.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        const end = new Date();
        end.setHours(h, m, 0, 0);
        return end.getTime() > Date.now() ? end : null;
    };

    const handleSend = async () => {
        const text = message.trim();
        if (!text) {
            toast.error('Escribí el mensaje');
            return;
        }
        if (targets.length === 0) {
            toast.error('Elegí al menos una pantalla');
            return;
        }
        const end = endsAt();
        if (!end) {
            toast.error('La hora de fin tiene que ser más tarde que ahora');
            return;
        }
        try {
            await create.mutateAsync({
                commerceId,
                message: text,
                layout,
                color,
                endsAt: end,
                deviceIds: allScreens ? null : picked,
                notifyCodes: targets.map(s => s.device_id),
            });
            toast.success(`Aviso en ${targets.length === 1 ? '1 pantalla' : `${targets.length} pantallas`} hasta las ${end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`);
            setMessage('');
            onClose();
        } catch {
            toast.error('No se pudo mandar el aviso. Probá de nuevo.');
        }
    };

    const chip = (active: boolean) =>
        `px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${active
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-border text-muted-foreground hover:text-foreground'}`;

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-xl max-h-[92dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-rose-500" /> Aviso urgente</DialogTitle>
                    <DialogDescription>Aparece en segundos encima de lo que se está mostrando y se va solo a la hora que elijas.</DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Textarea
                            value={message}
                            onChange={e => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                            placeholder="Ej.: Hoy cerramos a las 18 h"
                            rows={2}
                            className="bg-background border-border text-base"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                            {TEMPLATES.map(t => (
                                <button key={t} type="button" onClick={() => setMessage(t)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-indigo-500/60">
                                    {t.trim()}{t.endsWith(' ') ? '…' : ''}
                                </button>
                            ))}
                            <span className="ml-auto text-xs text-muted-foreground">{message.length}/{MAX_LENGTH}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Cómo se ve</p>
                        <div className="grid grid-cols-2 gap-2">
                            {([['banner', 'Franja abajo', 'El contenido sigue pasando'], ['full', 'Pantalla completa', 'Tapa todo el contenido']] as const).map(([value, title, hint]) => (
                                <button key={value} type="button" onClick={() => setLayout(value)}
                                    className={`rounded-lg border p-3 text-left ${layout === value ? 'border-indigo-600 bg-indigo-600/10' : 'border-border hover:border-indigo-500/50'}`}>
                                    <span className="block text-sm font-medium">{title}</span>
                                    <span className="block text-xs text-muted-foreground">{hint}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <span className="text-sm text-muted-foreground mr-1">Color</span>
                            {(Object.keys(URGENT_ALERT_COLORS) as UrgentAlertColor[]).map(key => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setColor(key)}
                                    title={URGENT_ALERT_COLORS[key].label}
                                    aria-label={URGENT_ALERT_COLORS[key].label}
                                    className={`w-8 h-8 rounded-full border-2 ${color === key ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-border'}`}
                                    style={{ background: URGENT_ALERT_COLORS[key].bg }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Vista previa */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-600 to-slate-900">
                        <span className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">Lo que se está mostrando</span>
                        <UrgentAlertOverlay alert={{ message: message.trim() || 'Tu mensaje acá', layout, color }} />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Cuánto dura</p>
                        <div className="flex flex-wrap items-center gap-2">
                            {DURATIONS.map(d => (
                                <button key={d.minutes} type="button" onClick={() => setDuration(d.minutes)} className={chip(duration === d.minutes)}>{d.label}</button>
                            ))}
                            <button type="button" onClick={() => setDuration('until')} className={chip(duration === 'until')}>Hasta las…</button>
                            {duration === 'until' && (
                                <Input type="time" value={untilTime} onChange={e => setUntilTime(e.target.value)} className="w-28 h-9 bg-background border-border" />
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">En qué pantallas</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setAllScreens(true)} className={chip(allScreens)}>Todas ({screens.length})</button>
                            <button type="button" onClick={() => setAllScreens(false)} className={chip(!allScreens)}>Elegir</button>
                        </div>
                        {!allScreens && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {screens.map(s => (
                                    <label key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                                        <input
                                            type="checkbox"
                                            checked={picked.includes(s.id)}
                                            onChange={() => setPicked(prev => (prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]))}
                                            className="w-4 h-4 accent-indigo-600"
                                        />
                                        <span className="truncate">{s.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSend} disabled={create.isPending} className="bg-rose-600 hover:bg-rose-700 text-white">
                        <Megaphone className="w-4 h-4 mr-2" />
                        {create.isPending ? 'Mandando…' : `Mostrar ahora${targets.length ? ` en ${targets.length === 1 ? '1 pantalla' : `${targets.length} pantallas`}` : ''}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
