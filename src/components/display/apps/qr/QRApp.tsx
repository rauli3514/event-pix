import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

export interface QRConfig {
    value: string;
    title: string;
    subtitle: string;
    theme: 'dark' | 'light' | 'glass' | 'corporate';
    qrColor: string;
    qrBgColor: string;
}

interface QRFormProps {
    config: Partial<QRConfig>;
    onChange: (config: Partial<QRConfig>) => void;
}

export const QRForm = ({ config, onChange }: QRFormProps) => {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Contenido del QR (URL o Texto)</Label>
                <Input
                    className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-indigo-500"
                    placeholder="ej: https://tupagina.com o WIFI:T:WPA;S:Red;P:123;;"
                    value={config.value || ''}
                    onChange={(e) => onChange({ ...config, value: e.target.value })}
                />
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Título Principal</Label>
                <Input
                    className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-indigo-500"
                    placeholder="ej: ¡Escanea nuestro Menú!"
                    value={config.title || ''}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                />
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Subtítulo (Opcional)</Label>
                <Input
                    className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-indigo-500"
                    placeholder="ej: Y obtén un 10% de descuento"
                    value={config.subtitle || ''}
                    onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
                />
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Tema Visual</Label>
                <Select 
                    value={config.theme || 'glass'} 
                    onValueChange={(val) => {
                        const theme = val as any;
                        let qrColor = '#ffffff';
                        let qrBgColor = 'transparent';
                        
                        if (theme === 'light') { qrColor = '#000000'; }
                        if (theme === 'corporate') { qrColor = '#1e3a8a'; }
                        
                        onChange({ ...config, theme, qrColor, qrBgColor });
                    }}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona un tema" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="glass">Premium Glassmorphism</SelectItem>
                        <SelectItem value="dark">Modo Oscuro</SelectItem>
                        <SelectItem value="light">Modo Claro</SelectItem>
                        <SelectItem value="corporate">Corporativo (Azul/Blanco)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <Label className="text-slate-300">Color del QR</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="color"
                            className="w-12 h-10 p-1 bg-slate-950 border-slate-800 cursor-pointer rounded"
                            value={config.qrColor || '#ffffff'}
                            onChange={(e) => onChange({ ...config, qrColor: e.target.value })}
                        />
                        <Input
                            className="bg-slate-950 border-slate-800 text-slate-200"
                            value={config.qrColor || '#ffffff'}
                            onChange={(e) => onChange({ ...config, qrColor: e.target.value })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const QRPreview = ({ config, containerWidth: extContainerWidth }: { config: Partial<QRConfig>, containerWidth?: number, mode?: 'main' | 'column' | 'square' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

    const theme = config.theme || 'glass';
    const title = config.title || 'Escanea aquí';
    const subtitle = config.subtitle || '';
    const value = config.value || 'https://eventpix.com';
    const qrColor = config.qrColor || (theme === 'light' || theme === 'corporate' ? '#000000' : '#ffffff');
    const qrBgColor = config.qrBgColor || 'transparent';

    // Theme Styles
    const getThemeStyles = () => {
        switch (theme) {
            case 'dark': return 'bg-[#0f172a] text-white';
            case 'light': return 'bg-slate-50 text-slate-900';
            case 'corporate': return 'bg-white text-blue-900 border-b-8 border-blue-900';
            case 'glass':
            default: return 'bg-gradient-to-br from-indigo-900/40 to-cyan-900/40 backdrop-blur-xl text-white border border-white/10';
        }
    };

    const width = extContainerWidth || dimensions.width;
    const isSmall = width > 0 && width < 350;
    const isMedium = width >= 350 && width < 700;

    const qrSize = isSmall ? 150 : isMedium ? 250 : 400;

    return (
        <div ref={containerRef} className={cn("w-full h-full flex flex-col items-center justify-center p-8 transition-all overflow-hidden relative", getThemeStyles())}>
            
            {theme === 'glass' && (
                <>
                    <div className="absolute top-[10%] left-[-10%] w-3/4 h-3/4 bg-blue-500/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-3/4 h-3/4 bg-cyan-500/20 rounded-full blur-[100px]" />
                </>
            )}

            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full gap-6 lg:gap-12 text-center">
                
                <div className="space-y-2 lg:space-y-4">
                    <h2 className={cn(
                        "font-bold tracking-tight leading-tight",
                        theme === 'glass' ? 'drop-shadow-lg' : ''
                    )}
                    style={{ fontSize: isSmall ? '1.5rem' : isMedium ? '2.5rem' : '4rem' }}
                    >
                        {title}
                    </h2>
                    
                    {subtitle && (
                        <p className={cn(
                            "font-medium",
                            theme === 'glass' ? 'text-white/80' : 
                            theme === 'corporate' ? 'text-blue-700' : 'opacity-80'
                        )}
                        style={{ fontSize: isSmall ? '0.875rem' : isMedium ? '1.25rem' : '2rem' }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className={cn(
                    "relative flex items-center justify-center transition-all",
                    theme === 'glass' ? 'p-4 lg:p-8 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)]' :
                    theme === 'dark' ? 'p-4 lg:p-8 bg-slate-800 rounded-3xl border border-slate-700' :
                    theme === 'light' || theme === 'corporate' ? 'p-4 lg:p-8 bg-white rounded-3xl shadow-xl border border-slate-100' : ''
                )}>
                    <QRCodeSVG 
                        value={value} 
                        size={qrSize} 
                        fgColor={qrColor} 
                        bgColor={qrBgColor} 
                        level="H"
                        includeMargin={false}
                    />
                </div>
            </div>
        </div>
    );
};
