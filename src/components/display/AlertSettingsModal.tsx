import { useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type AlertSettings, useSaveAlertSettings } from '@/hooks/use-alert-settings';
import { ALERT_DAYS as DAYS, hhmm } from '@/lib/screenAlerts';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    settings: AlertSettings;
}

export function AlertSettingsModal({ isOpen, onClose, commerceId, settings }: Props) {
    const save = useSaveAlertSettings();
    const [enabled, setEnabled] = useState(settings.alerts_enabled);
    const [email, setEmail] = useState(settings.alert_email || settings.email || '');
    const [days, setDays] = useState<number[]>(settings.alert_days || []);
    const [from, setFrom] = useState(hhmm(settings.alert_from) || '09:00');
    const [to, setTo] = useState(hhmm(settings.alert_to) || '21:00');

    const toggleDay = (d: number) => setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));

    const handleSave = async () => {
        if (enabled && !email.trim()) {
            toast.error('Poné un email para recibir los avisos');
            return;
        }
        if (from >= to) {
            toast.error('La hora de cierre tiene que ser después de la de apertura');
            return;
        }
        try {
            await save.mutateAsync({ commerceId, enabled, email: email.trim(), days, from, to });
            toast.success(enabled ? 'Listo: te avisamos por email si se cae una pantalla' : 'Avisos por email apagados');
            onClose();
        } catch (error) {
            const message = String((error as { message?: string })?.message || '');
            toast.error(message.includes('invalid_email') ? 'El email no es válido' : 'No se pudo guardar. Probá de nuevo.');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-indigo-500" /> Avisos por email</DialogTitle>
                    <DialogDescription>
                        Si una pantalla se queda sin señal más de 10 minutos en el horario del local, te mandamos un email. Y otro cuando vuelve.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                        <span className="text-sm font-medium">Avisarme por email</span>
                    </label>

                    <div className={`space-y-5 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                        <div className="space-y-1.5">
                            <label htmlFor="alert-email" className="text-sm font-medium">Email</label>
                            <Input id="alert-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" className="bg-background border-border" />
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-sm font-medium">Días que abre el local</p>
                            <div className="flex flex-wrap gap-1.5">
                                {DAYS.map(d => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => toggleDay(d.value)}
                                        className={`w-12 py-1.5 rounded-md border text-sm ${days.includes(d.value)
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'border-border text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-sm font-medium">Horario</p>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Abre</span>
                                <Input type="time" value={from} onChange={e => setFrom(e.target.value)} className="w-28 bg-background border-border" />
                                <span className="text-muted-foreground">cierra</span>
                                <Input type="time" value={to} onChange={e => setTo(e.target.value)} className="w-28 bg-background border-border" />
                            </div>
                            <p className="text-xs text-muted-foreground">Fuera de este horario no avisamos (las pantallas apagadas de noche no cuentan). Al abrir esperamos media hora.</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={save.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {save.isPending ? 'Guardando…' : 'Guardar'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
