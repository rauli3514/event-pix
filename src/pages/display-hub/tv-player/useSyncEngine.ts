import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignItem } from '@/types/display';
import { useCacheManager } from './useCacheManager';

type PlayerStatus = 'loading' | 'playing' | 'offline_playing' | 'no_content' | 'error';

// Última playlist reproducida, para seguir mostrando contenido sin internet.
const cacheKey = (deviceCode: string) => `tv_cache_${deviceCode}_v3`;
// Claves de versiones anteriores del reproductor (solo lectura / limpieza).
const legacyCacheKeys = (deviceCode: string) => [`tv_cache_${deviceCode}_v2`, `tv_cache_${deviceCode}`];

// Agrupa ráfagas de cambios (ej.: guardar una playlist toca varias filas) en una sola consulta.
const REFETCH_DEBOUNCE_MS = 1500;

// Campos de la pantalla que cambian lo que se reproduce. El latido actualiza
// last_seen/telemetría cada minuto y no debe disparar una recarga.
const deviceConfigSignature = (d: Record<string, unknown> | null | undefined) =>
    JSON.stringify([d?.pairing_status, d?.group_id, d?.commerce_id, d?.scale, d?.orientation, d?.name]);

export function useSyncEngine(deviceCode: string | undefined, forceHeartbeat: () => void) {
    const [items, setItems] = useState<CampaignItem[]>([]);
    const [status, setStatus] = useState<PlayerStatus>('loading');
    const [deviceSettings, setDeviceSettings] = useState({ scale: 'fit', orientation: 'landscape' });
    const [deviceName, setDeviceName] = useState<string>('');
    const [deviceCommerceId, setDeviceCommerceId] = useState<string>('');
    const [deviceUuid, setDeviceUuid] = useState<string>('');
    const [deviceGroupId, setDeviceGroupId] = useState<string>('');

    const { preloadAssets, preloadProgress } = useCacheManager();

    // Cada consulta lleva un número; si termina después de una más nueva, se descarta.
    const fetchSeqRef = useRef(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deviceSigRef = useRef<string>('');
    const scheduleIdRef = useRef<string | null>(null);
    // Ids que usa esta pantalla: los DELETE de Realtime solo traen el id, así que
    // se comparan contra estos para no recargar por borrados de otros negocios.
    const deviceUuidRef = useRef<string>('');
    const assignmentIdsRef = useRef<Set<string>>(new Set());
    const scheduleEventIdsRef = useRef<Set<string>>(new Set());

    const fetchCampaign = async () => {
        if (!deviceCode) return;
        const seq = ++fetchSeqRef.current;
        const isStale = () => seq !== fetchSeqRef.current;

        try {
            const { data: device, error: deviceError } = await supabase
                .from('display_devices')
                .select('id, group_id, pairing_status, scale, orientation, commerce_id, name')
                .eq('device_id', deviceCode)
                .single();

            if (deviceError || !device) throw deviceError || new Error("Device not found");
            if (isStale()) return;

            deviceSigRef.current = deviceConfigSignature(device);
            deviceUuidRef.current = device.id;
            setDeviceUuid(device.id);
            setDeviceGroupId(device.group_id || '');

            if (device.name) setDeviceName(device.name);
            setDeviceSettings({ scale: device.scale || 'fit', orientation: device.orientation || 'landscape' });
            if (device.commerce_id) setDeviceCommerceId(device.commerce_id);

            if (device.pairing_status !== 'linked') {
                setStatus('no_content');
                return;
            }

            let orQuery = `device_id.eq.${device.id}`;
            if (device.group_id) {
                orQuery += `,group_id.eq.${device.group_id}`;
            }

            const { data: assignments, error: assignmentsError } = await supabase
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

            if (assignmentsError) throw assignmentsError;
            if (isStale()) return;

            const now = new Date();
            const currentDay = now.getDay();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const currentTimeStr = `${h}:${m}`;

            let activeContent: any = null;
            scheduleIdRef.current = null;
            assignmentIdsRef.current = new Set((assignments || []).map((a: any) => a.id));
            scheduleEventIdsRef.current = new Set();

            if (assignments && assignments.length > 0) {
                const assignment = assignments[0];
                scheduleIdRef.current = assignment.schedule?.id || null;
                scheduleEventIdsRef.current = new Set((assignment.schedule?.events || []).map((ev: any) => ev.id));
                
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
                    const campaignDefaultTransition = activeContent.campaign.settings?.transition || 'fade';
                    
                    if (rawItems.version === '2.0' && Array.isArray(rawItems.zones) && rawItems.zones.length > 0) {
                        compiledItems = rawItems.zones[0].playlist || [];
                    } else if (Array.isArray(rawItems)) {
                        compiledItems = rawItems;
                    }

                    // Asegurar que cada elemento herede la transición por defecto de la playlist si no la especifica
                    compiledItems = compiledItems.map((item: any) => ({
                        ...item,
                        transition: (item.transition && item.transition !== 'default') ? item.transition : campaignDefaultTransition
                    }));
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
                        title: activeContent.media.name,
                        transition: 'fade'
                    }];
                }

                if (compiledItems.length > 0) {
                    const newItemsString = JSON.stringify(compiledItems);
                    const oldItemsString = localStorage.getItem(cacheKey(deviceCode));
                    
                    if (oldItemsString !== newItemsString) {
                        await preloadAssets(compiledItems);
                        if (isStale()) return;
                        try {
                            localStorage.setItem(cacheKey(deviceCode), newItemsString);
                        } catch (e) {
                            console.warn('No se pudo guardar la playlist para modo sin conexión', e);
                        }
                    }

                    // Siempre actualizar el estado de items en React para aplicar cambios de transición y duración
                    setItems(compiledItems);
                    setStatus('playing');
                    return;
                }
            }

            setStatus('no_content');

        } catch (error: any) {
            if (isStale()) return;
            console.error('Error fetching campaign from Supabase:', error);
            if (error?.code === 'PGRST116') {
                localStorage.removeItem('device_id');
                window.location.href = '/';
                return;
            }

            const cachedData = [cacheKey(deviceCode), ...legacyCacheKeys(deviceCode)]
                .map(key => localStorage.getItem(key))
                .find(Boolean);
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

    // Los listeners viven más que un render: siempre llaman a la versión más reciente.
    const fetchRef = useRef(fetchCampaign);
    fetchRef.current = fetchCampaign;

    const scheduleFetch = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            fetchRef.current();
        }, REFETCH_DEBOUNCE_MS);
    };

    useEffect(() => {
        if (!deviceCode) return;
        fetchRef.current();

        const handleOnline = () => {
            setStatus('loading');
            fetchRef.current();
        };
        window.addEventListener('online', handleOnline);

        const commandChannel = supabase.channel(`device:${deviceCode}`)
            .on('broadcast', { event: 'command' }, (payload) => {
                if (payload.payload?.action === 'reload') {
                    window.location.reload();
                } else if (payload.payload?.action === 'clear_cache') {
                    [cacheKey(deviceCode), ...legacyCacheKeys(deviceCode)].forEach(key => localStorage.removeItem(key));
                    window.location.reload();
                } else if (payload.payload?.action === 'rotate_screen') {
                    fetchRef.current();
                } else if (payload.payload?.action === 'reset_telemetry') {
                    if ((window as any).TvBridge && typeof (window as any).TvBridge.resetTelemetry === 'function') {
                        (window as any).TvBridge.resetTelemetry();
                        forceHeartbeat();
                    }
                } else if (payload.payload?.action === 'set_volume') {
                    const vol = payload.payload?.volume;
                    if (typeof vol === 'number' && vol >= 0 && vol <= 100) {
                        if ((window as any).TvBridge && typeof (window as any).TvBridge.setVolume === 'function') {
                            (window as any).TvBridge.setVolume(vol);
                        } else if ((window as any).AndroidKiosk) {
                            (window as any).AndroidKiosk.setVolume(vol);
                        } else {
                            import('@capawesome/capacitor-volume').then(({ Volume }) => {
                                Volume.setVolume({ volume: vol / 100 });
                            }).catch(console.error);
                        }
                        forceHeartbeat();
                    }
                } else if (payload.payload?.action === 'connect_wifi') {
                    const ssid = payload.payload?.ssid;
                    const password = payload.payload?.password;
                    if (ssid && password && (window as any).TvBridge && typeof (window as any).TvBridge.connectToWifi === 'function') {
                        (window as any).TvBridge.connectToWifi(ssid, password);
                        // Wait a few seconds for network to reconnect then heartbeat
                        setTimeout(() => forceHeartbeat(), 5000);
                    }
                } else if (payload.payload?.action === 'sync') {
                    fetchRef.current();
                }
            })
            // Solo los cambios de ESTA pantalla, y solo si cambia algo que afecte lo que se ve
            // (el latido de cada minuto también actualiza la fila).
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'display_devices', filter: `device_id=eq.${deviceCode}` }, (payload) => {
                if (deviceConfigSignature(payload.new) !== deviceSigRef.current) {
                    scheduleFetch();
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'display_devices' }, (payload) => {
                if ((payload.old as { id?: string })?.id === deviceUuidRef.current) {
                    scheduleFetch();
                }
            })
            .subscribe();
            
        // Watchdog Fallback (10 minutes)
        // If web sockets fail, we still check every 10 minutes silently.
        const fallbackInterval = setInterval(() => {
            // Check internet before polling
            if (navigator.onLine) {
                fetchRef.current();
            }
        }, 10 * 60 * 1000);

        return () => {
            window.removeEventListener('online', handleOnline);
            supabase.removeChannel(commandChannel);
            clearInterval(fallbackInterval);
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [deviceCode]); // Removed 'status' dependency to prevent constant resubscription loops

    // Cambios de contenido: filtrados por esta pantalla, su grupo y su negocio, para que
    // la edición de un cliente no haga recargar las TVs de todos los demás.
    useEffect(() => {
        if (!deviceCode || !deviceUuid) return;

        let channel = supabase.channel(`device-content:${deviceCode}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_assignments', filter: `device_id=eq.${deviceUuid}` }, scheduleFetch)
            // Los DELETE no se pueden filtrar en Realtime (solo traen el id).
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'display_assignments' }, (payload) => {
                const id = (payload.old as { id?: string })?.id;
                if (id && assignmentIdsRef.current.has(id)) scheduleFetch();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_schedule_events' }, (payload) => {
                if (!scheduleIdRef.current) return;
                if (payload.eventType === 'DELETE') {
                    const id = (payload.old as { id?: string })?.id;
                    if (id && scheduleEventIdsRef.current.has(id)) scheduleFetch();
                } else if ((payload.new as { schedule_id?: string })?.schedule_id === scheduleIdRef.current) {
                    scheduleFetch();
                }
            });

        if (deviceGroupId) {
            channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'display_assignments', filter: `group_id=eq.${deviceGroupId}` }, scheduleFetch);
        }

        if (deviceCommerceId) {
            for (const table of ['display_campaigns', 'display_media', 'display_schedules']) {
                channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `commerce_id=eq.${deviceCommerceId}` }, scheduleFetch);
            }
        }

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [deviceCode, deviceUuid, deviceGroupId, deviceCommerceId]);

    return {
        items,
        status,
        setStatus,
        deviceSettings,
        deviceName,
        deviceCommerceId,
        preloadProgress,
        fetchCampaign
    };
}
