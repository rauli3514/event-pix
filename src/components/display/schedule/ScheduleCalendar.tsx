import { useEffect, useMemo, useRef, useState } from 'react';
import { useNowMinute } from '@/hooks/use-now-minute';
import {
    DAY_LONG, DAY_SHORT, EVENT_COLORS, MINUTES_PER_DAY, SLOT, SNAP, WEEK,
    colorMap, eventAssetKey, eventName, eventRange, firstVisibleHour, formatMinutes, gapsForDay, segmentsForDay, winnersByDay,
    type ScheduleEvent, type Segment,
} from '@/lib/scheduleView';

const HOUR_PX = 44;
const PX_PER_MIN = HOUR_PX / 60;

interface Props {
    events: ScheduleEvent[];
    // Nombre de lo que pasa fuera de las franjas (o null = pantalla negra).
    defaultName: string | null;
    // Días a mostrar (en el celular, uno solo).
    days?: number[];
    onCreate: (day: number, start: number, end: number) => void;
    onEdit: (event: ScheduleEvent) => void;
    // Mover o estirar una franja: nuevo horario para todos sus días.
    onChangeTime: (event: ScheduleEvent, start: number, end: number) => void;
    // Días de esta semana con fecha especial (se marcan en el encabezado).
    specialByDay?: Record<number, string>;
}

type Drag =
    | { kind: 'create'; day: number; from: number; to: number }
    | { kind: 'move' | 'resize-start' | 'resize-end'; day: number; seg: Segment; y0: number; delta: number; moved: boolean };

