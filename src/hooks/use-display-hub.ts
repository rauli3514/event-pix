import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DisplayDevice, DisplayAssignment, DisplayGroup, DisplayCampaign } from "@/types/display";

export type DeviceDerivedStatus = 'pending' | 'online' | 'offline';

export interface DisplayDeviceWithStatus extends DisplayDevice {
    derived_status: DeviceDerivedStatus;
    commerce?: { name: string; email: string };
    group?: DisplayGroup;
}

// ------------------------------------
// COMMERCES & GROUPS (MULTI-TENANT)
// ------------------------------------

export const useCommerces = () => {
    return useQuery({
        queryKey: ["display_commerces"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, name, email")
                .eq("role", "provider")
                .order("name");
            if (error) throw error;
            return data;
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
        mutationFn: async ({ commerceId, name, description }: { commerceId: string; name: string; description?: string }) => {
            const { data, error } = await supabase
                .from("display_groups")
                .insert({ commerce_id: commerceId, name, description })
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
        mutationFn: async ({ commerceId, name, description }: { commerceId: string; name: string; description?: string }) => {
            const { data, error } = await supabase
                .from("display_campaigns")
                .insert({
                    commerce_id: commerceId,
                    name,
                    description,
                    items_json: []
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
                    commerce:profiles(name, email),
                    group:display_groups(*)
                `)
                .order("created_at", { ascending: false });

            if (commerceId) {
                query = query.eq("commerce_id", commerceId);
            }

            const { data, error } = await query;

            if (error) throw error;
            
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

                return { ...device, derived_status: status } as DisplayDeviceWithStatus;
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
                    commerce:profiles(name, email),
                    group:display_groups(*)
                `)
                .eq("id", id)
                .single();

            if (deviceError) throw deviceError;

            const { data: assignment } = await supabase
                .from("display_assignments")
                .select(`
                    *,
                    campaign:display_campaigns(*)
                `)
                .eq("device_id", id)
                .maybeSingle();

            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            let status: DeviceDerivedStatus = 'offline';
            if (device.pairing_status === 'pending') status = 'pending';
            else if (device.pairing_status === 'linked' && device.last_seen && new Date(device.last_seen) > twoMinutesAgo) status = 'online';

            return {
                ...device,
                derived_status: status,
                assignment: assignment as DisplayAssignment | null
            } as DisplayDeviceWithStatus & { assignment: DisplayAssignment | null };
        },
        enabled: !!id,
        refetchInterval: 30000,
    });
};

export const useLinkDevice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ device_code, name, description, commerce_id, group_id }: { device_code: string; name: string; description?: string; commerce_id: string; group_id?: string }) => {
            
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
                    pairing_status: 'linked'
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
        mutationFn: async ({ deviceId, campaignId }: { deviceId: string; campaignId: string }) => {
            const { data, error } = await supabase
                .from("display_assignments")
                .upsert({
                    device_id: deviceId,
                    campaign_id: campaignId
                }, { onConflict: 'device_id' })
                .select()
                .single();

            if (error) throw error;
            return data as DisplayAssignment;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["display_device", variables.deviceId] });
        },
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
