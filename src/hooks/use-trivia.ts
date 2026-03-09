import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import {
    TriviaGame, TriviaQuestion, TriviaPlayer, TriviaAnswer, TriviaOption
} from '@/types';

// ============================================================
// ADMIN HOOKS
// ============================================================

export const useTriviaGamesList = (eventId?: string) => {
    return useQuery({
        queryKey: ['trivia_games_list', eventId],
        queryFn: async () => {
            if (!eventId) return [];
            const { data, error } = await supabase
                .from('trivia_games')
                .select('*')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as TriviaGame[];
        },
        enabled: !!eventId,
    });
};

export const useTriviaGame = (gameId?: string) => {
    return useQuery({
        queryKey: ['trivia_game', gameId],
        queryFn: async () => {
            if (!gameId) return null;
            const { data, error } = await supabase
                .from('trivia_games')
                .select('*')
                .eq('id', gameId)
                .single();
            if (error) throw error;
            return data as TriviaGame | null;
        },
        enabled: !!gameId,
        refetchInterval: 3000,
    });
};

export const useTriviaQuestions = (gameId?: string) => {
    return useQuery({
        queryKey: ['trivia_questions', gameId],
        queryFn: async () => {
            if (!gameId) return [];
            const { data, error } = await supabase
                .from('trivia_questions')
                .select('*')
                .eq('game_id', gameId)
                .order('order_index', { ascending: true });
            if (error) throw error;
            return data as TriviaQuestion[];
        },
        enabled: !!gameId,
    });
};

export const useTriviaSortedPlayers = (gameId?: string) => {
    return useQuery({
        queryKey: ['trivia_players', gameId],
        queryFn: async () => {
            if (!gameId) return [];
            const { data, error } = await supabase
                .from('trivia_players')
                .select('*')
                .eq('game_id', gameId)
                .order('score', { ascending: false });
            if (error) throw error;
            return data as TriviaPlayer[];
        },
        enabled: !!gameId,
        refetchInterval: 2000,
    });
};


export const useTriviaAnswersForQuestion = (questionId?: string) => {
    return useQuery({
        queryKey: ['trivia_answers_q', questionId],
        queryFn: async () => {
            if (!questionId) return [];
            const { data, error } = await supabase
                .from('trivia_answers')
                .select('*')
                .eq('question_id', questionId);
            if (error) throw error;
            return data as TriviaAnswer[];
        },
        enabled: !!questionId,
        refetchInterval: 1000,
    });
};

// ============================================================
// ADMIN MUTATIONS
// ============================================================

export const useCreateTriviaGame = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (title: string = 'Nueva Trivia') => {
            if (!eventId) throw new Error('No event ID');
            const { data, error } = await supabase
                .from('trivia_games')
                .insert({
                    event_id: eventId,
                    status: 'setup',
                    title: title
                })
                .select()
                .single();
            if (error) throw error;
            return data as TriviaGame;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_games_list', eventId] });
        },
    });
};

export const useDeleteTriviaGame = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (gameId: string) => {
            const { error } = await supabase
                .from('trivia_games')
                .delete()
                .eq('id', gameId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_questions'] });
            queryClient.invalidateQueries({ queryKey: ['trivia_players'] });
        },
    });
};

export const useAddTriviaQuestion = (gameId?: string, eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (q: Omit<TriviaQuestion, 'id' | 'created_at' | 'game_id' | 'event_id'>) => {
            if (!gameId || !eventId) throw new Error('No IDs');
            const { data, error } = await supabase
                .from('trivia_questions')
                .insert({ ...q, game_id: gameId, event_id: eventId })
                .select()
                .single();
            if (error) throw error;
            return data as TriviaQuestion;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_questions', gameId] });
        },
    });
};

export const useDeleteTriviaQuestion = (gameId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (questionId: string) => {
            const { error } = await supabase
                .from('trivia_questions')
                .delete()
                .eq('id', questionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_questions', gameId] });
        },
    });
};

export const useUpdateTriviaGame = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ gameId, updates }: { gameId: string; updates: Partial<TriviaGame> }) => {
            const { data, error } = await supabase
                .from('trivia_games')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', gameId)
                .select()
                .single();
            if (error) throw error;
            return data as TriviaGame;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
        },
    });
};

export const useLaunchQuestion = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ gameId, questionId }: { gameId: string; questionId: string }) => {
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from('trivia_games')
                .update({
                    status: 'active',
                    current_question_id: questionId,
                    question_started_at: now,
                    updated_at: now,
                })
                .eq('id', gameId)
                .select()
                .single();
            if (error) throw error;

            // Broadcast via Supabase channel for instant sync
            const channel = supabase.channel(`trivia-sync-${gameId}`);
            await new Promise<void>((resolve) => {
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        channel.send({
                            type: 'broadcast',
                            event: 'question_launched',
                            payload: { gameId, questionId, startedAt: now },
                        });
                        setTimeout(() => { supabase.removeChannel(channel); resolve(); }, 300);
                    }
                });
            });

            return data as TriviaGame;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
        },
    });
};

