import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, Monitor, Trash2, CheckCircle2, AlertCircle, RefreshCw, PlaySquare, Image as ImageIcon, Globe, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDisplaySchedules, useDeleteSchedule } from '@/hooks/use-display-hub';
import { toast } from 'sonner';
import { GlobalScheduleModal } from '@/components/display/GlobalScheduleModal';

// Format ISO to dd/mm/aaaa
function fmtDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// Format ISO to HH:MM AM/PM
function fmtTime(iso: string): string {
    const d = new Date(iso);
    let h = d.getHours();
    const min = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${min} ${ampm}`;
}

const formatLabel = (f: string) => {
    const map: Record<string, string> = {
        landscape_16_9: 'Paisaje (16:9)',
        portrait_9_16: 'Vertical (9:16)',
        square_1_1: 'Cuadrado (1:1)',
        landscape_4_3: 'Paisaje (4:3)',
    };
    return map[f] || f;
};

const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'published') return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Publicado
        </span>
    );
    if (status === 'expired') return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-400 border border-slate-700">
            <AlertCircle className="w-3 h-3" /> Vencido
        </span>
    );
    // pending
    return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Programado
        </span>
    );
};

const WorkspaceSchedule = () => {
    const { commerceId } = useParams<{ commerceId: string }>();
    const { data: schedules = [], isLoading, refetch } = useDisplaySchedules(commerceId);
    const deleteSchedule = useDeleteSchedule();
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

    const handleDelete = async (id: string, contentName: string) => {
        if (!confirm(`¿Eliminar la programación "${contentName}"?`)) return;
        try {
            await deleteSchedule.mutateAsync(id);
            toast.success('Programación eliminada');
        } catch (err: any) {
            toast.error('Error al eliminar: ' + err.message);
        }
    };

    const pending = (schedules as any[]).filter(s => s.status === 'pending');
    const published = (schedules as any[]).filter(s => s.status === 'published');
    const expired = (schedules as any[]).filter(s => s.status === 'expired');

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white font-[Orbitron]">
                        Programación de <span className="text-indigo-400">Contenido</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        El sistema publica automáticamente cuando se cumple la fecha y hora configurada.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2 h-10"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Actualizar
                    </Button>
                    <Button
                        onClick={() => setIsGlobalModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-10 shadow-lg shadow-indigo-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Programación
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-40 text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span>Cargando programaciones...</span>
                    </div>
                </div>
            ) : schedules.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                    <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white">Sin programaciones</h3>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                        Para crear una programación, abrí "Editar Pantalla", seleccioná un contenido y hacé clic en "Programar".
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Pending */}
                    {pending.length > 0 && (
                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Programadas ({pending.length})
                            </h2>
                            <div className="space-y-3">
                                {pending.map((s: any) => (
                                    <ScheduleCard key={s.id} schedule={s} onDelete={handleDelete} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Published */}
                    {published.length > 0 && (
                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Publicadas ({published.length})
                            </h2>
                            <div className="space-y-3">
                                {published.map((s: any) => (
                                    <ScheduleCard key={s.id} schedule={s} onDelete={handleDelete} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Expired */}
                    {expired.length > 0 && (
                        <section>
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Vencidas ({expired.length})
                            </h2>
                            <div className="space-y-3">
                                {expired.map((s: any) => (
                                    <ScheduleCard key={s.id} schedule={s} onDelete={handleDelete} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {commerceId && (
                <GlobalScheduleModal 
                    isOpen={isGlobalModalOpen}
                    onClose={() => setIsGlobalModalOpen(false)}
                    commerceId={commerceId}
                    onScheduled={() => {
                        setIsGlobalModalOpen(false);
                        refetch();
                    }}
                />
            )}
        </div>
    );
};

const ScheduleCard = ({ schedule: s, onDelete }: { schedule: any; onDelete: (id: string, name: string) => void }) => {
    const typeIcon = s.campaign_id
        ? <PlaySquare className="w-5 h-5 text-emerald-400" />
        : s.media?.type === 'image'
        ? <ImageIcon className="w-5 h-5 text-blue-400" />
        : s.media?.type === 'video'
        ? <PlaySquare className="w-5 h-5 text-violet-400" />
        : <Globe className="w-5 h-5 text-cyan-400" />;

    return (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700 transition-colors">
            {/* Type icon */}
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                {typeIcon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{s.content_name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Monitor className="w-3.5 h-3.5" /> {s.device_name}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5" /> {fmtDate(s.scheduled_at)} — {fmtTime(s.scheduled_at)}
                    </span>
                    {s.expires_at && (
                        <span className="flex items-center gap-1 text-xs text-rose-400/80">
                            <AlertCircle className="w-3.5 h-3.5" /> Vence: {fmtDate(s.expires_at)} {fmtTime(s.expires_at)}
                        </span>
                    )}
                    <span className="text-xs text-slate-500">{formatLabel(s.format)}</span>
                </div>
            </div>

            {/* Status */}
            <StatusBadge status={s.status} />

            {/* Actions */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(s.id, s.content_name)}
                className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
};

export default WorkspaceSchedule;
