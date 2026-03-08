import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    useActivePhotoVoteSession, useEventPhotos, useMyVotedPhotos,
    useSubmitPhotoVote, usePhotoVoteRealtime
} from "@/hooks/use-photo-vote";
import { Swords, Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoBattleViewProps {
    eventId: string;
}

export const PhotoBattleView = ({ eventId }: PhotoBattleViewProps) => {
    const queryClient = useQueryClient();
    const { data: session, refetch } = useActivePhotoVoteSession(eventId);
    const { data: photos = [] } = useEventPhotos(eventId);
    const { data: votedIdsArr = [] } = useMyVotedPhotos(session?.id);
    const votedIds = new Set(votedIdsArr);
    const submitVote = useSubmitPhotoVote();

    const [, setCurrentPairIndex] = useState(0);
    const [votingFor, setVotingFor] = useState<string | null>(null);
    const [showFightSplash, setShowFightSplash] = useState(true);

    usePhotoVoteRealtime(session?.id, () => {
        queryClient.invalidateQueries({ queryKey: ['photo_vote_session', eventId] });
        refetch();
    });

    // Resetear al cambiar la sesión
    useEffect(() => {
        setVotingFor(null);
        setCurrentPairIndex(0);
        setShowFightSplash(true);
        const timer = setTimeout(() => setShowFightSplash(false), 2000);
        return () => clearTimeout(timer);
    }, [session?.id]);

    // Solo fotos seleccionadas para competir
    const competingPhotos = useMemo(() => {
        if (!session?.selected_submission_ids || session.selected_submission_ids.length === 0) {
            return photos;
        }
        // Usamos el orden de la base de datos para que sea igual para todos
        return session.selected_submission_ids
            .map(id => photos.find(p => p.id === id))
            .filter((p): p is typeof photos[0] => !!p);
    }, [session?.selected_submission_ids, photos]);

    // Generamos las parejas discretas (1 vs 2, 3 vs 4, etc.)
    const pairs = useMemo(() => {
        const result: [typeof photos[0], typeof photos[0]][] = [];
        for (let i = 0; i < competingPhotos.length - 1; i += 2) {
            result.push([competingPhotos[i], competingPhotos[i + 1]]);
        }
        return result;
    }, [competingPhotos]);

    // Filtrar qué parejas ya votó el usuario
    const pendingPairs = useMemo(() => {
        return pairs.filter(pair => !votedIds.has(pair[0].id) && !votedIds.has(pair[1].id));
    }, [pairs, votedIds]);

    const handleVote = async (photoId: string) => {
        if (!session || votingFor || pendingPairs.length === 0) return;

        setVotingFor(photoId);

        try {
            await submitVote.mutateAsync({
                sessionId: session.id,
                eventId,
                submissionId: photoId,
                liked: true,
            });

            // Pequeña pausa para efecto visual antes de pasar a la siguiente pelea
            setTimeout(() => {
                setVotingFor(null);
            }, 800);
        } catch (error) {
            setVotingFor(null);
        }
    };

    if (!session || session.status === 'inactive') return null;

    // ===================== JUEGO TERMINADO O SIN PAREJAS =====================
    if (session.status === 'finished') {
        const winner = photos.find(p => p.id === session.winner_submission_id);
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
                <TrophyIcon className="w-20 h-20 text-yellow-400 mb-4 animate-bounce shrink-0" />
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">¡Tenemos Ganadora!</h2>
                {winner && (
                    <div className="relative mt-8">
                        <div className="absolute -inset-4 bg-pink-500/50 blur-2xl rounded-full" />
                        <div className="relative rounded-3xl overflow-hidden border-4 border-white shadow-2xl max-w-[280px]">
                            <img src={winner.content} alt="Ganadora" className="w-full aspect-square object-cover" />
                            <div className="bg-white p-3 text-center">
                                <p className="font-black text-slate-800">📸 {winner.author || 'Invitado'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (pendingPairs.length === 0 && session.status === 'active') {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center"
                style={{ background: '#0f172a' }}>
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
                    <Sparkles className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">¡Todas las batallas completadas!</h2>
                <p className="text-slate-400 mt-2 max-w-xs mx-auto text-sm font-medium">
                    Has votado en todos los enfrentamientos de esta ronda.
                </p>
                <div className="mt-12 text-[10px] text-white/20 font-bold uppercase tracking-[0.3em]">Mirá los resultados en el salón</div>
            </div>
        );
    }

    const currentPair = pendingPairs[0];
    if (!currentPair) return null;

    const [photo1, photo2] = currentPair;

    return (
        <div className="fixed inset-0 z-50 flex flex-col pt-safe select-none" style={{ background: '#0f172a' }}>

            {/* FIGHT SPLASH OVERLAY */}
            {showFightSplash && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm pointer-events-none animate-out fade-out duration-700 delay-1000 fill-mode-forwards">
                    <div className="text-center animate-in zoom-in-50 duration-300">
                        <h2 className="text-8xl font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(236,72,153,1)]">FIGHT!</h2>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-6 flex items-center justify-between shrink-0 relative z-10 pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="bg-pink-600 p-1.5 rounded-lg shadow-lg">
                        <Swords className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Batalla</h1>
                        <span className="text-[10px] text-pink-500 font-bold uppercase tracking-widest mt-1">Pelea {pairs.indexOf(currentPair) + 1} de {pairs.length}</span>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
                    <span className="text-white/80 text-[10px] font-black uppercase tracking-widest">{votedIds.size} Votos</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-1 p-4 justify-center items-center relative z-10">

                {/* Photo 1 */}
                <div
                    onClick={() => handleVote(photo1.id)}
                    className={cn(
                        "relative w-full max-w-[320px] aspect-[4/3] rounded-3xl overflow-hidden border-4 transition-all duration-300 cursor-pointer shadow-2xl touch-manipulation",
                        votingFor === photo1.id ? "border-green-500 scale-105 z-20 shadow-[0_0_40px_rgba(34,197,94,0.6)]" : votingFor && votingFor !== photo1.id ? "opacity-20 scale-95 grayscale" : "border-white/10"
                    )}
                >
                    <img src={photo1.content} className="w-full h-full object-cover pointer-events-none" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                    {votingFor === photo1.id && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center animate-in zoom-in-50 duration-200 pointer-events-none">
                            <div className="bg-green-500 text-white font-black px-6 py-2 skew-x-[-15deg] shadow-2xl">
                                <span className="block skew-x-[15deg] text-2xl italic tracking-tighter uppercase">Win!</span>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 flex flex-col pointer-events-none">
                        <span className="text-[9px] text-pink-500 font-black uppercase tracking-widest">Contendiente A</span>
                        <p className="text-white font-black text-lg truncate pr-2">{photo1.author || 'Invitado'}</p>
                    </div>
                </div>

                {/* VS Divider */}
                <div className="relative h-12 flex items-center justify-center w-full z-10 mt-[-15px] mb-[-15px] pointer-events-none">
                    <div className="absolute w-[80%] h-px bg-white/20" />
                    <div className="relative bg-pink-600 px-6 py-1.5 skew-x-[-15deg] shadow-[0_0_20px_rgba(236,72,153,0.8)] border-2 border-white/20">
                        <span className="text-white font-black italic text-2xl tracking-tighter block skew-x-[15deg]">VS</span>
                    </div>
                </div>

                {/* Photo 2 */}
                <div
                    onClick={() => handleVote(photo2.id)}
                    className={cn(
                        "relative w-full max-w-[320px] aspect-[4/3] rounded-3xl overflow-hidden border-4 transition-all duration-300 cursor-pointer shadow-2xl touch-manipulation",
                        votingFor === photo2.id ? "border-green-500 scale-105 z-20 shadow-[0_0_40px_rgba(34,197,94,0.6)]" : votingFor && votingFor !== photo2.id ? "opacity-20 scale-95 grayscale" : "border-white/10"
                    )}
                >
                    <img src={photo2.content} className="w-full h-full object-cover pointer-events-none" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                    {votingFor === photo2.id && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center animate-in zoom-in-50 duration-200 pointer-events-none">
                            <div className="bg-green-500 text-white font-black px-6 py-2 skew-x-[-15deg] shadow-2xl">
                                <span className="block skew-x-[15deg] text-2xl italic tracking-tighter uppercase">Win!</span>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 flex flex-col pointer-events-none">
                        <span className="text-[9px] text-pink-500 font-black uppercase tracking-widest">Contendiente B</span>
                        <p className="text-white font-black text-lg truncate pr-2">{photo2.author || 'Invitado'}</p>
                    </div>
                </div>
            </div>

            <div className="p-8 text-center relative z-10 pointer-events-none">
                <p className="text-white font-black italic text-xs animate-pulse opacity-50 uppercase tracking-widest">¡Tocá tu favorita para votar!</p>
            </div>
        </div>
    );
};

const TrophyIcon = ({ className }: { className?: string }) => (
    <Trophy className={className} />
);
