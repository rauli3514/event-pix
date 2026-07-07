import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Monitor, PlaySquare, Globe, CheckCircle2, LayoutGrid } from 'lucide-react';
import { useCreateSchedule, useDisplayDevices } from '@/hooks/use-display-hub';
import { toast } from 'sonner';
import { AssetSelectorModal } from './AssetSelectorModal';

interface GlobalScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    onScheduled?: () => void;
}

// Format a Date to yyyy-mm-dd for input type="date"
function formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
}

// Format time to HH:mm for input type="time"
function formatTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${min}`;
}

// Combine yyyy-mm-dd string and HH:mm string to ISO
function toISO(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null;
    const dateParts = dateStr.split('-');
    const timeParts = timeStr.split(':');
    if (dateParts.length !== 3 || timeParts.length !== 2) return null;
    
    const y = parseInt(dateParts[0]);
    const m = parseInt(dateParts[1]) - 1;
    const d = parseInt(dateParts[2]);
    const h = parseInt(timeParts[0]);
    const min = parseInt(timeParts[1]);
    
    if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || isNaN(min)) return null;
    
    const date = new Date(y, m, d, h, min, 0, 0);
    return date.toISOString();
}

export const GlobalScheduleModal = ({ isOpen, onClose, commerceId, onScheduled }: GlobalScheduleModalProps) => {
    const now = new Date();
    const [dateStr, setDateStr] = useState(formatDate(now));
    const [timeStr, setTimeStr] = useState(formatTime(now));
    const [format, setFormat] = useState('landscape_16_9');
    
    const [hasExpiry, setHasExpiry] = useState(false);
    const [expiryDateStr, setExpiryDateStr] = useState('');
    const [expiryTimeStr, setExpiryTimeStr] = useState('09:00 AM');
    const [afterExpiry, setAfterExpiry] = useState('last_played');
    
    // Recurring State
    const [isRecurring, setIsRecurring] = useState(false);
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [startTimeStr, setStartTimeStr] = useState('11:00 AM');
    const [endTimeStr, setEndTimeStr] = useState('02:00 PM');
    
    const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
    
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const { data: devices = [] } = useDisplayDevices(commerceId);
    const createSchedule = useCreateSchedule();

    useEffect(() => {
        if (isOpen) {
            const n = new Date();
            setDateStr(formatDate(n));
            setTimeStr(formatTime(n));
            setHasExpiry(false);
            setExpiryDateStr('');
            setExpiryTimeStr('09:00 AM');
            setIsRecurring(false);
            setDaysOfWeek([]);
            setStartTimeStr('11:00 AM');
            setEndTimeStr('02:00 PM');
            setShowConfirmation(false);
            setSelectedAsset(null);
            setSelectedDeviceIds([]);
        }
    }, [isOpen]);

    const handleSchedule = async () => {
        if (!selectedAsset) {
            toast.error('Debe seleccionar un contenido');
            return;
        }
        if (selectedDeviceIds.length === 0) {
            toast.error('Debe seleccionar al menos una pantalla');
            return;
        }

        let finalScheduledAt: string | null = null;
        let finalExpiresAt: string | null = null;

        if (!isRecurring) {
            finalScheduledAt = toISO(dateStr, timeStr);
            if (!finalScheduledAt) {
                toast.error('Fecha u hora de inicio inválida. Usa el formato dd/mm/aaaa - HH:MM AM/PM');
                return;
            }
            if (hasExpiry && expiryDateStr && expiryTimeStr) {
                finalExpiresAt = toISO(expiryDateStr, expiryTimeStr);
                if (!finalExpiresAt) {
                    toast.error('Fecha u hora de caducidad inválida');
                    return;
                }
            }
        } else {
            // For recurring schedules, we use a dummy scheduledAt to satisfy the database NOT NULL constraint
            finalScheduledAt = new Date().toISOString();
            
            if (daysOfWeek.length === 0) {
                toast.error('Debe seleccionar al menos un día de la semana');
                return;
            }
            if (!startTimeStr || !endTimeStr) {
                toast.error('Horario de inicio o fin inválido');
                return;
            }
        }

        try {
            // Schedule for all selected devices concurrently
            await Promise.all(selectedDeviceIds.map(deviceId => {
                const device = devices.find(d => d.id === deviceId);
                return createSchedule.mutateAsync({
                    commerceId,
                    deviceId,
                    mediaId: selectedAsset.type !== 'campaign' ? selectedAsset.id : null,
                    campaignId: selectedAsset.type === 'campaign' ? selectedAsset.id : null,
                    scheduledAt: finalScheduledAt,
                    expiresAt: finalExpiresAt,
                    afterExpiry: (!isRecurring && hasExpiry) ? afterExpiry : null,
                    format,
                    contentName: selectedAsset.name,
                    deviceName: device?.name || 'Pantalla',
                    isRecurring,
                    daysOfWeek,
                    startTime: isRecurring ? startTimeStr : null,
                    endTime: isRecurring ? endTimeStr : null,
                });
            }));

            setShowConfirmation(true);
        } catch (err: any) {
            toast.error(`Error al programar: ${err.message || 'Error desconocido'}`);
        }
    };

    const toggleDevice = (id: string) => {
        setSelectedDeviceIds(prev => 
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const toggleAllDevices = () => {
        if (selectedDeviceIds.length === devices.length) {
            setSelectedDeviceIds([]);
        } else {
            setSelectedDeviceIds(devices.map(d => d.id));
        }
    };



    if (showConfirmation) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-lg p-0 overflow-hidden sm:rounded-2xl">
                    <div className="p-8 flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">¡Programado correctamente!</h2>
                        <p className="text-slate-500 text-sm">
                            El contenido fue programado para <strong>{selectedDeviceIds.length} pantalla(s)</strong> y se publicará automáticamente en la fecha indicada.
                        </p>
                        <Button onClick={() => { onScheduled?.(); onClose(); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white mt-4">
                            Aceptar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-4xl p-0 overflow-hidden rounded-xl w-[95vw] md:w-full h-[90dvh] md:h-auto md:max-h-[85vh] flex flex-col">
                <DialogHeader className="px-4 md:px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <DialogTitle className="text-xl font-bold">Nueva Programación</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="flex flex-col md:flex-row min-h-full md:min-h-[500px]">
                        {/* Left: Selecciones (Contenido y Pantallas) */}
                        <div className="w-full md:w-1/2 p-4 md:p-6 space-y-6 md:space-y-8 md:border-r border-b md:border-b-0 border-slate-100 bg-slate-50/50 flex flex-col">
                        
                        {/* Paso 1: Contenido */}
                        <div>
                            <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3 block">
                                1. Seleccionar Contenido
                            </Label>
                            {!selectedAsset ? (
                                <Button 
                                    variant="outline" 
                                    className="w-full h-24 border-dashed border-2 border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex flex-col gap-2"
                                    onClick={() => setIsAssetModalOpen(true)}
                                >
                                    <LayoutGrid className="w-6 h-6" />
                                    <span>Elegir medios o playlist</span>
                                </Button>
                            ) : (
                                <div className="bg-white border border-slate-200 rounded-xl p-3 flex gap-4 items-center group relative shadow-sm">
                                    <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                                        {selectedAsset.type === 'image' && <img src={selectedAsset.url} alt="preview" className="w-full h-full object-cover" />}
                                        {selectedAsset.type === 'video' && <PlaySquare className="w-6 h-6 text-violet-400" />}
                                        {selectedAsset.type === 'campaign' && <PlaySquare className="w-6 h-6 text-emerald-400" />}
                                        {selectedAsset.type === 'web' && <Globe className="w-6 h-6 text-blue-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 truncate">{selectedAsset.name}</p>
                                        <p className="text-xs text-slate-500 capitalize">{selectedAsset.type === 'campaign' ? 'Playlist' : selectedAsset.type}</p>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setIsAssetModalOpen(true)}
                                        className="text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Cambiar
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Paso 2: Pantallas */}
                        <div className="flex-1 flex flex-col min-h-0 mt-6 md:mt-0">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
                                    2. Seleccionar Pantallas
                                </Label>
                                <button 
                                    onClick={toggleAllDevices}
                                    className="text-xs text-indigo-600 font-medium hover:underline"
                                >
                                    {selectedDeviceIds.length === devices.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                                </button>
                            </div>
                            
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 shadow-sm">
                                {devices.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        No hay pantallas configuradas en este workspace.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto p-1">
                                        {devices.map(d => (
                                            <div 
                                                key={d.id} 
                                                onClick={() => toggleDevice(d.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                                    selectedDeviceIds.includes(d.id) 
                                                    ? 'bg-indigo-50/50 hover:bg-indigo-50' 
                                                    : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-center shrink-0">
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                                        selectedDeviceIds.includes(d.id) 
                                                        ? 'bg-indigo-500 border-indigo-500' 
                                                        : 'border-slate-300 bg-white'
                                                    }`}>
                                                        {selectedDeviceIds.includes(d.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <Monitor className="w-4 h-4 text-slate-500" />
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">{d.name || 'Pantalla sin nombre'}</p>
                                                        <p className="text-xs text-slate-500 truncate">{d.description || 'Sin ubicación'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-right">
                                {selectedDeviceIds.length} de {devices.length} seleccionadas
                            </p>
                        </div>
                    </div>

                    {/* Right: Configuración de Fechas */}
                    <div className="w-full md:w-1/2 p-4 md:p-6 space-y-6 flex flex-col">
                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3 block">
                            3. Configuración de Tiempos
                        </Label>

                        {/* Tipo de Programación */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-slate-700 font-medium cursor-pointer" onClick={() => setIsRecurring(!isRecurring)}>
                                        Programación Recurrente
                                    </Label>
                                    <p className="text-xs text-slate-500">Repetir contenido ciertos días y horas</p>
                                </div>
                                <Switch
                                    checked={isRecurring}
                                    onCheckedChange={setIsRecurring}
                                    className="data-[state=checked]:bg-indigo-500"
                                />
                            </div>

                            {isRecurring ? (
                                <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <Label className="text-slate-700 text-sm mb-2 block">Días de la semana</Label>
                                        <div className="flex gap-2">
                                            {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        setDaysOfWeek(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]);
                                                    }}
                                                    className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${daysOfWeek.includes(idx) ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Label className="text-slate-700 text-sm mb-1 block">Hora Inicio</Label>
                                            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white transition-all">
                                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                <input type="time" value={startTimeStr} onChange={(e) => setStartTimeStr(e.target.value)} className="outline-none bg-transparent text-sm text-slate-800 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-slate-700 text-sm mb-1 block">Hora Fin</Label>
                                            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white transition-all">
                                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                <input type="time" value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)} className="outline-none bg-transparent text-sm text-slate-800 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-slate-700 font-medium mb-3 block">Publicar en fecha y hora (1 sola vez)</Label>
                                    <div className="flex gap-2">
                                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex-1 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white transition-all">
                                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                            <input
                                                type="date"
                                                value={dateStr}
                                                onChange={(e) => setDateStr(e.target.value)}
                                                className="outline-none bg-transparent text-sm text-slate-800 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex-1 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white transition-all">
                                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                            <input
                                                type="time"
                                                value={timeStr}
                                                onChange={(e) => setTimeStr(e.target.value)}
                                                className="outline-none bg-transparent text-sm text-slate-800 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Seleccioná la fecha y hora de inicio</p>
                                </div>
                            )}
                        </div>

                        {/* Caducidad */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-700 font-medium cursor-pointer" onClick={() => setHasExpiry(!hasExpiry)}>
                                    Establecer fecha de caducidad
                                </Label>
                                <Switch
                                    checked={hasExpiry}
                                    onCheckedChange={setHasExpiry}
                                    className="data-[state=checked]:bg-indigo-500"
                                />
                            </div>

                            {hasExpiry && (
                                <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex gap-2">
                                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex-1 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white">
                                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                            <input
                                                type="date"
                                                value={expiryDateStr}
                                                onChange={(e) => setExpiryDateStr(e.target.value)}
                                                className="outline-none bg-transparent text-sm text-slate-800 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex-1 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:bg-white">
                                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                            <input
                                                type="time"
                                                value={expiryTimeStr}
                                                onChange={(e) => setExpiryTimeStr(e.target.value)}
                                                className="outline-none bg-transparent text-sm text-slate-800 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <Label className="text-slate-500 text-xs mb-1.5 block">Al caducar el contenido:</Label>
                                        <Select value={afterExpiry} onValueChange={setAfterExpiry}>
                                            <SelectTrigger className="bg-white border-slate-200 text-slate-700">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="last_played">Reproducir últimos contenidos</SelectItem>
                                                <SelectItem value="black_screen">Dejar la pantalla en negro</SelectItem>
                                                <SelectItem value="no_content">Volver al estado "Sin contenido"</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Formato visual */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <Label className="text-slate-700 font-medium mb-2 block">Formato Visual</Label>
                            <Select value={format} onValueChange={setFormat}>
                                <SelectTrigger className="bg-white border-slate-200 text-slate-700 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="landscape_16_9">Paisaje (16:9)</SelectItem>
                                    <SelectItem value="portrait_9_16">Vertical (9:16)</SelectItem>
                                    <SelectItem value="square_1_1">Cuadrado (1:1)</SelectItem>
                                    <SelectItem value="landscape_4_3">Paisaje (4:3)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                </div>

                {/* Footer */}
                <div className="px-4 md:px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSchedule}
                        disabled={createSchedule.isPending || !selectedAsset || selectedDeviceIds.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm px-8"
                    >
                        {createSchedule.isPending ? 'Procesando...' : 'Programar contenido'}
                    </Button>
                </div>
            </DialogContent>
            
            {/* Modal para elegir el contenido */}
            <AssetSelectorModal 
                isOpen={isAssetModalOpen} 
                onClose={() => setIsAssetModalOpen(false)} 
                onSelect={(asset) => {
                    setSelectedAsset(asset);
                    setIsAssetModalOpen(false);
                }}
            />
        </Dialog>
    );
};
