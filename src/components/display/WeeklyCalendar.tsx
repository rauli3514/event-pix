
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconForType } from '@/pages/display-hub/WorkspaceMedia';

interface WeeklyCalendarProps {
    schedule: any;
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// JS Date.getDay() gives 0 for Sunday, 1 for Monday.
// We want Monday=0, Sunday=6 for our grid.
const JS_DAY_TO_GRID_COL = {
    1: 0, // Mon
    2: 1, // Tue
    3: 2, // Wed
    4: 3, // Thu
    5: 4, // Fri
    6: 5, // Sat
    0: 6, // Sun
};

const PIXELS_PER_HOUR = 60; // 60px per hour

export const WeeklyCalendar = ({ schedule }: WeeklyCalendarProps) => {
    
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

    const renderEventBlock = (event: any, dayIndex: number) => {
        const startDecimal = parseTimeToDecimal(event.start_time);
        const endDecimal = parseTimeToDecimal(event.end_time);
        let duration = endDecimal - startDecimal;
        
        // Handle midnight wrap-around loosely
        if (duration < 0) duration += 24;

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
                key={`${event.id}-${dayIndex}`}
                className={cn("absolute left-1 right-1 rounded-md shadow-sm border border-white/20 p-2 overflow-hidden flex flex-col group transition-all", bgClass, "text-white")}
                style={{ top: `${top}px`, height: `${height}px` }}
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
                                {schedule.events?.map((ev: any) => {
                                    if (ev.days_of_week && ev.days_of_week.includes(Object.keys(JS_DAY_TO_GRID_COL).find(k => (JS_DAY_TO_GRID_COL as any)[k] === colIndex) ? parseInt(Object.keys(JS_DAY_TO_GRID_COL).find(k => (JS_DAY_TO_GRID_COL as any)[k] === colIndex)!) : -1)) {
                                        return renderEventBlock(ev, ev.days_of_week[0]); // The day index isn't super critical for the key here since we're mapping inside the col
                                    }
                                    return null;
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
