import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Monitor, Image as ImageIcon, PlaySquare, Globe, CheckCircle2 } from 'lucide-react';
import { useCreateSchedule } from '@/hooks/use-display-hub';
import { toast } from 'sonner';

interface ScheduleContentModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: any | null;       // selected media or campaign
    device: any | null;      // target device
    commerceId: string;
    onScheduled?: () => void;
}

// Format a Date to dd/mm/aaaa
function formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

// Format time to HH:MM AM/PM
function formatTime(date: Date): string {
    let h = date.getHours();
    const min = date.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${min} ${ampm}`;
}

// Parse dd/mm/aaaa to Date
function parseDate(str: string): Date | null {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const y = parseInt(parts[2]);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return new Date(y, m, d);
}

// Parse HH:MM AM/PM to {h, min}
function parseTime(str: string): { h: number; min: number } | null {
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let h = parseInt(match[1]);
    const min = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return { h, min };
}

// Combine date string and time string to ISO
function toISO(dateStr: string, timeStr: string): string | null {
    const date = parseDate(dateStr);
    const time = parseTime(timeStr);
    if (!date || !time) return null;
    date.setHours(time.h, time.min, 0, 0);
    return date.toISOString();
}

export const ScheduleContentModal = ({ isOpen, onClose, asset, device, commerceId, onScheduled }: ScheduleContentModalProps) => {
    const now = new Date();
    const [dateStr, setDateStr] = useState(formatDate(now));
    const [timeStr, setTimeStr] = useState(formatTime(now));
    const [format, setFormat] = useState('landscape_16_9');
    const [hasExpiry, setHasExpiry] = useState(false);
    const [expiryDateStr, setExpiryDateStr] = useState('');
    const [expiryTimeStr, setExpiryTimeStr] = useState('09:00 AM');
    const [afterExpiry, setAfterExpiry] = useState('last_played');
    const [showConfirmation, setShowConfirmation] = useState(false);

    const createSchedule = useCreateSchedule();

    useEffect(() => {
        if (isOpen) {
            const n = new Date();
            setDateStr(formatDate(n));
            setTimeStr(formatTime(n));
            setHasExpiry(false);
            setExpiryDateStr('');
            setExpiryTimeStr('09:00 AM');
            setShowConfirmation(false);
        }
    }, [isOpen]);

    const handleSchedule = async () => {
        if (!asset || !device || !commerceId) return;

        const scheduledAt = toISO(dateStr, timeStr);
        if (!scheduledAt) {
            toast.error('Fecha u hora de inicio inválida. Usa el formato dd/mm/aaaa - HH:MM AM/PM');
            return;
        }

        let expiresAt: string | null = null;
        if (hasExpiry && expiryDateStr && expiryTimeStr) {
            expiresAt = toISO(expiryDateStr, expiryTimeStr);
            if (!expiresAt) {
                toast.error('Fecha u hora de caducidad inválida');
                return;
            }
        }

        try {
            await createSchedule.mutateAsync({
                commerceId,
                deviceId: device.id,
                mediaId: asset.type !== 'campaign' ? asset.id : null,
                campaignId: asset.type === 'campaign' ? asset.id : null,
                scheduledAt,
                expiresAt,
                afterExpiry: hasExpiry ? afterExpiry : null,
                format,
                contentName: asset.name,
                deviceName: device.name || 'Pantalla',
            });

            setShowConfirmation(true);
        } catch (err: any) {
            toast.error(`Error al programar: ${err.message || 'Error desconocido'}`);
        }
    };

    const formatLabel = (f: string) => {
        const map: Record<string, string> = {
            landscape_16_9: 'Paisaje (16:9)',
            portrait_9_16: 'Vertical (9:16)',
            square_1_1: 'Cuadrado (1:1)',
            landscape_4_3: 'Paisaje (4:3)',
        };
        return map[f] || f;
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
                        <p className="text-slate-500 text-sm">El contenido será enviado automáticamente a la pantalla cuando se cumpla la fecha y hora configurada.</p>

                        <div className="w-full bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 text-left mt-2">
                            <div className="flex justify-between px-4 py-3">
                                <span className="text-slate-500 text-sm font-medium">Contenido</span>
                                <span className="text-slate-800 text-sm font-semibold">{asset?.name}</span>
                            </div>
                            <div className="flex justify-between px-4 py-3">
                                <span className="text-slate-500 text-sm font-medium">Pantalla</span>
                                <span className="text-slate-800 text-sm font-semibold">{device?.name || 'Pantalla'}</span>
                            </div>
                            <div className="flex justify-between px-4 py-3">
                                <span className="text-slate-500 text-sm font-medium">Fecha de publicación</span>
                                <span className="text-slate-800 text-sm font-semibold">{dateStr}</span>
                            </div>
                            <div className="flex justify-between px-4 py-3">
                                <span className="text-slate-500 text-sm font-medium">Hora de publicación</span>
                                <span className="text-slate-800 text-sm font-semibold">{timeStr}</span>
                            </div>
                            {hasExpiry && expiryDateStr && (
                                <div className="flex justify-between px-4 py-3">
                                    <span className="text-slate-500 text-sm font-medium">Caducidad</span>
                                    <span className="text-slate-800 text-sm font-semibold">{expiryDateStr} {expiryTimeStr}</span>
                                </div>
                            )}
                            <div className="flex justify-between px-4 py-3">
                                <span className="text-slate-500 text-sm font-medium">Formato</span>
                                <span className="text-slate-800 text-sm font-semibold">{formatLabel(format)}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 mt-1">Podés ver y gestionar todas las programaciones en la pestaña <strong>Programación</strong>.</p>

                        <Button onClick={() => { onScheduled?.(); onClose(); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white mt-2">
                            Aceptar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-3xl p-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-slate-500" />
                        <DialogTitle className="text-xl font-bold">Cronograma</DialogTitle>
                    </div>
                    <p className="text-sm text-emerald-600 font-medium mt-0.5">
                        Activo : {asset?.name || '—'}
                    </p>
                </DialogHeader>

                <div className="flex flex-col md:flex-row min-h-[400px]">
                    {/* Left: config */}
                    <div className="flex-1 p-6 space-y-6 border-r border-slate-100">

                        {/* Screen info */}
                        <div>
                            <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1 block">Configuración de pantalla</Label>
                            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                                <Monitor className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-800 font-medium text-sm">{device?.name || 'Sin seleccionar'}</span>
                            </div>
                        </div>

                        {/* Go-Live Date & Time */}
                        <div>
                            <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2 block">
                                Fecha y hora de publicación
                            </Label>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 border border-emerald-400 rounded-lg px-3 py-2 bg-white flex-1 focus-within:ring-2 focus-within:ring-emerald-300">
                                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="dd/mm/aaaa"
                                        value={dateStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="outline-none bg-transparent text-sm text-slate-800 w-full"
                                    />
                                </div>
                                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 focus-within:ring-2 focus-within:ring-emerald-300">
                                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="00:00 AM"
                                        value={timeStr}
                                        onChange={(e) => setTimeStr(e.target.value)}
                                        className="outline-none bg-transparent text-sm text-slate-800 w-full"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Formato: dd/mm/aaaa — HH:MM AM/PM</p>
                        </div>

                        {/* Expiry toggle */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={hasExpiry}
                                    onCheckedChange={setHasExpiry}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                                <Label className="text-sm font-medium text-slate-700 cursor-pointer" onClick={() => setHasExpiry(!hasExpiry)}>
                                    Establecer fecha de caducidad
                                </Label>
                            </div>

                            {hasExpiry && (
                                <div className="space-y-3 pl-2 border-l-2 border-emerald-200">
                                    <div>
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2 block">
                                            Fecha y hora de caducidad
                                        </Label>
                                        <div className="flex gap-2">
                                            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 focus-within:ring-2 focus-within:ring-emerald-300">
                                                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                                <input
                                                    type="text"
                                                    placeholder="dd/mm/aaaa"
                                                    value={expiryDateStr}
                                                    onChange={(e) => setExpiryDateStr(e.target.value)}
                                                    className="outline-none bg-transparent text-sm text-slate-800 w-full"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 focus-within:ring-2 focus-within:ring-emerald-300">
                                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                <input
                                                    type="text"
                                                    placeholder="00:00 AM"
                                                    value={expiryTimeStr}
                                                    onChange={(e) => setExpiryTimeStr(e.target.value)}
                                                    className="outline-none bg-transparent text-sm text-slate-800 w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1 block">Después del vencimiento</Label>
                                        <Select value={afterExpiry} onValueChange={setAfterExpiry}>
                                            <SelectTrigger className="bg-white border-slate-200 text-slate-700">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="last_played">Reproducir últimos contenidos</SelectItem>
                                                <SelectItem value="black_screen">Pantalla en negro</SelectItem>
                                                <SelectItem value="no_content">Sin contenido</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: preview + format */}
                    <div className="w-full md:w-72 flex flex-col p-4 gap-4">
                        {/* Format selector */}
                        <div className="flex justify-end">
                            <Select value={format} onValueChange={setFormat}>
                                <SelectTrigger className="w-44 h-9 bg-white border-slate-200 text-slate-700 text-sm">
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

                        {/* Preview */}
                        <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center relative min-h-[180px]">
                            {asset?.url && asset.type === 'image' ? (
                                <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
                            ) : asset?.url && asset.type === 'video' ? (
                                <video src={asset.url} className="w-full h-full object-contain bg-black" muted autoPlay loop playsInline />
                            ) : asset?.type === 'campaign' ? (
                                <div className="flex flex-col items-center text-slate-400 gap-2">
                                    <PlaySquare className="w-12 h-12 text-emerald-400" />
                                    <span className="text-sm text-slate-500 font-medium">Lista de Reproducción</span>
                                </div>
                            ) : asset?.type === 'web' ? (
                                <div className="flex flex-col items-center text-slate-400 gap-2">
                                    <Globe className="w-10 h-10 text-blue-400" />
                                    <span className="text-xs text-slate-500">{asset.url}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-slate-300 gap-2">
                                    <ImageIcon className="w-10 h-10" />
                                    <span className="text-xs text-slate-400">Sin vista previa</span>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-slate-400 text-center">
                            El contenido no se envía a la pantalla inmediatamente. El sistema lo publicará automáticamente en la fecha y hora indicadas.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                    <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:bg-slate-200">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSchedule}
                        disabled={createSchedule.isPending || !asset || !device}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm px-6"
                    >
                        {createSchedule.isPending ? 'Programando...' : 'Programar publicación'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
