import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutTemplate } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DisplayMedia } from '@/types/display';
import { MediaPickerModal } from '../../MediaPickerModal';
import { WeatherPreview } from '../weather/WeatherApp';
import { DolarPreview } from '../dolar/DolarApp';

export interface SplitZone {
    id: string;
    name: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    w: number; // percentage 0-100
    h: number; // percentage 0-100
    mediaId?: string;
    mediaObj?: DisplayMedia; // For preview rendering
}

export interface SplitScreenConfig {
    templateId: string;
    zones: SplitZone[];
}

const TEMPLATES = [
    {
        id: '1main_1ticker',
        name: '1 Main + 1 Ticker',
        zones: [
            { id: 'main', name: 'Main', x: 0, y: 0, w: 100, h: 85, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 85, w: 100, h: 15, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '2mains',
        name: '2 Mains',
        zones: [
            { id: 'main_left', name: 'Main Left', x: 0, y: 0, w: 70, h: 100, mediaId: undefined },
            { id: 'main_right', name: 'Main Right', x: 70, y: 0, w: 30, h: 100, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '2mains_1ticker',
        name: '2 Mains + 1 Ticker',
        zones: [
            { id: 'main_left', name: 'Main Left', x: 0, y: 0, w: 70, h: 85, mediaId: undefined },
            { id: 'main_right', name: 'Main Right', x: 70, y: 0, w: 30, h: 85, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 85, w: 100, h: 15, mediaId: undefined }
        ] as SplitZone[]
    }
];

export const SplitScreenForm = ({ config, onChange, commerceId }: { config: Partial<SplitScreenConfig>, onChange: (c: Partial<SplitScreenConfig>) => void, commerceId: string }) => {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Initialize with default template if empty
    useEffect(() => {
        if (!config.templateId) {
            onChange({
                templateId: TEMPLATES[0].id,
                zones: TEMPLATES[0].zones
            });
        }
    }, []);

    const handleTemplateChange = (templateId: string) => {
        const tpl = TEMPLATES.find(t => t.id === templateId);
        if (tpl) {
            onChange({ templateId, zones: tpl.zones });
        }
    };

    const currentTemplate = TEMPLATES.find(t => t.id === config.templateId) || TEMPLATES[0];
    const zones = config.zones || currentTemplate.zones;

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Plantilla Base</Label>
                <Select 
                    value={config.templateId || '1main_1ticker'} 
                    onValueChange={handleTemplateChange}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona una plantilla" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        {TEMPLATES.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Contenido de Zonas</Label>
                <div className="space-y-2">
                    {zones.map(zone => (
                        <div key={zone.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                    {zone.name}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {zone.w}% ancho x {zone.h}% alto
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
        <div className="w-full h-full relative bg-black overflow-hidden">
            {hydratedZones.map(zone => (
                <div 
                    key={zone.id}
                    className="absolute border border-slate-800/50 bg-slate-900/80 flex flex-col items-center justify-center overflow-hidden transition-all duration-300"
                    style={{
                        top: `${zone.y}%`,
                        left: `${zone.x}%`,
                        width: `${zone.w}%`,
                        height: `${zone.h}%`
                    }}
                >
                    {zone.mediaObj ? (
                        <ZoneRenderer media={zone.mediaObj} />
                    ) : (
                        <div className="text-slate-500 text-center flex flex-col items-center p-4">
                            <LayoutTemplate className="w-8 h-8 mb-2 opacity-30" />
                            <span className="text-sm font-medium">{zone.name}</span>
                            <span className="text-xs opacity-50">Sin contenido</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const ZoneRenderer = ({ media }: { media: DisplayMedia }) => {
    if (media.type === 'image') {
        return <img src={media.url} className="w-full h-full object-cover" alt="" />;
    }
    if (media.type === 'video') {
        return <video src={media.url} className="w-full h-full object-cover" autoPlay loop muted playsInline />;
    }
    if (media.type === 'app') {
        if (media.metadata?.appId === 'weather') {
            return <WeatherPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'dolar') {
            return <DolarPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'ticker') {
            return <div className="w-full h-full bg-emerald-900/50 flex items-center justify-center text-emerald-200 font-bold">App: Ticker</div>;
        }
        return <div className="text-white">App: {media.metadata?.appId}</div>;
    }
    
    return <div className="text-white">{media.type}</div>;
};
