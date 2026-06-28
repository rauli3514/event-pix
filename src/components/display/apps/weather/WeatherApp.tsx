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
                    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=auto${unitParam}`)
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
    const { code, temp, isDay } = parseWeatherData(data);
    const Icon = getWeatherIcon(code, isDay);
    
    return (
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-indigo-400">
                <MapPin className="w-5 h-5" />
                <span className="text-xl font-bold">{data.location.name.split(',')[0]}</span>
            </div>
            <div className="flex items-center gap-3">
                <Icon className="w-8 h-8 text-white" />
                <span className="text-3xl font-black text-white">{temp}{unitStr}</span>
            </div>
        </div>
    );
};

const parseWeatherData = (data: any) => {
    const current = data.current || data.current_weather || {};
    const code = current.weather_code ?? current.weathercode ?? 0;
    const temp = Math.round(current.temperature_2m ?? current.temperature ?? 0);
    const isDay = (current.is_day === 1 || current.is_day === true);
    const windSpeed = current.wind_speed_10m ?? current.windspeed ?? 0;
    const humidity = current.relative_humidity_2m ?? 0;
    const feelsLike = Math.round(current.apparent_temperature ?? temp);
    const cloudCover = current.cloud_cover ?? 0;
    const rain = current.precipitation ?? 0;
    return { code, temp, isDay, windSpeed, humidity, feelsLike, cloudCover, rain };
};

const getBackgroundImage = (code: number, isDay: boolean) => {
    if (!isDay) {
        if (code <= 3) return 'https://images.unsplash.com/photo-1505322022520-5e1ceaf74c93?auto=format&fit=crop&w=1920&q=80'; // clear night
        return 'https://images.unsplash.com/photo-1483702581635-c33118cf6f5e?auto=format&fit=crop&w=1920&q=80'; // cloudy night
    }
    if (code === 0) return 'https://images.unsplash.com/photo-1601297183305-6df14faa7181?auto=format&fit=crop&w=1920&q=80'; // clear day
    if (code >= 1 && code <= 3) return 'https://images.unsplash.com/photo-1534274988757-a28bf1a5753a?auto=format&fit=crop&w=1920&q=80'; // cloudy day
    if (code >= 51 && code <= 67) return 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80'; // rain
    if (code >= 71 && code <= 82) return 'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=1920&q=80'; // snow
    if (code >= 95) return 'https://images.unsplash.com/photo-1605722243979-fc647f98f267?auto=format&fit=crop&w=1920&q=80'; // storm
    return 'https://images.unsplash.com/photo-1601297183305-6df14faa7181?auto=format&fit=crop&w=1920&q=80';
};

const WeatherCard = ({ data, unitStr, mode, theme }: { data: any, unitStr: string, mode: 'micro' | 'square' | 'column' | 'main', theme: string }) => {
    const { code, temp, isDay, windSpeed, humidity, feelsLike, cloudCover, rain } = parseWeatherData(data);
    const Icon = getWeatherIcon(code, isDay);
    const desc = getWeatherDesc(code);
    
    // Theme computation
    let bgStyle = 'bg-slate-900 text-white';
    let cardStyle = 'bg-white/10 border-white/5';
    let bgImage = '';

    if (theme === 'vibrant') {
        bgStyle = isDay 
            ? (code <= 3 ? 'bg-blue-600 text-white' : 'bg-slate-500 text-white')
            : 'bg-indigo-900 text-white';
        cardStyle = 'bg-black/20 border-black/10';
    } else if (theme === 'glass') {
        bgStyle = 'text-white bg-slate-900';
        bgImage = getBackgroundImage(code, isDay);
        cardStyle = 'bg-black/40 backdrop-blur-xl border border-white/20 shadow-xl';
    } else if (theme === 'light') {
        bgStyle = 'bg-slate-50 text-slate-900';
        cardStyle = 'bg-white border border-slate-200 shadow-sm';
    } else if (theme === 'dark') {
        bgStyle = 'bg-slate-950 text-slate-100';
        cardStyle = 'bg-slate-900 border border-slate-800';
    } else if (theme === 'dynamic') {
        bgStyle = 'text-white bg-slate-900';
        bgImage = getBackgroundImage(code, isDay);
        cardStyle = 'bg-black/60 backdrop-blur-md border border-white/10 shadow-xl';
    }

    const timeString = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dateString = new Date().toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' });

    const renderMainLayout = () => {
        if (theme === 'vibrant') {
            return (
                <div className="w-full h-full flex flex-col relative p-12 overflow-hidden z-10">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                        <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full h-auto min-h-[50%]" preserveAspectRatio="none">
                            <path fill="currentColor" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,128C672,107,768,117,864,138.7C960,160,1056,192,1152,197.3C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                        </svg>
                    </div>

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-4">{data.location.name.split(',')[0]}</h1>
                            <p className="text-2xl lg:text-3xl opacity-90 capitalize">{dateString}</p>
                        </div>
                        <div className="text-4xl lg:text-5xl font-medium">{timeString}</div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 relative z-10 py-8">
                        <Icon className="w-48 h-48 lg:w-64 lg:h-64 drop-shadow-2xl" />
                        <div className="flex flex-col items-center lg:items-start">
                            <div className="text-[10rem] lg:text-[14rem] font-bold tracking-tighter leading-none">
                                {temp}<span className="text-6xl lg:text-7xl align-top opacity-70">{unitStr}</span>
                            </div>
                            <div className="text-4xl lg:text-5xl font-medium opacity-100 capitalize mt-4">{desc}</div>
                        </div>
                    </div>

                    <div className={cn("w-full rounded-[2.5rem] p-6 lg:p-8 flex flex-wrap lg:flex-nowrap justify-around items-center relative z-10 mt-auto", cardStyle)}>
                        <div className="flex flex-col items-center px-4 py-2">
                            <Wind className="w-8 h-8 lg:w-10 lg:h-10 mb-2 lg:mb-3 opacity-80"/>
                            <div className="text-xl lg:text-2xl font-bold">Viento</div>
                            <div className="text-lg lg:text-xl opacity-90 mt-1">{windSpeed} km/h</div>
                        </div>
                        {data.daily.time.slice(1, 5).map((time: string, idx: number) => {
                            const max = Math.round(data.daily.temperature_2m_max[idx + 1]);
                            const dayName = new Date(time).toLocaleDateString('es-ES', { weekday: 'short' });
                            return (
                                <div key={time} className="flex flex-col items-center px-4 py-2 lg:px-8 lg:border-l lg:border-white/20">
                                    <span className="text-xl lg:text-2xl font-bold uppercase mb-2 lg:mb-3">{dayName}</span>
                                    <div className="text-3xl lg:text-4xl font-bold">{max}°</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (theme === 'glass') {
            return (
                <div className="w-full h-full flex flex-col lg:flex-row p-6 lg:p-8 gap-6 lg:gap-8 relative z-10">
                    <div className="flex-1 flex flex-col justify-between lg:pt-8 lg:pb-4">
                        <div className="flex flex-col gap-2 lg:gap-4">
                            <div className="flex items-center gap-3 text-2xl lg:text-3xl font-medium drop-shadow-md">
                                <MapPin className="w-6 h-6 lg:w-8 lg:h-8" /> {data.location.name.split(',')[0]}
                            </div>
                            <div className="text-5xl lg:text-7xl font-light tracking-tight drop-shadow-lg leading-tight capitalize">
                                {dateString.split(',')[0]}<br/>
                                <span className="font-bold">{dateString.split(' ')[1]} {dateString.split(' ')[2]}</span>
                            </div>
                        </div>
                        <div className="mt-8 lg:mt-0">
                            <div className="text-[8rem] lg:text-[12rem] font-light tracking-tighter leading-none drop-shadow-2xl">
                                {temp}<span className="text-5xl lg:text-7xl align-top opacity-80">{unitStr}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/2 flex flex-col gap-4">
                        <div className="hidden lg:flex justify-end text-3xl font-medium drop-shadow-md mb-2">{timeString}</div>
                        <div className="flex gap-4 h-32 lg:h-48">
                            <div className={cn("flex-1 rounded-3xl p-4 lg:p-6 flex flex-col justify-between", cardStyle)}>
                                <div className="text-lg lg:text-xl font-medium">Sensación</div>
                                <div className="text-4xl lg:text-5xl font-bold">{feelsLike}°</div>
                                <div className="text-base lg:text-xl opacity-80 capitalize">{desc}</div>
                            </div>
                            <div className={cn("w-32 lg:w-48 rounded-3xl p-4 lg:p-6 flex flex-col items-center justify-center", cardStyle)}>
                                <Icon className="w-16 h-16 lg:w-24 lg:h-24 drop-shadow-lg" />
                            </div>
                        </div>
                        <div className="flex gap-4 h-32 lg:h-48">
                            <div className={cn("flex-1 rounded-3xl p-4 lg:p-6 flex flex-col items-center justify-center", cardStyle)}>
                                <div className="text-base lg:text-xl font-medium mb-1 lg:mb-auto">Humedad</div>
                                <Droplets className="w-8 h-8 lg:w-12 lg:h-12 text-blue-300 mb-1" />
                                <div className="text-2xl lg:text-4xl font-bold">{humidity}%</div>
                            </div>
                            <div className={cn("flex-1 rounded-3xl p-4 lg:p-6 flex flex-col items-center justify-center", cardStyle)}>
                                <div className="text-base lg:text-xl font-medium mb-1 lg:mb-auto">Lluvia</div>
                                <CloudRain className="w-8 h-8 lg:w-12 lg:h-12 text-blue-300 mb-1" />
                                <div className="text-2xl lg:text-4xl font-bold">{rain}mm</div>
                            </div>
                            <div className={cn("flex-1 rounded-3xl p-4 lg:p-6 flex flex-col items-center justify-center", cardStyle)}>
                                <div className="text-base lg:text-xl font-medium mb-1 lg:mb-auto">Nubes</div>
                                <Cloud className="w-8 h-8 lg:w-12 lg:h-12 text-white mb-1" />
                                <div className="text-2xl lg:text-4xl font-bold">{cloudCover}%</div>
                            </div>
                        </div>
                        <div className="flex gap-2 lg:gap-4 h-28 lg:h-40">
                            {data.daily.time.slice(1, 6).map((time: string, idx: number) => {
                                const max = Math.round(data.daily.temperature_2m_max[idx + 1]);
                                const dayName = new Date(time).toLocaleDateString('es-ES', { weekday: 'short' });
                                const DIcon = getWeatherIcon(data.daily.weathercode[idx+1], true);
                                return (
                                    <div key={time} className={cn("flex-1 rounded-3xl p-2 lg:p-4 flex flex-col items-center justify-between", cardStyle)}>
                                        <span className="text-sm lg:text-lg font-medium capitalize">{dayName}</span>
                                        <DIcon className="w-6 h-6 lg:w-10 lg:h-10" />
                                        <div className="text-lg lg:text-2xl font-bold">{max}°</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 lg:p-12 overflow-hidden z-10">
                <div className="flex items-center gap-2 text-xl lg:text-2xl font-medium mb-4 lg:mb-8 drop-shadow-md">
                    <MapPin className="w-5 h-5 lg:w-6 lg:h-6" /> {data.location.name.split(',')[0]}
                </div>
                
                <Icon className="w-24 h-24 lg:w-32 lg:h-32 drop-shadow-xl mb-4 lg:mb-6" />
                
                <div className="text-[7rem] lg:text-[9rem] font-light tracking-tighter leading-none drop-shadow-2xl mb-6 lg:mb-8">
                    {temp}<span className="text-5xl lg:text-6xl align-top font-normal">{unitStr}</span>
                </div>
                
                <div className="flex gap-6 lg:gap-8 text-xl lg:text-2xl font-medium drop-shadow-md mb-8">
                    <div className="flex items-center gap-2 lg:gap-3"><Droplets className="w-5 h-5 lg:w-6 lg:h-6"/> {humidity}%</div>
                    <div className="flex items-center gap-2 lg:gap-3"><Wind className="w-5 h-5 lg:w-6 lg:h-6"/> {windSpeed} km/h</div>
                </div>

                <div className={cn("w-full max-w-5xl rounded-[2rem] p-6 lg:p-8 mt-auto flex flex-col gap-4 lg:gap-6", cardStyle)}>
                    <div className="flex justify-between text-lg lg:text-xl opacity-90 px-2 lg:px-4 font-medium">
                        <span>{timeString}</span>
                        <span className="capitalize">{dateString}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                        {data.daily.time.slice(0, 6).map((time: string, idx: number) => {
                            const max = Math.round(data.daily.temperature_2m_max[idx]);
                            const min = Math.round(data.daily.temperature_2m_min[idx]);
                            const dayName = idx === 0 ? 'Hoy' : new Date(time).toLocaleDateString('es-ES', { weekday: 'short' });
                            const DIcon = getWeatherIcon(data.daily.weathercode[idx], true);
                            return (
                                <div key={time} className="flex-1 flex flex-col items-center gap-2 lg:gap-4">
                                    <span className="text-base lg:text-2xl font-medium capitalize">{dayName}</span>
                                    <DIcon className="w-8 h-8 lg:w-12 lg:h-12" />
                                    <div className="text-lg lg:text-2xl font-bold">{max}° <span className="opacity-60 font-normal ml-1">{min}°</span></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={cn("w-full h-full flex flex-col relative overflow-hidden", bgStyle)}>
            {bgImage && (
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 z-0" 
                    style={{ backgroundImage: `url(${bgImage})` }} 
                />
            )}
            
            {mode === 'main' && renderMainLayout()}

            {mode === 'micro' && (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 relative z-10">
                    <Icon className="w-3/5 h-3/5 max-w-[80px] max-h-[80px] drop-shadow-md mb-1" />
                    <div className="text-3xl font-bold tracking-tighter">{temp}°</div>
                </div>
            )}

            {mode === 'square' && (
                <div className="w-full h-full flex flex-col p-4 relative z-10">
                    <div className="text-sm font-semibold opacity-70 truncate drop-shadow-md">{data.location.name}</div>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Icon className="w-16 h-16 drop-shadow-md mb-2" />
                        <div className="text-5xl font-bold drop-shadow-md">{temp}°</div>
                        <div className="text-sm opacity-90 mt-1 capitalize drop-shadow-md">{desc}</div>
                    </div>
                </div>
            )}

            {mode === 'column' && (
                <div className="w-full h-full flex flex-col p-6 overflow-hidden relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold truncate max-w-[200px] drop-shadow-md">{data.location.name.split(',')[0]}</h2>
                            <p className="text-sm opacity-90 drop-shadow-md">Hoy {timeString}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center mb-6">
                        <Icon className="w-20 h-20 drop-shadow-lg mb-2" />
                        <div className="text-6xl font-bold tracking-tighter drop-shadow-xl">
                            {temp}<span className="text-2xl align-top opacity-80">{unitStr}</span>
                        </div>
                        <div className="text-base opacity-90 font-medium capitalize drop-shadow-md">{desc}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-auto">
                        {data.daily.time.slice(1, 5).map((time: string, idx: number) => {
                            const max = Math.round(data.daily.temperature_2m_max[idx + 1]);
                            const min = Math.round(data.daily.temperature_2m_min[idx + 1]);
                            const dayName = new Date(time).toLocaleDateString('es-ES', { weekday: 'short' });
                            const DIcon = getWeatherIcon(data.daily.weathercode[idx+1], true);
                            return (
                                <div key={time} className={cn("p-3 rounded-xl flex flex-col items-center", cardStyle)}>
                                    <span className="text-xs font-semibold uppercase opacity-90 mb-1">{dayName}</span>
                                    <DIcon className="w-6 h-6 mb-2" />
                                    <div className="text-sm font-bold">{max}° <span className="opacity-70 font-normal">{min}°</span></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const getWeatherIcon = (code: number, isDay: boolean) => {
    if (code === 0) return isDay ? Sun : Moon;
    if (code >= 1 && code <= 3) return Cloud;
    if (code >= 51 && code <= 67) return CloudRain;
    if (code >= 71 && code <= 82) return CloudRain;
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
