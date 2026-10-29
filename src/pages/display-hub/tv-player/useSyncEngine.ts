import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignItem } from '@/types/display';
import { useCacheManager } from './useCacheManager';
import { findActiveScheduleEvent, pickActiveAssignment } from '@/lib/displaySchedule';
import { getOrCreateCommandSecret, openSignedCommand, registerCommandSecret } from '@/lib/displayCommands';
import { callTvBridge, hasTvBridgeMethod } from '@/lib/tvBridge';

type PlayerStatus = 'loading' | 'playing' | 'offline_playing' | 'no_content' | 'error';

// Última playlist reproducida, para seguir mostrando contenido sin internet.
const cacheKey = (deviceCode: string) => `tv_cache_${deviceCode}_v3`;
// Claves de versiones anteriores del reproductor (solo lectura / limpieza).
const legacyCacheKeys = (deviceCode: string) => [`tv_cache_${deviceCode}_v2`, `tv_cache_${deviceCode}`];
// Asignación con su programación, para cambiar de franja horaria aun sin internet.
const assignmentCacheKey = (deviceCode: string) => `tv_assignment_${deviceCode}_v1`;

// Cada cuánto se revisa si cambió la franja horaria de la programación.
const SCHEDULE_TICK_MS = 30 * 1000;

// Cada cuánto la TV vuelve a registrar su clave de comandos.
const COMMAND_SECRET_RETRY_MS = 5 * 60 * 1000;

