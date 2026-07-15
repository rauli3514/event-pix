import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Profile, UserRole } from "@/types";
import { useEffect, useState } from "react";

/**
 * Hook para obtener el perfil y rol del usuario actual
 */
export const useUserProfile = () => {
    return useQuery({
        queryKey: ["user-profile-v2"], // Cambiado para forzar recarga
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return null;

            console.log("Fetching profile for:", user.id); // Debug log

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Error fetching profile:", error);
                return null;
            }

            console.log("Profile found:", data); // Debug log
            return data as Profile;
        },
        staleTime: 0, // Desactivar caché temporalmente
    });
};

/**
 * Hook para verificar si el usuario es super admin
 */
export const useIsSuperAdmin = () => {
    const { data: profile } = useUserProfile();
    return profile?.role === 'super_admin';
};

/**
 * Hook para obtener todos los providers (solo super admin)
 */
export const useProviders = () => {
    const isSuperAdmin = useIsSuperAdmin();

    return useQuery({
        queryKey: ["providers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .in("role", ["provider", "super_admin"]) // Traer admins y proveedores
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as Profile[];
        },
        enabled: isSuperAdmin,
    });
};

/**
 * Hook para asignar/desasignar providers a eventos
 */
export const useEventProviders = () => {
    const queryClient = useQueryClient();

    const assignProvider = useMutation({
        mutationFn: async ({ eventId, providerId }: { eventId: string; providerId: string }) => {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from("event_providers")
                .insert({
                    event_id: eventId,
                    provider_id: providerId,
                    assigned_by: user?.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["events"] });
            queryClient.invalidateQueries({ queryKey: ["event-providers"] });
        },
    });

    const removeProvider = useMutation({
        mutationFn: async ({ eventId, providerId }: { eventId: string; providerId: string }) => {
            const { error } = await supabase
                .from("event_providers")
                .delete()
                .eq("event_id", eventId)
                .eq("provider_id", providerId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["events"] });
            queryClient.invalidateQueries({ queryKey: ["event-providers"] });
        },
    });

    return { assignProvider, removeProvider };
};

/**
 * Hook para asignar/desasignar providers a comercios
 */
export const useCommerceAssignments = () => {
    const queryClient = useQueryClient();

    const assignCommerce = useMutation({
        mutationFn: async ({ commerceId, userId }: { commerceId: string; userId: string }) => {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from("display_commerce_users")
                .insert({
                    commerce_id: commerceId,
                    user_id: userId,
                    assigned_by: user?.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["display_commerces"] });
            queryClient.invalidateQueries({ queryKey: ["commerce-users"] });
        },
    });

    const removeCommerce = useMutation({
        mutationFn: async ({ commerceId, userId }: { commerceId: string; userId: string }) => {
            const { error } = await supabase
                .from("display_commerce_users")
                .delete()
                .eq("commerce_id", commerceId)
                .eq("user_id", userId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["display_commerces"] });
            queryClient.invalidateQueries({ queryKey: ["commerce-users"] });
        },
    });

    return { assignCommerce, removeCommerce };
};

/**
 * Hook para obtener los providers asignados a un evento
 */
export const useEventProvidersList = (eventId?: string) => {
    return useQuery({
        queryKey: ["event-providers", eventId],
        queryFn: async () => {
            if (!eventId) return [];

            const { data, error } = await supabase
                .from("event_providers")
                .select(`
                    *,
                    provider:profiles!event_providers_provider_id_fkey(*)
                `)
                .eq("event_id", eventId);

            if (error) throw error;
            return data;
        },
        enabled: !!eventId,
    });
};

/**
 * Hook para obtener los eventos asignados a un provider
 */
export const useUserEventAssignments = (userId?: string) => {
    return useQuery({
        queryKey: ["user-event-assignments", userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from("event_providers")
                .select("event_id")
                .eq("provider_id", userId);
            if (error) throw error;
            return data.map(d => d.event_id);
        },
        enabled: !!userId,
    });
};

/**
 * Hook para obtener los comercios asignados a un provider
 */
export const useUserCommerceAssignments = (userId?: string) => {
    return useQuery({
        queryKey: ["commerce-users", userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from("display_commerce_users")
                .select("commerce_id")
                .eq("user_id", userId);
            if (error) throw error;
            return data.map(d => d.commerce_id);
        },
        enabled: !!userId,
    });
};

/**
 * Hook para crear un nuevo provider (solo super admin)
 */
/**
 * Hook para crear un nuevo provider (solo super admin)
 * Usa un cliente secundario para no cerrar la sesión actual
 */
export const useCreateProvider = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ email, name, password, user_type }: { email: string; name?: string; password: string; user_type?: string }) => {
            // 1. Crear un cliente temporal para no perder la sesión del admin
            // Necesitamos la URL y la KEY del cliente actual
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Importamos createClient dinámicamente o usamos el global si es posible
            // Para simplificar, usaremos fetch directo a la API de Auth de Supabase
            // Esto evita instanciar otro cliente completo

            const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                },
                body: JSON.stringify({
                    email,
                    password,
                    data: { name, user_type } // Metadata
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.msg || data.error_description || 'Error al crear usuario');
            }

            // El trigger handle_new_user se encargará de crear el perfil en la tabla profiles
            return data.user;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["providers"] });
        },
    });
};

/**
 * Helper para verificar acceso a un evento
 */
export const useHasEventAccess = (eventId?: string) => {
    const [hasAccess, setHasAccess] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const isSuperAdmin = useIsSuperAdmin();

    useEffect(() => {
        const checkAccess = async () => {
            if (!eventId) {
                setHasAccess(false);
                setLoading(false);
                return;
            }

            // Super admin siempre tiene acceso
            if (isSuperAdmin) {
                setHasAccess(true);
                setLoading(false);
                return;
            }

            // Verificar si está asignado al evento
            const { data } = await supabase
                .from("event_providers")
                .select("id")
                .eq("event_id", eventId)
                .maybeSingle();

            setHasAccess(!!data);
            setLoading(false);
        };

        checkAccess();
    }, [eventId, isSuperAdmin]);

    return { hasAccess, loading };
};

/**
 * Hook para promover un usuario a super_admin (solo desde SQL o super_admin)
 */
export const useUpdateUserRole = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
            const { data, error } = await supabase
                .from("profiles")
                .update({ role })
                .eq("id", userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["providers"] });
            queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        },
    });
};
