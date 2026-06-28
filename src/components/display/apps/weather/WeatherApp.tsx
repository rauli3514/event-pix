import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cloud, CloudRain, CloudLightning, Sun, Search, MapPin, X, Wind, Droplets, Sunrise, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface WeatherConfig {
    locationName?: string; // Legacy
    latitude?: number;     // Legacy
    longitude?: number;    // Legacy
    locations?: {
        name: string;
        lat: number;
        lon: number;
    }[];
    theme: 'light' | 'dark' | 'dynamic' | 'vibrant' | 'glass';
    unit: 'celsius' | 'fahrenheit';
}

interface WeatherFormProps {
    config: Partial<WeatherConfig>;
    onChange: (config: Partial<WeatherConfig>) => void;
}

export const WeatherForm = ({ config, onChange }: WeatherFormProps) => {
    const locations = config.locations || (config.locationName ? [{ name: config.locationName, lat: config.latitude!, lon: config.longitude! }] : []);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    const handleSearch = async (queryToSearch: string) => {
        if (!queryToSearch || queryToSearch.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(queryToSearch)}&count=5&language=es&format=json`);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (error) {
            console.error("Geocoding error", error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery.length >= 3) {
                handleSearch(searchQuery);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const addLocation = (res: any) => {
        const newLoc = { name: `${res.name}, ${res.country}`, lat: res.latitude, lon: res.longitude };
        const newLocations = [...locations, newLoc].slice(0, 3); // Max 3
        
        onChange({ 
            ...config, 
            locations: newLocations,
            // Keep legacy sync for first item
            locationName: newLocations[0]?.name,
            latitude: newLocations[0]?.lat,
            longitude: newLocations[0]?.lon
        });
        
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeLocation = (index: number) => {
        const newLocations = locations.filter((_, i) => i !== index);
        onChange({ 
            ...config, 
            locations: newLocations,
            locationName: newLocations[0]?.name || '',
            latitude: newLocations[0]?.lat || 0,
            longitude: newLocations[0]?.lon || 0
        });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Ciudades (Máx 3)</Label>
                
                <div className="space-y-2 mb-4">
                    {locations.map((loc, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-slate-200">
                                <MapPin className="w-4 h-4 text-indigo-400" />
                                {loc.name}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeLocation(idx)} className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    {locations.length === 0 && (
                        <div className="text-xs text-slate-500 italic">No hay ciudades configuradas.</div>
                    )}
                </div>

                {locations.length < 3 && (
                    <div className="relative">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Buscar nueva ciudad..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-950 border-slate-800 text-slate-200"
                            />
                            <Button variant="outline" disabled={isSearching} className="border-slate-700 bg-slate-800 text-slate-200">
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-1 shadow-xl">
                                {searchResults.map(res => (
                                    <div 
                                        key={res.id} 
                                        className="px-3 py-2 hover:bg-slate-800 cursor-pointer flex items-center gap-2 text-sm text-slate-300 transition-colors"
                                        onClick={() => addLocation(res)}
                                    >
                                        <MapPin className="w-4 h-4 text-slate-500" />
                                        <span>{res.name}, <span className="text-slate-500">{res.admin1}, {res.country}</span></span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Escala de Temperatura</Label>
                <Select 
                    value={config.unit || 'celsius'} 
                    onValueChange={(val) => onChange({ ...config, unit: val as any })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona unidad" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="celsius">Celsius (°C)</SelectItem>
                        <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-300">Tema Visual</Label>
                <Select 
                    value={config.theme || 'dynamic'} 
                    onValueChange={(val) => onChange({ ...config, theme: val as any })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                        <SelectValue placeholder="Selecciona un tema" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="dynamic">Dinámico (Sutil según clima)</SelectItem>
                        <SelectItem value="vibrant">Vibrante Sólido (Estilo ScreenCloud)</SelectItem>
                        <SelectItem value="glass">Premium Glassmorphism</SelectItem>
                        <SelectItem value="dark">Modo Oscuro Plano</SelectItem>
                        <SelectItem value="light">Modo Claro Plano</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

export const WeatherPreview = ({ config }: { config: Partial<WeatherConfig> }) => {
    const [weatherDataList, setWeatherDataList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const locations = config.locations || (config.locationName && config.latitude && config.longitude ? [{ name: config.locationName, lat: config.latitude, lon: config.longitude }] : []);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (locations.length === 0) return;

        const fetchAll = async () => {
            setLoading(true);
            try {
                const unitParam = config.unit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
                const promises = locations.map(loc => 
                    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto${unitParam}`)
                    .then(res => res.json())
                    .then(data => ({ ...data, location: loc }))
                );
                const results = await Promise.all(promises);
                setWeatherDataList(results);
            } catch (error) {
                console.error("Weather error", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [JSON.stringify(locations), config.unit]);

    const renderContent = () => {
        if (locations.length === 0) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950 p-4 text-center">
                    <CloudRain className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-sm">Configura al menos una ciudad</p>
                </div>
            );
        }

        if (loading || weatherDataList.length === 0) {
            return (
                <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-950">
                    <span className="animate-pulse">Cargando clima...</span>
                </div>
            );
        }

        const { width, height } = dimensions;
        if (width === 0 || height === 0) return null;

        const isMicro = width < 250 && height < 250;
        const isTicker = height < 150;
        const isColumn = width < 400 && height >= 150;
        const isSquare = width >= 250 && width < 500 && height >= 150 && height < 400;
        const isMain = width >= 400 && height >= 400;

        const unitStr = config.unit === 'fahrenheit' ? '°F' : '°C';
        const theme = config.theme || 'dynamic';

        return (
            <>
                {isTicker && (
                    <div className="w-full h-full bg-slate-900 text-white flex items-center overflow-hidden whitespace-nowrap">
                        <div className="animate-[marquee_25s_linear_infinite] flex items-center gap-16 px-4">
                            {weatherDataList.map((data, idx) => (
                                <TickerItem key={idx} data={data} unitStr={unitStr} />
                            ))}
                            {weatherDataList.map((data, idx) => (
                                <TickerItem key={`dup-${idx}`} data={data} unitStr={unitStr} />
                            ))}
                        </div>
                        <style>{`@keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }`}</style>
                    </div>
                )}

                {(isMicro || isSquare) && (
                    <WeatherCard data={weatherDataList[0]} unitStr={unitStr} mode={isMicro ? 'micro' : 'square'} theme={theme} />
                )}

                {isColumn && (
                    <div className="w-full h-full flex flex-col">
                        {weatherDataList.map((data, idx) => (
                            <div key={idx} className="flex-1 min-h-0 border-b border-black/10 last:border-0 relative">
                                <WeatherCard data={data} unitStr={unitStr} mode="column" theme={theme} />
                            </div>
                        ))}
                    </div>
                )}

                {isMain && (
                    <div className="w-full h-full flex">
                        {weatherDataList.map((data, idx) => (
                            <div key={idx} className="flex-1 min-w-0 border-r border-black/20 last:border-0 relative">
                                <WeatherCard data={data} unitStr={unitStr} mode="main" theme={theme} />
                            </div>
                        ))}
                    </div>
                )}
            </>
        );
    };

    return (
        <div ref={containerRef} className="w-full h-full flex flex-col overflow-hidden relative bg-black">
            {renderContent()}
        </div>
    );
};

