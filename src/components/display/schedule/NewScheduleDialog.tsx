import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateSchedule } from '@/hooks/use-display-hub';
import { ContentPicker, type PickedContent } from './ContentPicker';
import { MINUTES_PER_DAY, WEEK, toStoredTime } from '@/lib/scheduleView';

type TemplateId = 'vacia' | 'momentos' | 'finde';

interface Slot {
    label: string;
    hint: string;
    start: number;
    end: number;
    days: number[];
}

const TEMPLATES: Record<TemplateId, { label: string; hint: string; slots: Slot[] }> = {
    vacia: { label: 'Empezar de cero', hint: 'Armás las franjas en el calendario', slots: [] },
    momentos: {
        label: 'Mañana, tarde y noche',
        hint: 'Algo distinto en cada momento del día',
        slots: [
            { label: 'Mañana', hint: '7 a 12 h', start: 7 * 60, end: 12 * 60, days: WEEK },
            { label: 'Tarde', hint: '12 a 19 h', start: 12 * 60, end: 19 * 60, days: WEEK },
            { label: 'Noche', hint: '19 a 24 h', start: 19 * 60, end: MINUTES_PER_DAY, days: WEEK },
        ],
    },
    finde: {
        label: 'Semana y fin de semana',
        hint: 'Lo de siempre de lunes a viernes y otra cosa sábado y domingo',
        slots: [{ label: 'Fin de semana', hint: 'sábado y domingo, todo el día', start: 0, end: MINUTES_PER_DAY, days: [6, 0] }],
    },
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    onCreated: (scheduleId: string) => void;
}

export function NewScheduleDialog(props: Props) {
    return (
        <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[92dvh] overflow-y-auto">
                {props.isOpen && <NewScheduleForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function NewScheduleForm({ onClose, commerceId, onCreated }: Props) {
    const create = useCreateSchedule();
    const [name, setName] = useState('');
    const [base, setBase] = useState<PickedContent | null>(null);
    const [template, setTemplate] = useState<TemplateId>('momentos');
    const [picks, setPicks] = useState<Record<string, PickedContent | null>>({});

    const slots = TEMPLATES[template].slots;

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed) return toast.error('Poné un nombre (por ejemplo, "Semana del bar")');
        const events = slots
            .filter(s => picks[s.label])
            .map(s => {
                const c = picks[s.label]!;
                return {
                    campaignId: c.kind === 'campaign' ? c.id : null,
                    mediaId: c.kind === 'media' ? c.id : null,
                    startTime: toStoredTime(s.start),
                    endTime: toStoredTime(s.end),
                    daysOfWeek: s.days,
                };
            });
        try {
            const schedule = await create.mutateAsync({
                commerceId,
                name: trimmed,
                defaultCampaignId: base?.kind === 'campaign' ? base.id : null,
                defaultMediaId: base?.kind === 'media' ? base.id : null,
                events,
            });
            toast.success('Programación creada');
            onCreated(schedule.id);
        } catch {
            toast.error('No se pudo crear. Revisá la conexión y probá de nuevo.');
        }
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-indigo-500" /> Nueva programación</DialogTitle>
                <DialogDescription>Una semana tipo: qué pasa la pantalla en cada horario. Después la mandás a las pantallas que quieras.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Nombre</span>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej.: Semana del bar" className="bg-background border-border" autoFocus />
                </label>

                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Lo de siempre</p>
                    <p className="text-xs text-muted-foreground">Lo que pasa cuando no hay ninguna franja.</p>
                    <ContentPicker commerceId={commerceId} value={base} onChange={setBase} noneLabel="Nada (pantalla negra)" placeholder="Elegí una playlist" className="w-full h-10" />
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Para empezar</p>
                    <div className="grid gap-2">
                        {(Object.keys(TEMPLATES) as TemplateId[]).map(id => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setTemplate(id)}
                                className={`rounded-lg border p-3 text-left ${template === id ? 'border-indigo-600 bg-indigo-600/10' : 'border-border hover:border-indigo-500/50'}`}
                            >
                                <span className="block text-sm font-medium">{TEMPLATES[id].label}</span>
                                <span className="block text-xs text-muted-foreground">{TEMPLATES[id].hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {slots.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Qué pasa en cada franja</p>
                        {slots.map(s => (
                            <div key={s.label} className="grid grid-cols-[110px_1fr] items-center gap-2">
                                <span className="text-sm">
                                    <span className="block font-medium">{s.label}</span>
                                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                                </span>
                                <ContentPicker
                                    commerceId={commerceId}
                                    value={picks[s.label] || null}
                                    onChange={v => setPicks(prev => ({ ...prev, [s.label]: v }))}
                                    noneLabel="(sin franja: lo de siempre)"
                                    className="w-full h-10"
                                />
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground">Las que dejes vacías pasan lo de siempre. Después se ajusta todo en el calendario.</p>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={create.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {create.isPending ? 'Creando…' : 'Crear programación'}
                </Button>
            </div>
        </>
    );
}
