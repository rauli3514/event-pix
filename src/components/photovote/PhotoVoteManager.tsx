import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Trash2, Play, Square, Trophy, Loader2, ImageIcon, Check, LayoutDashboard } from "lucide-react";

import {
    usePhotoVoteSession, useEventPhotos, usePhotoVoteRanking,
    useCreatePhotoVoteSession, useUpdatePhotoVoteSession, useDeletePhotoVoteSession
} from "@/hooks/use-photo-vote";
import { cn } from "@/lib/utils";

interface PhotoVoteManagerProps {
    eventId: string;
    onBackToDashboard?: () => void;
}

export const PhotoVoteManager = ({ eventId, onBackToDashboard }: PhotoVoteManagerProps) => {
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

    const { data: session, refetch } = usePhotoVoteSession(eventId);
    const { data: photos = [] } = useEventPhotos(eventId);
    const { data: ranking = [] } = usePhotoVoteRanking(session?.id);

    const createSession = useCreatePhotoVoteSession(eventId);
    const updateSession = useUpdatePhotoVoteSession(eventId);
    const deleteSession = useDeletePhotoVoteSession(eventId);

    const totalVotes = ranking.reduce((sum, r) => sum + Number(r.vote_count), 0);

    const togglePhoto = (id: string) => {
        const next = new Set(selectedPhotos);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPhotos(next);
    };

    const handleSelectAll = () => {
        if (selectedPhotos.size === photos.length) setSelectedPhotos(new Set());
        else setSelectedPhotos(new Set(photos.map(p => p.id)));
    };

    const handleCreate = async () => {
        if (photos.length === 0) {
            toast.error("No hay fotos aprobadas en este evento todavía");
            return;
        }
        await createSession.mutateAsync();
        toast.success("📸 Sesión de votación creada");
    };

    const handleStart = async () => {
        if (!session) return;
        if (selectedPhotos.size < 2) {
            toast.error("Seleccioná al menos 2 fotos para la batalla");
            return;
        }

        await updateSession.mutateAsync({
            sessionId: session.id,
            updates: {
                status: 'active',
                selected_submission_ids: Array.from(selectedPhotos)
            }
        });
        toast.success(`❤️ ¡Votación iniciada con ${selectedPhotos.size} fotos!`);
        refetch();
    };

    const handleFinish = async (winnerId?: string) => {
        if (!session) return;
        const topId = winnerId ?? (ranking[0]?.submission_id ?? undefined);
        await updateSession.mutateAsync({
            sessionId: session.id,
            updates: { status: 'finished', winner_submission_id: topId ?? null }
        });
        toast.success("🏆 ¡Votación finalizada! Mostrando ganadora");
        refetch();
    };

    const handleDelete = () => {
        if (!session) return;
        setConfirmDialog({
            message: '¿Eliminar esta sesión de votación y todos los votos?',
            onConfirm: async () => {
                await deleteSession.mutateAsync(session.id);
                toast.success("Sesión eliminada");
                setConfirmDialog(null);
                refetch();
            }
        });
    };

    const statusLabel: Record<string, { label: string; color: string }> = {
        inactive: { label: 'Inactiva', color: 'text-slate-400' },
        active: { label: '● Votando en Vivo', color: 'text-pink-400 animate-pulse' },
        finished: { label: 'Finalizada', color: 'text-yellow-400' },
    };

    return (
        <div className="space-y-6">
            {/* Diálogo de confirmación */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                        <p className="text-white font-semibold text-center">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors">Cancelar</button>
                            <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(253,38,122,0.2), rgba(255,96,54,0.2))' }}>
                        <Heart className="w-6 h-6" style={{ color: '#fd267a' }} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Mejor Foto</h2>
                        {session && (
                            <p className={`text-sm font-medium ${statusLabel[session.status]?.color}`}>
                                {statusLabel[session.status]?.label}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {onBackToDashboard && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onBackToDashboard}
                            className="text-slate-400 hover:text-white border-slate-700 bg-slate-900/50"
                        >
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            <span>Salir al Inicio</span>
                        </Button>
                    )}
                    {session && (
                        <Button variant="outline" size="sm" onClick={handleDelete} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Sin sesión */}
            {
                !session && (
                    <Card className="bg-slate-900 border-slate-800 text-center py-14">
                        <CardContent className="space-y-4">
                            <div className="text-6xl">📸</div>
                            <h3 className="text-xl font-bold text-white">Sin sesión activa</h3>
                            <p className="text-slate-400 max-w-sm mx-auto text-sm">
                                Los invitados verán las fotos del evento una a una y votarán deslizando ❤️ o ✕.
                                La foto más votada gana.
                            </p>
                            <p className="text-xs text-slate-500">{photos.length} fotos aprobadas disponibles</p>
                            <Button
                                onClick={handleCreate}
                                disabled={createSession.isPending || photos.length === 0}
                                className="px-8 font-bold"
                                style={{ background: 'linear-gradient(135deg, #fd267a, #ff6036)' }}
                            >
                                {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
                                Crear Sesión de Votación
                            </Button>
                        </CardContent>
                    </Card>
                )
            }

            {/* Sesión activa / inactiva */}
            {
                session && session.status !== 'finished' && (
                    <div className="space-y-4">
                        {/* Stats */}
                        {session.status === 'active' && (
                            <div className="grid grid-cols-3 gap-3">
                                <Card className="bg-slate-900 border-slate-800 text-center p-3">
                                    <div className="text-2xl font-bold text-white">{session.selected_submission_ids?.length || 0}</div>
                                    <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> fotos
                                    </div>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800 text-center p-3">
                                    <div className="text-2xl font-bold" style={{ color: '#fd267a' }}>{totalVotes}</div>
                                    <div className="text-xs text-slate-400 mt-1">❤️ votos</div>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800 text-center p-3">
                                    <div className="text-2xl font-bold text-green-400">{ranking.length}</div>
                                    <div className="text-xs text-slate-400 mt-1">fotos votadas</div>
                                </Card>
                            </div>
                        )}

                        {/* Selector de Fotos (Solo si está inactiva) */}
                        {session.status === 'inactive' && (
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base text-white">Elegir fotos para competir</CardTitle>
                                        <p className="text-xs text-slate-500">
                                            Seleccionadas: {selectedPhotos.size} de {photos.length}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs text-violet-400">
                                        {selectedPhotos.size === photos.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {photos.map((photo) => (
                                            <div
                                                key={photo.id}
                                                onClick={() => togglePhoto(photo.id)}
                                                className={cn(
                                                    "relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                                                    selectedPhotos.has(photo.id) ? "border-pink-500 scale-[0.95]" : "border-transparent opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                                                )}
                                            >
                                                <img src={photo.content} className="w-full h-full object-cover" alt="" />
                                                {selectedPhotos.has(photo.id) && (
                                                    <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                                                        <div className="bg-white rounded-full p-1 shadow-lg">
                                                            <Check className="w-3 h-3 text-pink-500 stroke-[4]" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={handleStart}
                                        disabled={updateSession.isPending || selectedPhotos.size === 0}
                                        className="w-full py-6 mt-4 text-lg font-bold rounded-2xl"
                                        style={{ background: 'linear-gradient(135deg, #fd267a, #ff6036)' }}
                                    >
                                        {updateSession.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                                        ❤️ Iniciar Votación Tinder
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Controles modo Activo */}
                        {session.status === 'active' && (
                            <Button
                                onClick={() => handleFinish()}
                                disabled={updateSession.isPending}
                                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-2xl py-4"
                                variant="outline"
                            >
                                <Square className="w-4 h-4 mr-2" /> Finalizar y Mostrar Ganadora
                            </Button>
                        )}

                        {/* Ranking en vivo */}
                        {ranking.length > 0 && session.status === 'active' && (
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-white flex items-center gap-2 text-base">
                                        <Trophy className="w-4 h-4 text-yellow-400" /> Ranking en Vivo
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {ranking.slice(0, 8).map((r, i) => {
                                        const photo = photos.find(p => p.id === r.submission_id);
                                        const maxVotes = ranking[0]?.vote_count ?? 1;
                                        const pct = Math.round((Number(r.vote_count) / Number(maxVotes)) * 100);
                                        return (
                                            <div key={r.submission_id} className="flex items-center gap-3">
                                                <span className="text-base font-black w-7 text-center text-slate-400">
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                                </span>
                                                {photo && (
                                                    <img src={photo.content} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-xs font-medium truncate">{photo?.author ?? 'Sin nombre'}</p>
                                                    <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #fd267a, #ff6036)' }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="font-black text-white text-sm flex-shrink-0">
                                                    ❤️ {r.vote_count}
                                                </span>
                                                {i === 0 && (
                                                    <button
                                                        onClick={() => handleFinish(r.submission_id)}
                                                        className="text-xs px-2 py-1 rounded-lg font-bold transition-colors ml-2"
                                                        style={{ background: '#fd267a', color: 'white' }}
                                                    >
                                                        Elegir
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )
            }

            {/* Finalizado */}
            {
                session?.status === 'finished' && (() => {
                    const winner = photos.find(p => p.id === session.winner_submission_id);
                    const winnerVotes = ranking.find(r => r.submission_id === session.winner_submission_id)?.vote_count ?? 0;
                    return (
                        <Card className="bg-slate-900 border-yellow-500/30">
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="text-5xl">💘</div>
                                <h3 className="text-xl font-black text-yellow-400">¡Foto Ganadora!</h3>
                                {winner && (
                                    <div className="space-y-3">
                                        <img src={winner.content} alt="ganadora" className="w-32 h-32 object-cover rounded-2xl mx-auto shadow-lg border-2 border-yellow-500/40" />
                                        {winner.author && <p className="text-white font-bold">{winner.author}</p>}
                                        <p className="text-pink-400 font-black">❤️ {winnerVotes} votos · {totalVotes} totales</p>
                                    </div>
                                )}
                                <div className="flex gap-2 justify-center">
                                    <Button onClick={handleCreate} style={{ background: 'linear-gradient(135deg, #fd267a, #ff6036)' }}>
                                        Nueva Ronda
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            if (session) {
                                                await updateSession.mutateAsync({ sessionId: session.id, updates: { status: 'inactive' } });
                                                toast.success("Muro liberado");
                                                refetch();
                                            }
                                        }}
                                        className="border-slate-700 text-slate-400 hover:bg-slate-800"
                                    >
                                        Cerrar y Volver al Wall
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()
            }
        </div >
    );
};
