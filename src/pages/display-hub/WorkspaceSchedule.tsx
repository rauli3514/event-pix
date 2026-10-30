import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarClock, MonitorUp, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDeleteSchedule, useDisplayDevices, useDisplaySchedules } from '@/hooks/use-display-hub';
import { useDeleteScheduleEvent, useSaveScheduleEvent, useUpdateScheduleInfo } from '@/hooks/use-schedule-editor';
import { useNowMinute } from '@/hooks/use-now-minute';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { ScheduleCalendar } from '@/components/display/schedule/ScheduleCalendar';
import { FranjaDialog, type FranjaValue } from '@/components/display/schedule/FranjaDialog';
import { NewScheduleDialog } from '@/components/display/schedule/NewScheduleDialog';
import { ContentPicker, type PickedContent } from '@/components/display/schedule/ContentPicker';
import { findActiveScheduleEvent } from '@/lib/displaySchedule';
import { describeDays } from '@/lib/itemRules';
import {
    DAY_LETTER, DAY_LONG, EVENT_COLORS, MINUTES_PER_DAY, WEEK,
    colorMap, conflicts, eventAssetKey, eventName, eventRange, formatMinutes, segmentsForDay, toStoredTime, winnersByDay,
    type ScheduleEvent,
} from '@/lib/scheduleView';

/* eslint-disable @typescript-eslint/no-explicit-any */
type ScheduleRow = any;
type DeviceRow = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const screenName = (d: DeviceRow) => d.name || `Pantalla ${d.device_id}`;
const defaultOf = (s: ScheduleRow): PickedContent | null =>
    s.default_campaign ? { kind: 'campaign', id: s.default_campaign.id, name: s.default_campaign.name }
        : s.default_media ? { kind: 'media', id: s.default_media.id, name: s.default_media.name, type: s.default_media.type } : null;

function useIsNarrow() {
    const query = '(max-width: 767px)';
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setNarrow(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);
    return narrow;
}

