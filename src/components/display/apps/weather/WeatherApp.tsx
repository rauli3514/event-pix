import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cloud, CloudRain, CloudLightning, Sun, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface WeatherConfig {
    locationName: string;
    latitude: number;
    longitude: number;
    theme: 'light' | 'dark' | 'dynamic';
    unit: 'celsius' | 'fahrenheit';
}

interface WeatherFormProps {
    config: Partial<WeatherConfig>;
    onChange: (config: Partial<WeatherConfig>) => void;
}

export const WeatherForm = ({ config, onChange }: WeatherFormProps) => {
    const [searchQuery, setSearchQuery] = useState(config.locationName || '');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Simple search using open-meteo geocoding API
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

    // Auto-search when typing stops
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery !== config.locationName) {
                handleSearch(searchQuery);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">Ubicación</Label>
                <div className="flex gap-2">
                    <Input 
                        placeholder="Ej: Buenos Aires, Madrid" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                        className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                    <Button variant="outline" onClick={() => handleSearch(searchQuery)} disabled={isSearching} className="border-slate-700 bg-slate-800 text-slate-200">
                        <Search className="w-4 h-4" />
                    </Button>
                </div>
                {searchResults.length > 0 && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden mt-2">
                        {searchResults.map(res => (
                            <div 
                                key={res.id} 
                                className="px-3 py-2 hover:bg-slate-800 cursor-pointer flex items-center gap-2 text-sm text-slate-300 transition-colors"
                                onClick={() => {
                                    setSearchQuery(`${res.name}, ${res.country}`);
                                    setSearchResults([]);
                                    onChange({ 
                                        ...config, 
                                        locationName: `${res.name}, ${res.country}`,
                                        latitude: res.latitude,
                                        longitude: res.longitude
                                    });
                                }}
                            >
                                <MapPin className="w-4 h-4 text-slate-500" />
                                <span>{res.name}, <span className="text-slate-500">{res.admin1}, {res.country}</span></span>
                            </div>
                        ))}
                    </div>
                )}
                {config.locationName && searchResults.length === 0 && (
                    <div className="text-xs text-emerald-400 flex items-center mt-2">
                        <MapPin className="w-3 h-3 mr-1" />
                        Ubicación fijada: {config.locationName}
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
                        <SelectItem value="dynamic">Dinámico (Según clima actual)</SelectItem>
                        <SelectItem value="dark">Modo Oscuro</SelectItem>
                        <SelectItem value="light">Modo Claro</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

export const WeatherPreview = ({ config }: { config: Partial<WeatherConfig> }) => {
    const [weatherData, setWeatherData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!config.latitude || !config.longitude) return;

        const fetchWeather = async () => {
            setLoading(true);
            try {
                // Fetch using open-meteo
                const unitParam = config.unit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${config.latitude}&longitude=${config.longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto${unitParam}`);
                const data = await res.json();
                setWeatherData(data);
            } catch (error) {
                console.error("Weather error", error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [config.latitude, config.longitude, config.unit]);

    if (!config.locationName) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950">
                <CloudRain className="w-16 h-16 mb-4 opacity-20" />
                <p>Busca una ubicación para previsualizar el clima</p>
            </div>
        );
    }

    if (loading || !weatherData) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-950">
                <span className="animate-pulse">Cargando clima...</span>
            </div>
        );
    }

    // Determine theme classes
    const isDark = config.theme === 'dark' || (config.theme === 'dynamic' && weatherData.current_weather.is_day === 0);
    const bgClass = isDark ? 'bg-slate-900 text-white' : 'bg-sky-50 text-slate-900';
    const cardBgClass = isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-sky-100';

    // Map WMO Weather codes to icons
    const code = weatherData.current_weather.weathercode;
    let MainIcon = Sun;
    if (code >= 1 && code <= 3) MainIcon = Cloud;
    if (code >= 51 && code <= 67) MainIcon = CloudRain;
    if (code >= 95) MainIcon = CloudLightning;

    const currentTemp = Math.round(weatherData.current_weather.temperature);
    const unitStr = config.unit === 'fahrenheit' ? '°F' : '°C';

    return (
        <div className={`w-full h-full p-8 flex flex-col relative transition-colors duration-500 ${bgClass}`}>
            <div className="flex-1 flex flex-col items-center justify-center">
                <h2 className="text-3xl font-light tracking-wider opacity-80 mb-2">{config.locationName}</h2>
                <div className="flex items-center gap-6 mt-4">
                    <MainIcon className="w-24 h-24 drop-shadow-md" />
                    <div className="text-8xl font-bold tracking-tighter">
                        {currentTemp}<span className="text-5xl opacity-50 align-top">{unitStr}</span>
                    </div>
                </div>
            </div>

            {/* Daily Forecast Strip */}
            <div className={`mt-8 p-6 rounded-3xl border backdrop-blur-md flex justify-between ${cardBgClass}`}>
                {weatherData.daily.time.slice(1, 6).map((time: string, idx: number) => {
                    const max = Math.round(weatherData.daily.temperature_2m_max[idx + 1]);
                    const min = Math.round(weatherData.daily.temperature_2m_min[idx + 1]);
                    const date = new Date(time);
                    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
                    
                    return (
                        <div key={time} className="flex flex-col items-center">
                            <span className="text-sm font-medium opacity-70 mb-3">{dayName}</span>
                            <Cloud className="w-8 h-8 opacity-80 mb-3" />
                            <div className="flex items-center gap-2 font-medium">
                                <span>{max}°</span>
                                <span className="opacity-50 text-sm">{min}°</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
