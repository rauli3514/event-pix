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
    const [isSyncing, setIsSyncing] = useState(false);
    const [localRotation, setLocalRotation] = useState<number | null>(null);
    
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
                        type: assignment.media.type === 'web' ? 'url' : (assignment.media.type || 'image'),
                        url: assignment.media.url,
                        metadata: assignment.media.metadata,
                        duration: 0, // 0 = infinito / loop
                        title: assignment.media.name
                    }];
                }

                if (compiledItems.length > 0) {
                    const newItemsString = JSON.stringify(compiledItems);
                    const oldItemsString = localStorage.getItem(`tv_cache_${deviceCode}`);
                    
                    if (oldItemsString !== newItemsString) {
                        setIsSyncing(true);
                        localStorage.setItem(`tv_cache_${deviceCode}`, newItemsString);
                        setItems(compiledItems);
                        setStatus('playing');
                        setTimeout(() => setIsSyncing(false), 3000);
                    } else if (status !== 'playing') {
                        setItems(compiledItems);
                        setStatus('playing');
                    }
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

        // Sincronización rápida cada 5 segundos para que los cambios se sientan instantáneos
        syncIntervalRef.current = setInterval(() => {
            fetchCampaign();
        }, 5 * 1000);

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

        // Leer rotación local
        const storedRotation = localStorage.getItem('local_rotation');
        if (storedRotation !== null) {
            setLocalRotation(parseInt(storedRotation, 10));
        }

        const handleRotationChange = (e: any) => {
            setLocalRotation(e.detail);
        };
        window.addEventListener('local_rotation_changed', handleRotationChange);

        return () => {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
            if (heartbeatIntervalRef.current) clearTimeout(heartbeatIntervalRef.current);
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('local_rotation_changed', handleRotationChange);
        };
    }, [deviceCode, status]);

    // 3. Rotation Logic
    useEffect(() => {
        if (items.length === 0 || (status !== 'playing' && status !== 'offline_playing')) return;

        // Limpiar el timeout anterior si existe
        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);

        const currentItem = items[currentIndex];
        if (!currentItem) {
            setCurrentIndex(0);
            return;
        }
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
            <div className="fixed inset-0 w-full h-full bg-[#050505] flex flex-col items-center justify-center text-white">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-slate-800 rounded-full"></div>
                    <div className="w-24 h-24 border-4 border-orange-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <img src="/edm-assets/logo.PNG" alt="Logo" className="w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold mt-8 mb-2 tracking-wide text-white">Descargando Contenido</h1>
                <p className="text-slate-400 text-lg">Por favor espere mientras recibimos los nuevos datos...</p>
                <div className="w-64 h-2 bg-slate-800 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full animate-pulse w-full"></div>
                </div>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    if (status === 'no_content') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#050505] flex flex-col items-center justify-center text-white p-10 text-center overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative w-40 h-40 mb-10 flex items-center justify-center">
                        <div className="absolute inset-0 bg-slate-800/50 rounded-3xl animate-ping opacity-20"></div>
                        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10">
                            <img src="/edm-assets/logo.PNG" alt="Logo" className="w-32 object-contain" />
                        </div>
                    </div>
                    
                    <h1 className="text-5xl font-black tracking-tight mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Display Digital by eventpix</h1>
                    
                    <div className="flex items-center gap-3 mt-4 mb-12 bg-slate-900/50 border border-slate-800 px-6 py-3 rounded-full backdrop-blur-md">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-emerald-400 font-medium">Vinculado y Listo</span>
                    </div>

                    <p className="text-2xl text-slate-400 max-w-2xl font-light">
                        Esta pantalla está conectada a la red.
                        <br/>
                        Envía contenido desde tu panel de control para comenzar la reproducción.
                    </p>
                </div>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#050505] flex flex-col items-center justify-center text-white p-10 text-center">
                <div className="relative mb-8">
                    <WifiOff className="w-32 h-32 text-rose-600 relative z-10 animate-pulse" />
                    <div className="absolute inset-0 bg-rose-600/20 blur-2xl rounded-full"></div>
                </div>
                <h1 className="text-5xl font-black mb-4">Sin Conexión</h1>
                <p className="text-2xl text-slate-400 max-w-2xl mb-8 font-light">
                    La pantalla no tiene conexión a Internet o no puede alcanzar los servidores.
                    Revisa tu conexión WiFi o cable de red.
                </p>
                <button 
                    onClick={() => {
                        setStatus('loading');
                        fetchCampaign();
                    }}
                    className="px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xl font-medium transition-all shadow-xl"
                >
                    Reintentar Conexión
                </button>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    const getRotationStyle = (orientation: string | undefined): React.CSSProperties => {
        let degreeStr = orientation === 'portrait' ? '90' : (orientation === 'landscape' ? '0' : (orientation || '0'));
        
        if (localRotation !== null) {
            degreeStr = String(localRotation);
        }
        
        const isVertical = degreeStr === '90' || degreeStr === '270';
        
        if (isVertical) {
            return {
                position: 'fixed',
                transform: `rotate(${degreeStr}deg)`,
                transformOrigin: 'center center',
                width: '100vh',
                height: '100vw',
                top: 'calc(50vh - 50vw)',
                left: 'calc(50vw - 50vh)',
                backgroundColor: '#000',
                overflow: 'hidden'
            };
        }
        
        return {
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            transform: `rotate(${degreeStr}deg)`,
            transformOrigin: 'center center',
            backgroundColor: '#000', 
            overflow: 'hidden'
        };
    };

    const containerStyle = getRotationStyle(deviceSettings.orientation);

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
                />
            ))}

            {/* Menú de configuración lateral oculto */}
            <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            {isSyncing && (
                <div className="absolute top-8 right-8 bg-zinc-900/90 border border-indigo-500/50 text-white px-6 py-3 rounded-full flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500 z-50 shadow-2xl backdrop-blur-md">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Sincronizando caché...</span>
                </div>
            )}
        </div>
    );
};

export default TvPlayer;
