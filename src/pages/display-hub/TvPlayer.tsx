import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CampaignItem } from '@/types/display';
import { PlayerRenderer } from '@/components/display/PlayerRenderer';
import { TvSettingsMenu } from '@/components/display/TvSettingsMenu';
import { MonitorPlay, WifiOff } from 'lucide-react';

const TvPlayer = () => {
    const { deviceCode } = useParams<{ deviceCode: string }>();
    
    const [items, setItems] = useState<CampaignItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [status, setStatus] = useState<'loading' | 'playing' | 'offline_playing' | 'no_content' | 'error'>('loading');
    const [deviceSettings, setDeviceSettings] = useState({ scale: 'fit', orientation: 'landscape' });
    
    // Referencias para limpiar timeouts e intervalos
    const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Fetching and Caching Logic
    const fetchCampaign = async () => {
        if (!deviceCode) return;

        try {
            // 1. Obtener UUID del dispositivo y configuración
            const { data: device, error: deviceError } = await supabase
                .from('display_devices')
                .select('id, group_id, pairing_status, scale, orientation')
                .eq('device_id', deviceCode)
                .single();

            if (deviceError || !device) throw deviceError || new Error("Device not found");

            if (device.pairing_status !== 'linked') {
                setStatus('no_content');
                return;
            }

            setDeviceSettings({
                scale: device.scale || 'fit',
                orientation: device.orientation || 'landscape'
            });

            // 2. Buscar asignaciones para el dispositivo o su zona
            let orQuery = `device_id.eq.${device.id}`;
            if (device.group_id) {
                orQuery += `,group_id.eq.${device.group_id}`;
            }

            const { data: assignments } = await supabase
                .from('display_assignments')
                .select(`
                  *,
                  campaign:display_campaigns(*),
                  media:display_media(*)
                `)
                .or(orQuery)
                .order('created_at', { ascending: false });

            if (assignments && assignments.length > 0) {
                const now = new Date();
                
                // 1. Buscar una programación vigente (start_time y end_time definidos y dentro del rango)
                const scheduledAssignment = assignments.find(a => {
                    if (a.start_time && a.end_time) {
                        const start = new Date(a.start_time);
                        const end = new Date(a.end_time);
                        return now >= start && now <= end;
                    }
                    return false;
                });

                // 2. Si no hay programación vigente, buscar la asignación por defecto (sin start_time)
                const defaultAssignment = assignments.find(a => !a.start_time);

                const assignment = scheduledAssignment || defaultAssignment;

                if (assignment) {
                    let compiledItems: any[] = [];

                if (assignment.campaign && assignment.campaign.items_json) {
                    const rawItems = assignment.campaign.items_json;
                    
                    // Si es V2 (Objeto con version 2.0 y zones)
                    if (rawItems.version === '2.0' && Array.isArray(rawItems.zones) && rawItems.zones.length > 0) {
                        // Extraer playlist de la primera zona (por simplicidad en la TV temporalmente)
                        compiledItems = rawItems.zones[0].playlist || [];
                        
                        // Aplicar Shuffle si está activado en settings
                        if (rawItems.settings?.shuffle) {
                            compiledItems = [...compiledItems].sort(() => Math.random() - 0.5);
                        }
                    } 
                    // Si es V1 (Array directo)
                    else if (Array.isArray(rawItems)) {
                        compiledItems = rawItems;
                    }
                } else if (assignment.media) {
                    compiledItems = [{
                        id: assignment.media.id,
                        type: assignment.media.type || 'image',
                        url: assignment.media.url,
                        duration: 0, // 0 = infinito / loop
                        title: assignment.media.name
                    }];
                }

                if (compiledItems.length > 0) {
                    const newItemsString = JSON.stringify(compiledItems);
                    localStorage.setItem(`tv_cache_${deviceCode}`, newItemsString);
                    setItems((prevItems) => {
                        if (JSON.stringify(prevItems) === newItemsString) return prevItems;
                        return compiledItems;
                    });
                    setStatus('playing');
                    return;
                }
                }
            }

            // Si llega aquí, no hay contenido válido
            setStatus('no_content');

        } catch (error) {
            console.error('Error fetching campaign from Supabase:', error);
            const cachedData = localStorage.getItem(`tv_cache_${deviceCode}`);
            if (cachedData) {
                try {
                    const parsedItems = JSON.parse(cachedData) as CampaignItem[];
                    if (parsedItems.length > 0) {
                        setItems(parsedItems);
                        setStatus('offline_playing');
                        return;
                    }
                } catch (e) { }
            }
            setStatus('error');
        }
    };

    // 2. Heartbeat Logic (Ping to Supabase)
    const sendHeartbeat = async () => {
        if (!deviceCode) return;
        try {
            const { data: device } = await supabase
                .from('display_devices')
                .select('id')
                .eq('device_id', deviceCode)
                .single();
                
            if (device) {
                // Actualizamos el last_seen del device (o insertamos en heartbeats)
                await supabase
                    .from('display_devices')
                    .update({ last_seen: new Date().toISOString() })
                    .eq('id', device.id);
            }
        } catch (error) {
            // Silently fail if offline, the player should keep running
        }
    };

    // Initialization
    useEffect(() => {
        // Primera carga
        fetchCampaign();
        sendHeartbeat();

        // Sincronización periódica (cada 30 segundos)
        syncIntervalRef.current = setInterval(() => {
            console.log('Syncing TV campaign...', new Date().toISOString());
            fetchCampaign();
        }, 30 * 1000);

        // Heartbeat (cada 60 segundos)
        heartbeatIntervalRef.current = setInterval(() => {
            sendHeartbeat();
        }, 60 * 1000);

        // Recuperación automática cuando vuelve el internet
        const handleOnline = () => {
            console.log('Internet restaurado. Intentando reconectar...');
            setStatus('loading');
            fetchCampaign();
        };
        window.addEventListener('online', handleOnline);

        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            window.removeEventListener('online', handleOnline);
        };
    }, [deviceCode]);

    // 3. Rotation Logic
    useEffect(() => {
        if (items.length === 0 || (status !== 'playing' && status !== 'offline_playing')) return;

        // Limpiar el timeout anterior si existe
        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);

        const currentItem = items[currentIndex];
        // Si la duración es inválida, usar 10 segundos por defecto
        const durationMs = (currentItem.duration && currentItem.duration > 0 ? currentItem.duration : 10) * 1000;

        rotationTimeoutRef.current = setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }, durationMs);

        return () => {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
        };
    }, [currentIndex, items, status]);


    // -- Renders --

    if (status === 'loading') {
        return (
            <div className="fixed inset-0 w-full h-full bg-black flex flex-col items-center justify-center text-white">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                <h1 className="text-2xl font-mono text-slate-400">Iniciando EventPix Player...</h1>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    if (status === 'no_content') {
        return (
            <div className="fixed inset-0 w-full h-full bg-black flex flex-col items-center justify-center text-white p-10 text-center">
                <MonitorPlay className="w-32 h-32 text-indigo-600 mb-8 animate-pulse" />
                <h1 className="text-6xl font-bold font-mono tracking-widest mb-4">{deviceCode}</h1>
                <p className="text-2xl text-slate-400 max-w-2xl">
                    Esta pantalla está encendida pero no tiene contenido asignado. <br/><br/>
                    Ingresa a tu panel de EventPix y asígnale una campaña a este código.
                </p>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="fixed inset-0 w-full h-full bg-black flex flex-col items-center justify-center text-white p-10 text-center">
                <WifiOff className="w-32 h-32 text-rose-600 mb-8" />
                <h1 className="text-5xl font-bold mb-4">Sin Conexión o Error</h1>
                <p className="text-2xl text-slate-400 max-w-2xl mb-8">
                    La pantalla no pudo comunicarse con el servidor. Es posible que la TV se esté conectando al WiFi recién ahora.
                </p>
                <button 
                    onClick={() => {
                        setStatus('loading');
                        fetchCampaign();
                    }}
                    className="px-8 py-4 bg-rose-600 hover:bg-rose-700 rounded-xl text-2xl font-bold transition-all"
                >
                    Reintentar Conexión
                </button>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    const containerStyle: React.CSSProperties = deviceSettings.orientation === 'portrait' 
        ? { 
            position: 'fixed',
            transform: 'rotate(90deg)',
            transformOrigin: 'center center',
            width: '100vh',
            height: '100vw',
            top: 'calc(50vh - 50vw)',
            left: 'calc(50vw - 50vh)',
            backgroundColor: '#000',
            overflow: 'hidden'
          }
        : {
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            backgroundColor: '#000', 
            overflow: 'hidden'
          };

    return (
        <div style={containerStyle}>
            {/* Indicador de modo offline invisible a simple vista, pero útil para debugear */}
            {status === 'offline_playing' && (
                <div className="absolute top-2 right-2 z-50 bg-rose-600 text-white text-[10px] px-2 py-1 rounded opacity-30">
                    Modo Offline
                </div>
            )}

            {/* Renderizamos todos los iframes/imagenes, pero solo hacemos visible el "activo" */}
            {items.map((item, index) => (
                <PlayerRenderer 
                    key={`${item.id}-${index}`} 
                    item={item} 
                    isActive={index === currentIndex} 
                    deviceScale={deviceSettings.scale}
                />
            ))}

            {/* Menú de configuración lateral oculto */}
            <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
        </div>
    );
};

export default TvPlayer;