// Cuánto se espera a que baje el contenido nuevo antes de mostrarlo. En el
// primer arranque no hay nada en pantalla y conviene esperar más; con algo ya
// reproduciéndose, un cambio desde el panel tiene que verse enseguida.
const PRELOAD_WAIT_FIRST_MS = 45 * 1000;
const PRELOAD_WAIT_UPDATE_MS = 10 * 1000;

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

    // Asignación vigente (con su programación completa) y qué parte de ella se está
    // mostrando, para poder cambiar de franja horaria sin volver a consultar.
    const assignmentRef = useRef<any>(null);
    const activeContentKeyRef = useRef<string | null>(null);
    const [contentKey, setContentKey] = useState<string | null>(null);
    const [shuffle, setShuffle] = useState(false);
    const offlineRef = useRef(false);
    // Ya hay contenido en pantalla (los cambios siguientes no esperan tanto la descarga).
    const hasShownContentRef = useRef(false);

    // Arma la playlist de lo que toca mostrar ahora según la asignación y la publica.
    const applyAssignment = async (assignment: any, isStale: () => boolean) => {
        const now = new Date();
        let activeContent: { campaign: any; media: any } | null = null;
        let contentKey: string | null = null;

        if (assignment?.schedule) {
            const schedule = assignment.schedule;
            const activeEvent = findActiveScheduleEvent<any>(schedule.events, now);
            activeContent = activeEvent
                ? { campaign: activeEvent.campaign, media: activeEvent.media }
                : { campaign: schedule.default_campaign, media: schedule.default_media };
            contentKey = `${assignment.id}:${activeEvent ? activeEvent.id : 'default'}`;
        } else if (assignment) {
            activeContent = { campaign: assignment.campaign, media: assignment.media };
            contentKey = `${assignment.id}:direct`;
        }
        activeContentKeyRef.current = contentKey;

        let compiledItems: any[] = [];
        let playlistShuffle = false;
        if (activeContent) {
            if (activeContent.campaign && activeContent.campaign.commerce_id) {
                setDeviceCommerceId(prev => prev || activeContent!.campaign.commerce_id);
            }

            if (activeContent.campaign && activeContent.campaign.items_json) {
                const rawItems = activeContent.campaign.items_json;
                // La configuración de la playlist (editor V2) vive dentro de items_json.settings.
                const playlistSettings = rawItems?.settings || activeContent.campaign.settings || {};
                const campaignDefaultTransition = playlistSettings.transition || 'fade';
                playlistShuffle = !!playlistSettings.shuffle;
                
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
                if (activeContent.media.commerce_id) {
                    setDeviceCommerceId(prev => prev || activeContent!.media.commerce_id);
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
        }

        if (compiledItems.length === 0) {
            setStatus('no_content');
            return;
        }

        const newItemsString = JSON.stringify(compiledItems);
        const oldItemsString = localStorage.getItem(cacheKey(deviceCode!));
        
        if (oldItemsString !== newItemsString) {
            if (!offlineRef.current) {
                await preloadAssets(compiledItems, hasShownContentRef.current ? PRELOAD_WAIT_UPDATE_MS : PRELOAD_WAIT_FIRST_MS);
            }
            if (isStale()) return;
            try {
                localStorage.setItem(cacheKey(deviceCode!), newItemsString);
            } catch (e) {
                console.warn('No se pudo guardar la playlist para modo sin conexión', e);
            }
        }

        // Siempre actualizar el estado de items en React para aplicar cambios de transición y duración
        setContentKey(contentKey);
        setShuffle(playlistShuffle);
        setItems(compiledItems);
        setStatus(offlineRef.current ? 'offline_playing' : 'playing');
        hasShownContentRef.current = true;
    };

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

            // Misma regla que el panel: primero la asignación directa de la pantalla, después la del grupo.
            const assignment = pickActiveAssignment(assignments as any[], device.id, device.group_id);

            assignmentIdsRef.current = new Set((assignments || []).map((a: any) => a.id));
            scheduleIdRef.current = assignment?.schedule?.id || null;
            scheduleEventIdsRef.current = new Set((assignment?.schedule?.events || []).map((ev: any) => ev.id));
            assignmentRef.current = assignment;
            offlineRef.current = false;
            try {
                localStorage.setItem(assignmentCacheKey(deviceCode), JSON.stringify(assignment));
            } catch (e) {
                console.warn('No se pudo guardar la programación para modo sin conexión', e);
            }

            await applyAssignment(assignment, isStale);

        } catch (error: any) {
            if (isStale()) return;
            console.error('Error fetching campaign from Supabase:', error);
            if (error?.code === 'PGRST116') {
                localStorage.removeItem('device_id');
                window.location.href = '/';
                return;
            }

            offlineRef.current = true;

            // Sin conexión: si hay una programación guardada se sigue respetando el horario.
            try {
                const cachedAssignment = JSON.parse(localStorage.getItem(assignmentCacheKey(deviceCode)) || 'null');
                if (cachedAssignment?.schedule) {
                    assignmentRef.current = cachedAssignment;
                    await applyAssignment(cachedAssignment, isStale);
                    return;
                }
            } catch (e) { /* programación guardada inválida: se usa la última playlist */ }

            const cachedData = [cacheKey(deviceCode), ...legacyCacheKeys(deviceCode)]
                .map(key => localStorage.getItem(key))
                .find(Boolean);
            if (cachedData) {
                try {
                    const parsedItems = JSON.parse(cachedData) as CampaignItem[];
                    if (parsedItems.length > 0) {
                        setItems(parsedItems);
                        setStatus('offline_playing');
                        hasShownContentRef.current = true;
                        return;
                    }
                } catch (e) { /* caché inválida */ }
            }
            setStatus('error');
        }
    };

    // Los listeners viven más que un render: siempre llaman a la versión más reciente.
    const fetchRef = useRef(fetchCampaign);
    fetchRef.current = fetchCampaign;
    const applyRef = useRef(applyAssignment);
    applyRef.current = applyAssignment;

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
            .on('broadcast', { event: 'command' }, async (message) => {
                const raw = message.payload;
                // Pedidos inofensivos (solo vuelven a consultar el contenido): se aceptan sin firma.
                if (raw?.action === 'sync' || raw?.action === 'rotate_screen') {
                    scheduleFetch();
                    return;
                }

                // Todo lo demás tiene que venir cifrado y firmado por el panel (ver displayCommands.ts).
                const command = await openSignedCommand(raw, deviceCode, getOrCreateCommandSecret(deviceCode));
                if (!command) {
                    console.warn('Comando remoto descartado: no está firmado para esta pantalla.');
                    return;
                }

                if (command.action === 'reload') {
                    window.location.reload();
                } else if (command.action === 'clear_cache') {
                    [cacheKey(deviceCode), assignmentCacheKey(deviceCode), ...legacyCacheKeys(deviceCode)].forEach(key => localStorage.removeItem(key));
                    window.location.reload();
                } else if (command.action === 'reset_telemetry') {
                    if (hasTvBridgeMethod('resetTelemetry')) {
                        callTvBridge('resetTelemetry');
                        forceHeartbeat();
                    }
                } else if (command.action === 'set_volume') {
                    const vol = command.volume;
                    if (typeof vol === 'number' && vol >= 0 && vol <= 100) {
                        if (hasTvBridgeMethod('setVolume')) {
                            callTvBridge('setVolume', vol);
                        } else if ((window as any).AndroidKiosk) {
                            (window as any).AndroidKiosk.setVolume(vol);
                        } else {
                            import('@capawesome/capacitor-volume').then(({ Volume }) => {
                                Volume.setVolume({ volume: vol / 100 });
                            }).catch(console.error);
                        }
                        forceHeartbeat();
                    }
                } else if (command.action === 'update_app') {
                    if (hasTvBridgeMethod('startUpdate')) callTvBridge('startUpdate');
                } else if (command.action === 'connect_wifi') {
                    const { ssid, password } = command;
                    if (ssid && password && hasTvBridgeMethod('connectToWifi')) {
                        callTvBridge('connectToWifi', ssid, password);
                        // Wait a few seconds for network to reconnect then heartbeat
                        setTimeout(() => forceHeartbeat(), 5000);
                    }
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

    // Clave de comandos remotos: se registra al arrancar y se reintenta cada tanto
    // (por si no había red, o si alguien la restableció desde el panel).
    useEffect(() => {
        if (!deviceCode) return;
        const register = () => {
            registerCommandSecret(deviceCode)
                .then(ok => {
                    if (!ok) console.warn('Esta pantalla tiene otra clave de comandos registrada: restablecela desde el panel.');
                })
                .catch(() => { /* sin red o migración pendiente: se reintenta */ });
        };
        register();
        const interval = setInterval(register, COMMAND_SECRET_RETRY_MS);
        return () => clearInterval(interval);
    }, [deviceCode]);

    // Cambio de franja horaria: se evalúa localmente (también sin internet) en vez de
    // esperar a la próxima consulta al servidor, que puede tardar hasta 10 minutos.
    useEffect(() => {
        if (!deviceCode) return;
        const interval = setInterval(() => {
            const assignment = assignmentRef.current;
            if (!assignment?.schedule) return;
            const activeEvent = findActiveScheduleEvent<any>(assignment.schedule.events, new Date());
            const key = `${assignment.id}:${activeEvent ? activeEvent.id : 'default'}`;
            if (key !== activeContentKeyRef.current) {
                const seq = fetchSeqRef.current;
                applyRef.current(assignment, () => seq !== fetchSeqRef.current);
            }
        }, SCHEDULE_TICK_MS);
        return () => clearInterval(interval);
    }, [deviceCode]);

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
        fetchCampaign,
        contentKey,
        shuffle
    };
}
