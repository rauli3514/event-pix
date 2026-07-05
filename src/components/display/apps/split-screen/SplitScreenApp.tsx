import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutTemplate, Plus, Trash2, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DisplayMedia } from '@/types/display';
import { MediaPickerModal } from '../../MediaPickerModal';
import { WeatherPreview } from '../weather/WeatherApp';
import { DolarPreview } from '../dolar/DolarApp';
import { TickerPreview } from '../ticker/TickerApp';
import { ClockPreview } from '../clock/ClockApp';
import { QRPreview } from '../qr/QRApp';
import { ReviewsPreview } from '../reviews/ReviewsApp';
import { DynamicMenuPreview } from '../dynamic-menu/DynamicMenuApp';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SplitZone {
    id: string;
    name: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    w: number; // percentage 0-100
    h: number; // percentage 0-100
    color?: string;
    mediaId?: string;
    mediaObj?: DisplayMedia; 
    playlistId?: string;
    playlistObj?: any;
}

export interface SplitScreenConfig {
    templateId: string;
    orientation: 'landscape' | 'portrait';
    zones: SplitZone[];
    unitType?: 'percent' | 'pixel';
    resolution?: string;
    backgroundMusicId?: string;
    audioZoneId?: string | 'all';
    primaryZoneId?: string;
}

const BRAND_BLUE = '#1ea8eb';
const BRAND_ORANGE = '#f99d1c';
const BRAND_GREEN = '#10b981';
const BRAND_PURPLE = '#8b5cf6';

