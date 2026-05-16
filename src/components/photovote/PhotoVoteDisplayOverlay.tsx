import { useState, useEffect } from "react";
import { Trophy, Zap, ImageIcon, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { useEvent } from "@/context/EventContext";
import {
    useActivePhotoVoteSession, useEventPhotos,
    usePhotoVoteRanking, usePhotoVoteRealtime
} from "@/hooks/use-photo-vote";

interface PhotoVoteDisplayOverlayProps {
    eventId: string;
}

const WINNER_DISPLAY_SECONDS = 30;

export const PhotoVoteDisplayOverlay = ({ eventId }: PhotoVoteDisplayOverlayProps) => {
    const queryClient = useQueryClient();
    const { event } = useEvent();
    const [dismissed, setDismissed] = useState(false);
    const [countdown, setCountdown] = useState(WINNER_DISPLAY_SECONDS);

    const { data: session, refetch } = useActivePhotoVoteSession(eventId);
    const { data: photos = [] } = useEventPhotos(eventId);
    const { data: ranking = [] } = usePhotoVoteRanking(session?.id);

    usePhotoVoteRealtime(eventId, () => {
        queryClient.invalidateQueries({ queryKey: ['photo_vote_session', eventId] });
        queryClient.invalidateQueries({ queryKey: ['photo_vote_ranking', session?.id] });
        refetch();
    });

    // Auto-dismiss winner screen (robusto ante refrescos y remounts)
    useEffect(() => {
        if (!session || session.status !== 'finished') {
            setDismissed(false);
            setCountdown(WINNER_DISPLAY_SECONDS);
            return;
        }

        const updatedAt = new Date(session.updated_at).getTime();
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
    }, [session?.status, session?.id, session?.updated_at]);

    // Fotos que están compitiendo en esta sesión
    const competingPhotos = session?.selected_submission_ids && session.selected_submission_ids.length > 0
        ? photos.filter(p => session.selected_submission_ids?.includes(p.id))
        : photos;

    if (!session || dismissed || session.status === 'inactive') return null;

    const totalVotes = ranking.reduce((sum, r) => sum + Number(r.vote_count), 0);
    const appUrl = event ? `${window.location.origin}/${event.slug}` : window.location.origin;

    // ===================== ACTIVE VOTING =====================
    if (session.status === 'active') {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_20px_rgba(236,72,153,1)]" />
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_20px_rgba(244,63,94,1)]" />

                <div className="w-full max-w-7xl space-y-12 relative z-10 animate-fade-in">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="flex items-center justify-center gap-4">
                            <Zap className="w-12 h-12 text-pink-500 animate-pulse fill-pink-500" />
                            <h1 className="text-4xl font-black text-white tracking-tight uppercase italic">
                                ¡Batalla de Fotos!
                            </h1>
                            <Zap className="w-12 h-12 text-pink-500 animate-pulse fill-pink-500" />
                        </div>
                        <p className="text-xl text-pink-500 font-black uppercase tracking-[0.1em] bg-white/10 px-6 py-2 rounded-full border border-pink-500/30 animate-pulse inline-block">
                            📸 ¡Votá la foto más divertida o canchera! 📸
                        </p>
                        <p className="text-base text-slate-300 font-bold uppercase tracking-widest pt-1">
                            ¡La foto más votada ganará un premio especial! ❤️
                        </p>
                    </div>

                    {/* Dashboard de Ranking */}
                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
                        {/* Top Photos Side */}
                        <div className="space-y-4">
                            {ranking.slice(0, 5).map((r, i) => {
                                const photo = competingPhotos.find(p => p.id === r.submission_id);
                                if (!photo) return null;

                                const maxVotes = ranking[0]?.vote_count ?? 1;
                                const pct = (Number(r.vote_count) / Number(maxVotes)) * 100;

                                return (
                                    <div key={r.submission_id} className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 flex items-center gap-6 border border-white/10">
                                        <div className="text-4xl font-black w-14 text-center text-white/40 italic">
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                        </div>
                                        <img src={photo.content} alt="" className="w-20 h-20 rounded-xl object-cover shadow-2xl" />
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between items-end">
                                                <p className="text-xl font-black text-white truncate">{photo.author || '📸 Invitado'}</p>
                                                <p className="text-2xl font-black text-pink-500">❤️ {r.vote_count}</p>
                                            </div>
                                            <div className="h-4 bg-black/40 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(236,72,153,0.5)]"
                                                    style={{
                                                        width: `${pct}%`,
                                                        background: 'linear-gradient(90deg, #ec4899, #f43f5e)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Stats & QR Side */}
                        <div className="flex flex-col items-center justify-center space-y-8 bg-white/5 rounded-[3rem] p-10 border border-white/10">
                            <div className="text-center">
                                <div className="text-[7rem] font-black text-white leading-none drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                                    {totalVotes}
                                </div>
                                <div className="text-2xl font-black text-pink-500 uppercase tracking-widest mt-2">
                                    Votos Totales ❤️
                                </div>
                            </div>

                            {/* QR CODE GIGANTE */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-[2.5rem] opacity-75 blur-xl group-hover:opacity-100 transition duration-1000 animate-pulse" />
                                <div className="relative bg-white p-6 rounded-[2rem] shadow-2xl">
                                    <QRCode 
                                        value={appUrl} 
                                        size={280}
                                        className="rounded-lg"
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                            </div>

                            <div className="text-center space-y-1">
                                <p className="text-2xl font-black text-white uppercase italic tracking-tighter">
                                    🔥 ¡UNITE A LA BATALLA! 🔥
                                </p>
                                <p className="text-sm text-pink-400 font-bold uppercase tracking-[0.2em]">
                                    ESCANEÁ EL QR PARA VOTAR
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full">
                                <div className="bg-black/40 rounded-2xl p-4 text-center border border-white/5">
                                    <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                                    <p className="text-2xl font-black text-white">{competingPhotos.length}</p>
                                    <p className="text-slate-400 font-bold uppercase text-xs mt-1">Fotos</p>
                                </div>
                                <div className="bg-black/40 rounded-2xl p-4 text-center border border-white/5">
                                    <Users className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                                    <p className="text-2xl font-black text-white">{ranking.length}</p>
                                    <p className="text-slate-400 font-bold uppercase text-xs mt-1">Votadas</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // ===================== FINISHED (WINNER) =====================
    if (session.status === 'finished') {
        const winner = photos.find(p => p.id === session.winner_submission_id);
        const winnerVotes = ranking.find(r => r.submission_id === session.winner_submission_id)?.vote_count ?? 0;

        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 overflow-hidden">
                {/* Background Animation */}
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,#fd267a_0%,transparent_70%)] animate-pulse" />
                </div>

                {/* Content */}
                <div className="relative z-10 w-full max-w-4xl space-y-6 text-center">
                    <div className="animate-bounce">
                        <Trophy className="w-24 h-24 text-yellow-400 mx-auto drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic leading-tight">
                            ¡Foto Ganadora!
                        </h1>
                        <p className="text-2xl text-yellow-400 font-black flex items-center justify-center gap-4">
                            🏆 EL FAVORITO DEL EVENTO 🏆
                        </p>
                    </div>

                    {winner && (
                        <div className="relative inline-block mt-4 group">
                            {/* Frame Effects */}
                            <div className="absolute -inset-4 bg-gradient-to-r from-yellow-500 via-pink-500 to-yellow-500 rounded-[40px] opacity-75 blur-2xl animate-spin-slow" />
                            <div className="absolute -inset-1 bg-white rounded-[24px]" />

                            <div className="relative rounded-[22px] overflow-hidden shadow-2xl border-4 border-white">
                                <img
                                    src={winner.content}
                                    alt="Ganadora"
                                    className="max-h-[50vh] w-auto min-w-[300px] object-cover"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-white p-4">
                                    <p className="text-2xl font-black text-slate-900 truncate">📸 {winner.author || 'Invitado'}</p>
                                    <p className="text-lg font-black text-pink-600 mt-1">❤️ {winnerVotes} Votos</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="pt-6 text-white/40 font-bold uppercase tracking-[0.5em] text-sm">
                        Volviendo al muro en {countdown}s
                    </div>

                    <button
                        onClick={() => setDismissed(true)}
                        className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold transition-all border border-white/20 text-xs"
                    >
                        Cerrar ya
                    </button>

                </div>
            </div>
        );
    }

    return null;
};
