import { useState } from 'react';
import { CalendarHeart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContentPicker, type PickedContent } from './ContentPicker';
import { MINUTES_PER_DAY, SNAP, formatMinutes } from '@/lib/scheduleView';

export interface SpecialValue {
    id?: string;
    label: string;
    dateFrom: string;       // AAAA-MM-DD
    dateTo: string | null;  // null = un solo día
    start: number;
    end: number;
    content: PickedContent | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    initial: SpecialValue;
    onSave: (value: SpecialValue) => Promise<void> | void;
    onDelete?: () => Promise<void> | void;
    saving?: boolean;
}

const TIMES = Array.from({ length: MINUTES_PER_DAY / SNAP }, (_, i) => i * SNAP);
const LABELS = ['Feriado', 'Navidad', 'Año nuevo', 'Día de la madre', 'Aniversario', 'Evento'];

// Una fecha especial: un día (o varios seguidos) con algo distinto a la semana tipo.
export function SpecialDateDialog(props: Props) {
    return (
        <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[92dvh] overflow-y-auto">
                {props.isOpen && <SpecialForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function SpecialForm({ onClose, commerceId, initial, onSave, onDelete, saving }: Props) {
    const [label, setLabel] = useState(initial.label);
    const [dateFrom, setDateFrom] = useState(initial.dateFrom);
    const [multi, setMulti] = useState(!!initial.dateTo && initial.dateTo !== initial.dateFrom);
    const [dateTo, setDateTo] = useState(initial.dateTo || initial.dateFrom);
    const [allDay, setAllDay] = useState(initial.start === 0 && initial.end === MINUTES_PER_DAY);
    const [start, setStart] = useState(initial.start);
    const [end, setEnd] = useState(initial.end);
    const [content, setContent] = useState<PickedContent | null>(initial.content);

    const handleSave = () => {
        if (!dateFrom) return toast.error('Elegí la fecha');
        if (multi && (!dateTo || dateTo < dateFrom)) return toast.error('La fecha "hasta" tiene que ser igual o posterior a la "desde"');
        if (!content) return toast.error('Elegí qué se muestra');
        const s = allDay ? 0 : start;
        const e = allDay ? MINUTES_PER_DAY : end;
        if (s === e) return toast.error('La hora de inicio y la de fin no pueden ser iguales');
        onSave({ id: initial.id, label: label.trim(), dateFrom, dateTo: multi && dateTo !== dateFrom ? dateTo : null, start: s, end: e, content });
    };

    const chip = (active: boolean) =>
        `px-2.5 py-1 rounded-md border text-xs ${active
            ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300'
            : 'border-border text-muted-foreground hover:text-foreground'}`;
    const selectCls = 'h-10 rounded-md border border-border bg-background px-3 text-sm';

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CalendarHeart className="w-5 h-5 text-rose-500" /> {initial.id ? 'Editar fecha especial' : 'Fecha especial'}</DialogTitle>
                <DialogDescription>Ese día, en ese horario, la pantalla pasa esto en lugar de la semana tipo. El resto queda igual.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Nombre <span className="font-normal text-muted-foreground">(opcional)</span></p>
                    <Input value={label} onChange={e => setLabel(e.target.value.slice(0, 40))} placeholder="Ej.: Navidad" className="bg-background border-border" />
                    <div className="flex flex-wrap gap-1.5">
                        {LABELS.map(l => <button key={l} type="button" onClick={() => setLabel(l)} className={chip(label === l)}>{l}</button>)}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Cuándo</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" aria-label="Fecha" value={dateFrom} onChange={e => { setDateFrom(e.target.value); if (dateTo < e.target.value) setDateTo(e.target.value); }} className="h-10 w-[170px] bg-background border-border" />
                        {multi && (
                            <>
                                <span className="text-sm text-muted-foreground">hasta</span>
                                <Input type="date" aria-label="Hasta" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} className="h-10 w-[170px] bg-background border-border" />
                            </>
                        )}
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={multi} onChange={e => setMulti(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                        Varios días seguidos (vacaciones, una semana de promo)
                    </label>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Horario</p>
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setAllDay(true)} className={chip(allDay)}>Todo el día</button>
                        <button type="button" onClick={() => setAllDay(false)} className={chip(!allDay)}>Solo un horario</button>
                    </div>
                    {!allDay && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">De</span>
                            <select aria-label="Desde" value={start} onChange={e => setStart(Number(e.target.value))} className={selectCls}>
                                {TIMES.map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
                            </select>
                            <span className="text-sm text-muted-foreground">a</span>
                            <select aria-label="Hasta la hora" value={end} onChange={e => setEnd(Number(e.target.value))} className={selectCls}>
                                {[...TIMES.slice(1), MINUTES_PER_DAY].map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
                            </select>
                            <span className="text-sm text-muted-foreground">h</span>
                        </div>
                    )}
                    {!allDay && end !== MINUTES_PER_DAY && end <= start && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">Cruza la medianoche: termina a las {formatMinutes(end)} del día siguiente.</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Qué se muestra</p>
                    <ContentPicker commerceId={commerceId} value={content} onChange={setContent} className="w-full h-10" />
                    <p className="text-xs text-muted-foreground">Para un "cerrado por feriado", armá una placa de Aviso y elegila acá.</p>
                </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-3">
                {onDelete && (
                    <Button variant="ghost" className="mr-auto text-rose-600 hover:text-rose-700" onClick={() => onDelete()} disabled={saving}>
                        <Trash2 className="w-4 h-4 mr-2" /> Quitar
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
