import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import {
    useActiveTrivia, useTriviaQuestions, useTriviaSortedPlayers,
    useJoinTriviaGame, useSubmitTriviaAnswer, useTriviaTimer, useTriviaRealtime
} from "@/hooks/use-trivia";
import { useQueryClient } from "@tanstack/react-query";
import { TriviaOption, TriviaQuestion, TriviaPlayer } from "@/types";
import { supabase } from "@/lib/supabase";

interface TriviaGuestViewProps {
    eventId: string;
}

// Colores fijos por slot de pantalla (siempre el mismo orden visual)
const SLOT_STYLES: Record<TriviaOption, {
    bg: string;
    bgSelected: string;
    bgCorrect: string;
    bgWrong: string;
    bgDimmed: string;
    shape: 'triangle' | 'diamond' | 'circle' | 'square';
}> = {
    a: { bg: 'bg-red-600', bgSelected: 'bg-red-700', bgCorrect: 'bg-green-500', bgWrong: 'bg-red-900/60', bgDimmed: 'bg-red-900/20', shape: 'triangle' },
    b: { bg: 'bg-blue-600', bgSelected: 'bg-blue-700', bgCorrect: 'bg-green-500', bgWrong: 'bg-blue-900/60', bgDimmed: 'bg-blue-900/20', shape: 'diamond' },
    c: { bg: 'bg-yellow-500', bgSelected: 'bg-yellow-600', bgCorrect: 'bg-green-500', bgWrong: 'bg-yellow-900/60', bgDimmed: 'bg-yellow-900/20', shape: 'circle' },
    d: { bg: 'bg-green-600', bgSelected: 'bg-green-700', bgCorrect: 'bg-green-400', bgWrong: 'bg-green-900/60', bgDimmed: 'bg-green-900/20', shape: 'square' },
};

const KahootShape = ({ shape, size = 48 }: { shape: string; size?: number }) => {
    switch (shape) {
        case 'triangle': return (
            <svg width={size} height={size} viewBox="0 0 100 100">
                <polygon points="50,8 92,90 8,90" fill="white" />
            </svg>
        );
        case 'diamond': return (
            <svg width={size} height={size} viewBox="0 0 100 100">
                <polygon points="50,5 95,50 50,95 5,50" fill="white" />
            </svg>
        );
        case 'circle': return (
            <svg width={size} height={size} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="white" />
            </svg>
        );
        case 'square': return (
            <svg width={size} height={size} viewBox="0 0 100 100">
                <rect x="12" y="12" width="76" height="76" fill="white" />
            </svg>
        );
        default: return null;
    }
};

