import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DisplayDevice, DisplayAssignment, DisplayGroup, DisplayCampaign } from "@/types/display";

export type DeviceDerivedStatus = 'pending' | 'online' | 'offline';

export type DisplayDeviceWithStatus = DisplayDevice & { 
    derived_status: DeviceDerivedStatus;
    commerce?: { name: string; email: string };
    group?: DisplayGroup;
    assignment?: DisplayAssignment;
};

// ------------------------------------
// COMMERCES & GROUPS (MULTI-TENANT)
// ------------------------------------

export const useCommerces = () => {
    return useQuery({
        queryKey: ["display_commerces"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("display_commerces")
                .select("id, name, email")
                .order("name");
            if (error) throw error;
            return data;
        }
    });
};

export const useCreateCommerce = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ name, email }: { name: string; email?: string }) => {
            const { data, error } = await supabase
                .from("display_commerces")
                .insert([{ name, email }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["display_commerces"] });
        }
    });
};

export const useDeleteCommerce = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("display_commerces")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["display_commerces"] });
        }
    });
};

export const useDisplayGroups = (commerceId?: string) => {
    return useQuery({
        queryKey: ["display_groups", commerceId],
        queryFn: async () => {
            let query = supabase.from("display_groups").select("*").order("name");
            if (commerceId) {
                query = query.eq("commerce_id", commerceId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data as DisplayGroup[];
        },
        enabled: commerceId !== undefined, // Can be null to fetch all
    });
};

export const useCreateDisplayGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ commerceId, name, description, parentId }: { commerceId: string; name: string; description?: string; parentId?: string | null }) => {
            const { data, error } = await supabase
                .from("display_groups")
                .insert({ commerce_id: commerceId, name, description, parent_id: parentId })
                .select()
                .single();
            if (error) throw error;
            return data as DisplayGroup;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_groups", variables.commerceId] });
            queryClient.invalidateQueries({ queryKey: ["display_groups"] });
        }
    });
};

export const useUpdateDisplayGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<DisplayGroup> }) => {
            const { data, error } = await supabase
                .from("display_groups")
                .update(updates)
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data as DisplayGroup;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["display_groups", data.commerce_id] });
            queryClient.invalidateQueries({ queryKey: ["display_groups"] });
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
        }
    });
};

export const useDeleteDisplayGroup = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const { data: group } = await supabase.from("display_groups").select("commerce_id").eq("id", id).single();
            const { error } = await supabase.from("display_groups").delete().eq("id", id);
            if (error) throw error;
            return group;
        },
        onSuccess: (data) => {
            if (data?.commerce_id) {
                queryClient.invalidateQueries({ queryKey: ["display_groups", data.commerce_id] });
                queryClient.invalidateQueries({ queryKey: ["display_groups"] });
                queryClient.invalidateQueries({ queryKey: ["display_devices"] });
            }
        }
    });
};

// ------------------------------------
// CAMPAIGNS (PLAYLISTS)
// ------------------------------------

export const useDisplayCampaigns = (commerceId?: string) => {
    return useQuery({
        queryKey: ["display_campaigns", commerceId],
        queryFn: async () => {
            if (!commerceId) return [];
            const { data, error } = await supabase
                .from("display_campaigns")
                .select("*")
                .eq("commerce_id", commerceId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as DisplayCampaign[];
        },
        enabled: !!commerceId,
    });
};

export const useCreateCampaign = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ commerceId, name, description, items_json }: { commerceId: string; name: string; description?: string; items_json?: any }) => {
            const { data, error } = await supabase
                .from("display_campaigns")
                .insert({
                    commerce_id: commerceId,
                    name,
                    description,
                    items_json: items_json || []
                })
                .select()
                .single();
            if (error) throw error;
            return data as DisplayCampaign;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_campaigns", variables.commerceId] });
        }
    });
};

export const useUpdateCampaign = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<DisplayCampaign> }) => {
            const { data, error } = await supabase
                .from("display_campaigns")
                .update(updates)
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data as DisplayCampaign;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["display_campaigns", data.commerce_id] });
            queryClient.invalidateQueries({ queryKey: ["display_device"] }); // Invalidate devices as their assigned campaign content changed
        }
    });
};

export const useDeleteCampaign = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const { data: campaign } = await supabase.from("display_campaigns").select("commerce_id").eq("id", id).single();
            const { error } = await supabase.from("display_campaigns").delete().eq("id", id);
            if (error) throw error;
            return campaign;
        },
        onSuccess: (data) => {
            if (data?.commerce_id) {
                queryClient.invalidateQueries({ queryKey: ["display_campaigns", data.commerce_id] });
            }
        }
    });
};

// ------------------------------------
// DEVICES & ASSIGNMENTS
// ------------------------------------

