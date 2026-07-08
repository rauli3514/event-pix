import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, Trash2, Edit2, PlaySquare, Image as ImageIcon, Globe, Plus, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDisplaySchedules, useDeleteSchedule } from '@/hooks/use-display-hub';
import { toast } from 'sonner';
import { ScheduleBuilderModal } from '@/components/display/ScheduleBuilderModal';
import { SendToScreensModal } from '@/components/display/SendToScreensModal';
import { WeeklyCalendar } from '@/components/display/WeeklyCalendar';
import { ArrowLeft, MonitorUp } from 'lucide-react';

const WorkspaceSchedule = () => {
    const { commerceId } = useParams<{ commerceId: string }>();
    const { data: schedules = [], isLoading, refetch } = useDisplaySchedules(commerceId);
    const deleteSchedule = useDeleteSchedule();
    
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any>(null);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el horario "${name}"? Las pantallas que lo tengan asignado dejarán de usarlo.`)) return;
        try {
            await deleteSchedule.mutateAsync(id);
            toast.success('Horario eliminado');
        } catch (err: any) {
            toast.error('Error al eliminar: ' + err.message);
        }
    };

    const handleEdit = (schedule: any) => {
        setEditingSchedule(schedule);
        setIsBuilderOpen(true);
    };

    const handleCreateNew = () => {
        setEditingSchedule(null);
        setIsBuilderOpen(true);
    };

    const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto h-full flex flex-col">
            {selectedSchedule ? (
                // Detailed Calendar View
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedScheduleId(null)} className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground leading-tight">{selectedSchedule.name}</h1>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => handleEdit(selectedSchedule)} className="gap-2 bg-background">
                                <Edit2 className="w-4 h-4" />
                                Editar Horario
                            </Button>
                            <Button onClick={() => setIsSendModalOpen(true)} className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white">
                                <MonitorUp className="w-4 h-4" />
                                Empujar a la Pantalla
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-sm">
                        <WeeklyCalendar schedule={selectedSchedule} />
                    </div>
                </div>
            ) : (
                // List View
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground font-[Orbitron]">
                                Horarios <span className="text-indigo-500">Inteligentes</span>
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Crea horarios con eventos recurrentes y asígnalos a tus pantallas.
                            </p>
                        </div>
                        <Button
                            onClick={handleCreateNew}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-10 shadow-lg shadow-indigo-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Horario
                        </Button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-40 text-muted-foreground">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span>Cargando horarios...</span>
                                </div>
                            </div>
                        ) : schedules.length === 0 ? (
                            <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl bg-card/50">
                                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-foreground">Sin horarios</h3>
                                <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                                    Crea un Horario para programar contenido dinámico durante la semana y asígnalo a tus pantallas.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {schedules.map((s: any) => (
                                    <ScheduleCard 
                                        key={s.id} 
                                        schedule={s} 
                                        onClick={() => setSelectedScheduleId(s.id)}
                                        onEdit={(e) => { e.stopPropagation(); handleEdit(s); }}
                                        onDelete={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }} 
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {commerceId && isBuilderOpen && (
                <ScheduleBuilderModal 
                    isOpen={isBuilderOpen}
                    onClose={() => setIsBuilderOpen(false)}
                    commerceId={commerceId}
                    existingSchedule={editingSchedule}
                    onSaved={() => {
                        refetch();
                        if (editingSchedule && editingSchedule.id === selectedScheduleId) {
                            // If we were editing the selected schedule, just refetch
                        } else {
                            // If it was a new schedule, we could theoretically set it, but refetch might lose it. Let's just go back to list.
                            setSelectedScheduleId(null);
                        }
                    }}
                />
            )}
            
            {commerceId && isSendModalOpen && selectedSchedule && (
                <SendToScreensModal
                    isOpen={isSendModalOpen}
                    onClose={() => setIsSendModalOpen(false)}
                    commerceId={commerceId}
                    selectedAssets={[{ ...selectedSchedule, type: 'schedule' }]}
                    onSuccess={() => setIsSendModalOpen(false)}
                />
            )}
        </div>
    );
};

const ScheduleCard = ({ schedule: s, onEdit, onDelete, onClick }: { schedule: any; onEdit: (e: any) => void; onDelete: (e: any) => void; onClick: () => void }) => {
    const defaultAsset = s.default_campaign || s.default_media;
    
    return (
        <div 
            onClick={onClick}
            className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-indigo-500/50 transition-colors shadow-sm relative group cursor-pointer"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="text-foreground font-bold text-lg leading-tight">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">{s.events?.length || 0} eventos configurados</p>
                    </div>
                </div>
                
                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-card rounded-lg">
                    <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8 text-muted-foreground hover:text-indigo-500 hover:bg-indigo-50">
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Default Content */}
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3 border border-border/50">
                <div className="w-8 h-8 rounded bg-background flex items-center justify-center shrink-0 border border-border">
                    {!defaultAsset ? <LayoutGrid className="w-4 h-4 text-muted-foreground" /> :
                     defaultAsset.type === 'campaign' || s.default_campaign ? <PlaySquare className="w-4 h-4 text-emerald-500" /> :
                     defaultAsset.type === 'video' ? <PlaySquare className="w-4 h-4 text-violet-500" /> :
                     defaultAsset.type === 'web' ? <Globe className="w-4 h-4 text-blue-500" /> :
                     <ImageIcon className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Predeterminado</p>
                    <p className="text-sm font-medium truncate">{defaultAsset ? defaultAsset.name : 'Ninguno (Pantalla Negra)'}</p>
                </div>
            </div>

            {/* Events Preview */}
            {s.events && s.events.length > 0 && (
                <div className="space-y-2 mt-1">
                    {s.events.slice(0, 3).map((ev: any, i: number) => {
                        const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'].filter((_, i) => ev.days_of_week.includes(i)).join(', ');
                        const itemName = ev.campaign?.name || ev.media?.name || 'Desconocido';
                        return (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground flex items-center gap-1.5 min-w-0 truncate">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{itemName}</span>
                                </span>
                                <span className="font-medium text-foreground shrink-0 pl-2">
                                    {days} ({ev.start_time}-{ev.end_time})
                                </span>
                            </div>
                        );
                    })}
                    {s.events.length > 3 && (
                        <p className="text-xs text-muted-foreground italic text-center pt-1">+ {s.events.length - 3} eventos más</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkspaceSchedule;
