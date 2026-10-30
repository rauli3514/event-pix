import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ScheduleEvent } from '@/lib/scheduleView';

// Edición de una programación de a una franja por vez: cada cambio guarda solo
// esa franja (nunca se borra todo para volver a crearlo) y el calendario se
// actualiza al instante; si el servidor falla, vuelve a como estaba.

/* eslint-disable @typescript-eslint/no-explicit-any */
type ScheduleRow = any;

const key = (commerceId: string) => ['display_schedules', commerceId];

export interface EventDraft {
    id?: string;
    campaign_id: string | null;
    media_id: string | null;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    // Para mostrarlo mientras se guarda.
    campaign?: ScheduleEvent['campaign'];
    media?: ScheduleEvent['media'];
}

function useOptimistic(commerceId: string) {
    const queryClient = useQueryClient();
    const apply = async (scheduleId: string, change: (schedule: ScheduleRow) => ScheduleRow) => {
        await queryClient.cancelQueries({ queryKey: key(commerceId) });
        const previous = queryClient.getQueryData<ScheduleRow[]>(key(commerceId));
        queryClient.setQueryData<ScheduleRow[]>(key(commerceId), old =>
            (old || []).map(s => (s.id === scheduleId ? change(s) : s)));
        return { previous };
    };
    const rollback = (ctx?: { previous?: ScheduleRow[] }) => {
        if (ctx?.previous) queryClient.setQueryData(key(commerceId), ctx.previous);
    };
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: key(commerceId) });
        queryClient.invalidateQueries({ queryKey: ['display_devices'] });
    };
    return { apply, rollback, refresh };
}

export const useSaveScheduleEvent = (commerceId: string) => {
    const { apply, rollback, refresh } = useOptimistic(commerceId);
    return useMutation({
        mutationFn: async ({ scheduleId, event }: { scheduleId: string; event: EventDraft }) => {
            const row = {
                campaign_id: event.campaign_id,
                media_id: event.media_id,
                start_time: event.start_time,
                end_time: event.end_time,
                days_of_week: event.days_of_week,
            };
            const query = event.id
                ? supabase.from('display_schedule_events').update(row).eq('id', event.id)
                : supabase.from('display_schedule_events').insert({ ...row, schedule_id: scheduleId });
            const { error } = await query;
            if (error) throw error;
        },
        onMutate: ({ scheduleId, event }) => apply(scheduleId, s => {
            const events = [...(s.events || [])];
            const i = event.id ? events.findIndex((e: ScheduleRow) => e.id === event.id) : -1;
            const merged = { ...(i >= 0 ? events[i] : { id: `tmp-${Date.now()}`, schedule_id: scheduleId }), ...event };
            if (i >= 0) events[i] = merged; else events.push(merged);
            return { ...s, events };
        }),
        onError: (_e, _v, ctx) => rollback(ctx),
        onSettled: refresh,
    });
};

export const useDeleteScheduleEvent = (commerceId: string) => {
    const { apply, rollback, refresh } = useOptimistic(commerceId);
    return useMutation({
        mutationFn: async ({ eventId }: { scheduleId: string; eventId: string }) => {
            const { error } = await supabase.from('display_schedule_events').delete().eq('id', eventId);
            if (error) throw error;
        },
        onMutate: ({ scheduleId, eventId }) => apply(scheduleId, s => ({ ...s, events: (s.events || []).filter((e: ScheduleRow) => e.id !== eventId) })),
        onError: (_e, _v, ctx) => rollback(ctx),
        onSettled: refresh,
    });
};

// Nombre y contenido de siempre.
export const useUpdateScheduleInfo = (commerceId: string) => {
    const { apply, rollback, refresh } = useOptimistic(commerceId);
    return useMutation({
        mutationFn: async ({ scheduleId, updates }: {
            scheduleId: string;
            updates: { name?: string; default_campaign_id?: string | null; default_media_id?: string | null };
            display?: { default_campaign?: ScheduleRow; default_media?: ScheduleRow };
        }) => {
            const { error } = await supabase.from('display_schedules').update(updates).eq('id', scheduleId);
            if (error) throw error;
        },
        onMutate: ({ scheduleId, updates, display }) => apply(scheduleId, s => ({ ...s, ...updates, ...(display || {}) })),
        onError: (_e, _v, ctx) => rollback(ctx),
        onSettled: refresh,
    });
};
/* eslint-enable @typescript-eslint/no-explicit-any */