export const useDisplayDevices = (commerceId?: string | null) => {
    return useQuery({
        queryKey: ["display_devices", commerceId],
        queryFn: async () => {
            let query = supabase
                .from("display_devices")
                .select(`
                    *,
                    commerce:display_commerces(name, email),
                    group:display_groups(*),
                    assignment:display_assignments(*, campaign:display_campaigns(*), media:display_media(*), schedule:display_schedules(*, events:display_schedule_events(*, campaign:display_campaigns!campaign_id(*), media:display_media!media_id(*)), default_campaign:display_campaigns!default_campaign_id(*), default_media:display_media!default_media_id(*)))
                `)
                .order("created_at", { ascending: false });

            if (commerceId) {
                query = query.eq("commerce_id", commerceId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch all assignments manually to ensure we get group assignments and bypass relation quirks
            const { data: allAssignments } = await supabase
                .from('display_assignments')
                .select('*, campaign:display_campaigns(*), media:display_media(*), schedule:display_schedules(*, events:display_schedule_events(*, campaign:display_campaigns!campaign_id(*), media:display_media!media_id(*)), default_campaign:display_campaigns!default_campaign_id(*), default_media:display_media!default_media_id(*))');
            
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            
            return (data as any[]).map(device => {
                let status: DeviceDerivedStatus = 'offline';
                
                if (device.pairing_status === 'pending') {
                    status = 'pending';
                } else if (device.pairing_status === 'linked') {
                    if (device.last_seen && new Date(device.last_seen) > twoMinutesAgo) {
                        status = 'online';
                    } else {
                        status = 'offline';
                    }
                }

                // Find assignment: first check direct device_id match, then group_id match
                let activeAssignment = null;
                if (allAssignments) {
                    const directMatch = allAssignments.find(a => a.device_id === device.id);
                    const groupMatch = device.group_id ? allAssignments.find(a => a.group_id === device.group_id) : null;
                    activeAssignment = directMatch || groupMatch || null;
                }

                return { 
                    ...device, 
                    derived_status: status,
                    assignment: activeAssignment
                } as DisplayDeviceWithStatus & { assignment: DisplayAssignment | null };
            });
        },
        refetchInterval: 30000,
    });
};

export const useDisplayDevice = (id?: string) => {
    return useQuery({
        queryKey: ["display_device", id],
        queryFn: async () => {
            if (!id) return null;

            const { data: device, error: deviceError } = await supabase
                .from("display_devices")
                .select(`
                    *,
                    commerce:display_commerces(name, email),
                    group:display_groups(*)
                `)
                .eq("id", id)
                .single();

            if (deviceError) throw deviceError;

            let orQuery = `device_id.eq.${id}`;
            if (device.group_id) {
                orQuery += `,group_id.eq.${device.group_id}`;
            }

            const { data: assignments } = await supabase
                .from("display_assignments")
                .select(`
                    *,
                    campaign:display_campaigns(*),
                    media:display_media(*)
                `)
                .or(orQuery)
                .order('created_at', { ascending: false });

            // assignment will be the default one (no start_time), but we can also attach the full array
            const defaultAssignment = assignments?.find(a => !a.start_time) || (assignments && assignments.length > 0 ? assignments[0] : null);

            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            let status: DeviceDerivedStatus = 'offline';
            if (device.pairing_status === 'pending') status = 'pending';
            else if (device.pairing_status === 'linked' && device.last_seen && new Date(device.last_seen) > twoMinutesAgo) status = 'online';

            return {
                ...device,
                derived_status: status,
                assignment: defaultAssignment as DisplayAssignment | null,
                allAssignments: assignments as DisplayAssignment[] | null
            } as DisplayDeviceWithStatus & { assignment: DisplayAssignment | null; allAssignments: DisplayAssignment[] | null };
        },
        enabled: !!id,
        refetchInterval: 30000,
    });
};

export const useLinkDevice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ device_code, name, description, commerce_id, group_id, orientation = 'landscape' }: { device_code: string; name: string; description?: string; commerce_id: string; group_id?: string; orientation?: string }) => {
            
            // First verify that the device exists and is pending
            const { data: pendingDevice, error: findError } = await supabase
                .from("display_devices")
                .select("id")
                .eq("device_id", device_code)
                .eq("pairing_status", "pending")
                .single();

            if (findError || !pendingDevice) {
                throw new Error("Código inválido o dispositivo ya vinculado.");
            }

            const { data, error } = await supabase
                .from("display_devices")
                .update({
                    name,
                    description,
                    commerce_id,
                    group_id: group_id || null,
                    pairing_status: 'linked',
                    orientation
                })
                .eq("id", pendingDevice.id)
                .select()
                .single();

            if (error) throw error;
            return data as DisplayDevice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
        },
    });
};

export const useUpdateDisplayDevice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<DisplayDevice> }) => {
            const { data, error } = await supabase
                .from("display_devices")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as DisplayDevice;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
            queryClient.invalidateQueries({ queryKey: ["display_device", variables.id] });
        },
    });
};