// --- SUBCOMPONENTS ---

const TickerItem = ({ data, unitStr }: { data: any, unitStr: string }) => {
    const currentTemp = Math.round(data.current_weather.temperature);
    const Icon = getWeatherIcon(data.current_weather.weathercode, data.current_weather.is_day === 1);
    
    return (
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-indigo-400">
                <MapPin className="w-5 h-5" />
                <span className="text-xl font-bold">{data.location.name.split(',')[0]}</span>
            </div>
            <div className="flex items-center gap-3">
                <Icon className="w-8 h-8 text-white" />
                <span className="text-3xl font-black text-white">{currentTemp}{unitStr}</span>
            </div>
        </div>
    );
};

const WeatherCard = ({ data, unitStr, mode, theme }: { data: any, unitStr: string, mode: 'micro' | 'square' | 'column' | 'main', theme: string }) => {
    const isDay = data.current_weather.is_day === 1;
    const code = data.current_weather.weathercode;
    const currentTemp = Math.round(data.current_weather.temperature);
    const Icon = getWeatherIcon(code, isDay);
    const desc = getWeatherDesc(code);
    
    // Theme computation
    let bgStyle = 'bg-slate-900 text-white';
    let cardStyle = 'bg-white/10 border-white/5';

    if (theme === 'vibrant') {
        bgStyle = isDay 
            ? (code <= 3 ? 'bg-blue-600 text-white' : 'bg-slate-500 text-white')
            : 'bg-indigo-900 text-white';
        cardStyle = 'bg-black/20 border-black/10';
    } else if (theme === 'glass') {
        bgStyle = isDay 
            ? (code <= 3 ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white' : 'bg-gradient-to-br from-slate-400 to-slate-600 text-white')
            : 'bg-gradient-to-br from-indigo-950 to-slate-900 text-white';
        cardStyle = 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl';
    } else if (theme === 'light') {
        bgStyle = 'bg-slate-50 text-slate-900';
        cardStyle = 'bg-white border border-slate-200 shadow-sm';
    } else if (theme === 'dark') {
        bgStyle = 'bg-slate-950 text-slate-100';
        cardStyle = 'bg-slate-900 border border-slate-800';
    } else if (theme === 'dynamic') {
        bgStyle = isDay ? 'bg-sky-50 text-slate-800' : 'bg-slate-900 text-slate-100';
        cardStyle = isDay ? 'bg-white/60 border border-sky-100' : 'bg-slate-800/60 border border-slate-700';
    }

    const timeString = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (mode === 'micro') {
        return (
            <div className={cn("w-full h-full flex flex-col items-center justify-center p-2", bgStyle)}>
                <Icon className="w-3/5 h-3/5 max-w-[80px] max-h-[80px] drop-shadow-md mb-1" />
                <div className="text-3xl font-bold tracking-tighter">{currentTemp}°</div>
            </div>
        );
    }

    if (mode === 'square') {
        return (
            <div className={cn("w-full h-full flex flex-col p-4", bgStyle)}>
                <div className="text-sm font-semibold opacity-70 truncate">{data.location.name}</div>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <Icon className="w-16 h-16 drop-shadow-md mb-2" />
                    <div className="text-5xl font-bold">{currentTemp}°</div>
                    <div className="text-sm opacity-80 mt-1 capitalize">{desc}</div>
                </div>
            </div>
        );
    }

    if (mode === 'column') {
        return (
            <div className={cn("w-full h-full flex flex-col p-6 overflow-hidden", bgStyle)}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold truncate max-w-[200px]">{data.location.name.split(',')[0]}</h2>
                        <p className="text-sm opacity-70">Hoy {timeString}</p>
                    </div>
                </div>
                
                <div className="flex flex-col items-center justify-center mb-6">
                    <Icon className="w-20 h-20 drop-shadow-lg mb-2" />
                    <div className="text-6xl font-bold tracking-tighter">
                        {currentTemp}<span className="text-2xl align-top opacity-50">{unitStr}</span>
                    </div>
                    <div className="text-base opacity-80 font-medium capitalize">{desc}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                    {data.daily.time.slice(1, 5).map((time: string, idx: number) => {
                        const max = Math.round(data.daily.temperature_2m_max[idx + 1]);
                        const min = Math.round(data.daily.temperature_2m_min[idx + 1]);
                        const dayName = new Date(time).toLocaleDateString('es-ES', { weekday: 'short' });
                        const DIcon = getWeatherIcon(data.daily.weathercode[idx+1], true);
                        
                        return (
                            <div key={time} className={cn("p-3 rounded-xl flex flex-col items-center", cardStyle)}>
                                <span className="text-xs font-semibold uppercase opacity-70 mb-1">{dayName}</span>
                                <DIcon className="w-6 h-6 mb-2" />
                                <div className="text-sm font-bold">{max}° <span className="opacity-50 font-normal">{min}°</span></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Main mode
    return (
        <div className={cn("w-full h-full flex flex-col relative p-8 overflow-hidden", bgStyle)}>
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                    <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </svg>
            </div>

            <div className="flex justify-between items-start relative z-10">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-2 truncate max-w-[300px] lg:max-w-none">{data.location.name.split(',')[0]}</h1>
                    <p className="text-lg lg:text-xl opacity-70">{new Date().toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="text-3xl lg:text-4xl font-light opacity-80">{timeString}</div>
            </div>

            <div className="flex-1 flex flex-col xl:flex-row items-center justify-center gap-8 lg:gap-12 relative z-10 py-8">
                <Icon className="w-40 h-40 lg:w-48 lg:h-48 drop-shadow-2xl" />
                <div className="flex flex-col items-center xl:items-start">
                    <div className="text-[8rem] lg:text-[10rem] xl:text-[12rem] font-bold tracking-tighter leading-none">
                        {currentTemp}<span className="text-5xl lg:text-6xl align-top opacity-50">{unitStr}</span>
                    </div>
                    <div className="text-2xl lg:text-3xl font-medium opacity-90 capitalize mt-2 xl:mt-4">{desc}</div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mt-auto relative z-10">
                {/* Stats */}
                <div className={cn("w-full lg:w-1/3 rounded-3xl p-6 flex lg:flex-col justify-around gap-4", cardStyle)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 opacity-80 text-sm lg:text-base"><Wind className="w-4 h-4 lg:w-5 lg:h-5"/> Viento</div>
                        <div className="font-bold text-sm lg:text-xl">{data.current_weather.windspeed} km/h</div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 opacity-80 text-sm lg:text-base"><Droplets className="w-4 h-4 lg:w-5 lg:h-5"/> Precip.</div>
                        <div className="font-bold text-sm lg:text-xl">{code >= 50 ? 'Alta' : 'Baja'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 opacity-80 text-sm lg:text-base"><Sunrise className="w-4 h-4 lg:w-5 lg:h-5"/> Sol</div>
                        <div className="font-bold text-sm lg:text-xl">{new Date(data.daily.sunrise[0]).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                </div>

                {/* Forecast */}
                <div className="flex-1 flex gap-2 lg:gap-4">
                    {data.daily.time.slice(1, 6).map((time: string, idx: number) => {
                        const max = Math.round(data.daily.temperature_2m_max[idx + 1]);
                        const min = Math.round(data.daily.temperature_2m_min[idx + 1]);
                        const dayName = new Date(time).toLocaleDateString('es-ES', { weekday: 'short' });
                        const DIcon = getWeatherIcon(data.daily.weathercode[idx+1], true);
                        
                        return (
                            <div key={time} className={cn("flex-1 rounded-3xl flex flex-col items-center justify-center p-3 lg:p-4", cardStyle)}>
                                <span className="text-xs lg:text-lg font-semibold uppercase opacity-70 mb-2 lg:mb-4">{dayName}</span>
                                <DIcon className="w-8 h-8 lg:w-12 lg:h-12 mb-2 lg:mb-4" />
                                <div className="text-lg lg:text-2xl font-bold">{max}°</div>
                                <div className="text-sm lg:text-lg opacity-50">{min}°</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const getWeatherIcon = (code: number, isDay: boolean) => {
    if (code === 0) return isDay ? Sun : Moon;
    if (code >= 1 && code <= 3) return Cloud;
    if (code >= 51 && code <= 67) return CloudRain;
    if (code >= 71 && code <= 82) return CloudRain; // Snow, fallback to rain
    if (code >= 95) return CloudLightning;
    return Sun;
};

const getWeatherDesc = (code: number) => {
    if (code === 0) return 'Despejado';
    if (code >= 1 && code <= 3) return 'Parcialmente Nublado';
    if (code >= 51 && code <= 67) return 'Lluvia';
    if (code >= 71 && code <= 82) return 'Nieve';
    if (code >= 95) return 'Tormenta';
    return 'Despejado';
};
