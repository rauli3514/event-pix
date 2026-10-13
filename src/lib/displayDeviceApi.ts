import { supabase } from '@/lib/supabase';

// Llamadas de las pantallas (sin sesión) y de la vinculación que pasan por
// RPCs seguras (migración 20261013000000_display_security_hardening.sql).
// Si la migración todavía no se aplicó en la base, la RPC no existe y se cae
// al método anterior para no dejar las TVs sin latido ni el panel sin vincular.

const isMissingRpc = (error: { code?: string } | null) =>
    !!error && (error.code === 'PGRST202' || error.code === '42883');

export interface HeartbeatPayload {
    telemetry?: Record<string, unknown> | null;
    appVersion?: string | null;
    androidVersion?: string | null;
}

export async function sendDeviceHeartbeat(deviceCode: string, payload: HeartbeatPayload = {}) {
    const { error } = await supabase.rpc('display_device_heartbeat', {
        p_device_code: deviceCode,
        p_telemetry: payload.telemetry ?? null,
        p_app_version: payload.appVersion ?? null,
        p_android_version: payload.androidVersion ?? null,
    });

    if (!isMissingRpc(error)) {
        if (error) throw error;
        return;
    }

    const updates: Record<string, unknown> = { last_seen: new Date().toISOString() };
    if (payload.telemetry) updates.telemetry = payload.telemetry;
    if (payload.appVersion) updates.app_version = payload.appVersion;
    if (payload.androidVersion) updates.android_version = payload.androidVersion;

    const { error: fallbackError } = await supabase
        .from('display_devices')
        .update(updates)
        .eq('device_id', deviceCode);
    if (fallbackError) throw fallbackError;
}

export interface LinkDeviceParams {
    device_code: string;
    name: string;
    description?: string;
    commerce_id: string;
    group_id?: string;
    orientation?: string;
}

export async function linkDisplayDevice({ device_code, name, description, commerce_id, group_id, orientation = 'landscape' }: LinkDeviceParams) {
    const { data, error } = await supabase.rpc('display_link_device', {
        p_device_code: device_code,
        p_commerce_id: commerce_id,
        p_name: name,
        p_description: description ?? null,
        p_group_id: group_id || null,
        p_orientation: orientation,
    });

    if (!isMissingRpc(error)) {
        if (error) throw new Error(error.message || 'Código inválido o dispositivo ya vinculado.');
        return data;
    }

    const { data: pendingDevice, error: findError } = await supabase
        .from('display_devices')
        .select('id')
        .eq('device_id', device_code)
        .eq('pairing_status', 'pending')
        .single();

    if (findError || !pendingDevice) {
        throw new Error('Código inválido o dispositivo ya vinculado.');
    }

    const { data: linked, error: updateError } = await supabase
        .from('display_devices')
        .update({
            name,
            description,
            commerce_id,
            group_id: group_id || null,
            pairing_status: 'linked',
            orientation,
        })
        .eq('id', pendingDevice.id)
        .select()
        .single();

    if (updateError) throw updateError;
    return linked;
}
