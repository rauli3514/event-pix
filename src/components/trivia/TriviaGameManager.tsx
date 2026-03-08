import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
    Plus, Trash2, Play, SkipForward, Users,
    Gamepad2, ClipboardList, BarChart3,
    ChevronLeft, Settings2, LayoutList
} from "lucide-react";
import {
    useTriviaGame, useTriviaQuestions, useTriviaSortedPlayers,
    useTriviaAnswersForQuestion, useCreateTriviaGame, useDeleteTriviaGame,
    useAddTriviaQuestion, useDeleteTriviaQuestion, useUpdateTriviaGame,
    useLaunchQuestion, useShowResults, useFinishTriviaGame,
    useTriviaGamesList
} from "@/hooks/use-trivia";
import { TriviaOption } from "@/types";

const OPTION_STYLES: Record<TriviaOption, { card: string; badge: string; icon: string }> = {
    a: { card: 'border-red-500/40 bg-red-500/10', badge: 'bg-red-500', icon: '🔺' },
    b: { card: 'border-blue-500/40 bg-blue-500/10', badge: 'bg-blue-500', icon: '🔷' },
    c: { card: 'border-yellow-500/40 bg-yellow-500/10', badge: 'bg-yellow-400', icon: '🔶' },
    d: { card: 'border-green-500/40 bg-green-500/10', badge: 'bg-green-500', icon: '🟢' },
};

const EMPTY_QUESTION = {
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'a' as TriviaOption,
    points: 1000,
    order_index: 0,
};

interface TriviaGameManagerProps {
    eventId: string;
}

