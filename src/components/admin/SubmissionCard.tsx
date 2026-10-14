import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Check, X, Trash2, Clock, User, MessageSquare, Mic, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { isAnonymousAuthor } from "@/lib/guestSubmissions";
import { Submission } from "@/types";
import { useSubmissions } from "@/hooks/use-submissions";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface SubmissionCardProps {
    item: Submission;
}

export const SubmissionCard = ({ item }: SubmissionCardProps) => {
    const { updateStatus, deleteSubmission } = useSubmissions(item.event_id);
    const [zoom, setZoom] = useState(false);

    // Aprobar/rechazar desde la vista grande cierra la ventana
    const moderate = (status: 'approved' | 'rejected') => {
        updateStatus.mutate({ id: item.id, status });
        setZoom(false);
    };

    return (
        <Card className="overflow-hidden bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group text-slate-100">
            <div className="relative aspect-square bg-slate-950">
                {item.type === 'photo' ? (
                    <button type="button" onClick={() => setZoom(true)} className="block w-full h-full cursor-zoom-in" title="Ver en grande">
                        <img
                            src={item.content}
                            alt="Submission"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                        />
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <Maximize2 className="w-3 h-3" /> Ver en grande
                        </span>
                    </button>
                ) : item.type === 'audio' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-900/50">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                            <Mic className="w-8 h-8 text-red-500" />
                        </div>
                        <audio controls src={item.content} className="w-full h-8 max-w-[200px]" />
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20">
                        <MessageSquare className="w-12 h-12 text-violet-400 mb-4 opacity-50" />
                        <p className="text-white font-medium line-clamp-4 italic">
                            "{item.content}"
                        </p>
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                    {item.status === 'pending' && <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-full backdrop-blur-sm border border-yellow-500/20 flex items-center gap-1"><Clock className="w-3 h-3" /> Pendiente</span>}
                    {item.status === 'approved' && <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs font-bold rounded-full backdrop-blur-sm border border-green-500/20 flex items-center gap-1"><Check className="w-3 h-3" /> Aprobado</span>}
                    {item.status === 'rejected' && <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs font-bold rounded-full backdrop-blur-sm border border-red-500/20 flex items-center gap-1"><X className="w-3 h-3" /> Rechazado</span>}
                </div>
            </div>

            <CardContent className="p-4 space-y-3">
                {item.caption && (
                    <p className="text-sm text-slate-200 italic line-clamp-3">“{item.caption}”</p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {item.author || "Anónimo"}
                    </span>
                    <span className="flex items-center gap-1" title={new Date(item.created_at).toLocaleString()}>
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                    </span>
                </div>
            </CardContent>

            <CardFooter className="p-3 bg-slate-950 border-t border-slate-800 grid grid-cols-3 gap-2">
                {item.status !== 'approved' && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-500 hover:text-green-400 hover:bg-green-950/30 w-full"
                        onClick={() => updateStatus.mutate({ id: item.id, status: 'approved' })}
                        disabled={updateStatus.isPending}
                    >
                        <Check className="w-4 h-4" />
                    </Button>
                )}

                {item.status !== 'rejected' && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-500 hover:text-amber-400 hover:bg-amber-950/30 w-full"
                        onClick={() => updateStatus.mutate({ id: item.id, status: 'rejected' })}
                        disabled={updateStatus.isPending}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}

                <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-400 hover:bg-red-950/30 w-full col-span-1 ml-auto"
                    onClick={() => deleteSubmission.mutate(item.id)}
                    disabled={deleteSubmission.isPending}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>

                {/* Adjust layout if mostly one button */}
                {item.status === 'approved' && (
                    <div className="col-span-2 flex items-center justify-center text-xs text-green-500 font-medium">
                        <Check className="w-3 h-3 mr-1" /> Visible
                    </div>
                )}
                {item.status === 'rejected' && (
                    <div className="col-span-2 flex items-center justify-center text-xs text-red-500 font-medium">
                        <X className="w-3 h-3 mr-1" /> Oculto
                    </div>
                )}
            </CardFooter>
            {item.type === 'photo' && (
                <Dialog open={zoom} onOpenChange={setZoom}>
                    <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-slate-950 border-slate-800 text-white flex flex-col">
                        <DialogTitle className="sr-only">Foto de {isAnonymousAuthor(item.author) ? 'un invitado' : item.author}</DialogTitle>
                        <div className="flex-1 min-h-0 bg-black flex items-center justify-center">
                            <img src={item.content} alt="Foto en grande" className="max-h-[75vh] w-auto max-w-full object-contain" />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 p-4">
                            <div className="flex-1 min-w-[200px]">
                                <p className="font-semibold">{isAnonymousAuthor(item.author) ? 'Invitado sin nombre' : item.author}</p>
                                {item.caption && <p className="text-sm italic text-slate-300">“{item.caption}”</p>}
                                <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}</p>
                            </div>
                            <div className="flex gap-2">
                                {item.status !== 'approved' && (
                                    <Button className="bg-green-600 hover:bg-green-500 text-white" onClick={() => moderate('approved')} disabled={updateStatus.isPending}>
                                        <Check className="w-4 h-4 mr-1" /> Aprobar
                                    </Button>
                                )}
                                {item.status !== 'rejected' && (
                                    <Button variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 bg-transparent" onClick={() => moderate('rejected')} disabled={updateStatus.isPending}>
                                        <X className="w-4 h-4 mr-1" /> Rechazar
                                    </Button>
                                )}
                                <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 bg-transparent" onClick={() => { deleteSubmission.mutate(item.id); setZoom(false); }} disabled={deleteSubmission.isPending}>
                                    <Trash2 className="w-4 h-4 mr-1" /> Borrar
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </Card>
    );
};