export const useAssignContentToDevice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ deviceId, campaignId, mediaId, scheduleId, startTime, endTime }: { deviceId: string; campaignId?: string | null; mediaId?: string | null; scheduleId?: string | null; startTime?: string | null; endTime?: string | null }) => {
            await supabase.from("display_assignments").delete().eq("device_id", deviceId);

            const { data, error } = await supabase
                .from("display_assignments")
                .insert({
                    device_id: deviceId,
                    campaign_id: campaignId || null,
                    media_id: mediaId || null,
                    schedule_id: scheduleId || null,
                    start_time: startTime || null,
                    end_time: endTime || null
                })
                .select()
                .single();

            if (error) throw error;
            return data as DisplayAssignment;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_device", variables.deviceId] });
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
        },
    });
};

export const useDeleteAssignment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id }: { id: string, deviceId: string }) => {
            const { error } = await supabase.from("display_assignments").delete().eq("id", id);
            if (error) throw error;
            return id;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_device", variables.deviceId] });
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
        }
    });
};

export const useDeviceHeartbeats = (deviceId?: string) => {
    return useQuery({
        queryKey: ["display_heartbeats", deviceId],
        queryFn: async () => {
            if (!deviceId) return [];
            
            const { data, error } = await supabase
                .from("display_heartbeats")
                .select("*")
                .eq("device_id", deviceId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) throw error;
            return data;
        },
        enabled: !!deviceId,
    });
};

// ------------------------------------
// SCHEDULES (Programación de contenido)
// ------------------------------------

export const useDisplaySchedules = (commerceId?: string) => {
    return useQuery({
        queryKey: ["display_schedules", commerceId],
        queryFn: async () => {
            if (!commerceId) return [];
            const { data, error } = await supabase
                .from("display_schedules")
                .select(`
                    *,
                    default_media:display_media!default_media_id(id, name, type, url),
                    default_campaign:display_campaigns!default_campaign_id(id, name),
                    events:display_schedule_events(
                        *,
                        media:display_media!media_id(id, name, type, url),
                        campaign:display_campaigns!campaign_id(id, name)
                    )
                `)
                .eq("commerce_id", commerceId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!commerceId,
    });
};

export const useCreateSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: {
            commerceId: string;
            name: string;
            defaultMediaId?: string | null;
            defaultCampaignId?: string | null;
            events: {
                mediaId?: string | null;
                campaignId?: string | null;
                startTime: string;
                endTime: string;
                daysOfWeek: number[];
            }[];
        }) => {
            // 1. Create Schedule
            const { data: schedule, error: scheduleError } = await supabase
                .from("display_schedules")
                .insert({
                    commerce_id: payload.commerceId,
                    name: payload.name,
                    default_media_id: payload.defaultMediaId || null,
                    default_campaign_id: payload.defaultCampaignId || null,
                })
                .select()
                .single();
            if (scheduleError) throw scheduleError;

            // 2. Create Events
            if (payload.events.length > 0) {
                const eventsToInsert = payload.events.map(ev => ({
                    schedule_id: schedule.id,
                    media_id: ev.mediaId || null,
                    campaign_id: ev.campaignId || null,
                    start_time: ev.startTime,
                    end_time: ev.endTime,
                    days_of_week: ev.daysOfWeek,
                }));
                const { error: eventsError } = await supabase
                    .from("display_schedule_events")
                    .insert(eventsToInsert);
                if (eventsError) throw eventsError;
            }

            return schedule;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["display_schedules", data.commerce_id] });
        }
    });
};

export const useDeleteSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (scheduleId: string) => {
            const { error } = await supabase
                .from("display_schedules")
                .delete()
                .eq("id", scheduleId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["display_schedules"] });
        }
    });
};

export const useUpdateSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates, newEvents }: { id: string; updates: any, newEvents?: any[] }) => {
            let data = null;
            if (updates && Object.keys(updates).length > 0) {
                const result = await supabase
                    .from("display_schedules")
                    .update(updates)
                    .eq("id", id)
                    .select()
                    .single();
                if (result.error) throw result.error;
                data = result.data;
            } else {
                // Si no hay updates al schedule, solo devolvemos los datos basicos que necesitamos
                const result = await supabase.from("display_schedules").select("*").eq("id", id).single();
                if (result.error) throw result.error;
                data = result.data;
            }
            
            // Si mandamos nuevos eventos, borramos los viejos y ponemos los nuevos (simplificación de edición)
            if (newEvents) {
                await supabase.from("display_schedule_events").delete().eq("schedule_id", id);
                if (newEvents.length > 0) {
                    const eventsToInsert = newEvents.map(ev => ({
                        schedule_id: id,
                        media_id: ev.mediaId || null,
                        campaign_id: ev.campaignId || null,
                        start_time: ev.startTime,
                        end_time: ev.endTime,
                        days_of_week: ev.daysOfWeek,
                    }));
                    await supabase.from("display_schedule_events").insert(eventsToInsert);
                }
            }
            
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["display_schedules", data.commerce_id] });
            queryClient.invalidateQueries({ queryKey: ["display_devices"] }); // Schedules might be assigned to devices
        }
    });
};
