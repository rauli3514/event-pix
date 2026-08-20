import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignItem } from '@/types/display';
import { useCacheManager } from './useCacheManager';

type PlayerStatus = 'loading' | 'playing' | 'offline_playing' | 'no_content' | 'error';

export function useSyncEngine(deviceCode: string | undefined, forceHeartbeat: () => void) {
    const [items, setItems] = useState<CampaignItem[]>([]);
    const [status, setStatus] = useState<PlayerStatus>('loading');
    const [deviceSettings, setDeviceSettings] = useState({ scale: 'fit', orientation: 'landscape' });
    const [deviceName, setDeviceName] = useState<string>('');
    const [deviceCommerceId, setDeviceCommerceId] = useState<string>('');
    
    const { preloadAssets, preloadProgress } = useCacheManager();

    const fetchCampaign = async () => {
        if (!deviceCode) return;

        try {
            const { data: device, error: deviceError } = await supabase
                .from('display_devices')
                .select('id, group_id, pairing_status, scale, orientation, commerce_id, name')
                .eq('device_id', deviceCode)
                .single();

            if (deviceError || !device) throw deviceError || new Error("Device not found");

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
                        setStatus('loading');
                        await preloadAssets(compiledItems);
                        localStorage.setItem(`tv_cache_${deviceCode}`, newItemsString);
                        setItems(compiledItems);
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

    useEffect(() => {
        fetchCampaign();

        const handleOnline = () => {
            setStatus('loading');
            fetchCampaign();
        };
        window.addEventListener('online', handleOnline);

        const commandChannel = supabase.channel(`device:${deviceCode}`)
            .on('broadcast', { event: 'command' }, (payload) => {
                if (payload.payload?.action === 'reload') {
                    window.location.reload();
                } else if (payload.payload?.action === 'clear_cache') {
                    localStorage.removeItem(`tv_cache_${deviceCode}`);
                    window.location.reload();
                } else if (payload.payload?.action === 'rotate_screen') {
                    fetchCampaign();
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
                    fetchCampaign();
                }
            })
            // Suscribirse no solo a assignments sino también a campañas!
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_devices' }, () => {
                fetchCampaign();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_assignments' }, () => {
                fetchCampaign();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_campaigns' }, () => {
                fetchCampaign();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_media' }, () => {
                fetchCampaign();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'display_schedules' }, () => {
                fetchCampaign();
            })
            .subscribe();
            
        // Watchdog Fallback (10 minutes)
        // If web sockets fail, we still check every 10 minutes silently.
        const fallbackInterval = setInterval(() => {
            // Check internet before polling
            if (navigator.onLine) {
                fetchCampaign();
            }
        }, 10 * 60 * 1000);

        return () => {
            window.removeEventListener('online', handleOnline);
            supabase.removeChannel(commandChannel);
            clearInterval(fallbackInterval);
        };
    }, [deviceCode]); // Removed 'status' dependency to prevent constant resubscription loops

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
