import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, PlaySquare, Globe, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { AssetSelectorModal } from './AssetSelectorModal';

interface ScheduleEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: any) => void;
    onDelete?: () => void;
    initialEvent?: any | null; // { asset, startTime, endTime, daysOfWeek }
    initialDay?: number | null; // For pre-selecting a day when clicking the grid
    initialHour?: string | null; // For pre-selecting time
}

const DAYS = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
];

export const ScheduleEventModal = ({ isOpen, onClose, onSave, onDelete, initialEvent, initialDay, initialHour }: ScheduleEventModalProps) => {
    const [asset, setAsset] = useState<any>(null);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialEvent) {
                setAsset(initialEvent.asset);
                setStartTime(initialEvent.startTime || '09:00');
                setEndTime(initialEvent.endTime || '10:00');
                setDaysOfWeek(initialEvent.daysOfWeek || []);
            } else {
                setAsset(null);
                setStartTime(initialHour || '09:00');
                
                // Calculate default end time (1 hour later)
                if (initialHour) {
                    const [h, m] = initialHour.split(':');
                    let nextH = parseInt(h) + 1;
                    if (nextH > 23) nextH = 23;
                    setEndTime(`${nextH.toString().padStart(2, '0')}:${m}`);
                } else {
                    setEndTime('10:00');
                }
                
                setDaysOfWeek(initialDay !== null && initialDay !== undefined ? [initialDay] : [1,2,3,4,5]);
            }
        }
    }, [isOpen, initialEvent, initialDay, initialHour]);

    const handleDayToggle = (dayValue: number) => {
        if (daysOfWeek.includes(dayValue)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== dayValue));
        } else {
            setDaysOfWeek([...daysOfWeek, dayValue].sort());
        }
    };

    const handleSave = () => {
        if (!asset) return toast.error("Debes seleccionar un contenido");
        if (daysOfWeek.length === 0) return toast.error("Selecciona al menos un día");
        if (startTime >= endTime) return toast.error("La hora de inicio debe ser menor a la de fin");

        onSave({
            asset,
            startTime,
            endTime,
            daysOfWeek
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-md p-0 overflow-hidden rounded-xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <DialogTitle className="text-xl font-bold">{initialEvent ? 'Editar Evento' : 'Añadir Evento'}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div>
                        <Label className="text-slate-700 font-semibold mb-1.5 block">Contenido <span className="text-rose-500">*</span></Label>
                        {!asset ? (
                            <Button 
                                variant="outline" 
                                className="w-full h-14 border-dashed border-2 border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-start gap-3"
                                onClick={() => setIsAssetModalOpen(true)}
                            >
                                <LayoutGrid className="w-5 h-5 shrink-0" />
                                <span>Seleccionar contenido...</span>
                            </Button>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-lg p-2 flex gap-3 items-center group relative shadow-sm hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => setIsAssetModalOpen(true)}>
                                <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                                    {asset.type === 'image' && <img src={asset.url} alt="preview" className="w-full h-full object-cover" />}
                                    {asset.type === 'video' && <PlaySquare className="w-4 h-4 text-violet-400" />}
                                    {asset.type === 'campaign' && <PlaySquare className="w-4 h-4 text-emerald-400" />}
                                    {asset.type === 'web' && <Globe className="w-4 h-4 text-blue-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-slate-800 truncate">{asset.name}</p>
                                    <p className="text-[10px] text-slate-500 capitalize">{asset.type === 'campaign' ? 'Playlist' : asset.type}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-slate-700 font-semibold mb-1.5 block">Comenzar</Label>
                            <Input 
                                type="time" 
                                value={startTime} 
                                onChange={e => setStartTime(e.target.value)}
                                className="bg-slate-50"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-700 font-semibold mb-1.5 block">Fin</Label>
                            <Input 
                                type="time" 
                                value={endTime} 
                                onChange={e => setEndTime(e.target.value)}
                                className="bg-slate-50"
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="text-slate-700 font-semibold mb-2 block">Días de la semana</Label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map(day => (
                                <button
                                    key={day.value}
                                    onClick={() => handleDayToggle(day.value)}
                                    className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                                        daysOfWeek.includes(day.value) 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {day.label[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                        {initialEvent ? (
                            <Button variant="destructive" onClick={onDelete} className="bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white">Eliminar</Button>
                        ) : <div/>}
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">Guardar Evento</Button>
                        </div>
                    </div>
                </div>
            </DialogContent>

            <AssetSelectorModal
                isOpen={isAssetModalOpen}
                onClose={() => setIsAssetModalOpen(false)}
                onSelect={(selected) => {
                    setAsset(selected);
                    setIsAssetModalOpen(false);
                }}
            />
        </Dialog>
    );
};