const TEMPLATES = [
    {
        id: '1main_1ticker', name: '1 Main + 1 Ticker', orientation: 'landscape',
        zones: [
            { id: 'main', name: 'Main', x: 0, y: 0, w: 100, h: 85, color: BRAND_BLUE, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 85, w: 100, h: 15, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '2mains', name: '2 Mains', orientation: 'landscape',
        zones: [
            { id: 'main_left', name: 'Main Left', x: 0, y: 0, w: 70, h: 100, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_right', name: 'Main Right', x: 70, y: 0, w: 30, h: 100, color: BRAND_GREEN, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '2mains_1ticker', name: '2 Mains + 1 Ticker', orientation: 'landscape',
        zones: [
            { id: 'main_left', name: 'Main Left', x: 0, y: 0, w: 70, h: 85, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_right', name: 'Main Right', x: 70, y: 0, w: 30, h: 85, color: BRAND_GREEN, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 85, w: 100, h: 15, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: '4splits', name: '4 Splits', orientation: 'landscape',
        zones: [
            { id: 'top_left', name: 'Top Left', x: 0, y: 0, w: 50, h: 50, color: BRAND_BLUE, mediaId: undefined },
            { id: 'top_right', name: 'Top Right', x: 50, y: 0, w: 50, h: 50, color: BRAND_GREEN, mediaId: undefined },
            { id: 'bottom_left', name: 'Bottom Left', x: 0, y: 50, w: 50, h: 50, color: BRAND_PURPLE, mediaId: undefined },
            { id: 'bottom_right', name: 'Bottom Right', x: 50, y: 50, w: 50, h: 50, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: 'portrait_1main_1ticker', name: '1 Main + 1 Ticker', orientation: 'portrait',
        zones: [
            { id: 'main', name: 'Main', x: 0, y: 0, w: 100, h: 90, color: BRAND_BLUE, mediaId: undefined },
            { id: 'ticker', name: 'Bottom Ticker', x: 0, y: 90, w: 100, h: 10, color: BRAND_ORANGE, mediaId: undefined }
        ] as SplitZone[]
    },
    {
        id: 'portrait_2mains', name: '2 Mains', orientation: 'portrait',
        zones: [
            { id: 'main_top', name: 'Main Top', x: 0, y: 0, w: 100, h: 50, color: BRAND_BLUE, mediaId: undefined },
            { id: 'main_bottom', name: 'Main Bottom', x: 0, y: 50, w: 100, h: 50, color: BRAND_GREEN, mediaId: undefined }
        ] as SplitZone[]
    }
];

export const SplitScreenForm = ({ config, onChange, commerceId, appName, setAppName }: { config: Partial<SplitScreenConfig>, onChange: (c: Partial<SplitScreenConfig>) => void, commerceId: string, appName?: string, setAppName?: (n: string) => void }) => {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    
    const orientation = config.orientation || 'landscape';

    useEffect(() => {
        if (!config.templateId) {
            const defaultTpl = TEMPLATES.find(t => t.orientation === 'landscape') || TEMPLATES[0];
            onChange({
                ...config,
                orientation: 'landscape',
                templateId: defaultTpl.id,
                zones: defaultTpl.zones,
                unitType: 'percent',
                resolution: '1080p',
                audioZoneId: 'all'
            });
        }
    }, []);

    const availableTemplates = TEMPLATES.filter(t => t.orientation === orientation);

    const handleOrientationChange = (newOrientation: 'landscape' | 'portrait') => {
        const defaultTpl = TEMPLATES.find(t => t.orientation === newOrientation) || TEMPLATES[0];
        onChange({
            ...config,
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

    const handleAddZone = () => {
        const newZones = [...(config.zones || [])];
        newZones.push({
            id: `zone_${Date.now()}`,
            name: `Zona ${newZones.length + 1}`,
            x: 25, y: 25, w: 50, h: 50,
            color: BRAND_PURPLE
        });
        onChange({ ...config, zones: newZones });
    };

    const currentTemplate = TEMPLATES.find(t => t.id === config.templateId) || TEMPLATES[0];
    const zones = config.zones || currentTemplate.zones;

    return (
        <Tabs defaultValue="plantillas" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-slate-950 border border-slate-800">
                <TabsTrigger value="plantillas" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Plantillas</TabsTrigger>
                <TabsTrigger value="zonas" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Propiedades</TabsTrigger>
                <TabsTrigger value="avanzado" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Avanzado</TabsTrigger>
            </TabsList>
            
            <TabsContent value="plantillas" className="mt-4 space-y-4">
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
            </TabsContent>

            <TabsContent value="zonas" className="mt-4 space-y-6">
                {setAppName && (
                    <div className="space-y-3">
                        <Label className="text-slate-300">Nombre de la App <span className="text-red-400">*</span></Label>
                        <Input 
                            placeholder="Ej: Menú 3 Zonas" 
                            value={appName || ''}
                            onChange={(e) => setAppName(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-indigo-500"
                        />
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Zonas de Contenido</Label>
                    <Button variant="outline" size="sm" onClick={handleAddZone} className="h-8 text-xs bg-slate-950 border-slate-800 text-slate-300 hover:text-white">
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar zona
                    </Button>
                </div>
                
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {zones.map(zone => {
                        const isExpanded = selectedZoneId === zone.id;
                        return (
                            <div key={zone.id} className={cn("bg-slate-950 border rounded-lg overflow-hidden transition-all", isExpanded ? "border-indigo-500" : "border-slate-800 hover:border-slate-700")}>
                                {/* Header (Clickable) */}
                                <div 
                                    className="p-3 flex items-center justify-between cursor-pointer select-none"
                                    onClick={() => setSelectedZoneId(isExpanded ? null : zone.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color || BRAND_BLUE }} />
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">{zone.name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {zone.mediaId || zone.playlistId ? 'Configurado' : 'Sin contenido'}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-3 bg-slate-900 text-slate-300 hover:text-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedZoneId(zone.id);
                                            setIsPickerOpen(true);
                                        }}
                                    >
                                        {zone.mediaId ? 'Cambiar' : 'Seleccionar'}
                                    </Button>
                                </div>
                                
                                {/* Expanded Body */}
                                {isExpanded && (
                                    <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-400">Nombre de la Zona</Label>
                                            <Input 
                                                value={zone.name}
                                                onChange={(e) => {
                                                    const newZones = zones.map(z => z.id === zone.id ? { ...z, name: e.target.value } : z);
                                                    onChange({ ...config, zones: newZones });
                                                }}
                                                className="bg-slate-950 border-slate-800 h-8 text-sm"
                                            />
                                        </div>
                                        
                                        <div>
                                            <Label className="text-xs text-slate-400 mb-2 block">Posición y Tamaño (%)</Label>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-slate-500">X</span>
                                                    <Input type="number" min="0" max="100" value={Math.round(zone.x)} onChange={(e) => {
                                                        const newZones = zones.map(z => z.id === zone.id ? { ...z, x: Number(e.target.value) } : z);
                                                        onChange({ ...config, zones: newZones });
                                                    }} className="bg-slate-950 border-slate-800 h-8 px-2 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-slate-500">Y</span>
                                                    <Input type="number" min="0" max="100" value={Math.round(zone.y)} onChange={(e) => {
                                                        const newZones = zones.map(z => z.id === zone.id ? { ...z, y: Number(e.target.value) } : z);
                                                        onChange({ ...config, zones: newZones });
                                                    }} className="bg-slate-950 border-slate-800 h-8 px-2 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-slate-500">Ancho</span>
                                                    <Input type="number" min="1" max="100" value={Math.round(zone.w)} onChange={(e) => {
                                                        const newZones = zones.map(z => z.id === zone.id ? { ...z, w: Number(e.target.value) } : z);
                                                        onChange({ ...config, zones: newZones });
                                                    }} className="bg-slate-950 border-slate-800 h-8 px-2 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-slate-500">Alto</span>
                                                    <Input type="number" min="1" max="100" value={Math.round(zone.h)} onChange={(e) => {
                                                        const newZones = zones.map(z => z.id === zone.id ? { ...z, h: Number(e.target.value) } : z);
                                                        onChange({ ...config, zones: newZones });
                                                    }} className="bg-slate-950 border-slate-800 h-8 px-2 text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </TabsContent>

            <TabsContent value="avanzado" className="mt-4 space-y-6">
                <div className="space-y-3">
                    <Label className="text-slate-300">Tipo de unidad</Label>
                    <Select 
                        value={config.unitType || 'percent'} 
                        onValueChange={(v) => onChange({...config, unitType: v as any})}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue placeholder="%" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="percent">Porcentaje (%)</SelectItem>
                            <SelectItem value="pixel">Píxeles (px)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-3">
                    <Label className="text-slate-300">Resolución Base</Label>
                    <Select 
                        value={config.resolution || '1080p'} 
                        onValueChange={(v) => onChange({...config, resolution: v})}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue placeholder="1080p - FHD" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="1080p">1080p - FHD (1920 x 1080)</SelectItem>
                            <SelectItem value="4k">4K - UHD (3840 x 2160)</SelectItem>
                            <SelectItem value="720p">720p - HD (1280 x 720)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label className="text-slate-300">Zona de audio (Reproducción)</Label>
                    <Select 
                        value={config.audioZoneId || 'all'} 
                        onValueChange={(v) => onChange({...config, audioZoneId: v})}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue placeholder="Todo" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="all">Todas las zonas (Mix)</SelectItem>
                            {zones.map(z => (
                                <SelectItem key={z.id} value={z.id}>Solo {z.name}</SelectItem>
                            ))}
                            <SelectItem value="none">Silenciar todas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label className="text-slate-300">Zona Primaria</Label>
                    <Select 
                        value={config.primaryZoneId || 'none'} 
                        onValueChange={(v) => onChange({...config, primaryZoneId: v})}
                    >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                            <SelectValue placeholder="Ninguno" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="none">Ninguno</SelectItem>
                            {zones.map(z => (
                                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </TabsContent>

            {isPickerOpen && selectedZoneId && (
                <MediaPickerModal
                    isOpen={isPickerOpen}
                    onClose={() => setIsPickerOpen(false)}
                    commerceId={commerceId}
                    onSelect={(item: any, type) => {
                        let newZones = [...zones];
                        if (type === 'playlist') {
                            newZones = zones.map(z => z.id === selectedZoneId ? { ...z, playlistId: item.id, playlistObj: item, mediaId: undefined, mediaObj: undefined } : z);
                        } else {
                            newZones = zones.map(z => z.id === selectedZoneId ? { ...z, mediaId: item.id, mediaObj: item as DisplayMedia, playlistId: undefined, playlistObj: undefined } : z);
                        }
                        onChange({ ...config, zones: newZones });
                        setIsPickerOpen(false);
                    }}
                />
            )}
        </Tabs>
    );
};

export const SplitScreenPreview = ({ config, onChange, commerceId }: { config: Partial<SplitScreenConfig>, onChange?: (c: Partial<SplitScreenConfig>) => void, commerceId?: string }) => {
    const zones = config.zones || [];
    const orientation = config.orientation || 'landscape';
    const [hydratedZones, setHydratedZones] = useState<SplitZone[]>(zones);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Drag state
    const [dragState, setDragState] = useState<{ id: string, type: 'move'|'resize', startX: number, startY: number, initialRect: {x:number, y:number, w:number, h:number} } | null>(null);

    // Hydrate zones with full media objects for runtime preview
    useEffect(() => {
        const hydrate = async () => {
            const needsMediaHydration = zones.some(z => z.mediaId && !z.mediaObj);
            const needsPlaylistHydration = zones.some(z => z.playlistId && !z.playlistObj);
            
            if (!needsMediaHydration && !needsPlaylistHydration) {
                setHydratedZones(zones);
                return;
            }

            let updatedZones = [...zones];

            if (needsMediaHydration) {
                const mediaIds = updatedZones.map(z => z.mediaId).filter(Boolean) as string[];
                if (mediaIds.length > 0) {
                    const { data } = await supabase.from('display_media').select('*').in('id', mediaIds);
                    if (data) {
                        updatedZones = updatedZones.map(z => {
                            if (z.mediaId) return { ...z, mediaObj: data.find(m => m.id === z.mediaId) };
                            return z;
                        });
                    }
                }
            }

            if (needsPlaylistHydration) {
                const playlistIds = updatedZones.map(z => z.playlistId).filter(Boolean) as string[];
                if (playlistIds.length > 0) {
                    const { data } = await supabase.from('display_campaigns').select('*').in('id', playlistIds);
                    if (data) {
                        updatedZones = updatedZones.map(z => {
                            if (z.playlistId) return { ...z, playlistObj: data.find(p => p.id === z.playlistId) };
                            return z;
                        });
                    }
                }
            }
            
            setHydratedZones(updatedZones);
        };
        hydrate();
    }, [zones]);

    // Global mouse events for drag and resize
    useEffect(() => {
        if (!dragState || !containerRef.current || !onChange) return;

        const handleMouseMove = (e: MouseEvent) => {
            const container = containerRef.current!.getBoundingClientRect();
            const dx = ((e.clientX - dragState.startX) / container.width) * 100;
            const dy = ((e.clientY - dragState.startY) / container.height) * 100;
            
            let newZones = [...zones];
            const zoneIndex = newZones.findIndex(z => z.id === dragState.id);
            if (zoneIndex === -1) return;
            
            const z = { ...newZones[zoneIndex] };
            
            if (dragState.type === 'move') {
                z.x = Math.max(0, Math.min(100 - z.w, dragState.initialRect.x + dx));
                z.y = Math.max(0, Math.min(100 - z.h, dragState.initialRect.y + dy));
            } else if (dragState.type === 'resize') {
                z.w = Math.max(5, Math.min(100 - z.x, dragState.initialRect.w + dx));
                z.h = Math.max(5, Math.min(100 - z.y, dragState.initialRect.h + dy));
            }
            
            newZones[zoneIndex] = z;
            onChange({ ...config, zones: newZones });
        };

        const handleMouseUp = () => setDragState(null);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, zones, config, onChange]);

    return (
        <div className={cn("w-full h-full flex items-center justify-center bg-[#050810]", onChange ? "p-4" : "")}>
            <div 
                ref={containerRef}
                className={cn(
                    "relative bg-black overflow-hidden shadow-2xl transition-all duration-300",
                    onChange ? "rounded-sm ring-1 ring-slate-800" : "", // only rounded/ring in editor
                    !onChange 
                        ? "w-full h-full" // Full screen in player mode
                        : (orientation === 'landscape' ? "w-full aspect-video" : "h-full aspect-[9/16]")
                )}
                onClick={() => setSelectedZoneId(null)}
            >
                {hydratedZones.map(zone => {
                    const isSelected = selectedZoneId === zone.id && onChange; // Interactive only if onChange is provided (editor mode)
                    return (
                        <div 
                            key={zone.id}
                            className={cn(
                                "@container absolute flex flex-col items-center justify-center overflow-hidden transition-colors duration-200",
                                isSelected ? "ring-2 ring-indigo-500 z-50 cursor-move" : "z-10"
                            )}
                            style={{
                                top: `${zone.y}%`, left: `${zone.x}%`, width: `${zone.w}%`, height: `${zone.h}%`,
                                backgroundColor: zone.mediaObj ? '#000' : (zone.color || BRAND_BLUE)
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onChange) setSelectedZoneId(zone.id);
                            }}
                            onMouseDown={(e) => {
                                if (isSelected) {
                                    setDragState({ id: zone.id, type: 'move', startX: e.clientX, startY: e.clientY, initialRect: {x: zone.x, y: zone.y, w: zone.w, h: zone.h} });
                                }
                            }}
                        >
                            {zone.playlistObj ? (
                                <NestedPlaylistRunner playlist={zone.playlistObj} commerceId={commerceId} />
                            ) : zone.mediaObj ? (
                                <ZoneRenderer media={zone.mediaObj} commerceId={commerceId} />
                            ) : (
                                <div className="text-white/80 text-center flex flex-col items-center p-4 pointer-events-none select-none">
                                    <LayoutTemplate className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-sm font-bold tracking-wide">{zone.name}</span>
                                </div>
                            )}

                            {/* Resize Handle */}
                            {isSelected && (
                                <div 
                                    className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-500 cursor-nwse-resize z-50"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setDragState({ id: zone.id, type: 'resize', startX: e.clientX, startY: e.clientY, initialRect: {x: zone.x, y: zone.y, w: zone.w, h: zone.h} });
                                    }}
                                />
                            )}
                            
                            {/* Toolbar */}
                            {isSelected && (
                                <div className="absolute top-2 right-2 flex items-center bg-slate-900/90 rounded border border-slate-700 shadow-lg p-1 gap-1 z-50" onMouseDown={e => e.stopPropagation()}>
                                    <button 
                                        className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onChange) {
                                                const newZone = { ...zone, id: `zone_${Date.now()}`, x: zone.x + 5, y: zone.y + 5 };
                                                onChange({ ...config, zones: [...zones, newZone] });
                                            }
                                        }}
                                        title="Duplicar"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onChange) {
                                                onChange({ ...config, zones: zones.filter(z => z.id !== zone.id) });
                                                setSelectedZoneId(null);
                                            }
                                        }}
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const NestedPlaylistRunner = ({ playlist, commerceId }: { playlist: any, commerceId?: string }) => {
    const items = Array.isArray(playlist.items_json) ? playlist.items_json : (playlist.items_json?.zones?.[0]?.playlist || []);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!items || items.length <= 1) return;
        const currentItem = items[currentIndex];
        const durationMs = (currentItem.duration || 10) * 1000;
        
        const timer = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % items.length);
        }, durationMs);
        return () => clearTimeout(timer);
    }, [currentIndex, items]);

    if (!items || items.length === 0) return null;

    const currentItem = items[currentIndex];
    const fakeMedia: DisplayMedia = {
        id: currentItem.id,
        name: currentItem.content || '',
        type: currentItem.type === 'url' ? 'web' : (currentItem.type || 'image'),
        url: currentItem.url || '',
        metadata: currentItem.metadata || {},
        folder_path: '',
        commerce_id: '',
        created_at: '',
        storage_path: '',
        size_bytes: 0
    };

    return <ZoneRenderer media={fakeMedia} commerceId={commerceId} />;
};

const ZoneRenderer = ({ media, commerceId }: { media: DisplayMedia, commerceId?: string }) => {
    if (media.type === 'image') {
        return (
            <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                <div 
                    className="absolute inset-0 w-full h-full opacity-40 scale-110 blur-xl bg-center bg-cover"
                    style={{ backgroundImage: `url(${media.url})` }}
                />
                <img src={media.url} className="relative w-full h-full object-contain z-10" alt="" draggable={false} />
            </div>
        );
    }
    if (media.type === 'video') {
        return (
            <div className="relative w-full h-full flex items-center justify-center bg-black pointer-events-none">
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
            return <TickerPreview config={media.metadata.config || {}} containerWidth={undefined} />;
        }
        if (media.metadata?.appId === 'clock') {
            return <ClockPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'qr') {
            return <QRPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'reviews') {
            return <ReviewsPreview config={media.metadata.config || {}} />;
        }
        if (media.metadata?.appId === 'dynamic-menu') {
            return <DynamicMenuPreview config={media.metadata.config || {}} commerceId={commerceId} />;
        }
        return <div className="text-white w-full h-full flex items-center justify-center pointer-events-none">App: {media.metadata?.appId}</div>;
    }
    if (media.type === 'web') {
        return (
            <div className="relative w-full h-full bg-white pointer-events-none">
                <iframe src={media.url} className="w-full h-full border-none" title={media.name || "Web Content"} />
            </div>
        );
    }
    
    return <div className="text-white w-full h-full flex items-center justify-center pointer-events-none">{media.type}</div>;
};
