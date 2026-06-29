import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Star, Plus, Trash2, Quote } from 'lucide-react';

export interface Review {
    id: string;
    author: string;
    text: string;
    rating: number;
}

export interface ReviewsConfig {
    reviews: Review[];
    theme: 'dark' | 'light' | 'glass' | 'google';
    speed: 'slow' | 'normal' | 'fast';
    title: string;
}

interface ReviewsFormProps {
    config: Partial<ReviewsConfig>;
    onChange: (config: Partial<ReviewsConfig>) => void;
}

export const ReviewsForm = ({ config, onChange }: ReviewsFormProps) => {
    const reviews = config.reviews || [];

    const addReview = () => {
        const newReview: Review = {
            id: Math.random().toString(36).substring(7),
            author: 'Nuevo Cliente',
            text: '¡Excelente servicio, muy recomendado!',
            rating: 5
        };
        onChange({ ...config, reviews: [...reviews, newReview] });
    };

    const updateReview = (id: string, field: keyof Review, value: any) => {
        const updated = reviews.map(r => r.id === id ? { ...r, [field]: value } : r);
        onChange({ ...config, reviews: updated });
    };

    const removeReview = (id: string) => {
        onChange({ ...config, reviews: reviews.filter(r => r.id !== id) });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Título de la sección</Label>
                <Input
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    placeholder="ej: Lo que dicen nuestros clientes"
                    value={config.title || ''}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <Label className="text-slate-300">Tema Visual</Label>
                    <Select 
                        value={config.theme || 'glass'} 
                        onValueChange={(val) => onChange({ ...config, theme: val as any })}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue placeholder="Tema" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="glass">Premium Glassmorphism</SelectItem>
                            <SelectItem value="dark">Modo Oscuro</SelectItem>
                            <SelectItem value="light">Modo Claro</SelectItem>
                            <SelectItem value="google">Estilo Google Maps</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label className="text-slate-300">Velocidad de rotación</Label>
                    <Select 
                        value={config.speed || 'normal'} 
                        onValueChange={(val) => onChange({ ...config, speed: val as any })}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue placeholder="Velocidad" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="slow">Lenta (10s)</SelectItem>
                            <SelectItem value="normal">Normal (6s)</SelectItem>
                            <SelectItem value="fast">Rápida (4s)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Reseñas Destacadas</Label>
                    <Button onClick={addReview} size="sm" variant="outline" className="h-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200">
                        <Plus className="w-4 h-4 mr-2" /> Añadir
                    </Button>
                </div>

                {reviews.length === 0 && (
                    <div className="p-4 text-center border border-dashed rounded-lg border-slate-800 bg-slate-900/50 text-slate-500 text-sm">
                        No has añadido ninguna reseña aún.
                    </div>
                )}

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {reviews.map((review, i) => (
                        <div key={review.id} className="p-4 space-y-3 bg-slate-900 border border-slate-800 rounded-xl">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 w-5">{i + 1}.</span>
                                <Input
                                    className="h-8 bg-slate-950 border-slate-800 text-slate-200 flex-1"
                                    placeholder="Nombre del autor"
                                    value={review.author}
                                    onChange={(e) => updateReview(review.id, 'author', e.target.value)}
                                />
                                <Select 
                                    value={review.rating.toString()} 
                                    onValueChange={(val) => updateReview(review.id, 'rating', parseInt(val))}
                                >
                                    <SelectTrigger className="w-[80px] h-8 bg-slate-950 border-slate-800 text-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 min-w-[80px]">
                                        {[5,4,3,2,1].map(num => (
                                            <SelectItem key={num} value={num.toString()}>
                                                {num} ⭐
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button onClick={() => removeReview(review.id)} size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <Textarea
                                className="resize-none bg-slate-950 border-slate-800 text-slate-200 text-sm h-20"
                                placeholder="Escribe la reseña aquí..."
                                value={review.text}
                                onChange={(e) => updateReview(review.id, 'text', e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const ReviewsPreview = ({ config, containerWidth: extContainerWidth }: { config: Partial<ReviewsConfig>, containerWidth?: number, mode?: 'main' | 'column' | 'square' }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const theme = config.theme || 'glass';
    const speed = config.speed || 'normal';
    const title = config.title || 'Nuestros clientes dicen...';
    
    // Default reviews if empty to show something in preview
    const reviews = config.reviews && config.reviews.length > 0 ? config.reviews : [
        { id: '1', author: 'María López', text: 'El mejor lugar al que he ido. La atención es impecable y los detalles marcan la diferencia.', rating: 5 },
        { id: '2', author: 'Juan Carlos', text: 'Muy buena experiencia, 100% recomendado.', rating: 5 },
        { id: '3', author: 'Ana Martínez', text: 'Hermoso ambiente y excelente servicio. Sin dudas volveremos muy pronto.', rating: 4 }
    ];

    useLayoutEffect(() => {
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

    useEffect(() => {
        if (reviews.length <= 1) return;
        
        let intervalMs = 6000; // normal
        if (speed === 'slow') intervalMs = 10000;
        if (speed === 'fast') intervalMs = 4000;

        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % reviews.length);
        }, intervalMs);

        return () => clearInterval(interval);
    }, [reviews.length, speed]);

    // Theme Styles
    const getThemeStyles = () => {
        switch (theme) {
            case 'dark': return 'bg-[#0f172a] text-white';
            case 'light': return 'bg-slate-50 text-slate-900';
            case 'google': return 'bg-white text-slate-800 border-t-4 border-blue-500';
            case 'glass':
            default: return 'bg-gradient-to-br from-indigo-900/40 to-emerald-900/40 backdrop-blur-xl text-white border border-white/10';
        }
    };

    const width = extContainerWidth || dimensions.width || 100;
    const height = dimensions.height || 100;
    const minDimension = Math.min(width, height);
    
    const isSmall = minDimension > 0 && minDimension < 400;
    const isMedium = minDimension >= 400 && minDimension < 700;

    const currentReview = reviews[currentIndex];

    if (!currentReview) return null;

    return (
        <div ref={containerRef} className={cn("w-full h-full flex flex-col items-center justify-center p-8 transition-all overflow-hidden relative", getThemeStyles())}>
            
            {theme === 'glass' && (
                <>
                    <div className="absolute top-[10%] right-[-10%] w-3/4 h-3/4 bg-indigo-500/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-3/4 h-3/4 bg-emerald-500/20 rounded-full blur-[100px]" />
                </>
            )}

            <div className="relative z-10 w-full h-full max-w-5xl flex flex-col items-center justify-center gap-8 lg:gap-16">
                
                {title && (
                    <h2 className={cn(
                        "font-bold tracking-tight text-center",
                        theme === 'glass' ? 'text-white drop-shadow-md' : '',
                        theme === 'google' ? 'text-slate-800' : ''
                    )}
                    style={{ fontSize: isSmall ? '1.5rem' : isMedium ? '2rem' : '3.5rem' }}
                    >
                        {title}
                    </h2>
                )}

                <div className="relative w-full flex items-center justify-center h-full max-h-[60%]">
                    {/* Render all reviews but visually hide non-current for a smooth fade effect */}
                    {reviews.map((review, idx) => {
                        const isActive = idx === currentIndex;
                        return (
                            <div 
                                key={review.id}
                                className={cn(
                                    "absolute inset-0 flex flex-col items-center justify-center text-center transition-all duration-1000",
                                    isActive ? 'opacity-100 scale-100 translate-y-0 z-10' : 'opacity-0 scale-95 translate-y-8 z-0 pointer-events-none',
                                    theme === 'glass' ? 'p-8 lg:p-12 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl' :
                                    theme === 'dark' ? 'p-8 lg:p-12 bg-slate-800/80 rounded-3xl border border-slate-700' :
                                    theme === 'light' ? 'p-8 lg:p-12 bg-white rounded-3xl shadow-xl' :
                                    'p-8 lg:p-12 bg-white rounded-2xl shadow-lg border border-slate-100' // google
                                )}
                            >
                                <Quote className={cn(
                                    "absolute top-6 left-6 lg:top-10 lg:left-10 opacity-20",
                                    theme === 'google' ? 'text-blue-500' : 'text-current'
                                )} style={{ width: isSmall ? 32 : 64, height: isSmall ? 32 : 64 }} />

                                <div className="flex gap-1 lg:gap-2 mb-6">
                                    {[...Array(5)].map((_, i) => (
                                        <Star 
                                            key={i} 
                                            className={cn(
                                                i < review.rating ? 
                                                    (theme === 'google' ? 'text-orange-400 fill-orange-400' : 'text-yellow-400 fill-yellow-400') 
                                                    : 'text-slate-300'
                                            )} 
                                            style={{ width: isSmall ? 24 : 40, height: isSmall ? 24 : 40 }}
                                        />
                                    ))}
                                </div>

                                <p className={cn(
                                    "font-medium italic leading-relaxed mb-8 max-w-4xl",
                                    theme === 'google' ? 'text-slate-700' : ''
                                )}
                                style={{ fontSize: isSmall ? '1rem' : isMedium ? '1.5rem' : '2.25rem' }}
                                >
                                    "{review.text}"
                                </p>

                                <div className="flex items-center gap-4 mt-auto">
                                    <div className={cn(
                                        "rounded-full flex items-center justify-center font-bold text-xl uppercase",
                                        theme === 'google' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200/20 text-current'
                                    )}
                                    style={{ width: isSmall ? 40 : 64, height: isSmall ? 40 : 64, fontSize: isSmall ? '1.2rem' : '1.8rem' }}>
                                        {review.author.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold" style={{ fontSize: isSmall ? '1rem' : '1.5rem' }}>
                                            {review.author}
                                        </div>
                                        {theme === 'google' && (
                                            <div className="text-slate-500 flex items-center gap-1 text-sm lg:text-base">
                                                <span>Reseña de Google</span>
                                            </div>
                                        )}
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