export const useShowResults = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (gameId: string) => {
            const { data, error } = await supabase
                .from('trivia_games')
                .update({ status: 'results', updated_at: new Date().toISOString() })
                .eq('id', gameId)
                .select()
                .single();
            if (error) throw error;
            return data as TriviaGame;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
        },
    });
};

export const useFinishTriviaGame = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (gameId: string) => {
            const { data, error } = await supabase
                .from('trivia_games')
                .update({ status: 'finished', updated_at: new Date().toISOString() })
                .eq('id', gameId)
                .select()
                .single();
            if (error) throw error;
            return data as TriviaGame;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
        },
    });
};

export const useResetTriviaGame = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (gameId: string) => {
            // Usamos RPC para borrar respuestas, inscriptos y resetear estado atómicamente
            // Esto evita errores de integridad de base de datos y borra TODO de un tirón.
            const { error } = await supabase.rpc('admin_reset_trivia', {
                p_game_id: gameId
            });

            if (error) throw error;

            // Enviar broadcast de reset para limpiar celulares de invitados
            const channel = supabase.channel(`trivia-sync-${gameId}`);
            await new Promise<void>((resolve) => {
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        channel.send({
                            type: 'broadcast',
                            event: 'game_reset',
                            payload: { gameId },
                        });
                        setTimeout(() => { supabase.removeChannel(channel); resolve(); }, 300);
                    }
                });
            });

            return true;
        },
        onSuccess: (_, gameId) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_players', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_answers_q'] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_games_list', eventId] });
        },
    });
};

// ============================================================
// GUEST HOOKS
// ============================================================

export const useActiveTrivia = (eventId?: string) => {
    return useQuery({
        queryKey: ['trivia_active', eventId],
        queryFn: async () => {
            if (!eventId) return null;
            const { data, error } = await supabase
                .from('trivia_games')
                .select('*')
                .eq('event_id', eventId)
                .in('status', ['lobby', 'active', 'results', 'finished'])
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            const game = data as TriviaGame;

            if (game.status === 'finished') {
                const updatedAt = new Date(game.updated_at).getTime();
                const now = Date.now();
                if (now - updatedAt > 120000) return null;
            }

            return game;
        },
        enabled: !!eventId,
        refetchInterval: 3000,
    });
};

export const useJoinTriviaGame = () => {
    return useMutation({
        mutationFn: async ({
            gameId, eventId, playerName
        }: { gameId: string; eventId: string; playerName: string }) => {
            const { data, error } = await supabase
                .from('trivia_players')
                .insert({ game_id: gameId, event_id: eventId, player_name: playerName })
                .select()
                .single();
            if (error) throw error;
            return data as TriviaPlayer;
        },
    });
};

export const useSubmitTriviaAnswer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            gameId, questionId, playerId, selectedOption, questionStartedAt, questionDuration
        }: {
            gameId: string;
            questionId: string;
            playerId: string;
            selectedOption: TriviaOption;
            questionStartedAt: string;
            questionDuration: number;
        }) => {
            const { data, error } = await supabase.rpc('submit_trivia_answer', {
                p_game_id: gameId,
                p_question_id: questionId,
                p_player_id: playerId,
                p_selected_option: selectedOption,
                p_question_started_at: questionStartedAt,
                p_question_duration: questionDuration,
            });
            if (error) throw error;
            return data as { is_correct: boolean; points_earned: number; speed_bonus: number; already_answered: boolean; is_eliminated: boolean };
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_players', vars.gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_answers_q', vars.questionId] });
        },
    });
};

// ============================================================
// TIMER HOOK
// ============================================================

export const useTriviaTimer = (questionStartedAt: string | null, durationSeconds: number) => {
    const [timeLeft, setTimeLeft] = useState(durationSeconds);
    const [isExpired, setIsExpired] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!questionStartedAt) {
            setTimeLeft(durationSeconds);
            setIsExpired(false);
            return;
        }

        const tick = () => {
            const elapsed = (Date.now() - new Date(questionStartedAt).getTime()) / 1000;
            const remaining = Math.max(0, durationSeconds - elapsed);
            setTimeLeft(Math.ceil(remaining));
            if (remaining <= 0) {
                setIsExpired(true);
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
        };

        tick();
        intervalRef.current = setInterval(tick, 250);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [questionStartedAt, durationSeconds]);

    return { timeLeft, isExpired };
};

// ============================================================
// REALTIME HOOK
// ============================================================

export const useTriviaRealtime = (eventId: string | undefined, gameId: string | undefined, onUpdate: () => void) => {
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    useEffect(() => {
        if (!eventId) return;

        const channel = supabase
            .channel(`trivia-sync-global-${eventId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trivia_games',
                filter: `event_id=eq.${eventId}`,
            }, () => {
                onUpdateRef.current();
            })
            .on('broadcast', { event: 'question_launched' }, () => {
                onUpdateRef.current();
            })
            .on('broadcast', { event: 'game_reset' }, () => {
                onUpdateRef.current();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [eventId, gameId]);
};