export const TriviaGameManager = ({ eventId }: TriviaGameManagerProps) => {
    const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
    const [view, setView] = useState<'setup' | 'live'>('setup');
    const [isCreating, setIsCreating] = useState(false);
    const [newTriviaTitle, setNewTriviaTitle] = useState("");

    const [editingQuestion, setEditingQuestion] = useState<typeof EMPTY_QUESTION | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Queries
    const { data: games = [], refetch: refetchGames } = useTriviaGamesList(eventId);
    const { data: game } = useTriviaGame(selectedGameId ?? undefined);
    const { data: questions = [] } = useTriviaQuestions(game?.id);
    const { data: players = [] } = useTriviaSortedPlayers(game?.id);
    const { data: answersForCurrentQ = [] } = useTriviaAnswersForQuestion(
        game?.status === 'active' ? game?.current_question_id ?? undefined : undefined
    );

    // Mutations
    const createGame = useCreateTriviaGame(eventId);
    const deleteGame = useDeleteTriviaGame(eventId);
    const addQuestion = useAddTriviaQuestion(game?.id, eventId);
    const deleteQuestion = useDeleteTriviaQuestion(game?.id);
    const updateGame = useUpdateTriviaGame(eventId);
    const launchQuestion = useLaunchQuestion(eventId);
    const showResults = useShowResults(eventId);
    const finishGame = useFinishTriviaGame(eventId);

    const currentQuestionIndex = game?.current_question_id
        ? questions.findIndex(q => q.id === game.current_question_id)
        : 0;

    const currentQuestion = questions[currentQuestionIndex] ?? null;
    const answeredCount = answersForCurrentQ.length;

    const handleCreateGame = async () => {
        if (!newTriviaTitle.trim()) {
            toast.error("Poné un título para la trivia");
            return;
        }
        const newGame = await createGame.mutateAsync(newTriviaTitle);
        toast.success(`🎮 ¡${newTriviaTitle} creada! Ahora cargá las preguntas.`);
        setSelectedGameId(newGame.id);
        setIsCreating(false);
        setNewTriviaTitle("");
        setView('setup');
    };

    const handleDeleteGame = async (gameId: string) => {
        setConfirmDialog({
            message: '¿Eliminar esta trivia y todas sus preguntas?',
            onConfirm: async () => {
                await deleteGame.mutateAsync(gameId);
                toast.success('Trivia eliminada');
                if (selectedGameId === gameId) setSelectedGameId(null);
                setConfirmDialog(null);
                refetchGames();
            },
        });
    };

    const handleAddQuestion = async () => {
        if (!editingQuestion) return;
        if (!editingQuestion.question_text.trim()) {
            toast.error("Escribí el texto de la pregunta");
            return;
        }
        if (!editingQuestion.option_a.trim() || !editingQuestion.option_b.trim() ||
            !editingQuestion.option_c.trim() || !editingQuestion.option_d.trim()) {
            toast.error("Completá todas las opciones");
            return;
        }
        await addQuestion.mutateAsync({
            ...editingQuestion,
            order_index: questions.length,
        });
        setEditingQuestion(null);
        toast.success("✅ Pregunta agregada");
    };

    const handleOpenLobby = async () => {
        if (!game) return;
        await updateGame.mutateAsync({ gameId: game.id, updates: { status: 'lobby', current_question_id: questions[0]?.id || null } });
        toast.success("🏠 Lobby abierto — los invitados ya pueden unirse");
        setView('live');
    };

    const handleLaunchQuestion = async (index?: number) => {
        if (!game) return;
        const targetIndex = index !== undefined ? index : currentQuestionIndex;
        const targetQ = questions[targetIndex];
        if (!targetQ) return;

        await launchQuestion.mutateAsync({ gameId: game.id, questionId: targetQ.id });
        toast.success(`🚀 Lanzada Pregunta #${targetIndex + 1}`);
    };

    const handleShowResults = async () => {
        if (!game) return;
        await showResults.mutateAsync(game.id);
    };

    const handleNextStep = async () => {
        if (!game) return;

        if (game.status === 'lobby') {
            await handleLaunchQuestion(0);
        } else if (game.status === 'active') {
            await handleShowResults();
        } else if (game.status === 'results') {
            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex >= questions.length) {
                await finishGame.mutateAsync(game.id);
                toast.success("🏆 ¡Fin de la trivia!");
            } else {
                await handleLaunchQuestion(nextIndex);
            }
        }
    };

    const statusLabel: Record<string, { label: string; color: string }> = {
        setup: { label: 'En Preparación', color: 'text-slate-500' },
        lobby: { label: 'Esperando Jugadores', color: 'text-blue-400' },
        active: { label: 'Pregunta en Vivo', color: 'text-green-400 animate-pulse' },
        results: { label: 'Mostrando Resultados', color: 'text-yellow-400' },
        finished: { label: 'Finalizado', color: 'text-slate-400' },
    };


    return (
        <div className="space-y-6">

            {/* ==== Diálogo de confirmación ==== */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
                        <p className="text-white font-semibold text-base">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors">Cancelar</button>
                            <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header General */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/20 rounded-xl">
                        <Gamepad2 className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Gestor de Trivias</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Series de preguntas en vivo</p>
                    </div>
                </div>
            </div>

            {/* 1. VISTA: LISTA DE TRIVIAS (Si no hay seleccionada) */}
            {!selectedGameId && (
                <div className="space-y-4">
                    {/* Botón Crear Nueva */}
                    {!isCreating ? (
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="w-full bg-violet-600 hover:bg-violet-700 py-8 text-lg font-bold rounded-2xl"
                        >
                            <Plus className="w-6 h-6 mr-2" /> Crear Nueva Serie de Preguntas
                        </Button>
                    ) : (
                        <Card className="bg-slate-900 border-violet-500/50">
                            <CardContent className="pt-6 space-y-4 text-center">
                                <h3 className="text-white font-bold uppercase tracking-wider text-sm">Nombre de la nueva Trivia</h3>
                                <Input
                                    className="bg-slate-800 border-slate-700 text-white text-center text-lg py-6"
                                    placeholder="Ej: Historia de los novios, Música de los 80..."
                                    value={newTriviaTitle}
                                    onChange={e => setNewTriviaTitle(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => setIsCreating(false)} className="flex-1 text-slate-400">Cancelar</Button>
                                    <Button onClick={handleCreateGame} className="flex-1 bg-green-600 hover:bg-green-700">Crear Ahora</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Lista de Existentes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {games.map(g => (
                            <Card key={g.id} className="bg-slate-900 border-slate-800 hover:border-violet-500/50 transition-all cursor-pointer group" onClick={() => setSelectedGameId(g.id)}>
                                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-white text-lg font-black italic uppercase tracking-tighter truncate max-w-[200px]">
                                            {g.title || 'Trivia sin título'}
                                        </CardTitle>
                                        <div className={`text-[10px] font-bold uppercase tracking-widest ${statusLabel[g.status].color}`}>
                                            {statusLabel[g.status].label}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteGame(g.id); }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-4 text-xs text-slate-400 font-bold uppercase tracking-widest">
                                        <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Preguntas: ?</span>
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Jugadores</span>
                                    </div>
                                    <Button className="w-full mt-4 bg-slate-800 group-hover:bg-violet-600 transition-colors text-white font-bold h-8">
                                        Gestionar Trivia
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. VISTA: GESTIÓN DE TRIVIA SELECCIONADA */}
            {selectedGameId && game && (
                <div className="space-y-6">
                    {/* Barra de navegación de la trivia */}
                    <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <Button variant="ghost" onClick={() => setSelectedGameId(null)} className="text-slate-400 hover:text-white px-0">
                            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a la lista
                        </Button>
                        <div className="text-center">
                            <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">{game.title}</h3>
                            <div className={`text-[10px] font-black uppercase tracking-widest ${statusLabel[game.status].color}`}>
                                ● {statusLabel[game.status].label}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={view === 'setup' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setView('setup')}
                                className={view === 'setup' ? "bg-violet-600" : "border-slate-700 text-slate-400"}
                            >
                                <Settings2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={view === 'live' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setView('live')}
                                className={view === 'live' ? "bg-green-600" : "border-slate-700 text-slate-400"}
                            >
                                <LayoutList className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* VISTA SETUP (IDEM ANTERIOR PERO PARA ESTA TRIVIA) */}
                    {view === 'setup' && (
                        <div className="space-y-6">
                            {/* Form y lista de preguntas (Copiado de la lógica anterior) */}
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <ClipboardList className="w-5 h-5 text-violet-400" />
                                        Preguntas ({questions.length})
                                    </CardTitle>
                                    <Button size="sm" onClick={() => setEditingQuestion({ ...EMPTY_QUESTION })} className="bg-violet-600 animate-pulse">
                                        <Plus className="w-4 h-4 mr-1" /> Agregar Pregunta
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {editingQuestion && (
                                        <div className="bg-slate-800/80 rounded-2xl p-6 border-2 border-violet-500/50 space-y-4 shadow-2xl">
                                            <textarea
                                                placeholder="Escribí la pregunta aquí..."
                                                value={editingQuestion.question_text}
                                                onChange={e => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                                                className="w-full bg-slate-900 border-none rounded-xl px-4 py-4 text-white text-lg font-bold placeholder-slate-600 resize-none focus:ring-2 ring-violet-500"
                                                rows={2}
                                            />

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {(['a', 'b', 'c', 'd'] as TriviaOption[]).map(opt => {
                                                    const isCorrect = editingQuestion.correct_option === opt;
                                                    return (
                                                        <div key={opt} className={`relative rounded-xl border-2 p-3 flex items-center gap-3 cursor-pointer transition-all ${isCorrect ? 'border-green-500 bg-green-500/10' : 'border-slate-700 bg-slate-900'}`} onClick={() => setEditingQuestion({ ...editingQuestion, correct_option: opt })}>
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${OPTION_STYLES[opt].badge}`}>{opt.toUpperCase()}</div>
                                                            <input
                                                                className="bg-transparent text-white text-sm outline-none flex-1"
                                                                placeholder={`Respuesta ${opt.toUpperCase()}`}
                                                                value={editingQuestion[`option_${opt}` as keyof typeof editingQuestion] as string}
                                                                onChange={e => setEditingQuestion({ ...editingQuestion, [`option_${opt}`]: e.target.value })}
                                                            />
                                                            <div className={`w-5 h-5 rounded-full border-2 ${isCorrect ? 'bg-green-500 border-green-500' : 'border-slate-500'}`} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" onClick={() => setEditingQuestion(null)} className="text-slate-500">Cancelar</Button>
                                                <Button onClick={handleAddQuestion} className="bg-green-600 hover:bg-green-700 font-bold px-8">Guardar Pregunta</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {questions.map((q, i) => (
                                            <div key={q.id} className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-violet-400 font-black italic">#{i + 1}</span>
                                                    <p className="text-white font-medium truncate max-w-[300px]">{q.question_text}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">OK</span>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteQuestion.mutate(q.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {questions.length > 0 && (
                                        <Button onClick={handleOpenLobby} className="w-full bg-violet-600 py-6 text-lg font-black uppercase italic tracking-tighter mt-4">
                                            Lanzar Trivia en Vivo 🚀
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* VISTA LIVE (Panel de control durante el evento) */}
                    {view === 'live' && (
                        <div className="space-y-6">
                            {/* Estadísticas */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="bg-slate-900 border-slate-800 p-4 text-center">
                                    <div className="text-3xl font-black text-white">{players.length}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Jugadores</div>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800 p-4 text-center">
                                    <div className="text-3xl font-black text-violet-400">{currentQuestionIndex + 1}/{questions.length}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Pregunta Actual</div>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800 p-4 text-center">
                                    <div className="text-3xl font-black text-green-400">{answeredCount}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Respuestas</div>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800 p-4 text-center">
                                    <div className="text-3xl font-black text-blue-400">{game.status === 'lobby' ? 'WAIT' : 'GO!'}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Estado</div>
                                </Card>
                            </div>

                            {/* Control Principal */}
                            {currentQuestion && (
                                <Card className="bg-slate-900 border-2 border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
                                    <CardHeader>
                                        <CardTitle className="text-white text-center text-3xl font-black italic uppercase tracking-tighter">
                                            Control de Pregunta
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-8 p-8">
                                        <div className="text-center space-y-2">
                                            <span className="text-violet-400 font-black tracking-widest uppercase text-xs">Pregunta #{currentQuestionIndex + 1}</span>
                                            <p className="text-white text-3xl font-bold leading-tight">{currentQuestion.question_text}</p>
                                        </div>

                                        <div className="flex gap-4">
                                            {game.status === 'finished' ? (
                                                <Button onClick={() => setSelectedGameId(null)} className="flex-1 py-10 bg-slate-800 text-2xl font-black uppercase italic">
                                                    Volver al Inicio
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleNextStep}
                                                    className={`flex-1 py-10 text-2xl font-black uppercase italic shadow-lg transition-all transform active:scale-95 ${game.status === 'lobby' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' :
                                                        game.status === 'active' ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20 text-slate-900' :
                                                            'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20'
                                                        }`}
                                                >
                                                    {game.status === 'lobby' && <><Play className="w-8 h-8 mr-4" /> Comenzar Trivia</>}
                                                    {game.status === 'active' && <><BarChart3 className="w-8 h-8 mr-4" /> Cortar Tiempo</>}
                                                    {game.status === 'results' && (
                                                        currentQuestionIndex + 1 >= questions.length
                                                            ? <><SkipForward className="w-8 h-8 mr-4" /> Ver Ranking Final</>
                                                            : <><Play className="w-8 h-8 mr-4" /> Lanzar Siguiente Pregunta</>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Ranking lateral */}
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader><CardTitle className="text-white font-black italic tracking-tighter uppercase">Top 10 Jugadores</CardTitle></CardHeader>
                                <CardContent className="space-y-2">
                                    {players.slice(0, 10).map((p, i) => (
                                        <div key={p.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-black text-slate-500 w-6">#{i + 1}</span>
                                                <span className="text-white font-bold">{p.player_name}</span>
                                            </div>
                                            <span className="text-xl font-black text-violet-400">{p.score} pts</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
