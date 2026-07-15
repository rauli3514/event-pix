import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import {
    TriviaGame, TriviaQuestion, TriviaPlayer, TriviaAnswer, TriviaOption
} from '@/types';

/**
 * HOOKS DE ADMINISTRACIÓN
 */

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
        staleTime: 60000, // Los juegos no cambian tan seguido
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
        staleTime: 10000,
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
        staleTime: 60000,
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
        refetchInterval: 5000, // Menos agresivo, confiamos más en Realtime
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
        refetchInterval: 3000, // Reducido de 1s a 3s para bajar carga
    });
};

/**
 * MUTATIONS DE ADMINISTRACIÓN
 */

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
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
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
            queryClient.invalidateQueries({ queryKey: ['trivia_games_list', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
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
        onSuccess: (_, { gameId }) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
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

            // Broadcast para sincronización inmediata
            const channel = supabase.channel(`trivia-sync-${eventId}`);
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'question_launched',
                        payload: { gameId, questionId, startedAt: now },
                    });
                    supabase.removeChannel(channel);
                }
            });

            return data as TriviaGame;
        },
        onSuccess: (_, { gameId }) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
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
        onSuccess: (_, gameId) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
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
        onSuccess: (_, gameId) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_game', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
        },
    });
};

export const useResetTriviaGame = (eventId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (gameId: string) => {
            if (!eventId) throw new Error('No event ID');

            // USAR RPC SIEMPRE QUE SEA POSIBLE PARA ATOMICIDAD Y PERMISOS
            const { error: rpcError } = await supabase.rpc('admin_reset_trivia', { p_game_id: gameId });

            if (rpcError) {
                console.warn("RPC admin_reset_trivia failed, falling back to manual delete:", rpcError);
                // Fallback manual
                await supabase.from('trivia_answers').delete().eq('game_id', gameId);
                await supabase.from('trivia_players').delete().eq('game_id', gameId);
                const { error: updateError } = await supabase
                    .from('trivia_games')
                    .update({
                        status: 'lobby',
                        question_started_at: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', gameId);
                if (updateError) throw updateError;
            }

            // Broadcast para que todos los clientes limpien estado
            const channel = supabase.channel(`trivia-sync-${eventId}`);
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'game_reset',
                        payload: { gameId },
                    });
                    supabase.removeChannel(channel);
                }
            });

            return true;
        },
        onSuccess: (_, gameId) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_games_list', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_game', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_players', gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_answers_q'] });
        },
    });
};

/**
 * HOOKS DE INVITADO
 */

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
                if (now - updatedAt > 300000) return null; // 5 minutos de visibilidad post-finish
            }

            return game;
        },
        enabled: !!eventId,
        refetchInterval: 10000, // Mucho menos agresivo, Realtime es primario
    });
};

export const useJoinTriviaGame = () => {
    const queryClient = useQueryClient();
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
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_players', vars.gameId] });
        }
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
            return data as {
                is_correct: boolean;
                points_earned: number;
                speed_bonus: number;
                already_answered: boolean;
                is_eliminated: boolean
            };
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['trivia_players', vars.gameId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_answers_q', vars.questionId] });
        },
    });
};

/**
 * TIMER HOOK
 */

export const useTriviaTimer = (questionStartedAt: string | null, durationSeconds: number) => {
    const [timeLeft, setTimeLeft] = useState(durationSeconds);
    const [isExpired, setIsExpired] = useState(false);
    const intervalRef = useRef<any>(null);

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
        intervalRef.current = setInterval(tick, 500);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [questionStartedAt, durationSeconds]);

    return { timeLeft, isExpired };
};

/**
 * REALTIME HOOK - UNIFICADO
 */

export const useTriviaRealtime = (eventId: string | undefined, callbacks: {
    onUpdate?: () => void;
    onReset?: () => void;
    onQuestionLaunched?: (payload: any) => void;
}) => {
    const queryClient = useQueryClient();
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    useEffect(() => {
        if (!eventId) return;

        const channel = supabase
            .channel(`trivia-sync-${eventId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trivia_games',
                filter: `event_id=eq.${eventId}`,
            }, (payload) => {
                // Actualiza el cache si tenemos la data nueva
                if (payload.new) {
                    queryClient.setQueryData(['trivia_active', eventId], payload.new);
                    queryClient.setQueryData(['trivia_game', (payload.new as any).id], payload.new);
                }
                callbacksRef.current.onUpdate?.();
            })
            .on('broadcast', { event: 'question_launched' }, ({ payload }) => {
                // Invalida inmediatamente para forzar recarga
                queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
                queryClient.invalidateQueries({ queryKey: ['trivia_game'] });
                callbacksRef.current.onUpdate?.();
                callbacksRef.current.onQuestionLaunched?.(payload);
            })
            .on('broadcast', { event: 'game_reset' }, () => {
                // El reset es una actualización mayor
                callbacksRef.current.onUpdate?.();
                callbacksRef.current.onReset?.();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [eventId]);
};
