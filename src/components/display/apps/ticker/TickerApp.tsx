import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Newspaper, Info, FastForward, Play, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TickerConfig {
    sourceType: 'custom' | 'rss';
    customText: string;
    rssUrl: string;
    speed: 'slow' | 'normal' | 'fast';
    theme: 'dark' | 'light' | 'brand' | 'glass';
}

interface TickerFormProps {
    config: Partial<TickerConfig>;
    onChange: (config: Partial<TickerConfig>) => void;
}

const PREDEFINED_RSS = [
    { name: 'Infobae', url: 'https://www.infobae.com/argentina-rss.xml' },
    { name: 'Clarín', url: 'https://www.clarin.com/rss/lo-ultimo/' },
    { name: 'La Nación', url: 'https://contenidos.lanacion.com.ar/herramientas/rss/origen=2' },
    { name: 'CNN en Español', url: 'http://cnnespanol.cnn.com/feed/' },
];

export const TickerForm = ({ config, onChange }: TickerFormProps) => {
    const sourceType = config.sourceType || 'custom';
    
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Fuente del Ticker</Label>
                <Select 
                    value={sourceType} 
                    onValueChange={(val) => onChange({ ...config, sourceType: val as 'custom' | 'rss' })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="custom"><div className="flex items-center gap-2"><Type className="w-4 h-4 text-indigo-400" /> Texto Personalizado</div></SelectItem>
                        <SelectItem value="rss"><div className="flex items-center gap-2"><Newspaper className="w-4 h-4 text-emerald-400" /> Noticias RSS</div></SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {sourceType === 'custom' ? (
                <div className="space-y-3">
                    <Label className="text-slate-300">Mensaje a mostrar</Label>
                    <Input 
                        value={config.customText || ''} 
                        onChange={(e) => onChange({ ...config, customText: e.target.value })}
                        placeholder="Ej: ¡Oferta especial! 50% de descuento..."
                        className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    <Label className="text-slate-300">URL del Canal RSS</Label>
                    <Input 
                        value={config.rssUrl || ''} 
                        onChange={(e) => onChange({ ...config, rssUrl: e.target.value })}
                        placeholder="Ej: https://www.infobae.com/argentina-rss.xml"
                        className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                        {PREDEFINED_RSS.map((rss) => (
                            <button
                                key={rss.url}
                                onClick={() => onChange({ ...config, rssUrl: rss.url })}
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                            >
                                {rss.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <Label className="text-slate-300">Velocidad</Label>
                    <Select 
                        value={config.speed || 'normal'} 
                        onValueChange={(val) => onChange({ ...config, speed: val as any })}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="slow"><div className="flex items-center gap-2"><Play className="w-3 h-3" /> Lenta</div></SelectItem>
                            <SelectItem value="normal"><div className="flex items-center gap-2"><FastForward className="w-3 h-3" /> Normal</div></SelectItem>
                            <SelectItem value="fast"><div className="flex items-center gap-2"><FastForward className="w-4 h-4" /> Rápida</div></SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label className="text-slate-300">Estilo Visual</Label>
                    <Select 
                        value={config.theme || 'dark'} 
                        onValueChange={(val) => onChange({ ...config, theme: val as any })}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="dark">Fondo Oscuro</SelectItem>
                            <SelectItem value="light">Fondo Claro</SelectItem>
                            <SelectItem value="brand">Corporativo (Color)</SelectItem>
                            <SelectItem value="glass">Cristal (Translúcido)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
};

export const TickerPreview = ({ config }: { config: Partial<TickerConfig>, containerWidth?: number }) => {
    const [newsItems, setNewsItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [sizeType, setSizeType] = useState<'small' | 'normal' | 'large'>('normal');

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const height = entry.contentRect.height;
                let newSize: 'small' | 'normal' | 'large' = 'normal';
                if (height > 0 && height < 80) newSize = 'small';
                else if (height > 150) newSize = 'large';
                
                setSizeType(prev => prev !== newSize ? newSize : prev);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const sourceType = config.sourceType || 'custom';
    
    useEffect(() => {
        if (sourceType === 'custom') {
            setNewsItems([config.customText || 'Escribe tu mensaje aquí...']);
            setLoading(false);
            return;
        }

        const fetchRSS = async () => {
            setLoading(true);
            try {
                const rssUrl = config.rssUrl || PREDEFINED_RSS[0].url;
                // Use rss2json API to easily convert XML RSS to JSON
                const apiEndpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
                
                const res = await fetch(apiEndpoint);
                const data = await res.json();
                
                if (data.status === 'ok') {
                    // Limit items to 12 to avoid massive DOM trees that hurt performance
                    const titles = data.items.slice(0, 12).map((item: any) => item.title);
                    setNewsItems(titles);
                } else {
                    setNewsItems(['Error al cargar las noticias.']);
                }
            } catch (error) {
                console.error("RSS Fetch Error", error);
                setNewsItems(['Error de conexión al cargar noticias.']);
            } finally {
                setLoading(false);
            }
        };

        fetchRSS();
        const interval = setInterval(fetchRSS, 30 * 60 * 1000); // refresh every 30 mins
        return () => clearInterval(interval);
    }, [sourceType, config.rssUrl, config.customText]);

    const speed = config.speed || 'normal';
    const theme = config.theme || 'dark';
    
    let duration = 30; // seconds
    if (speed === 'slow') duration = 50;
    if (speed === 'fast') duration = 15;

    // The more items, the longer it should take to maintain readability
    // We assume 30s is good for ~3 items. If more, we scale duration.
    const itemMultiplier = Math.max(1, newsItems.length / 3);
    const calculatedDuration = duration * itemMultiplier;

    let bgClass = "bg-slate-900 text-slate-100";
    let separatorClass = "text-indigo-400";
    let iconBgClass = "bg-indigo-600";
    let textClass = "font-medium";

    if (theme === 'light') {
        bgClass = "bg-white text-slate-900 shadow-md";
        separatorClass = "text-indigo-600";
    } else if (theme === 'brand') {
        bgClass = "bg-indigo-600 text-white";
        separatorClass = "text-indigo-200";
        iconBgClass = "bg-black/20";
        textClass = "font-bold tracking-wide";
    } else if (theme === 'glass') {
        bgClass = "bg-black/40 backdrop-blur-md text-white border-y border-white/10";
        separatorClass = "text-indigo-300";
        iconBgClass = "bg-indigo-500/80 backdrop-blur-xl";
    }

    // Dynamic sizing based on height
    const isSmall = sizeType === 'small';
    const isLarge = sizeType === 'large';

    return (
        <div ref={containerRef} className={cn("w-full h-full flex items-center overflow-hidden whitespace-nowrap transition-colors duration-500 relative", bgClass)}>
            
            {/* Left static badge */}
            <div className={cn("absolute left-0 top-0 bottom-0 z-20 flex items-center justify-center px-4 md:px-6 shadow-[10px_0_15px_-3px_rgba(0,0,0,0.3)]", iconBgClass)}>
                {sourceType === 'rss' ? (
                    <div className="flex items-center gap-2">
                        <Newspaper className={cn(isSmall ? "w-5 h-5" : isLarge ? "w-10 h-10" : "w-7 h-7", "text-white")} />
                        {!isSmall && <span className={cn("font-bold uppercase tracking-widest text-white ml-2 drop-shadow-md", isLarge ? "text-2xl" : "text-lg")}>Último Momento</span>}
                    </div>
                ) : (
                    <Info className={cn(isSmall ? "w-5 h-5" : isLarge ? "w-10 h-10" : "w-7 h-7", "text-white")} />
                )}
            </div>

            <div className="flex items-center pl-[200px] md:pl-[300px]">
                <div 
                    className="flex items-center will-change-transform"
                    style={{ 
                        animation: `marquee ${calculatedDuration}s linear infinite`,
                    }}
                >
                    {loading ? (
                        <span className={cn(isLarge ? "text-4xl" : isSmall ? "text-xl" : "text-2xl", "opacity-70 px-10")}>Cargando información...</span>
                    ) : (
                        newsItems.map((item, idx) => (
                            <div key={idx} className="flex items-center">
                                <span className={cn("px-8 drop-shadow-sm", textClass, isLarge ? "text-5xl" : isSmall ? "text-xl" : "text-3xl")}>
                                    {item}
                                </span>
                                {idx < newsItems.length - 1 && (
                                    <span className={cn("mx-4 flex items-center justify-center", separatorClass)}>
                                        <div className={cn("rounded-full bg-current", isLarge ? "w-4 h-4" : "w-2 h-2")} />
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                    
                    {/* Duplicate the items for seamless loop */}
                    {!loading && newsItems.length > 0 && (
                        <span className={cn("mx-4 flex items-center justify-center", separatorClass)}>
                            <div className={cn("rounded-full bg-current", isLarge ? "w-4 h-4" : "w-2 h-2")} />
                        </span>
                    )}
                    {!loading && newsItems.map((item, idx) => (
                        <div key={'dup-'+idx} className="flex items-center">
                            <span className={cn("px-8 drop-shadow-sm", textClass, isLarge ? "text-5xl" : isSmall ? "text-xl" : "text-3xl")}>
                                {item}
                            </span>
                            {idx < newsItems.length - 1 && (
                                <span className={cn("mx-4 flex items-center justify-center", separatorClass)}>
                                    <div className={cn("rounded-full bg-current", isLarge ? "w-4 h-4" : "w-2 h-2")} />
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Gradient mask for smooth text disappearance */}
            <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, transparent, ${theme === 'light' ? 'white' : theme === 'brand' ? '#4f46e5' : '#0f172a'})` }}></div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
};
