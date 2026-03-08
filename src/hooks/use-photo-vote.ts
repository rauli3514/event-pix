import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PhotoVoteSession, PhotoVoteRanking, Submission } from '@/types';

// ── Token anónimo del visitante (persiste en localStorage) ──
export const getVoterToken = (): string => {
    const key = 'eventpix_voter_token';
    let token = localStorage.getItem(key);
    if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem(key, token);
    }
    return token;
};

// ── Sesión activa para el evento ──
export const useActivePhotoVoteSession = (eventId?: string) => {
    return useQuery({
        queryKey: ['photo_vote_session', eventId],
        queryFn: async () => {
            if (!eventId) return null;
            const { data, error } = await supabase
                .from('photo_vote_sessions')
                .select('*')
                .eq('event_id', eventId)
                .in('status', ['active', 'finished'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data as PhotoVoteSession | null;
        },
        enabled: !!eventId,
        refetchInterval: 3000,
    });
};

// ── Sesión para admin (todas, incluyendo inactive) ──
export const usePhotoVoteSession = (eventId?: string) => {
    return useQuery({
        queryKey: ['photo_vote_session_admin', eventId],
        queryFn: async () => {
            if (!eventId) return null;
            const { data, error } = await supabase
                .from('photo_vote_sessions')
                .select('*')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data as PhotoVoteSession | null;
        },
        enabled: !!eventId,
        refetchInterval: 3000,
    });
};

// ── Fotos aprobadas del evento ──
export const useEventPhotos = (eventId?: string) => {
    return useQuery({
        queryKey: ['event_photos', eventId],
        queryFn: async () => {
            if (!eventId) return [];
            const { data, error } = await supabase
                .from('submissions')
                .select('*')
                .eq('event_id', eventId)
                .eq('type', 'photo')
                .eq('status', 'approved')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as Submission[];
        },
        enabled: !!eventId,
    });
};

// ── Ranking de votos ──
export const usePhotoVoteRanking = (sessionId?: string) => {
    return useQuery({
        queryKey: ['photo_vote_ranking', sessionId],
        queryFn: async () => {
            if (!sessionId) return [];
            const { data, error } = await supabase.rpc('get_photo_vote_ranking', {
                p_session_id: sessionId,
            });
            if (error) throw error;
            return data as PhotoVoteRanking[];
        },
        enabled: !!sessionId,
        refetchInterval: 2000,
    });
};

// ── Fotos que ya votó este visitante ──
export const useMyVotedPhotos = (sessionId?: string) => {
    return useQuery({
        queryKey: ['my_votes', sessionId],
        queryFn: async () => {
            if (!sessionId) return new Set<string>();
            const token = getVoterToken();
            const { data, error } = await supabase
                .from('photo_votes')
                .select('submission_id')
                .eq('session_id', sessionId)
                .eq('voter_token', token);
            if (error) throw error;
            return new Set<string>((data ?? []).map((v: any) => v.submission_id));
        },
        enabled: !!sessionId,
    });
};

// ── Crear sesión de votación ──
export const useCreatePhotoVoteSession = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            if (!eventId) throw new Error('No event ID');
            const { data, error } = await supabase
                .from('photo_vote_sessions')
                .insert({ event_id: eventId, status: 'inactive' })
                .select()
                .single();
            if (error) throw error;
            return data as PhotoVoteSession;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo_vote_session_admin', eventId] });
        },
    });
};

// ── Actualizar sesión (status, winner) ──
export const useUpdatePhotoVoteSession = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: Partial<PhotoVoteSession> }) => {
            const { data, error } = await supabase
                .from('photo_vote_sessions')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', sessionId)
                .select()
                .single();
            if (error) throw error;
            return data as PhotoVoteSession;
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo_vote_session_admin', eventId] });
            queryClient.invalidateQueries({ queryKey: ['photo_vote_session', eventId] });
        },
    });
};

// ── Eliminar sesión ──
export const useDeletePhotoVoteSession = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (sessionId: string) => {
            const { error } = await supabase
                .from('photo_vote_sessions')
                .delete()
                .eq('id', sessionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photo_vote_session_admin', eventId] });
        },
    });
};

// ── Emitir voto (❤️ o skip) ──
export const useSubmitPhotoVote = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            sessionId, eventId, submissionId, liked
        }: { sessionId: string; eventId: string; submissionId: string; liked: boolean }) => {
            const token = getVoterToken();
            const { error } = await supabase
                .from('photo_votes')
                .upsert({
                    session_id: sessionId,
                    event_id: eventId,
                    submission_id: submissionId,
                    voter_token: token,
                    voted: liked,
                }, { onConflict: 'session_id,submission_id,voter_token' });
            if (error) throw error;
            return { submissionId, liked };
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['my_votes', vars.sessionId] });
            queryClient.invalidateQueries({ queryKey: ['photo_vote_ranking', vars.sessionId] });
        },
    });
};

// ── Realtime: escuchar cambios en la sesión ──
export const usePhotoVoteRealtime = (sessionId: string | undefined, onUpdate: () => void) => {
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    useEffect(() => {
        if (!sessionId) return;
        const channel = supabase
            .channel(`photo-vote-${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'photo_vote_sessions',
                filter: `id=eq.${sessionId}`,
            }, () => onUpdateRef.current())
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'photo_votes',
                filter: `session_id=eq.${sessionId}`,
            }, () => onUpdateRef.current())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [sessionId]);
};
