import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, RefreshCw } from 'lucide-react';

export interface DolarConfig {
    type: 'all' | 'blue' | 'oficial' | 'tarjeta' | 'cripto';
    theme: 'dark' | 'light' | 'emerald';
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
                        <SelectItem value="dark">Modo Oscuro Elegante</SelectItem>
                        <SelectItem value="emerald">Finanzas (Verde/Oscuro)</SelectItem>
                        <SelectItem value="light">Modo Claro</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

export const DolarPreview = ({ config }: { config: Partial<DolarConfig> }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const fetchDolar = async () => {
            try {
                const res = await fetch('https://dolarapi.com/v1/dolares');
                const data = await res.json();
                setQuotes(data);
                setLastUpdate(new Date());
            } catch (error) {
                console.error("Dolar API Error", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDolar();
        // Update every 5 minutes
        const interval = setInterval(fetchDolar, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading || quotes.length === 0) {
        return (
            <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950">
                <RefreshCw className="w-12 h-12 mb-4 opacity-50 animate-spin" />
                <p>Cargando cotizaciones...</p>
            </div>
        );
    }

    const type = config.type || 'all';
    
    // Theme logic
    let bgClass = "bg-slate-900 text-white";
    let cardClass = "bg-slate-800/50 border-slate-700";
    let accentClass = "text-emerald-400";

    if (config.theme === 'light') {
        bgClass = "bg-slate-50 text-slate-900";
        cardClass = "bg-white border-slate-200 shadow-sm";
        accentClass = "text-emerald-600";
    } else if (config.theme === 'emerald') {
        bgClass = "bg-emerald-950 text-emerald-50";
        cardClass = "bg-emerald-900/50 border-emerald-800/50";
        accentClass = "text-emerald-400";
    }

    const formatPrice = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
    };

    // Determine layout type based on size
    const isTicker = dimensions.height > 0 && dimensions.height < 150;
    const isSideColumn = dimensions.width > 0 && dimensions.width < 400 && dimensions.height >= 150;

    const displayQuotes = quotes.filter(q => ['blue', 'oficial', 'tarjeta', 'cripto', 'bolsa'].includes(q.casa));
    const tickerQuotes = type !== 'all' ? [quotes.find(q => q.casa === type) || quotes[0]] : displayQuotes;

    if (isTicker) {
        return (
            <div ref={containerRef} className={`w-full h-full flex items-center overflow-hidden whitespace-nowrap transition-colors duration-500 ${bgClass}`}>
                <div className="animate-[marquee_20s_linear_infinite] flex items-center gap-16 px-4 w-full">
                    {tickerQuotes.map(quote => (
                        <div key={quote.casa} className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <DollarSign className={`w-6 h-6 ${accentClass}`} />
                                <span className="text-xl font-bold tracking-wider">{quote.nombre}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="opacity-70">C:</span>
                                <span className="text-2xl font-black">{formatPrice(quote.compra)}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="opacity-70">V:</span>
                                <span className="text-2xl font-black">{formatPrice(quote.venta)}</span>
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

    if (isSideColumn) {
        if (type !== 'all') {
            const quote = quotes.find(q => q.casa === type) || quotes[0];
            return (
                <div ref={containerRef} className={`w-full h-full p-6 flex flex-col items-center justify-center relative transition-colors duration-500 ${bgClass}`}>
                    <h2 className="text-2xl font-light opacity-90 mb-8 text-center">Dólar {quote.nombre}</h2>
                    
                    <div className="flex flex-col gap-8 w-full max-w-sm px-4">
                        <div className="flex flex-col items-center">
                            <span className="text-sm opacity-60 uppercase tracking-widest mb-2">Compra</span>
                            <div className={`text-5xl font-bold tracking-tighter ${accentClass}`}>
                                {formatPrice(quote.compra)}
                            </div>
                        </div>
                        <div className="w-full h-px bg-current opacity-20"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm opacity-60 uppercase tracking-widest mb-2">Venta</span>
                            <div className={`text-5xl font-bold tracking-tighter ${accentClass}`}>
                                {formatPrice(quote.venta)}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div ref={containerRef} className={`w-full h-full p-6 flex flex-col transition-colors duration-500 overflow-y-auto ${bgClass} scrollbar-hide`}>
                <div className="flex items-center gap-2 mb-6 opacity-80 border-b border-current pb-3 border-opacity-20">
                    <DollarSign className={`w-5 h-5 ${accentClass}`} />
                    <h2 className="text-xl font-light tracking-wider">Mercado</h2>
                </div>

                <div className="flex flex-col gap-4">
                    {displayQuotes.map(quote => (
                        <div key={quote.casa} className={`p-4 rounded-xl border ${cardClass} flex flex-col gap-3`}>
                            <h3 className="text-lg font-medium opacity-90">{quote.nombre}</h3>
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] uppercase tracking-wider opacity-50 block mb-1">Compra</span>
                                    <span className={`text-lg font-bold ${accentClass}`}>{formatPrice(quote.compra)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase tracking-wider opacity-50 block mb-1">Venta</span>
                                    <span className={`text-lg font-bold ${accentClass}`}>{formatPrice(quote.venta)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Single quote view (Pantalla Completa)
    if (type !== 'all') {
        const quote = quotes.find(q => q.casa === type) || quotes[0];
        
        return (
            <div ref={containerRef} className={`w-full h-full p-8 flex flex-col items-center justify-center relative transition-colors duration-500 ${bgClass}`}>
                <div className="absolute top-8 left-8 flex items-center gap-2 opacity-60">
                    <DollarSign className="w-6 h-6" />
                    <span className="font-semibold tracking-wider uppercase text-sm">Cotización en vivo</span>
                </div>
                
                <h2 className="text-4xl md:text-6xl font-light opacity-90 mb-12 text-center">Dólar {quote.nombre}</h2>
                
                <div className="flex flex-col md:flex-row items-center gap-10 md:gap-32 w-full max-w-4xl px-8">
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-lg md:text-xl opacity-60 uppercase tracking-widest mb-4">Compra</span>
                        <div className={`text-6xl md:text-8xl font-bold tracking-tighter ${accentClass}`}>
                            {formatPrice(quote.compra)}
                        </div>
                    </div>
                    <div className="w-full md:w-px h-px md:h-32 bg-current opacity-20 hidden md:block"></div>
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-lg md:text-xl opacity-60 uppercase tracking-widest mb-4">Venta</span>
                        <div className={`text-6xl md:text-8xl font-bold tracking-tighter ${accentClass}`}>
                            {formatPrice(quote.venta)}
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-8 right-8 text-sm opacity-50 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Actualizado: {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        );
    }

    // Multiple quotes view (Resumen)
    return (
        <div ref={containerRef} className={`w-full h-full p-8 flex flex-col transition-colors duration-500 ${bgClass} overflow-y-auto scrollbar-hide`}>
            <div className="flex items-center justify-between mb-8 opacity-80 border-b border-current pb-4 border-opacity-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className={`w-6 h-6 ${accentClass}`} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-light tracking-wider">Mercado Cambiario</h2>
                </div>
                <div className="text-xs md:text-sm opacity-60">
                    {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 content-start">
                {displayQuotes.map(quote => (
                    <div key={quote.casa} className={`p-5 md:p-6 rounded-2xl border ${cardClass} flex flex-col`}>
                        <h3 className="text-lg md:text-xl font-medium mb-4 md:mb-6 opacity-90">{quote.nombre}</h3>
                        <div className="flex justify-between items-end mt-auto">
                            <div>
                                <span className="text-[10px] md:text-xs uppercase tracking-wider opacity-50 block mb-1">Compra</span>
                                <span className={`text-xl md:text-2xl font-bold ${accentClass}`}>{formatPrice(quote.compra)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] md:text-xs uppercase tracking-wider opacity-50 block mb-1">Venta</span>
                                <span className={`text-xl md:text-2xl font-bold ${accentClass}`}>{formatPrice(quote.venta)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
