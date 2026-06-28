import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutTemplate } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DisplayMedia } from '@/types/display';
import { MediaPickerModal } from '../../MediaPickerModal';
import { WeatherPreview } from '../weather/WeatherApp';
import { DolarPreview } from '../dolar/DolarApp';
import { cn } from '@/lib/utils';

export interface SplitZone {
    id: string;
    name: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    w: number; // percentage 0-100
    h: number; // percentage 0-100
    color?: string; // Hex color for the empty state preview
    mediaId?: string;
    mediaObj?: DisplayMedia; // For preview rendering
}

export interface SplitScreenConfig {
    templateId: string;
    orientation: 'landscape' | 'portrait';
    zones: SplitZone[];
}

const BRAND_BLUE = '#1ea8eb';
const BRAND_ORANGE = '#f99d1c';
const BRAND_GREEN = '#10b981';
const BRAND_PURPLE = '#8b5cf6';

const TEMPLATES = [
    {
        id: '1main_1ticker',
        name: '1 Main + 1 Ticker',
        orientation: 'landscape',
        zones: [
            { id: 'main', name: 'Main', x: 0, y: 0, w: 100, h: 85, color: BRAND_BLUE, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 85, w: 100, h: 15, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '2mains',
        name: '2 Mains',
        orientation: 'landscape',
        zones: [
            { id: 'main_left', name: 'Main Left', x: 0, y: 0, w: 70, h: 100, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_right', name: 'Main Right', x: 70, y: 0, w: 30, h: 100, color: BRAND_GREEN, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '2mains_1ticker',
        name: '2 Mains + 1 Ticker',
        orientation: 'landscape',
        zones: [
            { id: 'main_left', name: 'Main Left', x: 0, y: 0, w: 70, h: 85, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_right', name: 'Main Right', x: 70, y: 0, w: 30, h: 85, color: BRAND_GREEN, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 85, w: 100, h: 15, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '4splits',
        name: '4 Splits',
        orientation: 'landscape',
        zones: [
            { id: 'top_left', name: 'Top Left', x: 0, y: 0, w: 50, h: 50, color: BRAND_BLUE, mediaId: undefined },
            { id: 'top_right', name: 'Top Right', x: 50, y: 0, w: 50, h: 50, color: BRAND_GREEN, mediaId: undefined },
            { id: 'bottom_left', name: 'Bottom Left', x: 0, y: 50, w: 50, h: 50, color: BRAND_PURPLE, mediaId: undefined },
            { id: 'bottom_right', name: 'Bottom Right', x: 50, y: 50, w: 50, h: 50, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: 'portrait_1main_1ticker',
        name: '1 Main + 1 Ticker',
        orientation: 'portrait',
        zones: [
            { id: 'main', name: 'Main', x: 0, y: 0, w: 100, h: 90, color: BRAND_BLUE, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 90, w: 100, h: 10, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: 'portrait_2mains',
        name: '2 Mains',
        orientation: 'portrait',
        zones: [
            { id: 'main_top', name: 'Main Top', x: 0, y: 0, w: 100, h: 50, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_bottom', name: 'Main Bottom', x: 0, y: 50, w: 100, h: 50, color: BRAND_GREEN, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: 'portrait_3splits',
        name: '3 Splits',
        orientation: 'portrait',
        zones: [
            { id: 'main_top', name: 'Main Top', x: 0, y: 0, w: 100, h: 45, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_mid', name: 'Main Mid', x: 0, y: 45, w: 100, h: 45, color: BRAND_GREEN, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 90, w: 100, h: 10, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    }
];

export const SplitScreenForm = ({ config, onChange, commerceId }: { config: Partial<SplitScreenConfig>, onChange: (c: Partial<SplitScreenConfig>) => void, commerceId: string }) => {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    
    const orientation = config.orientation || 'landscape';

    // Initialize with default template if empty
    useEffect(() => {
        if (!config.templateId) {
            const defaultTpl = TEMPLATES.find(t => t.orientation === 'landscape') || TEMPLATES[0];
            onChange({
                orientation: 'landscape',
                templateId: defaultTpl.id,
                zones: defaultTpl.zones
            });
        }
    }, []);

    const availableTemplates = TEMPLATES.filter(t => t.orientation === orientation);

    const handleOrientationChange = (newOrientation: 'landscape' | 'portrait') => {
        const defaultTpl = TEMPLATES.find(t => t.orientation === newOrientation) || TEMPLATES[0];
        onChange({
            orientation: newOrientation,
            templateId: defaultTpl.id,
            zones: defaultTpl.zones
        });
    };

    const handleTemplateChange = (templateId: string) => {
        const tpl = TEMPLATES.find(t => t.id === templateId);
        if (tpl) {
            onChange({ ...config, templateId, zones: tpl.zones });
        }
    };

    const currentTemplate = TEMPLATES.find(t => t.id === config.templateId) || TEMPLATES[0];
    const zones = config.zones || currentTemplate.zones;

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Orientación</Label>
                <Select 
                    value={orientation} 
                    onValueChange={(v) => handleOrientationChange(v as 'landscape'|'portrait')}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona orientación" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="landscape">Paisaje (Horizontal)</SelectItem>
                        <SelectItem value="portrait">Retrato (Vertical)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Plantillas</Label>
                <div className="grid grid-cols-2 gap-3">
                    {availableTemplates.map(t => (
                        <button
                            key={t.id}
                            onClick={() => handleTemplateChange(t.id)}
                            className={cn(
                                "p-3 border rounded-lg text-left transition-all duration-200 flex flex-col items-center justify-center gap-2",
                                config.templateId === t.id 
                                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900"
                            )}
                        >
                            <div className={cn("w-16 border-2 rounded border-current flex relative overflow-hidden", orientation === 'landscape' ? "h-9" : "h-24 w-14")}>
                                {t.zones.map(z => (
                                    <div key={z.id} className="absolute border border-current/20" style={{ top: `${z.y}%`, left: `${z.x}%`, width: `${z.w}%`, height: `${z.h}%`, backgroundColor: z.color ? `${z.color}40` : 'transparent' }} />
                                ))}
                            </div>
                            <span className="text-xs font-medium text-center">{t.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Contenido de Zonas</Label>
                <div className="space-y-2">
                    {zones.map(zone => (
                        <div key={zone.id} className={cn("p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between", selectedZoneId === zone.id && "border-indigo-500/50 bg-indigo-500/5")}>
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: zone.color || BRAND_BLUE }} />
                                <div>
                                    <div className="text-sm font-medium text-slate-200">{zone.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {zone.mediaId ? 'Configurado' : 'Sin contenido'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedZoneId(zone.id);
                                    setIsPickerOpen(true);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
                            >
                                {zone.mediaId ? 'Cambiar' : 'Seleccionar'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {isPickerOpen && selectedZoneId && (
                <MediaPickerModal
                    isOpen={isPickerOpen}
                    onClose={() => setIsPickerOpen(false)}
                    commerceId={commerceId}
                    onSelect={(media) => {
                        const newZones = zones.map(z => z.id === selectedZoneId ? { ...z, mediaId: media.id, mediaObj: media } : z);
                        onChange({ ...config, zones: newZones });
                        setIsPickerOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export const SplitScreenPreview = ({ config }: { config: Partial<SplitScreenConfig> }) => {
    const zones = config.zones || [];
    const orientation = config.orientation || 'landscape';
    const [hydratedZones, setHydratedZones] = useState<SplitZone[]>(zones);

    // Hydrate zones with full media objects for runtime preview
    useEffect(() => {
        const hydrate = async () => {
            const needsHydration = zones.some(z => z.mediaId && !z.mediaObj);
            if (!needsHydration) {
                setHydratedZones(zones);
                return;
            }

            const mediaIds = zones.map(z => z.mediaId).filter(Boolean) as string[];
            if (mediaIds.length === 0) return;

            const { data } = await supabase.from('display_media').select('*').in('id', mediaIds);
            if (data) {
                const updated = zones.map(z => {
                    if (z.mediaId) {
                        return { ...z, mediaObj: data.find(m => m.id === z.mediaId) };
                    }
                    return z;
                });
                setHydratedZones(updated);
            }
        };
        hydrate();
    }, [zones]);

    return (
        <div className="w-full h-full flex items-center justify-center bg-[#050810] p-4">
            <div 
                className={cn(
                    "relative bg-black overflow-hidden shadow-2xl rounded-sm ring-1 ring-slate-800 transition-all duration-300",
                    orientation === 'landscape' ? "w-full aspect-video" : "h-full aspect-[9/16]"
                )}
            >
                {hydratedZones.map(zone => (
                    <div 
                        key={zone.id}
                        className="@container absolute flex flex-col items-center justify-center overflow-hidden transition-all duration-300"
                        style={{
                            top: `${zone.y}%`,
                            left: `${zone.x}%`,
                            width: `${zone.w}%`,
                            height: `${zone.h}%`,
                            backgroundColor: zone.mediaObj ? '#000' : (zone.color || BRAND_BLUE)
                        }}
                    >
                        {zone.mediaObj ? (
                            <ZoneRenderer media={zone.mediaObj} />
                        ) : (
                            <div className="text-white/80 text-center flex flex-col items-center p-4">
                                <LayoutTemplate className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-sm font-bold tracking-wide">{zone.name}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ZoneRenderer = ({ media }: { media: DisplayMedia }) => {
    // We use a blurred background effect + object-contain to prevent cropping and empty spaces
    if (media.type === 'image') {
        return (
            <div className="relative w-full h-full flex items-center justify-center">
                <div 
                    className="absolute inset-0 w-full h-full opacity-40 scale-110 blur-xl bg-center bg-cover"
                    style={{ backgroundImage: `url(${media.url})` }}
                />
                <img src={media.url} className="relative w-full h-full object-contain z-10" alt="" />
            </div>
        );
    }
    if (media.type === 'video') {
        return (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video src={media.url} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xl scale-110" autoPlay loop muted playsInline />
                <video src={media.url} className="relative w-full h-full object-contain z-10" autoPlay loop muted playsInline />
            </div>
        );
    }
    if (media.type === 'app') {
        if (media.metadata?.appId === 'weather') {
            return <WeatherPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'dolar') {
            return <DolarPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'ticker') {
            return <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-200 font-bold">App: Ticker</div>;
        }
        return <div className="text-white w-full h-full flex items-center justify-center">App: {media.metadata?.appId}</div>;
    }
    
    return <div className="text-white w-full h-full flex items-center justify-center">{media.type}</div>;
};