// Mezcla aleatoria Fisher-Yates
const shuffle = (arr: TriviaOption[]): TriviaOption[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

type Phase = 'idle' | 'lobby' | 'question' | 'results' | 'finished' | 'eliminated';

export const TriviaGuestView = ({ eventId }: TriviaGuestViewProps) => {
    const [phase, setPhase] = useState<Phase>('idle');
    const [playerName, setPlayerName] = useState('');
    const [player, setPlayer] = useState<TriviaPlayer | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<TriviaOption | null>(null);
    const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number; bonus: number; isEliminated: boolean } | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);

    // Mapeo aleatorio: slot visual (a=rojo, b=azul...) → opción real de la DB
    // Se baraja cada vez que cambia la pregunta
    const [slotToOption, setSlotToOption] = useState<Record<TriviaOption, TriviaOption>>({ a: 'a', b: 'b', c: 'c', d: 'd' });
    const prevQuestionIdRef = useRef<string | null>(null);

    const queryClient = useQueryClient();
    const { data: game, refetch: refetchGame } = useActiveTrivia(eventId);
    const { data: allQuestions = [] } = useTriviaQuestions(game?.id);
    const { data: sortedPlayers = [] } = useTriviaSortedPlayers(game?.id);

    const joinGame = useJoinTriviaGame();
    const submitAnswer = useSubmitTriviaAnswer();

    const { timeLeft, isExpired } = useTriviaTimer(
        phase === 'question' ? (game?.question_started_at ?? null) : null,
        game?.question_duration_seconds ?? 10
    );

    // Barajar opciones cada vez que cambia la pregunta
    useEffect(() => {
        if (!game?.current_question_id) return;
        const q = allQuestions.find(q => q.id === game.current_question_id);
        if (!q) return;
        if (q.id === prevQuestionIdRef.current) return; // misma pregunta, no rebarajar
        prevQuestionIdRef.current = q.id;
        setCurrentQuestion(q);

        // Crear mapeo: slot visual → opción real
        const shuffled = shuffle(['a', 'b', 'c', 'd']);
        setSlotToOption({ a: shuffled[0], b: shuffled[1], c: shuffled[2], d: shuffled[3] });
    }, [game?.current_question_id, allQuestions]);

    // Realtime Unificado
    useTriviaRealtime(eventId, {
        onUpdate: () => {
            queryClient.invalidateQueries({ queryKey: ['trivia_active', eventId] });
            queryClient.invalidateQueries({ queryKey: ['trivia_players', game?.id] });
            refetchGame();
        },
        onReset: () => {
            setPlayer(null);
            setPhase('idle');
            setSelectedAnswer(null);
            setAnswerResult(null);
            toast.info("El juego ha sido reiniciado");
        }
    });

    useEffect(() => {
        if (!game) {
            if (phase !== 'idle') setPhase('idle');
            return;
        }

        // Si el juego está en lobby, resetear fase a lobby si hay jugador, o idle si no hay
        if (game.status === 'lobby') {
            setPhase(player ? 'lobby' : 'idle');
            return;
        }

        if (game.status === 'active' && player) {
            if (phase === 'eliminated') return; // eliminado no vuelve a jugar
            setSelectedAnswer(null);
            setAnswerResult(null);
            setPhase('question');
        }
        if (game.status === 'results' && player) {
            if (phase !== 'eliminated') {
                setPhase('results');
            }
        }
        if (game.status === 'finished') {
            setPhase('finished');
        }
    }, [game?.status, player]);

    // Refrescar datos del jugador desde la DB (para is_eliminated actualizado)
    const refreshPlayer = async (playerId: string) => {
        const { data } = await supabase
            .from('trivia_players')
            .select('*')
            .eq('id', playerId)
            .single();
        if (data) setPlayer(data as TriviaPlayer);
    };

    const handleJoin = async () => {
        if (!playerName.trim()) { toast.error("Escribí tu nombre para jugar"); return; }
        if (!game) return;
        try {
            const p = await joinGame.mutateAsync({ gameId: game.id, eventId, playerName: playerName.trim() });
            setPlayer(p);
            setPhase('lobby');
            toast.success(`¡Bienvenido/a ${p.player_name}! 🎮`);
        } catch (err: any) {
            toast.error("Error al unirse: " + (err.message || 'Intenta de nuevo'));
        }
    };

    const handleSubmitAnswer = async (slot: TriviaOption) => {
        if (!game || !currentQuestion || !player || selectedAnswer || isExpired) return;
        if (!game.question_started_at) return;

        const actualOption = slotToOption[slot]; // opción real en la DB
        setSelectedAnswer(slot); // guardamos el slot visual seleccionado

        try {
            const result = await submitAnswer.mutateAsync({
                gameId: game.id,
                questionId: currentQuestion.id,
                playerId: player.id,
                selectedOption: actualOption,
                questionStartedAt: game.question_started_at,
                questionDuration: game.question_duration_seconds || 10,
            });

            setAnswerResult({
                isCorrect: result.is_correct,
                points: result.points_earned,
                bonus: result.speed_bonus,
                isEliminated: result.is_eliminated ?? !result.is_correct,
            });

            setPlayer(prev => prev ? { ...prev, score: prev.score + result.points_earned } : prev);
            await refreshPlayer(player.id);

            if (!result.is_correct) {
                // Marcar como eliminado después de un breve delay para mostrar feedback
                setTimeout(() => setPhase('eliminated'), 2500);
            }
        } catch (err: any) {
            toast.error("Error al responder: " + err.message);
        }
    };

    // ===================== NO activo =====================
    if (!game || (game.status === 'finished' && !player)) return null;

    // ===================== JOIN =====================
    if ((game.status === 'lobby' || game.status === 'active') && !player) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <div className="bg-gradient-to-br from-violet-900 via-slate-900 to-fuchsia-900 rounded-3xl p-8 max-w-sm w-full border border-violet-500/40 shadow-2xl text-center space-y-6">
                    <div className="text-6xl animate-bounce">🎮</div>
                    <div>
                        <h2 className="text-2xl font-black text-white">¡Trivia en Vivo!</h2>
                        <p className="text-slate-300 mt-2 text-sm">Anotate para competir contra todos — ¡1 error y quedás eliminado!</p>
                    </div>
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Tu nombre o apodo"
                            value={playerName}
                            onChange={e => setPlayerName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleJoin()}
                            className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-slate-400 text-center text-lg focus:outline-none focus:border-violet-400 transition-all"
                            maxLength={20}
                        />
                        <button
                            onClick={handleJoin}
                            disabled={joinGame.isPending}
                            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black text-lg py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50"
                        >
                            {joinGame.isPending ? '⏳ Uniéndome...' : '¡Entrar a Jugar! 🚀'}
                        </button>
                    </div>
                    {sortedPlayers.length > 0 && (
                        <p className="text-xs text-slate-500">{sortedPlayers.length} jugador{sortedPlayers.length > 1 ? 'es' : ''} ya se unió</p>
                    )}
                </div>
            </div>
        );
    }

    // ===================== LOBBY =====================
    if (phase === 'lobby' && player) {
        const activePlayers = sortedPlayers.filter(p => !(p as any).is_eliminated);
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
                <div className="bg-gradient-to-br from-slate-900 to-violet-900/50 rounded-3xl p-8 max-w-sm w-full border border-violet-500/30 text-center space-y-6">
                    <div className="text-5xl animate-pulse">⏳</div>
                    <div>
                        <h2 className="text-xl font-black text-white">¡Estás dentro, {player.player_name}!</h2>
                        <p className="text-slate-300 mt-2 text-sm">Esperando que el organizador lance la primera pregunta...</p>
                        <p className="text-xs text-amber-400 mt-1">⚠️ 1 respuesta incorrecta = eliminación</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 space-y-2">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Jugadores listos</p>
                        <div className="flex flex-wrap gap-2 justify-center max-h-24 overflow-auto">
                            {sortedPlayers.map(p => (
                                <span key={p.id} className={`text-xs px-3 py-1 rounded-full ${p.id === player.id ? 'bg-violet-500 text-white font-bold' : 'bg-white/10 text-slate-300'}`}>
                                    {p.player_name}
                                </span>
                            ))}
                        </div>
                        <p className="text-lg font-bold text-white">{activePlayers.length} jugadores</p>
                    </div>
                    <div className="flex gap-1 justify-center">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ===================== ELIMINADO =====================
    if (phase === 'eliminated' && player) {
        const myPos = sortedPlayers.findIndex(p => p.id === player.id) + 1;
        const activePlayers = sortedPlayers.filter(p => !(p as any).is_eliminated);
        return (
            <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-red-950/30 to-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="text-8xl animate-bounce">💀</div>
                <div>
                    <h2 className="text-4xl font-black text-red-400">¡Eliminado!</h2>
                    <p className="text-slate-300 mt-2">Respondiste mal, {player.player_name}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 w-full max-w-xs space-y-2">
                    <p className="text-slate-400 text-sm">Tu posición final</p>
                    <div className="text-4xl font-black text-white">#{myPos}</div>
                    <p className="text-violet-300 font-bold text-xl">{player.score.toLocaleString()} pts</p>
                    <p className="text-xs text-slate-500">{player.answers_correct} respuestas correctas</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-3">
                    <p className="text-amber-300 text-sm font-medium">
                        Quedan <span className="font-black text-xl text-amber-400">{activePlayers.length}</span> jugadores en pie
                    </p>
                </div>
                <p className="text-slate-500 text-xs">Podés seguir viendo el juego desde la pantalla principal</p>
            </div>
        );
    }

    // ===================== PREGUNTA — estilo Kahoot =====================
    if (phase === 'question' && currentQuestion && player) {
        const timerPct = (timeLeft / (game?.question_duration_seconds ?? 10)) * 100;
        const timerColor = timerPct > 50 ? '#22c55e' : timerPct > 25 ? '#eab308' : '#ef4444';

        // El slot visual correcto es aquel cuyo slotToOption[slot] === correct_option de la DB
        const correctSlot = (Object.keys(slotToOption) as TriviaOption[]).find(
            slot => slotToOption[slot] === currentQuestion.correct_option
        );

        return (
            <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950 pb-16">
                {/* Timer bar */}
                <div className="h-1.5 bg-slate-800 flex-shrink-0">
                    <div className="h-full transition-all duration-300" style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
                </div>

                {/* Header */}
                <div className="flex-shrink-0 bg-slate-900 px-4 pt-3 pb-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl border-2 ${timeLeft <= 3 ? 'border-red-500 bg-red-500/20 text-red-300 animate-pulse' : 'border-white/20 bg-white/10 text-white'}`}>
                            {isExpired ? '⌛' : timeLeft}
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-black text-white">{player.score.toLocaleString()}</p>
                            <p className="text-xs text-slate-400">pts · {player.player_name}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl px-4 py-3 min-h-[56px] flex items-center justify-center">
                        <p className="text-slate-900 font-black text-base text-center leading-tight">
                            {currentQuestion.question_text}
                        </p>
                    </div>
                </div>

                {/* Grid 2×2 Kahoot */}
                <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2">
                    {(['a', 'b', 'c', 'd'] as TriviaOption[]).map(slot => {
                        const style = SLOT_STYLES[slot];
                        const actualOption = slotToOption[slot];
                        const isSelected = selectedAnswer === slot;
                        const isCorrect = answerResult && slot === correctSlot;
                        const isWrong = answerResult && isSelected && !answerResult.isCorrect;
                        const isDimmed = answerResult && !isCorrect && !isWrong;

                        let bgClass = style.bg;
                        if (answerResult) {
                            if (isCorrect) bgClass = style.bgCorrect;
                            else if (isWrong) bgClass = style.bgWrong;
                            else bgClass = style.bgDimmed;
                        } else if (isSelected) {
                            bgClass = style.bgSelected;
                        }

                        const optionText = currentQuestion[`option_${actualOption}` as keyof TriviaQuestion] as string;

                        return (
                            <button
                                key={slot}
                                onClick={() => !answerResult && !isExpired && handleSubmitAnswer(slot)}
                                disabled={!!answerResult || isExpired}
                                className={`
                                    relative rounded-2xl flex flex-col items-center justify-center gap-2
                                    transition-all duration-200 select-none overflow-hidden
                                    ${bgClass}
                                    ${!answerResult && !isExpired ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
                                    ${isSelected && !answerResult ? 'ring-4 ring-white/60 scale-[0.97]' : ''}
                                    ${isDimmed ? 'opacity-30' : 'opacity-100'}
                                `}
                            >
                                <KahootShape shape={style.shape} size={52} />
                                <span className="text-white font-bold text-sm text-center px-3 leading-tight line-clamp-2 max-w-full drop-shadow">
                                    {optionText}
                                </span>
                                {isCorrect && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                                        <span className="text-5xl drop-shadow-lg">✅</span>
                                    </div>
                                )}
                                {isWrong && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl">
                                        <span className="text-5xl drop-shadow-lg">❌</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer feedback */}
                {answerResult && (
                    <div className={`flex-shrink-0 p-4 text-center ${answerResult.isCorrect ? 'bg-green-600' : 'bg-red-700'}`}>
                        <p className="text-white font-black text-lg">
                            {answerResult.isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto — ¡Eliminado!'}
                        </p>
                        {answerResult.isCorrect ? (
                            <div className="flex items-center justify-center gap-3 mt-1">
                                <span className="text-green-100 font-bold">+{answerResult.points} pts</span>
                                {answerResult.bonus > 0 && (
                                    <span className="text-yellow-200 text-sm flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> +{answerResult.bonus} velocidad
                                    </span>
                                )}
                            </div>
                        ) : (
                            <p className="text-red-200 text-sm mt-1">Pasando a pantalla de eliminado...</p>
                        )}
                    </div>
                )}

                {isExpired && !selectedAnswer && (
                    <div className="flex-shrink-0 p-4 text-center bg-slate-700">
                        <p className="text-white font-black text-lg">⌛ ¡Se acabó el tiempo!</p>
                    </div>
                )}
            </div>
        );
    }

    // ===================== RESULTADOS entre preguntas =====================
    if (phase === 'results' && player) {
        const activePlayers = sortedPlayers.filter(p => !(p as any).is_eliminated);
        const myPos = sortedPlayers.findIndex(p => p.id === player.id) + 1;
        return (
            <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 to-violet-950/50 flex flex-col overflow-auto">
                <div className="flex-1 p-4 space-y-4">
                    <div className="flex gap-2 text-center">
                        <div className="flex-1 bg-violet-500/20 border border-violet-500/30 rounded-2xl p-3">
                            <p className="text-2xl font-black text-white">{activePlayers.length}</p>
                            <p className="text-xs text-violet-300">en pie</p>
                        </div>
                        <div className="flex-1 bg-red-500/20 border border-red-500/30 rounded-2xl p-3">
                            <p className="text-2xl font-black text-white">{sortedPlayers.length - activePlayers.length}</p>
                            <p className="text-xs text-red-300">eliminados</p>
                        </div>
                    </div>

                    <div className={`rounded-3xl p-5 text-center ${myPos === 1 ? 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border border-yellow-500/40' : 'bg-white/5 border border-white/10'}`}>
                        <div className="text-4xl mb-1">
                            {myPos === 1 ? '🥇' : myPos === 2 ? '🥈' : myPos === 3 ? '🥉' : `#${myPos}`}
                        </div>
                        <p className="font-black text-white text-lg">{player.player_name}</p>
                        <p className="text-2xl font-black text-violet-300">{player.score.toLocaleString()} pts</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs text-slate-400 uppercase tracking-wider px-1">Siguen en juego</p>
                        {activePlayers.slice(0, 6).map((p, i) => {
                            const isMe = p.id === player.id;
                            return (
                                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-2xl ${isMe ? 'bg-violet-500/20 border border-violet-500/40' : 'bg-white/5'}`}>
                                    <span className="text-base font-black text-slate-400 w-7 text-center">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </span>
                                    <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-violet-200' : 'text-white'}`}>
                                        {p.player_name} {isMe && '← Vos'}
                                    </span>
                                    <span className={`font-black ${isMe ? 'text-violet-300' : 'text-white'}`}>
                                        {p.score.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-center text-slate-500 text-xs animate-pulse pb-4">
                        Esperando la siguiente pregunta...
                    </p>
                </div>
            </div>
        );
    }

    // ===================== JUEGO FINALIZADO =====================
    if (phase === 'finished') {
        const activePlayers = sortedPlayers.filter(p => !(p as any).is_eliminated);
        const winner = activePlayers[0] ?? sortedPlayers[0];
        const myPos = player ? (sortedPlayers.findIndex(p => p.id === player?.id) + 1) : null;

        return (
            <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-yellow-950/20 to-slate-950 flex flex-col overflow-auto">
                <div className="flex-1 p-5 space-y-5 flex flex-col items-center justify-start pt-10">
                    <div className="text-8xl animate-bounce">🏆</div>
                    <div className="text-center">
                        <h2 className="text-4xl font-black text-yellow-400">¡Juego<br />Terminado!</h2>
                        {winner && (
                            <div className="mt-3 bg-yellow-400/10 border border-yellow-400/30 rounded-2xl px-6 py-3">
                                <p className="text-slate-400 text-sm">Ganador/a</p>
                                <p className="text-2xl font-black text-yellow-300">{winner.player_name}</p>
                                <p className="text-yellow-400 font-bold">{winner.score.toLocaleString()} pts</p>
                            </div>
                        )}
                    </div>

                    {myPos && player && (
                        <div className={`rounded-3xl p-5 text-center w-full max-w-xs ${myPos === 1 ? 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border-2 border-yellow-500/50' : 'bg-white/5 border border-white/10'}`}>
                            <div className="text-3xl mb-1">
                                {myPos === 1 ? '🥇' : myPos === 2 ? '🥈' : myPos === 3 ? '🥉' : `#${myPos}`}
                            </div>
                            <p className="font-black text-white">{player.player_name}</p>
                            <p className="text-2xl font-black text-violet-300">{player.score.toLocaleString()} pts</p>
                            <p className="text-sm text-slate-400 mt-1">{player.answers_correct}/{player.answers_total} correctas</p>
                        </div>
                    )}

                    <div className="w-full max-w-xs space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider text-center">Ranking Final</p>
                        {sortedPlayers.slice(0, 5).map((p, i) => {
                            const isMe = p.id === player?.id;
                            const eliminated = (p as any).is_eliminated;
                            return (
                                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-violet-500/20 border border-violet-500/40' : 'bg-white/5'} ${eliminated ? 'opacity-50' : ''}`}>
                                    <span className="text-base font-black text-slate-400 w-7 text-center">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </span>
                                    <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-violet-200' : 'text-white'}`}>
                                        {p.player_name} {eliminated && '💀'}
                                    </span>
                                    <span className="font-black text-white text-sm">{p.score.toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="text-center pt-2 pb-6">
                        <p className="text-slate-400 text-sm">¡Gracias por jugar! 🎉</p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
