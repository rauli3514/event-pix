import { Trophy, Users, Zap } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import QRCode from "react-qr-code";
import { useEvent } from "@/context/EventContext";
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
    const { event } = useEvent();
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

    const appUrl = event ? `${window.location.origin}/${event.slug}` : window.location.origin;

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
                <div className="relative text-center space-y-8 px-8 flex flex-col items-center">
                    <div className="text-9xl animate-bounce">🎮</div>
                    <div>
                        <h1 className="text-7xl font-black text-white tracking-tight italic uppercase">TRIVIA</h1>
                        <p className="text-2xl text-violet-300 mt-2 font-medium uppercase tracking-widest">¡Escanea el QR y unite al juego!</p>
                    </div>

                    {/* QR GIGANTE LOBBY */}
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-[2.5rem] opacity-75 blur-xl group-hover:opacity-100 transition duration-1000 animate-pulse" />
                        <div className="relative bg-white p-6 rounded-[2rem] shadow-2xl">
                            <QRCode 
                                value={appUrl} 
                                size={320}
                                className="rounded-lg"
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 inline-block border border-white/20">
                        <p className="text-5xl font-black text-white">{players.length}</p>
                        <p className="text-violet-300 flex items-center gap-2 justify-center mt-1 uppercase font-bold tracking-widest"><Users className="w-6 h-6" /> Jugadores listos</p>
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
                <div className="flex items-center justify-between px-8 py-4 border-b border-white/10 relative">
                    <div className="flex items-center gap-4">
                        <span className="bg-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-bold border border-violet-500/30 uppercase tracking-widest">
                            Pregunta {qIndex + 1} / {questions.length}
                        </span>
                        <span className="text-slate-400 text-sm flex items-center gap-1 uppercase font-bold tracking-widest"><Users className="w-4 h-4" /> {activePlayers.length} en pie</span>
                    </div>

                    {/* Header Center Timer */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8">
                        <div className="relative w-24 h-24">
                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 112 112">
                                <circle cx="56" cy="56" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
                                <circle cx="56" cy="56" r={radius} fill="none" stroke={timerColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 0.25s, stroke 0.25s' }} />
                            </svg>
                            <span className={`absolute inset-0 flex items-center justify-center text-3xl font-black ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{isExpired ? '0' : timeLeft}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-12">
                        <div className="text-right">
                            <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Respondieron</p>
                            <p className="text-4xl font-black text-white">{answeredCount}<span className="text-slate-500 text-lg">/{activePlayers.length}</span></p>
                        </div>
                        
                        {/* QR SMALL IN HEADER */}
                        <div className="bg-white p-2 rounded-xl shadow-xl">
                            <QRCode value={appUrl} size={60} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-row p-8 gap-8">
                    {/* Left Side: Question & Options */}
                    <div className="flex-[0.7] flex flex-col gap-6">
                        <div className="bg-white/5 rounded-[3rem] p-10 border border-white/10 flex-1 flex items-center justify-center shadow-inner">
                            <p className="text-white font-black text-5xl text-center leading-tight max-w-4xl italic uppercase tracking-tighter">{currentQuestion.question_text}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {(['a', 'b', 'c', 'd'] as TriviaOption[]).map(opt => {
                                const styles = OPTION_STYLES[opt];
                                const optAnswers = answers.filter(a => a.selected_option === opt).length;
                                const pct = answeredCount > 0 ? Math.round(optAnswers / answeredCount * 100) : 0;
                                return (
                                    <div key={opt} className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${styles.gradient} p-8 flex items-center gap-6 border border-white/10 shadow-lg`}>
                                        <div className="absolute inset-0 bg-black/20" style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
                                        <span className="relative w-16 h-16 rounded-2xl bg-black/30 flex items-center justify-center text-white text-4xl font-black flex-shrink-0">{styles.icon}</span>
                                        <div className="relative flex-1 min-w-0">
                                            <p className="text-white font-black text-2xl leading-snug uppercase tracking-tight">{currentQuestion[`option_${opt}` as keyof TriviaQuestion] as string}</p>
                                        </div>
                                        <span className="relative text-white/80 font-black text-3xl flex-shrink-0">{optAnswers}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side: QR Gigante & Tip */}
                    <div className="flex-[0.3] flex flex-col items-center justify-center gap-8 bg-white/5 rounded-[3rem] p-10 border border-white/10">
                         <div className="text-center space-y-2">
                            <Zap className="w-12 h-12 text-yellow-400 mx-auto animate-pulse" />
                            <h2 className="text-white font-black text-2xl uppercase italic tracking-tighter">¿Aún no entraste?</h2>
                            <p className="text-violet-300 text-sm font-bold uppercase tracking-widest">Escanea el QR ahora</p>
                        </div>

                        <div className="bg-white p-5 rounded-[2.5rem] shadow-[0_0_50px_rgba(139,92,246,0.3)]">
                            <QRCode value={appUrl} size={220} />
                        </div>

                        <div className="text-center">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Juego en vivo</p>
                            <p className="text-white font-black text-lg">EVENTPIX TRIVIA</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (game.status === 'results' && currentQuestion) {
        const activePlayers = players.filter(p => !p.is_eliminated);
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex flex-col p-8 gap-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-3 rounded-2xl shadow-xl">
                            <QRCode value={appUrl} size={100} />
                        </div>
                        <div>
                            <p className="text-violet-300 text-sm font-bold uppercase tracking-widest">Siguiente pregunta en breve</p>
                            <h2 className="text-white font-black text-3xl uppercase italic tracking-tighter">¡Preparate!</h2>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-violet-300 text-lg font-black uppercase tracking-widest mb-2">Respuesta correcta</p>
                        <div className={`inline-block bg-gradient-to-r ${OPTION_STYLES[currentQuestion.correct_option].gradient} rounded-full px-12 py-5 shadow-2xl`}>
                            <p className="text-white font-black text-4xl uppercase tracking-tight">{OPTION_STYLES[currentQuestion.correct_option].icon} {currentQuestion[`option_${currentQuestion.correct_option}` as keyof TriviaQuestion] as string}</p>
                        </div>
                    </div>
                    <div className="w-[200px]" /> {/* Spacer to center the middle element */}
                </div>

                <div className="flex-1 bg-white/5 rounded-[3rem] p-10 border border-white/10 shadow-2xl">
                    <p className="text-violet-300 text-xl font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-3 border-b border-white/10 pb-4">
                        <Trophy className="w-8 h-8 text-yellow-400" /> Ranking — {activePlayers.length} siguen en juego
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {players.slice(0, 10).map((p, i) => (
                            <div key={p.id} className={`flex items-center gap-6 rounded-[2rem] p-6 transition-all ${p.is_eliminated ? 'bg-red-500/5 border border-red-500/20 opacity-40' : i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 scale-105 shadow-xl' : 'bg-white/5 border border-white/5'}`}>
                                <span className="text-4xl font-black w-14 text-center">{p.is_eliminated ? '💀' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                                <span className={`flex-1 font-black text-2xl truncate uppercase tracking-tighter ${p.is_eliminated ? 'text-red-400 line-through' : 'text-white'}`}>{p.player_name}</span>
                                <span className={`font-black text-3xl ${p.is_eliminated ? 'text-red-400' : 'text-white'}`}>{p.score.toLocaleString()}</span>
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
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-yellow-950 via-slate-950 to-orange-950 flex flex-col items-center justify-center p-8 gap-12">
                <div className="absolute top-8 right-8 flex items-center gap-4 bg-black/40 rounded-3xl px-8 py-5 border border-white/10 backdrop-blur-md">
                    <span className="text-slate-400 text-lg font-bold uppercase tracking-widest">Volviendo al muro en</span>
                    <span className="text-white font-black text-5xl w-14 text-center tabular-nums">{countdown}</span>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                    <div className="text-[160px] animate-bounce">🏆</div>
                    <div className="text-center">
                        <h1 className="text-[8rem] font-black text-yellow-400 leading-none italic uppercase tracking-tighter drop-shadow-[0_0_50px_rgba(250,204,21,0.4)]">¡GANADOR!</h1>
                        {winner && <p className="text-6xl font-black text-white mt-4 uppercase tracking-tight italic">{winner.player_name}</p>}
                    </div>
                </div>

                <div className="w-full max-w-2xl h-4 bg-white/10 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-1000 ease-linear shadow-[0_0_20px_rgba(250,204,21,0.5)]" style={{ width: `${(countdown / WINNER_DISPLAY_SECONDS) * 100}%` }} />
                </div>

                <div className="bg-white p-4 rounded-[2rem] shadow-2xl opacity-50 hover:opacity-100 transition-opacity">
                    <QRCode value={appUrl} size={150} />
                </div>
            </div>
        );
    }
    return null;
};