// Programación: semanas tipo (qué pasa la pantalla en cada horario) que se
// mandan a las pantallas.
const WorkspaceSchedule = () => {
    const { commerceId = '' } = useParams<{ commerceId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: schedules = [], isLoading } = useDisplaySchedules(commerceId);
    const { data: devices = [] } = useDisplayDevices(commerceId);
    const [newOpen, setNewOpen] = useState(() => searchParams.get('nueva') === '1');

    const openId = searchParams.get('p');
    const open = (schedules as ScheduleRow[]).find(s => s.id === openId) || null;
    const setOpenId = (id: string | null) => {
        const next = new URLSearchParams(searchParams);
        next.delete('nueva');
        if (id) next.set('p', id); else next.delete('p');
        setSearchParams(next, { replace: !id });
    };

    const screensOf = (scheduleId: string) =>
        (devices as DeviceRow[]).filter(d => d.pairing_status === 'linked' && d.assignment?.schedule_id === scheduleId);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full h-full flex flex-col min-h-0">
            {open ? (
                <ScheduleDetail schedule={open} commerceId={commerceId} screens={screensOf(open.id)} onBack={() => setOpenId(null)} />
            ) : (
                <ScheduleList
                    schedules={schedules as ScheduleRow[]}
                    loading={isLoading}
                    screensOf={screensOf}
                    onOpen={setOpenId}
                    onNew={() => setNewOpen(true)}
                    commerceId={commerceId}
                />
            )}
            <NewScheduleDialog
                isOpen={newOpen}
                onClose={() => setNewOpen(false)}
                commerceId={commerceId}
                onCreated={id => { setNewOpen(false); setOpenId(id); }}
            />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Lista

function ScheduleList({ schedules, loading, screensOf, onOpen, onNew, commerceId }: {
    schedules: ScheduleRow[];
    loading: boolean;
    screensOf: (id: string) => DeviceRow[];
    onOpen: (id: string) => void;
    onNew: () => void;
    commerceId: string;
}) {
    const remove = useDeleteSchedule();
    const [sending, setSending] = useState<ScheduleRow | null>(null);
    const now = useNowMinute();

    const handleDelete = async (s: ScheduleRow) => {
        const used = screensOf(s.id).length;
        const warn = used ? ` Está en ${used === 1 ? '1 pantalla' : `${used} pantallas`}: van a quedar sin contenido asignado.` : '';
        if (!confirm(`¿Eliminar la programación "${s.name}"?${warn}`)) return;
        try {
            await remove.mutateAsync(s.id);
            toast.success('Programación eliminada');
        } catch {
            toast.error('No se pudo eliminar. Probá de nuevo.');
        }
    };

    return (
        <>
            <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Programación</h1>
                    <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                        Una semana tipo para cada pantalla: algo distinto de mañana, de tarde o el fin de semana. Cambia solo, a la hora indicada.
                    </p>
                </div>
                <Button onClick={onNew} className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Nueva programación
                </Button>
            </header>

            {loading ? (
                <div className="rounded-xl border border-border bg-card/50 p-12 text-center text-muted-foreground">Cargando…</div>
            ) : schedules.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 md:p-14 flex flex-col items-center text-center gap-2">
                    <CalendarClock className="w-12 h-12 text-muted-foreground/60" />
                    <p className="text-lg font-semibold">Todavía no hay programaciones</p>
                    <p className="text-sm text-muted-foreground max-w-md">Por ejemplo: desayunos de 7 a 12, almuerzo de 12 a 15 y la carta de la noche desde las 19. La pantalla cambia sola.</p>
                    <Button onClick={onNew} className="mt-4 h-11 bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="w-4 h-4 mr-2" /> Crear la primera</Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {schedules.map(s => {
                        const screens = screensOf(s.id);
                        const events: ScheduleEvent[] = s.events || [];
                        const active = findActiveScheduleEvent(events, now);
                        const showing = active ? eventName(active) : (defaultOf(s)?.name || 'pantalla negra');
                        return (
                            <article key={s.id} className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-indigo-500/40 transition-colors">
                                <button type="button" onClick={() => onOpen(s.id)} className="text-left p-4 pb-3 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold truncate">{s.name}</h2>
                                            <p className="text-sm text-muted-foreground">
                                                {events.length === 0 ? 'Sin franjas' : `${events.length} ${events.length === 1 ? 'franja' : 'franjas'}`} · lo de siempre: {defaultOf(s)?.name || 'nada'}
                                            </p>
                                        </div>
                                    </div>
                                    <WeekStrip events={events} />
                                    <p className="mt-3 text-sm">
                                        <span className="text-muted-foreground">Ahora pasa: </span>
                                        <span className="font-medium">{showing}</span>
                                    </p>
                                    <p className={`text-sm ${screens.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                        {screens.length ? `En pantalla: ${screens.map(screenName).join(', ')}` : 'Todavía no está en ninguna pantalla'}
                                    </p>
                                </button>
                                <div className="px-4 pb-4 flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => onOpen(s.id)}><Pencil className="w-4 h-4 mr-2" /> Editar</Button>
                                    <Button variant="outline" className="flex-1" onClick={() => setSending(s)}><MonitorUp className="w-4 h-4 mr-2" /> Mandar a pantallas</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" aria-label={`Opciones de ${s.name}`}><MoreVertical className="w-5 h-5" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                                            <DropdownMenuItem onClick={() => handleDelete(s)} className="cursor-pointer text-destructive focus:text-destructive">
                                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {sending && (
                <SendToScreensModal
                    isOpen
                    onClose={() => setSending(null)}
                    commerceId={commerceId}
                    selectedAssets={[{ ...sending, type: 'schedule' }]}
                    onSuccess={() => setSending(null)}
                />
            )}
        </>
    );
}

// La semana en miniatura: una columna por día con sus franjas de color.
function WeekStrip({ events }: { events: ScheduleEvent[] }) {
    const winners = useMemo(() => winnersByDay(events), [events]);
    const colors = useMemo(() => colorMap(events), [events]);
    return (
        <div className="mt-3 grid grid-cols-7 gap-1" aria-hidden>
            {WEEK.map(day => (
                <div key={day} className="text-center">
                    <div className="relative h-14 rounded bg-muted overflow-hidden">
                        {segmentsForDay(events, day, winners.get(day)).map(seg => (
                            <span
                                key={`${seg.event.id}-${seg.continuation}`}
                                className={`absolute inset-x-0 ${EVENT_COLORS[colors.get(eventAssetKey(seg.event)) ?? 0].dot}`}
                                style={{ top: `${(seg.start / MINUTES_PER_DAY) * 100}%`, height: `${Math.max(((seg.end - seg.start) / MINUTES_PER_DAY) * 100, 3)}%` }}
                            />
                        ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{DAY_LETTER[day]}</span>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Una programación: calendario y edición

function ScheduleDetail({ schedule, commerceId, screens, onBack }: { schedule: ScheduleRow; commerceId: string; screens: DeviceRow[]; onBack: () => void }) {
    const events: ScheduleEvent[] = useMemo(() => schedule.events || [], [schedule.events]);
    const saveEvent = useSaveScheduleEvent(commerceId);
    const deleteEvent = useDeleteScheduleEvent(commerceId);
    const updateInfo = useUpdateScheduleInfo(commerceId);
    const narrow = useIsNarrow();
    const now = useNowMinute();
    const [day, setDay] = useState(() => now.getDay());
    const [editing, setEditing] = useState<FranjaValue | null>(null);
    const [sending, setSending] = useState(false);
    const [name, setName] = useState<string>(schedule.name);
    const [nameFocused, setNameFocused] = useState(false);

    const colors = useMemo(() => colorMap(events), [events]);
    const winners = useMemo(() => winnersByDay(events), [events]);
    const clashes = useMemo(() => conflicts(events, winners), [events, winners]);
    const legend = useMemo(() => {
        const seen = new Map<string, ScheduleEvent>();
        for (const ev of events) if (!seen.has(eventAssetKey(ev))) seen.set(eventAssetKey(ev), ev);
        return [...seen.entries()];
    }, [events]);
    const base = defaultOf(schedule);

    const saveName = () => {
        const trimmed = name.trim();
        if (!trimmed) { setName(schedule.name); return; }
        if (trimmed !== schedule.name) updateInfo.mutate({ scheduleId: schedule.id, updates: { name: trimmed } }, { onError: () => toast.error('No se pudo cambiar el nombre') });
    };

    const setBase = (c: PickedContent | null) => {
        updateInfo.mutate({
            scheduleId: schedule.id,
            updates: { default_campaign_id: c?.kind === 'campaign' ? c.id : null, default_media_id: c?.kind === 'media' ? c.id : null },
            display: {
                default_campaign: c?.kind === 'campaign' ? { id: c.id, name: c.name } : null,
                default_media: c?.kind === 'media' ? { id: c.id, name: c.name, type: c.type } : null,
            },
        }, {
            onSuccess: () => toast.success('Listo: lo de siempre cambiado'),
            onError: () => toast.error('No se pudo guardar. Probá de nuevo.'),
        });
    };

    const toDraft = (v: FranjaValue) => ({
        id: v.id,
        campaign_id: v.content?.kind === 'campaign' ? v.content.id : null,
        media_id: v.content?.kind === 'media' ? v.content.id : null,
        campaign: v.content?.kind === 'campaign' ? { id: v.content.id, name: v.content.name } : null,
        media: v.content?.kind === 'media' ? { id: v.content.id, name: v.content.name, type: v.content.type } : null,
        start_time: toStoredTime(v.start),
        end_time: toStoredTime(v.end),
        days_of_week: [...v.days].sort(),
    });

    const fromEvent = (ev: ScheduleEvent): FranjaValue => {
        const r = eventRange(ev);
        return {
            id: ev.id,
            content: ev.campaign ? { kind: 'campaign', id: ev.campaign.id, name: ev.campaign.name }
                : ev.media ? { kind: 'media', id: ev.media.id, name: ev.media.name, type: ev.media.type } : null,
            days: ev.days_of_week || [],
            start: r?.start ?? 9 * 60,
            end: r?.end ?? 10 * 60,
        };
    };

    const handleSave = async (v: FranjaValue) => {
        try {
            await saveEvent.mutateAsync({ scheduleId: schedule.id, event: toDraft(v) });
            setEditing(null);
            toast.success(v.id ? 'Franja guardada' : 'Franja agregada');
        } catch {
            toast.error('No se pudo guardar. Revisá la conexión y probá de nuevo.');
        }
    };

    const handleDelete = async () => {
        if (!editing?.id) return;
        try {
            await deleteEvent.mutateAsync({ scheduleId: schedule.id, eventId: editing.id });
            setEditing(null);
            toast.success('Franja quitada');
        } catch {
            toast.error('No se pudo quitar. Probá de nuevo.');
        }
    };

    const handleChangeTime = (ev: ScheduleEvent, start: number, end: number) => {
        if (ev.id.startsWith('tmp-')) return;
        const v = { ...fromEvent(ev), start, end };
        saveEvent.mutate({ scheduleId: schedule.id, event: toDraft(v) }, {
            onSuccess: () => {
                const days = ev.days_of_week || [];
                toast.success(`${eventName(ev)}: ${formatMinutes(start)} a ${formatMinutes(end)} h${days.length > 1 ? ` (${describeDays(days) || 'todos los días'})` : ''}`);
            },
            onError: () => toast.error('No se pudo mover la franja. Probá de nuevo.'),
        });
    };

    const active = findActiveScheduleEvent(events, now);

    return (
        <div className="flex flex-col min-h-0 h-full gap-4">
            <header className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver a programación" className="shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
                <div className="flex-1 min-w-[200px]">
                    <Input
                        value={nameFocused ? name : schedule.name}
                        onFocus={() => { setName(schedule.name); setNameFocused(true); }}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => { setNameFocused(false); saveName(); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        aria-label="Nombre de la programación"
                        className="h-11 text-xl md:text-2xl font-bold border-transparent bg-transparent hover:border-border focus-visible:border-border px-2"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => {
                        const s = Math.min(Math.max(now.getHours() + 1, 0), 23) * 60;
                        setEditing({ content: null, days: [now.getDay()], start: s, end: Math.min(s + 60, MINUTES_PER_DAY) });
                    }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="w-4 h-4 mr-2" /> Agregar franja
                    </Button>
                    <Button variant="outline" onClick={() => setSending(true)}><MonitorUp className="w-4 h-4 mr-2" /> Mandar a pantallas</Button>
                </div>
            </header>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                    <p className="text-sm font-medium">Lo de siempre <span className="font-normal text-muted-foreground">(cuando no hay franja)</span></p>
                    <ContentPicker commerceId={commerceId} value={base} onChange={setBase} noneLabel="Nada (pantalla negra)" className="w-full h-10" />
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Ahora pasa:</span> <span className="font-medium">{active ? eventName(active) : (base?.name || 'pantalla negra')}</span></p>
                    <p className={screens.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {screens.length ? `En pantalla: ${screens.map(screenName).join(', ')}` : 'Todavía no está en ninguna pantalla. Tocá "Mandar a pantallas".'}
                    </p>
                </div>
            </div>

            {legend.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                    {legend.map(([key, ev]) => (
                        <span key={key} className="inline-flex items-center gap-1.5">
                            <span className={`w-3 h-3 rounded-sm ${EVENT_COLORS[colors.get(key) ?? 0].dot}`} /> {eventName(ev)}
                        </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-3 h-3 rounded-sm border border-border bg-[repeating-linear-gradient(135deg,transparent_0_2px,hsl(var(--muted-foreground)/0.35)_2px_4px)]" /> Lo de siempre
                    </span>
                    <span className="hidden md:inline text-muted-foreground">· Arrastrá en el calendario para crear, mover o estirar una franja.</span>
                </div>
            )}

            {clashes.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    <p className="font-medium flex items-center gap-1.5 text-amber-800 dark:text-amber-300"><AlertTriangle className="w-4 h-4" /> Hay franjas que se pisan</p>
                    <ul className="mt-1 space-y-0.5 text-amber-900/80 dark:text-amber-200/80">
                        {clashes.slice(0, 4).map((c, i) => (
                            <li key={i}>{DAY_LONG[c.day]} de {formatMinutes(c.start)} a {formatMinutes(c.end)}: se ve <strong>{c.shownName}</strong>, no {c.hiddenName}.</li>
                        ))}
                        {clashes.length > 4 && <li>…y {clashes.length - 4} más.</li>}
                    </ul>
                    <p className="mt-1 text-xs text-amber-900/70 dark:text-amber-200/70">Cuando dos franjas se pisan, se ve la que empieza más tarde.</p>
                </div>
            )}

            {narrow && (
                <div className="grid grid-cols-7 gap-1">
                    {WEEK.map(d => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDay(d)}
                            aria-label={DAY_LONG[d]}
                            aria-pressed={day === d}
                            className={`h-10 rounded-lg text-sm font-semibold border ${day === d ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-border text-muted-foreground'} ${d === now.getDay() && day !== d ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                        >
                            {DAY_LETTER[d]}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex-1 min-h-[420px] h-[calc(100dvh-340px)] rounded-xl border border-border overflow-hidden">
                <ScheduleCalendar
                    events={events}
                    defaultName={base?.name || null}
                    days={narrow ? [day] : WEEK}
                    onCreate={(d, start, end) => setEditing({ content: null, days: [d], start, end })}
                    onEdit={ev => { if (!ev.id.startsWith('tmp-')) setEditing(fromEvent(ev)); }}
                    onChangeTime={handleChangeTime}
                />
            </div>

            <FranjaDialog
                isOpen={!!editing}
                onClose={() => setEditing(null)}
                commerceId={commerceId}
                initial={editing || { content: null, days: [], start: 9 * 60, end: 10 * 60 }}
                onSave={handleSave}
                onDelete={editing?.id ? handleDelete : undefined}
                saving={saveEvent.isPending || deleteEvent.isPending}
            />

            {sending && (
                <SendToScreensModal
                    isOpen
                    onClose={() => setSending(false)}
                    commerceId={commerceId}
                    selectedAssets={[{ ...schedule, type: 'schedule' }]}
                    onSuccess={() => setSending(false)}
                />
            )}
        </div>
    );
}

export default WorkspaceSchedule;
