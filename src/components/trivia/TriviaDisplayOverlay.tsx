
import { Trophy, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import {
    useTriviaQuestions, useTriviaSortedPlayers,
    useTriviaAnswersForQuestion, useTriviaTimer, useTriviaRealtime,
    useActiveTrivia, useShowResults
} from "@/hooks/use-trivia";
import { useQueryClient } from "@tanstack/react-query";
import { TriviaOption, TriviaQuestion } from "@/types";

interface TriviaDisplayOverlayProps {
    eventId: string;
}

const OPTION_STYLES: Record<TriviaOption, { gradient: string; icon: string }> = {
    a: { gradient: 'from-red-600 to-rose-700', icon: '▲' },
    b: { gradient: 'from-blue-600 to-indigo-700', icon: '◆' },
    c: { gradient: 'from-amber-500 to-orange-600', icon: '●' },
    d: { gradient: 'from-green-600 to-emerald-700', icon: '■' },
};

const WINNER_DISPLAY_SECONDS = 30;

export const TriviaDisplayOverlay = ({ eventId }: TriviaDisplayOverlayProps) => {
    const queryClient = useQueryClient();
    const [dismissed, setDismissed] = useState(false);
    const [countdown, setCountdown] = useState(WINNER_DISPLAY_SECONDS);

    const { data: game, refetch } = useActiveTrivia(eventId);
    const showResults = useShowResults(eventId);

    const { timeLeft, isExpired } = useTriviaTimer(
        game?.status === 'active' ? (game?.question_started_at ?? null) : null,
        game?.question_duration_seconds ?? 10
    );

    const handleAutoShowResults = useCallback(() => {
        if (game?.status === 'active' && game.id) {
            showResults.mutate(game.id);
        }
    }, [game?.status, game?.id, showResults]);

    useEffect(() => {
        if (isExpired && game?.status === 'active') {
            handleAutoShowResults();
        }
    }, [isExpired, game?.status, handleAutoShowResults]);

    const { data: questions = [] } = useTriviaQuestions(game?.id);
    const { data: players = [] } = useTriviaSortedPlayers(game?.id);
    const { data: answers = [] } = useTriviaAnswersForQuestion(
        game?.status === 'active' || game?.status === 'results'
            ? (game?.current_question_id ?? undefined)
            : undefined
    );

    useTriviaRealtime(eventId, {
        onUpdate: () => {
            // Solo invalidamos lo necesario para no saturar
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
            if (game?.id) {
                queryClient.invalidateQueries({ queryKey: ['trivia_players', game.id] });
                queryClient.invalidateQueries({ queryKey: ['trivia_answers_q'] });
            }
            refetch();
        },
        onReset: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_questions'] });
            queryClient.invalidateQueries({ queryKey: ['trivia_players'] });
            refetch();
        }
    });

    // Auto-dismiss winner screen (robusto ante refrescos y remounts)
    useEffect(() => {
        if (!game || game.status !== 'finished') {
            setDismissed(false);
            setCountdown(WINNER_DISPLAY_SECONDS);
            return;
        }

        const updatedAt = new Date(game.updated_at).getTime();
        const elapsed = Math.floor((Date.now() - updatedAt) / 1000);
        const remaining = Math.max(0, WINNER_DISPLAY_SECONDS - elapsed);

        if (remaining <= 0) {
            setDismissed(true);
            setCountdown(0);
            return;
        }

        setCountdown(remaining);
        setDismissed(false);

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setDismissed(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [game?.status, game?.id, game?.updated_at]);

    const currentQuestion = game?.current_question_id
        ? questions.find(q => q.id === game.current_question_id)
        : null;

    const qIndex = currentQuestion ? questions.findIndex(q => q.id === currentQuestion.id) : -1;
    const answeredCount = answers.length;
    const timerPercent = Math.max(0, Math.min(100, (timeLeft / (game?.question_duration_seconds ?? 10)) * 100));
    const timerColor = timerPercent > 50 ? '#22c55e' : timerPercent > 25 ? '#eab308' : '#ef4444';

    if (!game || dismissed) return null;

    // Si el juego está activo pero aún no tenemos los datos de la pregunta, mostramos un pequeño loading
    if ((game.status === 'active' || game.status === 'results') && !currentQuestion) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center">
                <div className="text-violet-400 animate-pulse text-xl font-bold">Sincronizando pregunta...</div>
            </div>
        );
    }

    if (game.status === 'lobby') {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 flex flex-col items-center justify-center">
                <div className="absolute inset-0 overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="absolute w-2 h-2 rounded-full bg-violet-500/20 animate-pulse"
                            style={{ left: `${(i * 47 + 13) % 100}%`, top: `${(i * 31 + 7) % 100}%`, animationDelay: `${(i * 0.3) % 3}s`, animationDuration: `${2 + (i % 3)}s` }}
                        />
                    ))}
                </div>
                <div className="relative text-center space-y-8 px-8">
                    <div className="text-9xl animate-bounce">🎮</div>
                    <div>
                        <h1 className="text-7xl font-black text-white tracking-tight">TRIVIA</h1>
                        <p className="text-2xl text-violet-300 mt-2 font-medium">¡Escanea el QR y unite al juego!</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 inline-block border border-white/20">
                        <p className="text-4xl font-black text-white">{players.length}</p>
                        <p className="text-violet-300 flex items-center gap-2 justify-center mt-1"><Users className="w-5 h-5" /> Jugadores listos</p>
                    </div>
                </div>
            </div>
        );
    }

    if (game.status === 'active' && currentQuestion) {
        const radius = 48;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - timerPercent / 100);
        const activePlayers = players.filter(p => !p.is_eliminated);

        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex flex-col">
                <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <span className="bg-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-bold border border-violet-500/30">
                            Pregunta {qIndex + 1} / {questions.length}
                        </span>
                        <span className="text-slate-400 text-sm flex items-center gap-1"><Users className="w-4 h-4" /> {activePlayers.length} en pie</span>
                    </div>
                    <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 112 112">
                            <circle cx="56" cy="56" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
                            <circle cx="56" cy="56" r={radius} fill="none" stroke={timerColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 0.25s, stroke 0.25s' }} />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-3xl font-black ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{isExpired ? '0' : timeLeft}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-sm">Respondieron</p>
                        <p className="text-3xl font-black text-white">{answeredCount}<span className="text-slate-500 text-lg">/{activePlayers.length}</span></p>
                    </div>
                </div>
                <div className="flex-1 flex flex-col px-8 py-6 gap-6">
                    <div className="bg-white/5 rounded-3xl p-8 border border-white/10 flex-1 flex items-center justify-center">
                        <p className="text-white font-black text-4xl text-center leading-tight max-w-4xl">{currentQuestion.question_text}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        {(['a', 'b', 'c', 'd'] as TriviaOption[]).map(opt => {
                            const styles = OPTION_STYLES[opt];
                            const optAnswers = answers.filter(a => a.selected_option === opt).length;
                            const pct = answeredCount > 0 ? Math.round(optAnswers / answeredCount * 100) : 0;
                            return (
                                <div key={opt} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${styles.gradient} p-6 flex items-center gap-4 border border-white/10`}>
                                    <div className="absolute inset-0 bg-black/20" style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
                                    <span className="relative w-14 h-14 rounded-2xl bg-black/30 flex items-center justify-center text-white text-3xl font-black flex-shrink-0">{styles.icon}</span>
                                    <div className="relative flex-1 min-w-0">
                                        <p className="text-white font-bold text-2xl leading-snug">{currentQuestion[`option_${opt}` as keyof TriviaQuestion] as string}</p>
                                    </div>
                                    <span className="relative text-white/80 font-black text-2xl flex-shrink-0">{optAnswers}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (game.status === 'results' && currentQuestion) {
        const activePlayers = players.filter(p => !p.is_eliminated);
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex flex-col p-8 gap-6">
                <div className="text-center">
                    <p className="text-violet-300 text-lg font-medium mb-2">Respuesta correcta</p>
                    <div className={`inline-block bg-gradient-to-r ${OPTION_STYLES[currentQuestion.correct_option].gradient} rounded-3xl px-8 py-4`}>
                        <p className="text-white font-black text-3xl">{OPTION_STYLES[currentQuestion.correct_option].icon} {currentQuestion[`option_${currentQuestion.correct_option}` as keyof TriviaQuestion] as string}</p>
                    </div>
                </div>
                <div className="flex-1">
                    <p className="text-violet-300 text-lg font-medium mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Ranking — {activePlayers.length} siguen en juego</p>
                    <div className="grid grid-cols-1 gap-3">
                        {players.slice(0, 6).map((p, i) => (
                            <div key={p.id} className={`flex items-center gap-4 rounded-2xl p-4 ${p.is_eliminated ? 'bg-red-500/5 border border-red-500/20 opacity-40' : i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' : 'bg-white/5 border border-white/5'}`}>
                                <span className="text-2xl font-black w-10 text-center">{p.is_eliminated ? '💀' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                                <span className={`flex-1 font-bold text-xl truncate ${p.is_eliminated ? 'text-red-400 line-through' : 'text-white'}`}>{p.player_name}</span>
                                <span className={`font-black text-2xl ${p.is_eliminated ? 'text-red-400' : 'text-white'}`}>{p.score.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (game.status === 'finished') {
        const activePlayers = players.filter(p => !p.is_eliminated);
        const winner = activePlayers[0] ?? players[0];
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-yellow-950 via-slate-950 to-orange-950 flex flex-col items-center justify-center p-8 gap-8">
                <div className="absolute top-6 right-8 flex items-center gap-3 bg-black/40 rounded-2xl px-5 py-3 border border-white/10 backdrop-blur-sm">
                    <span className="text-slate-400 text-base">Volviendo al muro en</span>
                    <span className="text-white font-black text-3xl w-10 text-center tabular-nums">{countdown}</span>
                </div>
                <div className="text-[120px] animate-bounce">🏆</div>
                <div className="text-center">
                    <h1 className="text-8xl font-black text-yellow-400">¡GANADOR!</h1>
                    {winner && <p className="text-5xl font-black text-white mt-4">{winner.player_name}</p>}
                </div>
                <div className="w-full max-w-md h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400/60 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(countdown / WINNER_DISPLAY_SECONDS) * 100}%` }} />
                </div>
            </div>
        );
    }
    return null;
};
