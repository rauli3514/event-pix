import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface ClockConfig {
    type: 'digital' | 'analog';
    theme: 'dark' | 'light' | 'glass' | 'neon';
    format24h: boolean;
    showDate: boolean;
}

interface ClockFormProps {
    config: Partial<ClockConfig>;
    onChange: (config: Partial<ClockConfig>) => void;
}

export const ClockForm = ({ config, onChange }: ClockFormProps) => {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Tipo de Reloj</Label>
                <Select 
                    value={config.type || 'digital'} 
                    onValueChange={(val) => onChange({ ...config, type: val as any })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="digital">Digital (Números)</SelectItem>
                        <SelectItem value="analog">Analógico (Agujas)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Tema Visual</Label>
                <Select 
                    value={config.theme || 'glass'} 
                    onValueChange={(val) => onChange({ ...config, theme: val as any })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona un tema" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="glass">Premium Glassmorphism</SelectItem>
                        <SelectItem value="dark">Modo Oscuro</SelectItem>
                        <SelectItem value="light">Modo Claro</SelectItem>
                        <SelectItem value="neon">Neon Cyberpunk</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {config.type !== 'analog' && (
                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-slate-200">Formato 24 Horas</Label>
                        <p className="text-xs text-slate-400">Usar formato 24h (ej: 14:30)</p>
                    </div>
                    <Switch
                        checked={config.format24h ?? true}
                        onCheckedChange={(checked) => onChange({ ...config, format24h: checked })}
                        className="data-[state=checked]:bg-indigo-500"
                    />
                </div>
            )}

            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
                <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-slate-200">Mostrar Fecha</Label>
                    <p className="text-xs text-slate-400">Incluir el día y la fecha completa</p>
                </div>
                <Switch
                    checked={config.showDate ?? true}
                    onCheckedChange={(checked) => onChange({ ...config, showDate: checked })}
                    className="data-[state=checked]:bg-indigo-500"
                />
            </div>
        </div>
    );
};

export const ClockPreview = ({ config, containerWidth: extContainerWidth }: { config: Partial<ClockConfig>, containerWidth?: number, mode?: 'main' | 'column' | 'square' }) => {
    const [time, setTime] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        let timeoutId: any;
        const observer = new ResizeObserver(entries => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                for (let entry of entries) {
                    setDimensions({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height
                    });
                }
            }, 100);
        });
        observer.observe(containerRef.current);
        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, []);

    const type = config.type || 'digital';
    const theme = config.theme || 'glass';
    const format24h = config.format24h ?? true;
    const showDate = config.showDate ?? true;

    // Theme Styles
    const getThemeStyles = () => {
        switch (theme) {
            case 'dark': return 'bg-[#0f172a] text-white';
            case 'light': return 'bg-slate-50 text-slate-900';
            case 'neon': return 'bg-black text-cyan-400 [text-shadow:0_0_10px_rgba(34,211,238,0.8)]';
            case 'glass':
            default: return 'bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl text-white border border-white/10';
        }
    };

    const width = extContainerWidth || dimensions.width;
    const height = dimensions.height || width;
    const minDimension = Math.min(width, height);
    
    const isSmall = minDimension > 0 && minDimension < 300;
    const isMedium = minDimension >= 300 && minDimension < 600;

    // Digital formatting
    const hours = format24h ? time.getHours().toString().padStart(2, '0') : (time.getHours() % 12 || 12).toString();
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    const ampm = time.getHours() >= 12 ? 'PM' : 'AM';

    const formatter = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
    const dateStr = formatter.format(time);

    // Analog calculations
    const secDegrees = ((time.getSeconds() / 60) * 360) + 90;
    const minDegrees = ((time.getMinutes() / 60) * 360) + ((time.getSeconds()/60)*6) + 90;
    const hourDegrees = ((time.getHours() / 12) * 360) + ((time.getMinutes()/60)*30) + 90;

    return (
        <div ref={containerRef} className={cn("w-full h-full flex flex-col items-center justify-center p-8 transition-all overflow-hidden relative", getThemeStyles())}>
            
            {theme === 'glass' && (
                <>
                    <div className="absolute top-[-20%] left-[-10%] w-3/4 h-3/4 bg-blue-500/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-3/4 h-3/4 bg-purple-500/20 rounded-full blur-[100px]" />
                </>
            )}

            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full gap-4">
                
                {type === 'digital' ? (
                    <div className="flex flex-col items-center justify-center">
                        <div className={cn(
                            "font-bold tabular-nums tracking-tighter leading-none flex items-baseline gap-2",
                            theme === 'neon' ? 'font-mono' : 'font-sans'
                        )}
                        style={{ fontSize: isSmall ? '4rem' : isMedium ? '8rem' : '12rem' }}
                        >
                            {hours}:{minutes}
                            <div className="flex flex-col items-start justify-end pb-2 lg:pb-6 gap-2">
                                <span className={cn(
                                    "font-medium tabular-nums leading-none text-opacity-80",
                                    theme === 'neon' ? 'text-cyan-600' : 'text-slate-400'
                                )}
                                style={{ fontSize: isSmall ? '1.5rem' : isMedium ? '2.5rem' : '4rem' }}
                                >
                                    {seconds}
                                </span>
                                {!format24h && (
                                    <span className="text-xl lg:text-3xl font-medium opacity-80 leading-none">
                                        {ampm}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={cn(
                        "relative rounded-full border-4 shadow-2xl flex items-center justify-center",
                        theme === 'glass' ? 'bg-white/5 border-white/20 backdrop-blur-md shadow-[0_0_50px_rgba(255,255,255,0.1)]' :
                        theme === 'light' ? 'bg-white border-slate-200' :
                        theme === 'neon' ? 'bg-black border-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.5)]' :
                        'bg-slate-900 border-slate-700'
                    )}
                    style={{ 
                        width: isSmall ? '150px' : isMedium ? '300px' : '500px',
                        height: isSmall ? '150px' : isMedium ? '300px' : '500px' 
                    }}>
                        {/* Clock Center */}
                        <div className={cn(
                            "absolute z-50 rounded-full",
                            theme === 'neon' ? 'bg-cyan-400 shadow-[0_0_10px_cyan]' : 'bg-red-500'
                        )}
                        style={{ width: isSmall ? '8px' : '16px', height: isSmall ? '8px' : '16px' }} />

                        {/* Hour Hand */}
                        <div className="absolute top-1/2 left-1/2 origin-left z-20 rounded-full"
                             style={{
                                 width: '25%',
                                 height: isSmall ? '4px' : '8px',
                                 transform: `translateY(-50%) rotate(${hourDegrees}deg)`,
                                 backgroundColor: theme === 'neon' ? '#22d3ee' : theme === 'light' ? '#0f172a' : '#fff'
                             }} />
                        
                        {/* Minute Hand */}
                        <div className="absolute top-1/2 left-1/2 origin-left z-30 rounded-full"
                             style={{
                                 width: '38%',
                                 height: isSmall ? '3px' : '6px',
                                 transform: `translateY(-50%) rotate(${minDegrees}deg)`,
                                 backgroundColor: theme === 'neon' ? '#67e8f9' : theme === 'light' ? '#475569' : '#cbd5e1'
                             }} />
                             
                        {/* Second Hand */}
                        <div className="absolute top-1/2 left-1/2 origin-left z-40 rounded-full"
                             style={{
                                 width: '42%',
                                 height: isSmall ? '1px' : '2px',
                                 transform: `translateY(-50%) rotate(${secDegrees}deg)`,
                                 backgroundColor: theme === 'neon' ? '#cffafe' : '#ef4444'
                             }} />

                        {/* Clock Markers */}
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="absolute w-full h-full" style={{ transform: `rotate(${i * 30}deg)` }}>
                                <div className={cn(
                                    "mx-auto mt-2",
                                    i % 3 === 0 ? (isSmall ? 'h-3 w-1' : 'h-6 w-2') : (isSmall ? 'h-1.5 w-0.5' : 'h-3 w-1'),
                                    theme === 'neon' ? 'bg-cyan-800' : theme === 'light' ? 'bg-slate-300' : 'bg-white/30'
                                )} />
                            </div>
                        ))}
                    </div>
                )}

                {showDate && (
                    <div className={cn(
                        "font-medium capitalize mt-4 transition-all",
                        theme === 'glass' ? 'text-white/80' : 
                        theme === 'neon' ? 'text-cyan-600' : 'opacity-70'
                    )}
                    style={{ fontSize: isSmall ? '1rem' : isMedium ? '1.5rem' : '2.5rem' }}
                    >
                        {dateStr}
                    </div>
                )}
            </div>
        </div>
    );
};
