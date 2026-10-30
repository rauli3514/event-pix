import { useState } from 'react';
import { CalendarClock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContentPicker, type PickedContent } from './ContentPicker';
import { DAY_LETTER, DAY_LONG, MINUTES_PER_DAY, SNAP, WEEK, formatMinutes } from '@/lib/scheduleView';

export interface FranjaValue {
    id?: string;
    content: PickedContent | null;
    days: number[];
    start: number; // minutos
    end: number;   // minutos; 1440 = medianoche
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    initial: FranjaValue;
    onSave: (value: FranjaValue) => Promise<void> | void;
    onDelete?: () => Promise<void> | void;
    saving?: boolean;
}

const TIMES = Array.from({ length: MINUTES_PER_DAY / SNAP }, (_, i) => i * SNAP);
const PRESETS = [
    { label: 'Mañana', start: 7 * 60, end: 12 * 60 },
    { label: 'Mediodía', start: 12 * 60, end: 15 * 60 },
    { label: 'Tarde', start: 15 * 60, end: 19 * 60 },
    { label: 'Noche', start: 19 * 60, end: MINUTES_PER_DAY },
    { label: 'Todo el día', start: 0, end: MINUTES_PER_DAY },
];

// Una franja de la programación: qué se muestra, qué días y en qué horario.
export function FranjaDialog(props: Props) {
    return (
        <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[92dvh] overflow-y-auto">
                {props.isOpen && <FranjaForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function FranjaForm({ onClose, commerceId, initial, onSave, onDelete, saving }: Props) {
    const [content, setContent] = useState<PickedContent | null>(initial.content);
    const [days, setDays] = useState<number[]>(initial.days);
    const [start, setStart] = useState(initial.start);
    const [end, setEnd] = useState(initial.end);

    const toggleDay = (d: number) => setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));
    const sameDays = (list: number[]) => days.length === list.length && list.every(d => days.includes(d));
    const crosses = end !== MINUTES_PER_DAY && end <= start;

    const handleSave = () => {
        if (!content) return toast.error('Elegí qué se muestra');
        if (days.length === 0) return toast.error('Elegí al menos un día');
        if (start === end || (start === 0 && end === 0)) return toast.error('La hora de inicio y la de fin no pueden ser iguales');
        onSave({ id: initial.id, content, days, start, end });
    };

    const chip = (active: boolean) =>
        `px-2.5 py-1 rounded-md border text-xs ${active
            ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300'
            : 'border-border text-muted-foreground hover:text-foreground'}`;
    const selectCls = 'h-10 rounded-md border border-border bg-background px-3 text-sm';

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-indigo-500" /> {initial.id ? 'Editar franja' : 'Nueva franja'}</DialogTitle>
                <DialogDescription>En este horario la pantalla pasa lo que elijas. Fuera de las franjas, pasa lo de siempre.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Qué se muestra</p>
                    <ContentPicker commerceId={commerceId} value={content} onChange={setContent} className="w-full h-10" />
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Días</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {WEEK.map(d => (
                            <button
                                key={d}
                                type="button"
                                title={DAY_LONG[d]}
                                aria-label={DAY_LONG[d]}
                                aria-pressed={days.includes(d)}
                                onClick={() => toggleDay(d)}
                                className={`w-9 h-9 rounded-full border text-sm font-semibold ${days.includes(d)
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-border text-muted-foreground hover:text-foreground'}`}
                            >
                                {DAY_LETTER[d]}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setDays([...WEEK])} className={chip(days.length === 7)}>Todos los días</button>
                        <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])} className={chip(sameDays([1, 2, 3, 4, 5]))}>Lun a Vie</button>
                        <button type="button" onClick={() => setDays([6, 0])} className={chip(sameDays([6, 0]))}>Fin de semana</button>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Horario</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">De</span>
                        <select aria-label="Desde" value={start} onChange={e => setStart(Number(e.target.value))} className={selectCls}>
                            {TIMES.map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
                        </select>
                        <span className="text-sm text-muted-foreground">a</span>
                        <select aria-label="Hasta" value={end} onChange={e => setEnd(Number(e.target.value))} className={selectCls}>
                            {[...TIMES.slice(1), MINUTES_PER_DAY].map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
                        </select>
                        <span className="text-sm text-muted-foreground">h</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {PRESETS.map(p => (
                            <button key={p.label} type="button" onClick={() => { setStart(p.start); setEnd(p.end); }} className={chip(start === p.start && end === p.end)}>
                                {p.label} <span className="opacity-70">{formatMinutes(p.start).replace(':00', '')}–{formatMinutes(p.end).replace(':00', '')}</span>
                            </button>
                        ))}
                    </div>
                    {crosses && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">Cruza la medianoche: termina a las {formatMinutes(end)} del día siguiente.</p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-3">
                {onDelete && (
                    <Button variant="ghost" className="mr-auto text-rose-600 hover:text-rose-700" onClick={() => onDelete()} disabled={saving}>
                        <Trash2 className="w-4 h-4 mr-2" /> Quitar franja
                    </Button>
                )}
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {saving ? 'Guardando…' : 'Guardar'}
                </Button>
            </div>
        </>
    );
}
