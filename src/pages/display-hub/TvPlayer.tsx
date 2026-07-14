import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CampaignItem } from '@/types/display';
import { PlayerRenderer } from '@/components/display/PlayerRenderer';
import { TvSettingsMenu } from '@/components/display/TvSettingsMenu';

const TvPlayer = () => {
    const { deviceCode } = useParams<{ deviceCode: string }>();
    
    const [items, setItems] = useState<CampaignItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [status, setStatus] = useState<'loading' | 'playing' | 'offline_playing' | 'no_content' | 'error'>('loading');
    const [deviceSettings, setDeviceSettings] = useState({ scale: 'fit', orientation: 'landscape' });
    const [localRotation, setLocalRotation] = useState<number | null>(null);
    const [deviceCommerceId, setDeviceCommerceId] = useState<string>('');
    const [preloadProgress, setPreloadProgress] = useState<{ current: number, total: number } | null>(null);
    
    const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // --- Preload Engine ---
    const preloadAssets = async (itemsToPreload: CampaignItem[]) => {
        const assets = itemsToPreload.filter(item => item.type === 'image' || item.type === 'video');
        if (assets.length === 0) return true;

        setPreloadProgress({ current: 0, total: assets.length });

        let loadedCount = 0;
        const promises = assets.map(item => {
            return new Promise<void>((resolve) => {
                if (item.type === 'image' && item.url) {
                    const img = new Image();
                    img.onload = () => { loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve(); };
                    img.onerror = () => { loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve(); };
                    img.src = item.url;
                } else if (item.type === 'video' && item.url) {
                    const req = new XMLHttpRequest();
                    req.open('GET', item.url, true);
                    req.responseType = 'blob';
                    req.onload = function() {
                        loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve();
                    };
                    req.onerror = function() {
                        loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve();
                    };
                    req.send();
                } else {
                    loadedCount++; setPreloadProgress({ current: loadedCount, total: assets.length }); resolve();
                }
            });
        });

        await Promise.all(promises);
        setPreloadProgress(null);
        return true;
    };

    // --- Fetching Logic ---
    const fetchCampaign = async () => {
        if (!deviceCode) return;

        try {
            const { data: device, error: deviceError } = await supabase
                .from('display_devices')
                .select('id, group_id, pairing_status, scale, orientation, commerce_id')
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
            if (device.commerce_id) setDeviceCommerceId(device.commerce_id);

            let orQuery = `device_id.eq.${device.id}`;
            if (device.group_id) {
                orQuery += `,group_id.eq.${device.group_id}`;
            }

            const { data: assignments } = await supabase
                .from('display_assignments')
                .select(`
                  *,
                  campaign:display_campaigns(*),
                  media:display_media(*),
                  schedule:display_schedules(
                      *,
                      default_campaign:display_campaigns!default_campaign_id(*),
                      default_media:display_media!default_media_id(*),
                      events:display_schedule_events(
                          *,
                          campaign:display_campaigns!campaign_id(*),
                          media:display_media!media_id(*)
                      )
                  )
                `)
                .or(orQuery)
                .order('created_at', { ascending: false });

            const now = new Date();
            const currentDay = now.getDay();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${h}:${m}`;

            let activeContent: any = null;

            if (assignments && assignments.length > 0) {
                const assignment = assignments[0];
                
                if (assignment.schedule) {
                    const schedule = assignment.schedule;
                    let activeEvent = null;
                    
                    for (const ev of schedule.events || []) {
                        if (ev.days_of_week && ev.days_of_week.includes(currentDay)) {
                            const parse12hTo24h = (timeStr: string) => {
                                if (!timeStr) return '00:00';
                                const match = timeStr.match(/(\d+):(\d+)\s*(a\.?\s*m\.?|p\.?\s*m\.?)/i);
                                if (!match) return timeStr.substring(0, 5);
                                let [_, hStr, ms, ampm] = match;
                                let hr = parseInt(hStr, 10);
                                const cleanAmPm = ampm.replace(/[\.\s]/g, '').toUpperCase();
                                if (cleanAmPm === 'PM' && hr < 12) hr += 12;
                                if (cleanAmPm === 'AM' && hr === 12) hr = 0;
                                return `${hr.toString().padStart(2, '0')}:${ms}`;
                            };
                            
                            const start24 = parse12hTo24h(ev.start_time);
                            const end24 = parse12hTo24h(ev.end_time);
                            
                            if (currentTimeStr >= start24 && currentTimeStr <= end24) {
                                activeEvent = ev;
                                break;
                            }
                        }
                    }
                    
                    if (activeEvent) {
                        activeContent = { campaign: activeEvent.campaign, media: activeEvent.media };
                    } else {
                        activeContent = { campaign: schedule.default_campaign, media: schedule.default_media };
                    }
                } else {
                    activeContent = { campaign: assignment.campaign, media: assignment.media };
                }
            }

            if (activeContent) {
                let compiledItems: any[] = [];
                if (!device.commerce_id && activeContent.campaign && activeContent.campaign.commerce_id) {
                    setDeviceCommerceId(activeContent.campaign.commerce_id);
                }

                if (activeContent.campaign && activeContent.campaign.items_json) {
                    const rawItems = activeContent.campaign.items_json;
                    if (rawItems.version === '2.0' && Array.isArray(rawItems.zones) && rawItems.zones.length > 0) {
                        compiledItems = rawItems.zones[0].playlist || [];
                    } else if (Array.isArray(rawItems)) {
                        compiledItems = rawItems;
                    }
                } else if (activeContent.media) {
                    if (!device.commerce_id && activeContent.media.commerce_id) {
                        setDeviceCommerceId(activeContent.media.commerce_id);
                    }
                    compiledItems = [{
                        id: activeContent.media.id,
                        type: activeContent.media.type === 'web' ? 'url' : (activeContent.media.type || 'image'),
                        url: activeContent.media.url,
                        metadata: activeContent.media.metadata,
                        duration: 0,
                        title: activeContent.media.name
                    }];
                }

                if (compiledItems.length > 0) {
                    const newItemsString = JSON.stringify(compiledItems);
                    const oldItemsString = localStorage.getItem(`tv_cache_${deviceCode}`);
                    
                    if (oldItemsString !== newItemsString) {
                        setStatus('loading'); // Show preload screen
                        await preloadAssets(compiledItems);
                        localStorage.setItem(`tv_cache_${deviceCode}`, newItemsString);
                        setItems(compiledItems);
                        setCurrentIndex(0); // Reset index on new content
                        setStatus('playing');
                    } else if (status !== 'playing') {
                        setItems(compiledItems);
                        setStatus('playing');
                    }
                    return;
                }
            }

            setStatus('no_content');

        } catch (error: any) {
            console.error('Error fetching campaign from Supabase:', error);
            if (error.code === 'PGRST116') {
                localStorage.removeItem('device_id');
                window.location.href = '/';
                return;
            }

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

    // --- Heartbeat Logic ---
    const sendHeartbeat = async () => {
        if (!deviceCode) return;
        try {
            const { data: device } = await supabase
                .from('display_devices')
                .select('id')
                .eq('device_id', deviceCode)
                .single();
                
            if (device) {
                let telemetry: any = {};
                let appVersion = null;
                let androidVersion = null;
                
                if ((window as any).TvBridge && typeof (window as any).TvBridge.getTelemetry === 'function') {
                    try {
                        const telemetryJson = (window as any).TvBridge.getTelemetry();
                        const bridgeTelemetry = JSON.parse(telemetryJson);
                        if (bridgeTelemetry.app_version) appVersion = bridgeTelemetry.app_version;
                        if (bridgeTelemetry.android_version) androidVersion = bridgeTelemetry.android_version;
                        telemetry = { ...bridgeTelemetry };
                    } catch (e) {}
                }

                // Add Chromium JS memory if available
                if ((window.performance as any).memory) {
                    telemetry.jsHeapSizeLimit = (window.performance as any).memory.jsHeapSizeLimit;
                    telemetry.totalJSHeapSize = (window.performance as any).memory.totalJSHeapSize;
                    telemetry.usedJSHeapSize = (window.performance as any).memory.usedJSHeapSize;
                }

                const updates: any = { 
                    last_seen: new Date().toISOString() 
                };
                
                if (Object.keys(telemetry).length > 0) updates.telemetry = telemetry;
                if (appVersion) updates.app_version = appVersion;
                if (androidVersion) updates.android_version = androidVersion;

                await supabase.from('display_devices').update(updates).eq('id', device.id);
            }
        } catch (error) {}
    };

    // --- Initialization & Realtime Subscriptions ---
    useEffect(() => {
        fetchCampaign();
        sendHeartbeat();

        // Optimización: El Heartbeat ahora es cada 3 minutos (180 segundos)
        heartbeatIntervalRef.current = setInterval(() => {
            sendHeartbeat();
        }, 180 * 1000);

        const handleOnline = () => {
            setStatus('loading');
            fetchCampaign();
        };
        window.addEventListener('online', handleOnline);

        const storedRotation = localStorage.getItem('local_rotation');
        if (storedRotation !== null) {
            setLocalRotation(parseInt(storedRotation, 10));
        }

        const handleRotationChange = (e: any) => {
            setLocalRotation(e.detail);
        };
        window.addEventListener('local_rotation_changed', handleRotationChange);

        // WebSockets: Escuchar cambios de asignación para ESTE device o grupo
        // y comandos en tiempo real. Esto REEMPLAZA al viejo setInterval de 5 segundos.
        const commandChannel = supabase.channel(`device:${deviceCode}`)
            .on('broadcast', { event: 'command' }, (payload) => {
                if (payload.payload?.action === 'reload') {
                    window.location.reload();
                } else if (payload.payload?.action === 'clear_cache') {
                    localStorage.removeItem(`tv_cache_${deviceCode}`);
                    window.location.reload();
                } else if (payload.payload?.action === 'reset_telemetry') {
                    if ((window as any).TvBridge && typeof (window as any).TvBridge.resetTelemetry === 'function') {
                        (window as any).TvBridge.resetTelemetry();
                        sendHeartbeat();
                    }
                } else if (payload.payload?.action === 'sync') {
                    // Triggered by backend when assignments/campaigns change
                    fetchCampaign();
                }
            })
            // También escuchamos a nivel tabla por las dudas
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_assignments' }, () => {
                fetchCampaign();
            })
            .subscribe();

        return () => {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
            if (heartbeatIntervalRef.current) clearTimeout(heartbeatIntervalRef.current);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('local_rotation_changed', handleRotationChange);
            supabase.removeChannel(commandChannel);
        };
    }, [deviceCode, status]);

    // --- Rotation Logic ---
    useEffect(() => {
        if (items.length === 0 || (status !== 'playing' && status !== 'offline_playing')) return;

        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);

        const currentItem = items[currentIndex];
        if (!currentItem) {
            setCurrentIndex(0);
            return;
        }
        
        const durationMs = (currentItem.duration && currentItem.duration > 0 ? currentItem.duration : 10) * 1000;

        rotationTimeoutRef.current = setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }, durationMs);

        return () => {
            if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
        };
    }, [currentIndex, items, status]);


    // --- Renders Optimizados y Limpios ---
    
    const getRotationStyle = (orientation: string | undefined): React.CSSProperties => {
        let degreeStr = orientation === 'portrait' ? '90' : (orientation === 'landscape' ? '0' : (orientation || '0'));
        if (localRotation !== null) degreeStr = String(localRotation);
        const isVertical = degreeStr === '90' || degreeStr === '270';
        
        if (isVertical) {
            return {
                position: 'fixed', transform: `rotate(${degreeStr}deg)`, transformOrigin: 'center center',
                width: '100vh', height: '100vw', top: 'calc(50vh - 50vw)', left: 'calc(50vw - 50vh)',
                backgroundColor: '#111', overflow: 'hidden'
            };
        }
        return {
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            transform: `rotate(${degreeStr}deg)`, transformOrigin: 'center center',
            backgroundColor: '#111', overflow: 'hidden'
        };
    };

    const containerStyle = getRotationStyle(deviceSettings.orientation);

    if (status === 'loading') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#111] flex flex-col items-center justify-center text-white">
                <div className="text-4xl font-bold mb-4 tracking-wider text-[#00C4CC]">Cargando...</div>
                {preloadProgress && (
                    <div className="w-64">
                        <div className="text-sm text-center mb-2 text-zinc-400">
                            Descargando {preloadProgress.current} de {preloadProgress.total} activos
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#00C4CC] transition-all duration-300"
                                style={{ width: `${(preloadProgress.current / preloadProgress.total) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (status === 'no_content') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#111] flex flex-col items-center justify-center text-white">
                <div className="text-6xl font-bold text-[#00C4CC] mb-4">Paired</div>
                <div className="text-xl text-zinc-500">{deviceCode}</div>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="fixed inset-0 w-full h-full bg-[#111] flex flex-col items-center justify-center text-white">
                <div className="text-4xl font-bold text-rose-500 mb-4">Error de Conexión</div>
                <div className="text-lg text-zinc-500 mb-8">Revisando red...</div>
                <button 
                    onClick={() => { setStatus('loading'); fetchCampaign(); }}
                    className="px-6 py-2 bg-zinc-800 text-white rounded-md hover:bg-zinc-700"
                >
                    Reintentar
                </button>
                <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            {items.map((item, index) => (
                <PlayerRenderer 
                    key={`${item.id}-${index}`} 
                    item={item} 
                    isActive={index === currentIndex} 
                    commerceId={deviceCommerceId}
                />
            ))}
            <TvSettingsMenu deviceCode={deviceCode!} onRefresh={() => fetchCampaign()} />
        </div>
    );
};

export default TvPlayer;
