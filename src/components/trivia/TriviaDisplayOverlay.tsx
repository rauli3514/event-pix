
import { Trophy, Users, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import {
    useTriviaGame, useTriviaQuestions, useTriviaSortedPlayers,
    useTriviaAnswersForQuestion, useTriviaTimer, useTriviaRealtime
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

// Segundos que se muestra la pantalla de ganador antes de volver al wall
const WINNER_DISPLAY_SECONDS = 30;

export const TriviaDisplayOverlay = ({ eventId }: TriviaDisplayOverlayProps) => {
    const queryClient = useQueryClient();
    const [dismissed, setDismissed] = useState(false);
    const [countdown, setCountdown] = useState(WINNER_DISPLAY_SECONDS);

    const { data: game, refetch } = useTriviaGame(eventId);
    const { data: questions = [] } = useTriviaQuestions(game?.id);
    const { data: players = [] } = useTriviaSortedPlayers(game?.id);
    const { data: answers = [] } = useTriviaAnswersForQuestion(
        game?.status === 'active' || game?.status === 'results'
            ? (game?.current_question_id ?? undefined)
            : undefined
    );

    useTriviaRealtime(game?.id, () => {
        queryClient.invalidateQueries({ queryKey: ['trivia_game', eventId] });
        queryClient.invalidateQueries({ queryKey: ['trivia_players', game?.id] });
        refetch();
    });

    const { timeLeft, isExpired } = useTriviaTimer(
        game?.status === 'active' ? (game?.question_started_at ?? null) : null,
        game?.question_duration_seconds ?? 10
    );

    // Cuando el juego termina: iniciar countdown para volver al wall
    useEffect(() => {
        if (game?.status !== 'finished') {
            setDismissed(false);
            setCountdown(WINNER_DISPLAY_SECONDS);
            return;
        }

        setCountdown(WINNER_DISPLAY_SECONDS);
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
    }, [game?.status, game?.id]);

    const currentQuestion = game?.current_question_id
        ? questions.find(q => q.id === game.current_question_id)
        : null;

    const qIndex = currentQuestion ? questions.findIndex(q => q.id === currentQuestion.id) : -1;
    const answeredCount = answers.length;
    const correctCount = answers.filter(a => a.is_correct).length;
    const timerPercent = (timeLeft / (game?.question_duration_seconds ?? 10)) * 100;
    const timerColor = timerPercent > 50 ? '#22c55e' : timerPercent > 25 ? '#eab308' : '#ef4444';

    // No mostrar si no hay juego activo, fue descartado, o está en setup
    if (!game || dismissed || !['lobby', 'active', 'results', 'finished'].includes(game.status)) {
        return null;
    }

    // ===================== LOBBY =====================
    if (game.status === 'lobby') {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 flex flex-col items-center justify-center">
                <div className="absolute inset-0 overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 rounded-full bg-violet-500/20 animate-pulse"
                            style={{
                                left: `${(i * 47 + 13) % 100}%`,
                                top: `${(i * 31 + 7) % 100}%`,
                                animationDelay: `${(i * 0.3) % 3}s`,
                                animationDuration: `${2 + (i % 3)}s`,
                            }}
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
                        <p className="text-violet-300 flex items-center gap-2 justify-center mt-1">
                            <Users className="w-5 h-5" /> Jugadores listos
                        </p>
                    </div>
                    {players.length > 0 && (
                        <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
                            {players.slice(0, 12).map(p => (
                                <span key={p.id} className="bg-white/10 text-white px-4 py-2 rounded-full text-lg font-semibold backdrop-blur-sm border border-white/10">
                                    {p.player_name}
                                </span>
                            ))}
                            {players.length > 12 && <span className="text-violet-300 text-lg">+{players.length - 12} más</span>}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ===================== PREGUNTA ACTIVA =====================
    if (game.status === 'active' && currentQuestion) {
        const radius = 48;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - timerPercent / 100);
        const activePlayers = players.filter(p => !(p as any).is_eliminated);

        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex flex-col">
                <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <span className="bg-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-bold border border-violet-500/30">
                            Pregunta {qIndex + 1} / {questions.length}
                        </span>
                        <span className="text-slate-400 text-sm flex items-center gap-1">
                            <Users className="w-4 h-4" /> {activePlayers.length} en pie
                        </span>
                    </div>
                    <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 112 112">
                            <circle cx="56" cy="56" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
                            <circle
                                cx="56" cy="56" r={radius}
                                fill="none" stroke={timerColor} strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                                style={{ transition: 'stroke-dashoffset 0.25s, stroke 0.25s' }}
                            />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-3xl font-black ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                            {isExpired ? '0' : timeLeft}
                        </span>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-sm">Respondieron</p>
                        <p className="text-3xl font-black text-white">{answeredCount}<span className="text-slate-500 text-lg">/{activePlayers.length}</span></p>
                    </div>
                </div>
                <div className="flex-1 flex flex-col px-8 py-6 gap-6">
                    <div className="bg-white/5 rounded-3xl p-8 border border-white/10 flex-1 flex items-center justify-center">
                        <p className="text-white font-black text-4xl text-center leading-tight max-w-4xl">
                            {currentQuestion.question_text}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        {(['a', 'b', 'c', 'd'] as TriviaOption[]).map(opt => {
                            const styles = OPTION_STYLES[opt];
                            const optAnswers = answers.filter(a => a.selected_option === opt).length;
                            const pct = answeredCount > 0 ? Math.round(optAnswers / answeredCount * 100) : 0;
                            return (
                                <div key={opt} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${styles.gradient} p-6 flex items-center gap-4 border border-white/10`}>
                                    <div className="absolute inset-0 bg-black/20" style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
                                    <span className="relative w-14 h-14 rounded-2xl bg-black/30 flex items-center justify-center text-white text-3xl font-black flex-shrink-0">
                                        {styles.icon}
                                    </span>
                                    <div className="relative flex-1 min-w-0">
                                        <p className="text-white font-bold text-2xl leading-snug">
                                            {currentQuestion[`option_${opt}` as keyof TriviaQuestion] as string}
                                        </p>
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

    // ===================== RESULTADOS =====================
    if (game.status === 'results' && currentQuestion) {
        const activePlayers = players.filter(p => !(p as any).is_eliminated);
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex flex-col p-8 gap-6">
                <div className="text-center">
                    <p className="text-violet-300 text-lg font-medium mb-2">Respuesta correcta</p>
                    <div className={`inline-block bg-gradient-to-r ${OPTION_STYLES[currentQuestion.correct_option].gradient} rounded-3xl px-8 py-4`}>
                        <p className="text-white font-black text-3xl">
                            {OPTION_STYLES[currentQuestion.correct_option].icon}{' '}
                            {currentQuestion[`option_${currentQuestion.correct_option}` as keyof TriviaQuestion] as string}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-8 mt-4">
                        <div className="text-center">
                            <p className="text-3xl font-black text-white">{answeredCount}</p>
                            <p className="text-slate-400 text-sm">respondieron</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-black text-green-400">{correctCount}</p>
                            <p className="text-slate-400 text-sm">correctas</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-black text-red-400">{players.length - activePlayers.length}</p>
                            <p className="text-slate-400 text-sm">💀 eliminados</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-black text-violet-400">{activePlayers.length}</p>
                            <p className="text-slate-400 text-sm">en pie</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1">
                    <p className="text-violet-300 text-lg font-medium mb-4 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-400" /> Ranking — {activePlayers.length} siguen en juego
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                        {players.slice(0, 6).map((p, i) => {
                            const isEliminated = (p as any).is_eliminated;
                            return (
                                <div key={p.id} className={`flex items-center gap-4 rounded-2xl p-4 ${isEliminated ? 'bg-red-500/5 border border-red-500/20 opacity-40' :
                                        i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' :
                                            i === 1 ? 'bg-gradient-to-r from-slate-400/20 to-slate-500/20 border border-slate-400/30' :
                                                i === 2 ? 'bg-gradient-to-r from-amber-700/20 to-amber-800/20 border border-amber-700/30' :
                                                    'bg-white/5 border border-white/5'
                                    }`}>
                                    <span className="text-2xl font-black w-10 text-center">
                                        {isEliminated ? '💀' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </span>
                                    <span className={`flex-1 font-bold text-xl truncate ${isEliminated ? 'text-red-400 line-through' : 'text-white'}`}>{p.player_name}</span>
                                    {p.streak > 1 && !isEliminated && (
                                        <span className="flex items-center gap-1 text-orange-400 text-lg font-bold">🔥 x{p.streak}</span>
                                    )}
                                    <span className={`font-black text-2xl ${isEliminated ? 'text-red-400' : 'text-white'}`}>{p.score.toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ===================== FINALIZADO — vuelve al wall después de 30s =====================
    if (game.status === 'finished') {
        const activePlayers = players.filter(p => !(p as any).is_eliminated);
        const winner = activePlayers[0] ?? players[0];

        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-yellow-950 via-slate-950 to-orange-950 flex flex-col items-center justify-center p-8 gap-8">
                {/* Countdown chip */}
                <div className="absolute top-6 right-8 flex items-center gap-3 bg-black/40 rounded-2xl px-5 py-3 border border-white/10 backdrop-blur-sm">
                    <span className="text-slate-400 text-base">Volviendo al muro en</span>
                    <span className="text-white font-black text-3xl w-10 text-center tabular-nums">{countdown}</span>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-xs text-slate-500 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg px-3 py-1.5 transition-colors ml-1"
                    >
                        Cerrar ya
                    </button>
                </div>

                <div className="text-[120px] animate-bounce">🏆</div>
                <div className="text-center">
                    <h1 className="text-8xl font-black text-yellow-400">¡GANADOR!</h1>
                    {winner && (
                        <>
                            <p className="text-5xl font-black text-white mt-4">{winner.player_name}</p>
                            <p className="text-3xl text-yellow-300 mt-2 flex items-center justify-center gap-2">
                                <Zap className="w-8 h-8" />
                                {winner.score.toLocaleString()} puntos
                            </p>
                        </>
                    )}
                </div>

                {/* Top 3 podio */}
                <div className="flex gap-6 items-end">
                    {players[1] && (
                        <div className="text-center bg-slate-400/10 border border-slate-400/20 rounded-2xl p-4 w-36">
                            <div className="text-4xl">🥈</div>
                            <p className="text-white font-bold mt-1 text-sm truncate">{players[1].player_name}</p>
                            <p className="text-slate-300 font-black">{players[1].score.toLocaleString()}</p>
                        </div>
                    )}
                    {players[0] && (
                        <div className="text-center bg-yellow-500/20 border border-yellow-500/30 rounded-2xl p-6 w-44">
                            <div className="text-5xl">🥇</div>
                            <p className="text-white font-bold mt-1 truncate">{players[0].player_name}</p>
                            <p className="text-yellow-300 font-black text-lg">{players[0].score.toLocaleString()}</p>
                        </div>
                    )}
                    {players[2] && (
                        <div className="text-center bg-amber-700/10 border border-amber-700/20 rounded-2xl p-4 w-36">
                            <div className="text-4xl">🥉</div>
                            <p className="text-white font-bold mt-1 text-sm truncate">{players[2].player_name}</p>
                            <p className="text-amber-400 font-black">{players[2].score.toLocaleString()}</p>
                        </div>
                    )}
                </div>

                {/* Barra de progreso de countdown */}
                <div className="w-full max-w-md">
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-400/60 rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${(countdown / WINNER_DISPLAY_SECONDS) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
