import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DolarConfig {
    type: 'all' | 'blue' | 'oficial' | 'tarjeta' | 'cripto';
    theme: 'dark' | 'light' | 'emerald' | 'glass';
}

interface DolarFormProps {
    config: Partial<DolarConfig>;
    onChange: (config: Partial<DolarConfig>) => void;
}

export const DolarForm = ({ config, onChange }: DolarFormProps) => {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Tipo de Cotización</Label>
                <Select 
                    value={config.type || 'all'} 
                    onValueChange={(val) => onChange({ ...config, type: val as any })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="all">Múltiples Cotizaciones (Resumen)</SelectItem>
                        <SelectItem value="blue">Dólar Blue (Pantalla Completa)</SelectItem>
                        <SelectItem value="oficial">Dólar Oficial (Pantalla Completa)</SelectItem>
                        <SelectItem value="tarjeta">Dólar Tarjeta (Pantalla Completa)</SelectItem>
                        <SelectItem value="cripto">Dólar Cripto (Pantalla Completa)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Tema Visual</Label>
                <Select 
                    value={config.theme || 'dark'} 
                    onValueChange={(val) => onChange({ ...config, theme: val as any })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona un tema" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="glass">Premium Glassmorphism</SelectItem>
                        <SelectItem value="dark">Modo Oscuro Elegante</SelectItem>
                        <SelectItem value="emerald">Finanzas (Verde/Oscuro)</SelectItem>
                        <SelectItem value="light">Modo Claro</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

export const DolarPreview = ({ config, containerWidth: extContainerWidth, mode = 'main' }: { config: Partial<DolarConfig>, containerWidth?: number, mode?: 'main' | 'column' | 'square' }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerEl) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerEl);
        return () => observer.disconnect();
    }, [containerEl]);

    useEffect(() => {
        const CACHE = 'dolar_cache';
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        // Última cotización guardada: si arranca sin internet muestra esa (hasta 24 h).
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
            if (cached && Date.now() - cached.at < 24 * 3600_000 && Array.isArray(cached.quotes) && cached.quotes.length) {
                setQuotes(cached.quotes);
                setLastUpdate(new Date(cached.at));
                setLoading(false);
            }
        } catch {
            // sin caché
        }

        const fetchDolar = async () => {
            let ok = false;
            try {
                const res = await fetch('https://dolarapi.com/v1/dolares');
                const data = await res.json();
                // Una respuesta de error no es una lista: antes rompía la app (pantalla negra).
                if (!res.ok || !Array.isArray(data) || data.length === 0) throw new Error(`HTTP ${res.status}`);
                if (cancelled) return;
                setQuotes(data);
                setLastUpdate(new Date());
                ok = true;
                try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), quotes: data })); } catch { /* sin espacio */ }
            } catch (error) {
                console.error("Dolar API Error", error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    // Cada 5 min; si falló, se reintenta al minuto.
                    timer = setTimeout(fetchDolar, ok ? 5 * 60_000 : 60_000);
                }
            }
        };

        fetchDolar();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, []);

    if (quotes.length === 0) {
        return (
            <div ref={setContainerEl} className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950">
                <RefreshCw className="w-12 h-12 mb-4 opacity-50 animate-spin" />
                <p>{loading ? 'Cargando cotizaciones...' : 'Sin conexión con el servicio de cotizaciones'}</p>
            </div>
        );
    }

    const type = config.type || 'all';
    const theme = config.theme || 'glass';
    
    // JS based responsiveness
    const actualWidth = extContainerWidth || dimensions.width || 1024;
    const isLg = actualWidth >= 1024;
    
    // Determine layout type based on size or mode
    const isTicker = dimensions.height > 0 && dimensions.height < 150;
    const isPortrait = dimensions.width > 0 && dimensions.height > dimensions.width * 1.2;
    const isColumn = mode === 'column' || (dimensions.width > 0 && dimensions.height >= 150 && (dimensions.width < 400 || isPortrait));

    const displayQuotes = quotes.filter(q => ['blue', 'oficial', 'tarjeta', 'cripto', 'bolsa'].includes(q.casa));
    const tickerQuotes = type !== 'all' ? [quotes.find(q => q.casa === type) || quotes[0]] : displayQuotes;

    const formatPrice = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
    };

    // Theme logic
    let bgStyle = "bg-slate-900 text-white";
    let cardStyle = "bg-slate-800/50 border-slate-700";
    let accentClass = "text-emerald-400";
    let bgImage = "";

    if (theme === 'light') {
        bgStyle = "bg-slate-50 text-slate-900";
        cardStyle = "bg-white border-slate-200 shadow-sm";
        accentClass = "text-emerald-600";
    } else if (theme === 'emerald') {
        bgStyle = "bg-emerald-950 text-emerald-50";
        cardStyle = "bg-emerald-900/50 border-emerald-800/50";
        accentClass = "text-emerald-400";
    } else if (theme === 'glass') {
        bgStyle = 'text-white bg-slate-900';
        bgImage = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1920&q=80'; // Wall street / finance abstract
        cardStyle = 'bg-black/40 backdrop-blur-xl border border-white/20 shadow-xl';
        accentClass = "text-emerald-400 drop-shadow-md";
    }

    if (isTicker) {
        return (
            <div ref={setContainerEl} className={cn("w-full h-full flex items-center overflow-hidden whitespace-nowrap transition-colors duration-500 relative", bgStyle)}>
                {bgImage && (
                    <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 z-0 opacity-50" style={{ backgroundImage: `url(${bgImage})` }} />
                )}
                <div className="animate-[marquee_20s_linear_infinite] flex items-center gap-16 px-4 w-full relative z-10">
                    {tickerQuotes.map(quote => (
                        <div key={quote.casa} className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <DollarSign className={`w-6 h-6 ${accentClass}`} />
                                <span className="text-xl font-bold tracking-wider drop-shadow-md">{quote.nombre}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="opacity-70 font-medium">COMPRA:</span>
                                <span className="text-2xl font-black drop-shadow-lg">{formatPrice(quote.compra)}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="opacity-70 font-medium">VENTA:</span>
                                <span className="text-2xl font-black drop-shadow-lg">{formatPrice(quote.venta)}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <style>{`
                    @keyframes marquee {
                        0% { transform: translateX(100%); }
                        100% { transform: translateX(-100%); }
                    }
                `}</style>
            </div>
        );
    }

    if (isColumn) {
        if (type !== 'all') {
            const quote = quotes.find(q => q.casa === type) || quotes[0];
            return (
                <div ref={setContainerEl} className={cn("w-full h-full p-6 flex flex-col items-center justify-center relative transition-colors duration-500 overflow-hidden", bgStyle)}>
                    {bgImage && (
                        <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 z-0 opacity-80" style={{ backgroundImage: `url(${bgImage})` }} />
                    )}
                    <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
                        <div className="flex items-center gap-2 mb-8">
                            <DollarSign className={`w-8 h-8 ${accentClass}`} />
                            <h2 className="text-3xl font-light opacity-90 text-center drop-shadow-lg">Dólar {quote.nombre}</h2>
                        </div>
                        
                        <div className={cn("flex flex-col gap-6 w-full max-w-sm px-6 py-8 rounded-3xl", cardStyle)}>
                            <div className="flex flex-col items-center text-center">
                                <span className="text-sm opacity-70 uppercase tracking-widest mb-1 font-semibold">Compra</span>
                                <div className={cn("text-5xl font-black tracking-tighter drop-shadow-xl", accentClass)}>
                                    {formatPrice(quote.compra)}
                                </div>
                            </div>
                            <div className="w-full h-px bg-current opacity-20 my-2"></div>
                            <div className="flex flex-col items-center text-center">
                                <span className="text-sm opacity-70 uppercase tracking-widest mb-1 font-semibold">Venta</span>
                                <div className={cn("text-5xl font-black tracking-tighter drop-shadow-xl", accentClass)}>
                                    {formatPrice(quote.venta)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div ref={setContainerEl} className={cn("w-full h-full p-6 flex flex-col relative transition-colors duration-500 overflow-hidden", bgStyle)}>
                {bgImage && (
                    <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 z-0 opacity-80" style={{ backgroundImage: `url(${bgImage})` }} />
                )}
                <div className="relative z-10 flex flex-col h-full min-h-0">
                    <div className="flex items-center gap-2 mb-4 opacity-90 pb-2 drop-shadow-md">
                        <DollarSign className={`w-6 h-6 ${accentClass}`} />
                        <h2 className="text-2xl font-light tracking-wider">Mercado</h2>
                    </div>

                    {/* Las tarjetas se reparten el alto: en la TV no se puede deslizar. */}
                    <div className="flex flex-col gap-3 flex-1 min-h-0">
                        {/* Solo las que entran (cada tarjeta necesita ~70 px): en una zona
                            chica se encimaban. Primero oficial y blue. */}
                        {displayQuotes.slice(0, Math.max(1, Math.floor((dimensions.height - 50) / 70))).map(quote => (
                            <div key={quote.casa} className={cn("px-4 py-2 rounded-2xl flex flex-col justify-center gap-1 flex-1 min-h-0 max-h-40", cardStyle)}>
                                <h3 className="text-lg font-medium opacity-90 drop-shadow-md">{quote.nombre}</h3>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] uppercase tracking-wider opacity-70 block mb-1 font-semibold">Compra</span>
                                        <span className={cn("text-xl font-bold drop-shadow-lg", accentClass)}>{formatPrice(quote.compra)}</span>
                                    </div>
                                    <div className="w-px h-8 bg-current opacity-20 mx-2"></div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase tracking-wider opacity-70 block mb-1 font-semibold">Venta</span>
                                        <span className={cn("text-xl font-bold drop-shadow-lg", accentClass)}>{formatPrice(quote.venta)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // MAIN VIEW: Render responsive premium layout
    if (type !== 'all') {
        const quote = quotes.find(q => q.casa === type) || quotes[0];
        
        return (
            <div ref={setContainerEl} className={cn("w-full h-full flex flex-col relative transition-colors duration-500 overflow-hidden", bgStyle)}>
                {bgImage && (
                    <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 z-0 opacity-90" style={{ backgroundImage: `url(${bgImage})` }} />
                )}
                
                <div className={cn("relative z-10 flex flex-col w-full h-full", isLg ? "p-12" : "p-6")}>
                    <div className="flex items-center justify-between opacity-80 mb-8 drop-shadow-md">
                        <div className="flex items-center gap-3">
                            <div className={cn("flex items-center justify-center rounded-full bg-emerald-500/20 backdrop-blur-md", isLg ? "w-12 h-12" : "w-10 h-10")}>
                                <DollarSign className={cn(accentClass, isLg ? "w-7 h-7" : "w-6 h-6")} />
                            </div>
                            <span className={cn("font-medium tracking-widest uppercase", isLg ? "text-lg" : "text-sm")}>Cotización Oficial</span>
                        </div>
                        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                            <RefreshCw className="w-4 h-4 opacity-70" />
                            <span className={cn("font-mono", isLg ? "text-sm" : "text-xs")}>{lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center items-center">
                        <h2 className={cn("font-light opacity-90 text-center drop-shadow-xl mb-12", isLg ? "text-7xl" : "text-5xl")}>Dólar {quote.nombre}</h2>
                        
                        <div className={cn("flex w-full items-center justify-center gap-6", isLg ? "flex-row max-w-5xl" : "flex-col max-w-sm")}>
                            <div className={cn("flex-1 flex flex-col items-center justify-center rounded-3xl w-full", isLg ? "p-12" : "p-8", cardStyle)}>
                                <span className={cn("opacity-70 uppercase tracking-widest mb-4 font-semibold", isLg ? "text-xl" : "text-sm")}>Compra</span>
                                <div className={cn("font-black tracking-tighter drop-shadow-2xl", accentClass)} style={{ fontSize: Math.max(3, actualWidth / (isLg ? 150 : 100)) + 'rem', lineHeight: 1 }}>
                                    {formatPrice(quote.compra)}
                                </div>
                            </div>
                            
                            <div className={cn("flex items-center justify-center opacity-40", isLg ? "w-16" : "h-12")}>
                                <ArrowRightLeft className={cn("opacity-50", isLg ? "w-12 h-12" : "w-8 h-8 rotate-90")} />
                            </div>
                            
                            <div className={cn("flex-1 flex flex-col items-center justify-center rounded-3xl w-full", isLg ? "p-12" : "p-8", cardStyle)}>
                                <span className={cn("opacity-70 uppercase tracking-widest mb-4 font-semibold", isLg ? "text-xl" : "text-sm")}>Venta</span>
                                <div className={cn("font-black tracking-tighter drop-shadow-2xl", accentClass)} style={{ fontSize: Math.max(3, actualWidth / (isLg ? 150 : 100)) + 'rem', lineHeight: 1 }}>
                                    {formatPrice(quote.venta)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // MAIN VIEW: Multiple quotes (Resumen)
    return (
        <div ref={setContainerEl} className={cn("w-full h-full flex flex-col relative transition-colors duration-500 overflow-y-auto scrollbar-hide", bgStyle)}>
            {bgImage && (
                <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 z-0 opacity-90" style={{ backgroundImage: `url(${bgImage})` }} />
            )}
            
            <div className={cn("relative z-10 flex flex-col min-h-full", isLg ? "p-12" : "p-6")}>
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <div className="flex items-center gap-4">
                        <div className={cn("flex items-center justify-center rounded-full bg-emerald-500/20 backdrop-blur-md shadow-inner", isLg ? "w-16 h-16" : "w-12 h-12")}>
                            <DollarSign className={cn(accentClass, isLg ? "w-8 h-8" : "w-6 h-6")} />
                        </div>
                        <div>
                            <h2 className={cn("font-light tracking-wider drop-shadow-lg", isLg ? "text-5xl" : "text-3xl")}>Mercado Cambiario</h2>
                            <p className={cn("opacity-60 mt-1 font-medium", isLg ? "text-lg" : "text-sm")}>Cotizaciones en Argentina</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 self-start md:self-auto">
                        <RefreshCw className="w-4 h-4 opacity-70" />
                        <span className={cn("font-mono font-medium", isLg ? "text-sm" : "text-xs")}>{lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                <div className={cn("grid gap-6 flex-1 content-start", isLg ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
                    {displayQuotes.map((quote) => {
                        return (
                            <div key={quote.casa} className={cn("rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl", cardStyle)}>
                                <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <DollarSign className="w-16 h-16" />
                                </div>
                                <h3 className={cn("font-medium opacity-90 drop-shadow-md mb-8", isLg ? "text-2xl" : "text-xl")}>{quote.nombre}</h3>
                                
                                <div className="flex justify-between items-end mt-auto relative z-10">
                                    <div>
                                        <span className={cn("uppercase tracking-wider opacity-60 block mb-2 font-semibold", isLg ? "text-sm" : "text-xs")}>Compra</span>
                                        <span className={cn("font-black drop-shadow-lg", accentClass, isLg ? "text-4xl" : "text-3xl")}>{formatPrice(quote.compra)}</span>
                                    </div>
                                    <div className="w-px h-12 bg-current opacity-20 mx-4 hidden xs:block"></div>
                                    <div className="text-right">
                                        <span className={cn("uppercase tracking-wider opacity-60 block mb-2 font-semibold", isLg ? "text-sm" : "text-xs")}>Venta</span>
                                        <span className={cn("font-black drop-shadow-lg", accentClass, isLg ? "text-4xl" : "text-3xl")}>{formatPrice(quote.venta)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