const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Calendario semanal de una programación.
export function ScheduleCalendar({ events, defaultName, days = WEEK, onCreate, onEdit, onChangeTime, specialByDay = {} }: Props) {
    const now = useNowMinute();
    const today = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const winners = useMemo(() => winnersByDay(events), [events]);
    const colors = useMemo(() => colorMap(events), [events]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [drag, setDragState] = useState<Drag | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d); };
    // Con qué se tocó (mouse o dedo): con mouse se arrastra; con el dedo, un toque abre.
    const pointerType = useRef('mouse');

    // Al abrir, arranca una hora antes de la primera franja.
    const startHour = useMemo(() => firstVisibleHour(events), [events]);
    const didScroll = useRef(false);
    useEffect(() => {
        if (didScroll.current || !scrollRef.current) return;
        scrollRef.current.scrollTop = startHour * HOUR_PX;
        didScroll.current = true;
    }, [startHour]);

    const minuteAt = (clientY: number, el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return clamp(snap((clientY - rect.top) / PX_PER_MIN), 0, MINUTES_PER_DAY);
    };

    // Lo que quedaría al soltar (mover o estirar).
    const preview = (d: Extract<Drag, { seg: Segment }>) => {
        const r = eventRange(d.seg.event);
        if (!r) return null;
        const dur = r.crossesMidnight ? r.end + MINUTES_PER_DAY - r.start : r.end - r.start;
        if (d.kind === 'move') {
            if (r.crossesMidnight) {
                const s = (r.start + d.delta + MINUTES_PER_DAY) % MINUTES_PER_DAY;
                return { start: s, end: (s + dur) % MINUTES_PER_DAY || MINUTES_PER_DAY };
            }
            const s = clamp(r.start + d.delta, 0, MINUTES_PER_DAY - dur);
            return { start: s, end: s + dur };
        }
        if (d.kind === 'resize-start') return { start: clamp(r.start + d.delta, 0, r.end - SNAP), end: r.end };
        return { start: r.start, end: clamp(r.end + d.delta, r.start + SNAP, MINUTES_PER_DAY) };
    };

    const finish = () => {
        const d = dragRef.current;
        setDrag(null);
        if (!d) return;
        if (d.kind === 'create') {
            const a = Math.min(d.from, d.to);
            const b = Math.max(d.from, d.to);
            // Un clic (sin arrastrar): una hora desde ahí.
            if (b - a < SNAP) {
                const s = clamp(Math.floor(a / 60) * 60, 0, MINUTES_PER_DAY - 60);
                onCreate(d.day, s, s + 60);
            } else {
                onCreate(d.day, a, b);
            }
            return;
        }
        if (!d.moved) { onEdit(d.seg.event); return; }
        const p = preview(d);
        if (p) onChangeTime(d.seg.event, p.start, p.end);
    };

    const onColumnPointerDown = (e: React.PointerEvent<HTMLDivElement>, day: number) => {
        pointerType.current = e.pointerType;
        if (e.button !== 0) return;
        // En pantallas táctiles, arrastrar es para desplazarse: se crea con un toque.
        if (e.pointerType !== 'mouse') return;
        const m = minuteAt(e.clientY, e.currentTarget);
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'create', day, from: m, to: m });
    };

    const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, day: number) => {
        if (pointerType.current === 'mouse') return; // ya lo manejó el arrastre
        const m = minuteAt(e.clientY, e.currentTarget);
        const s = clamp(Math.floor(m / 60) * 60, 0, MINUTES_PER_DAY - 60);
        onCreate(day, s, s + 60);
    };

    const onColumnPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragRef.current;
        if (!d) return;
        if (d.kind === 'create') {
            setDrag({ ...d, to: minuteAt(e.clientY, e.currentTarget) });
        } else {
            const delta = snap((e.clientY - d.y0) / PX_PER_MIN);
            if (delta !== d.delta || (!d.moved && Math.abs(e.clientY - d.y0) > 4)) {
                setDrag({ ...d, delta, moved: d.moved || Math.abs(e.clientY - d.y0) > 4 });
            }
        }
    };

    const onBlockPointerDown = (e: React.PointerEvent<HTMLElement>, day: number, seg: Segment, kind: 'move' | 'resize-start' | 'resize-end') => {
        pointerType.current = e.pointerType;
        if (e.button !== 0) return;
        e.stopPropagation();
        if (e.pointerType !== 'mouse') return; // en táctil, tocar abre la franja (onClick)
        const column = (e.currentTarget as HTMLElement).closest('[data-day-column]') as HTMLElement | null;
        column?.setPointerCapture(e.pointerId);
        setDrag({ kind, day, seg, y0: e.clientY, delta: 0, moved: kind !== 'move' });
    };

    return (
        <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain select-none bg-card">
            {/* Encabezado de días */}
            <div className="flex border-b border-border sticky top-0 z-20 bg-card">
                <div className="w-14 shrink-0" />
                {days.map(d => (
                    <div key={d} className={`flex-1 min-w-0 py-2 text-center text-sm font-semibold border-l border-border ${d === today ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                        <span className="hidden md:inline">{DAY_LONG[d]}</span>
                        <span className="md:hidden">{days.length > 1 ? DAY_SHORT[d] : DAY_LONG[d]}</span>
                        {d === today && <span className="ml-1.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle">HOY</span>}
                        {specialByDay[d] && (
                            <span title={`Esta semana: ${specialByDay[d]} (fecha especial)`} className="block text-[10px] font-semibold text-rose-600 dark:text-rose-400 truncate px-1">
                                ★ {specialByDay[d]}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div>
                <div className="flex relative" style={{ height: 24 * HOUR_PX }}>
                    {/* Horas */}
                    <div className="w-14 shrink-0 relative">
                        {Array.from({ length: 24 }, (_, h) => (
                            <span key={h} className="absolute right-2 text-[11px] text-muted-foreground tabular-nums -translate-y-1/2" style={{ top: h * HOUR_PX }}>
                                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                            </span>
                        ))}
                    </div>

                    {days.map(day => {
                        const w = winners.get(day) || [];
                        const segs = segmentsForDay(events, day, w);
                        const gaps = gapsForDay(w);
                        return (
                            <div
                                key={day}
                                data-day-column
                                className={`flex-1 min-w-0 relative border-l border-border cursor-crosshair ${day === today ? 'bg-indigo-500/[0.04]' : ''}`}
                                onPointerDown={e => onColumnPointerDown(e, day)}
                                onPointerMove={onColumnPointerMove}
                                onPointerUp={finish}
                                onPointerCancel={() => setDrag(null)}
                                onClick={e => onColumnClick(e, day)}
                            >
                                {/* Líneas de las horas */}
                                {Array.from({ length: 24 }, (_, h) => (
                                    <div key={h} className="absolute inset-x-0 border-t border-border/50 pointer-events-none" style={{ top: h * HOUR_PX }} />
                                ))}

                                {/* Huecos: lo de siempre */}
                                {gaps.map(g => (
                                    <div
                                        key={g.start}
                                        className="absolute inset-x-1 rounded-md pointer-events-none bg-[repeating-linear-gradient(135deg,transparent_0_6px,hsl(var(--muted-foreground)/0.07)_6px_12px)]"
                                        style={{ top: g.start * PX_PER_MIN + 1, height: (g.end - g.start) * PX_PER_MIN - 2 }}
                                    >
                                        {g.end - g.start >= 60 && (
                                            <span className="block px-1.5 pt-1 text-[11px] leading-tight text-muted-foreground truncate">
                                                {defaultName ? `De siempre: ${defaultName}` : 'Pantalla negra'}
                                            </span>
                                        )}
                                    </div>
                                ))}

                                {/* Franjas */}
                                {segs.map(seg => {
                                    const isDragged = drag && drag.kind !== 'create' && drag.seg.event.id === seg.event.id && drag.moved;
                                    const color = EVENT_COLORS[colors.get(eventAssetKey(seg.event)) ?? 0];
                                    const top = seg.start * PX_PER_MIN;
                                    const height = Math.max((seg.end - seg.start) * PX_PER_MIN, 14);
                                    const crossing = eventRange(seg.event)?.crossesMidnight;
                                    const canResize = !crossing && !seg.continuation;
                                    const hiddenAll = seg.hidden.length === 1 && seg.hidden[0].start === seg.start && seg.hidden[0].end === seg.end;
                                    return (
                                        <div
                                            key={`${seg.event.id}-${seg.continuation ? 'c' : 's'}`}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`${eventName(seg.event)}, de ${formatMinutes(seg.start)} a ${formatMinutes(seg.end)}`}
                                            className={`absolute rounded-md border text-white shadow-sm overflow-hidden ${color.block} ${seg.continuation ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${isDragged ? 'opacity-30' : ''} hover:ring-2 hover:ring-white/60 focus-visible:ring-2 focus-visible:ring-indigo-400 outline-none`}
                                            style={{
                                                top: top + 1,
                                                height: height - 2,
                                                left: `calc(${(seg.col / seg.cols) * 100}% + 3px)`,
                                                width: `calc(${100 / seg.cols}% - 6px)`,
                                            }}
                                            onPointerDown={e => {
                                                if (seg.continuation) { pointerType.current = e.pointerType; e.stopPropagation(); return; }
                                                onBlockPointerDown(e, day, seg, 'move');
                                            }}
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (pointerType.current !== 'mouse' || seg.continuation) onEdit(seg.event);
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(seg.event); } }}
                                        >
                                            {/* Tramos tapados por otra franja */}
                                            {seg.hidden.map(h => (
                                                <div
                                                    key={h.start}
                                                    className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.45)_0_5px,rgba(0,0,0,0.2)_5px_10px)] pointer-events-none"
                                                    style={{ top: (h.start - seg.start) * PX_PER_MIN, height: (h.end - h.start) * PX_PER_MIN }}
                                                />
                                            ))}
                                            <div className="relative px-1.5 py-1 leading-tight pointer-events-none">
                                                <p className="text-xs font-bold truncate">{eventName(seg.event)}</p>
                                                {height >= 32 && (
                                                    <p className="text-[11px] opacity-90 tabular-nums truncate">
                                                        {seg.continuation ? `hasta ${formatMinutes(seg.end)}` : `${formatMinutes(seg.start)}–${formatMinutes(crossing ? eventRange(seg.event)!.end : seg.end)}`}
                                                    </p>
                                                )}
                                                {height >= 48 && seg.hidden.length > 0 && (
                                                    <p className="text-[10px] font-semibold opacity-90">{hiddenAll ? 'No se ve: la tapa otra' : 'En parte tapada'}</p>
                                                )}
                                            </div>
                                            {canResize && (
                                                <>
                                                    <span className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize" onPointerDown={e => onBlockPointerDown(e, day, seg, 'resize-start')} />
                                                    <span className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" onPointerDown={e => onBlockPointerDown(e, day, seg, 'resize-end')} />
                                                </>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Vista previa al crear */}
                                {drag?.kind === 'create' && drag.day === day && Math.abs(drag.to - drag.from) >= SNAP && (
                                    <div
                                        className="absolute inset-x-1 rounded-md border-2 border-dashed border-indigo-500 bg-indigo-500/15 pointer-events-none"
                                        style={{ top: Math.min(drag.from, drag.to) * PX_PER_MIN, height: Math.abs(drag.to - drag.from) * PX_PER_MIN }}
                                    >
                                        <span className="block px-1.5 pt-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">
                                            {formatMinutes(Math.min(drag.from, drag.to))}–{formatMinutes(Math.max(drag.from, drag.to))}
                                        </span>
                                    </div>
                                )}

                                {/* Vista previa al mover o estirar (en todos los días de la franja) */}
                                {drag && drag.kind !== 'create' && drag.moved && (drag.seg.event.days_of_week || []).includes(day) && (() => {
                                    const p = preview(drag);
                                    if (!p) return null;
                                    const s = p.start;
                                    const e = p.end <= p.start ? MINUTES_PER_DAY : p.end;
                                    return (
                                        <div
                                            className="absolute inset-x-1 rounded-md border-2 border-indigo-500 bg-indigo-500/25 pointer-events-none"
                                            style={{ top: s * PX_PER_MIN, height: (e - s) * PX_PER_MIN }}
                                        >
                                            <span className="block px-1.5 pt-1 text-[11px] font-bold text-indigo-800 dark:text-indigo-200 tabular-nums">
                                                {formatMinutes(p.start)}–{formatMinutes(p.end)}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* Ahora */}
                                {day === today && (
                                    <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: nowMin * PX_PER_MIN }}>
                                        <div className="h-0.5 bg-rose-500" />
                                        <span className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="sr-only">Cada tramo de {SLOT} minutos muestra lo que se ve en la pantalla.</p>
        </div>
    );
}
