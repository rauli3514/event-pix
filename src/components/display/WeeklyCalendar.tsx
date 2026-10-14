
import { Fragment } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconForType } from '@/pages/display-hub/WorkspaceMedia';
import { getEventWindow } from '@/lib/displaySchedule';

interface WeeklyCalendarProps {
    schedule: any;
    onSlotClick?: (day: number, hour: string) => void;
    onEventClick?: (event: any) => void;
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// Columnas Lunes..Domingo; JS Date.getDay() da 0 para el domingo (columna 6).

const PIXELS_PER_HOUR = 60; // 60px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export const WeeklyCalendar = ({ schedule, onSlotClick, onEventClick }: WeeklyCalendarProps) => {
    
    // Parse time like "14:30" or "02:30 PM" to decimal hours
    const parseTimeToDecimal = (timeStr: string) => {
        if (!timeStr) return 0;
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) return 0;
        let [_, hStr, mStr, ampm] = match;
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        
        if (ampm) {
            if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
        }
        
        return h + (m / 60);
    };

    const formatTimeTo12h = (timeStr: string) => {
        if (!timeStr) return '';
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) return timeStr;
        let [_, hStr, mStr, ampm] = match;
        if (ampm) return timeStr; // Already formatted
        let h = parseInt(hStr, 10);
        const ampmStr = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h.toString().padStart(2, '0')}:${mStr} ${ampmStr}`;
    };

    // segment: 'start' = día en que empieza; 'continuation' = madrugada del día
    // siguiente para eventos que cruzan la medianoche (ej. 22:00–02:00).
    const renderEventBlock = (event: any, dayIndex: number, segment: 'start' | 'continuation' = 'start') => {
        const win = getEventWindow(event);
        let startDecimal = win ? win.start / 60 : parseTimeToDecimal(event.start_time);
        let endDecimal = win ? win.end / 60 : parseTimeToDecimal(event.end_time);
        if (win?.crossesMidnight) {
            if (segment === 'start') endDecimal = 24;
            else startDecimal = 0;
        }
        const duration = Math.max(endDecimal - startDecimal, 0.25);

        const top = startDecimal * PIXELS_PER_HOUR;
        const height = duration * PIXELS_PER_HOUR;
        
        const isCampaign = !!event.campaign;
        const asset = event.campaign || event.media;
        const type = isCampaign ? 'layout' : (asset?.type || 'image');
        const Icon = getIconForType(type);

        // Calculate a color based on the asset id to keep it consistent
        const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500', 'bg-orange-500', 'bg-emerald-500', 'bg-teal-500'];
        const colorIndex = (asset?.id?.charCodeAt(0) || 0) % colors.length;
        const bgClass = colors[colorIndex];

        return (
            <div 
                key={`${event.id}-${dayIndex}-${segment}`}
                className={cn("absolute left-1 right-1 rounded-md shadow-sm border border-white/20 p-2 overflow-hidden flex flex-col group transition-all cursor-pointer hover:ring-2 hover:ring-indigo-500/50 hover:z-10", bgClass, "text-white")}
                style={{ top: `${top}px`, height: `${height}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onEventClick) onEventClick(event);
                }}
            >
                <div className="flex items-center gap-1.5 text-xs font-semibold mb-1 opacity-90 truncate">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="truncate">{formatTimeTo12h(event.start_time)} - {formatTimeTo12h(event.end_time)}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-sm truncate">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{asset?.name || 'Desconocido'}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[600px]">
            {/* Header / Default Content */}
            <div className="bg-muted px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">{schedule.name}</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Contenido Predeterminado:</span>
                            <span className="font-semibold text-foreground truncate max-w-[200px] md:max-w-[400px]">
                                {schedule.default_campaign ? schedule.default_campaign.name : (schedule.default_media ? schedule.default_media.name : 'Ninguno (Pantalla Negra)')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto flex">
                {/* Time Gutter */}
                <div className="w-16 shrink-0 border-r border-border bg-card sticky left-0 z-20">
                    <div className="h-12 border-b border-border bg-muted/50 sticky top-0 z-30" /> {/* Header spacer */}
                    <div className="relative" style={{ height: `${24 * PIXELS_PER_HOUR}px` }}>
                        {Array.from({ length: 24 }).map((_, i) => (
                            <div 
                                key={i} 
                                className="absolute w-full text-right pr-2 text-xs text-muted-foreground font-medium -mt-2"
                                style={{ top: `${i * PIXELS_PER_HOUR}px` }}
                            >
                                {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Days Grid */}
                <div className="flex-1 min-w-[700px]">
                    {/* Days Header */}
                    <div className="h-12 border-b border-border bg-muted/50 flex sticky top-0 z-20">
                        {DAYS.map((day) => (
                            <div key={day} className="flex-1 border-r border-border flex items-center justify-center font-semibold text-sm text-foreground">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Columns */}
                    <div className="flex relative bg-grid-pattern" style={{ height: `${24 * PIXELS_PER_HOUR}px` }}>
                        {/* Horizontal Grid Lines */}
                        {Array.from({ length: 24 }).map((_, i) => (
                            <div 
                                key={`h-${i}`} 
                                className="absolute w-full border-t border-border/50 pointer-events-none"
                                style={{ top: `${i * PIXELS_PER_HOUR}px` }}
                            />
                        ))}

                        {/* Day Columns */}
                        {DAYS.map((_, colIndex) => (
                            <div key={`col-${colIndex}`} className="flex-1 border-r border-border/50 relative">
                                {HOURS.map((hourStr, hourIdx) => (
                                    <div
                                        key={hourIdx}
                                        className="absolute w-full h-[60px] hover:bg-slate-50/50 cursor-pointer group z-0"
                                        style={{ top: `${hourIdx * PIXELS_PER_HOUR}px` }}
                                        onClick={() => {
                                            const jsDay = colIndex === 6 ? 0 : colIndex + 1;
                                            if (onSlotClick) onSlotClick(jsDay, hourStr);
                                        }}
                                    >
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                            <span className="text-indigo-500 font-medium text-xs">+</span>
                                        </div>
                                    </div>
                                ))}
                                {schedule.events?.map((ev: any) => {
                                    const jsDay = colIndex === 6 ? 0 : colIndex + 1;
                                    const previousJsDay = (jsDay + 6) % 7;
                                    const days: number[] = ev.days_of_week || [];
                                    return (
                                        <Fragment key={ev.id}>
                                            {days.includes(jsDay) && renderEventBlock(ev, jsDay, 'start')}
                                            {getEventWindow(ev)?.crossesMidnight && days.includes(previousJsDay) && renderEventBlock(ev, jsDay, 'continuation')}
                                        </Fragment>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
