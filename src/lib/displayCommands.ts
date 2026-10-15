import { supabase } from '@/lib/supabase';

// Comandos remotos del panel a las TVs, firmados y cifrados con una clave que
// solo conocen la TV y la base (migración 20261014000000_display_signed_commands.sql).
// El canal Realtime `device:<código>` es público: lo que viaja por ahí no sirve
// sin la clave, y la TV descarta lo que no pueda verificar.

export type DeviceCommand =
    | { action: 'reload' }
    | { action: 'clear_cache' }
    | { action: 'reset_telemetry' }
    | { action: 'set_volume'; volume: number }
    | { action: 'connect_wifi'; ssid: string; password: string }
    // Abre en la TV la actualización de la app (alguien confirma con el control remoto).
    | { action: 'update_app' };

interface SignedCommand {
    v: 2;
    iv: string;
    ct: string;
    sig: string;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export async function sendDeviceCommand(device: { id: string; device_id: string }, command: DeviceCommand) {
    const { data, error } = await supabase.rpc('display_sign_command', {
        p_device_id: device.id,
        p_command: command,
    });
    if (error) throw new Error(error.message || 'No se pudo firmar el comando');

    const channel = supabase.channel(`device:${device.device_id}`);
    try {
        const result = await channel.httpSend('command', data as SignedCommand);
        if (!result.success) throw new Error(result.error || 'No se pudo enviar el comando');
    } finally {
        supabase.removeChannel(channel);
    }
}

export async function resetDeviceCommandSecret(deviceId: string) {
    const { error } = await supabase.rpc('display_reset_command_secret', { p_device_id: deviceId });
    if (error) throw new Error(error.message || 'No se pudo restablecer la clave');
}

// ---------------------------------------------------------------------------
// TV
// ---------------------------------------------------------------------------

const secretKey = (deviceCode: string) => `tv_cmd_secret_${deviceCode}`;

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string) => {
    if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error('hex inválido');
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
};

// Clave de esta TV: se genera una vez y queda en el almacenamiento local.
export function getOrCreateCommandSecret(deviceCode: string): string {
    let secret = localStorage.getItem(secretKey(deviceCode));
    if (!secret || !/^[0-9a-f]{64}$/.test(secret)) {
        secret = toHex(crypto.getRandomValues(new Uint8Array(32)));
        localStorage.setItem(secretKey(deviceCode), secret);
    }
    return secret;
}

// Registra la clave en la base. Devuelve false si la pantalla ya tiene otra
// clave registrada (hay que restablecerla desde el panel).
export async function registerCommandSecret(deviceCode: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('display_register_command_secret', {
        p_device_code: deviceCode,
        p_secret: getOrCreateCommandSecret(deviceCode),
    });
    if (error) throw error;
    return data === true;
}

// Tolerancia de reloj entre la base y la TV, y ventana anti-repetición.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const seenNonces = new Map<string, number>();

const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
};

// Verifica, descifra y valida un comando recibido. Devuelve null si no es
// auténtico, es para otra pantalla, es viejo o ya se usó.
export async function openSignedCommand(
    payload: unknown,
    deviceCode: string,
    secret: string,
    now: number = Date.now()
): Promise<DeviceCommand | null> {
    try {
        const p = payload as Partial<SignedCommand> | null;
        if (!p || p.v !== 2 || !p.iv || !p.ct || !p.sig || !crypto?.subtle) return null;

        const iv = fromHex(p.iv);
        const ct = fromHex(p.ct);
        const encoder = new TextEncoder();

        const macKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signed = new Uint8Array(iv.length + ct.length);
        signed.set(iv);
        signed.set(ct, iv.length);
        const expected = new Uint8Array(await crypto.subtle.sign('HMAC', macKey, signed));
        if (!timingSafeEqual(expected, fromHex(p.sig))) return null;

        const encKeyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(`enc:${secret}`));
        const encKey = await crypto.subtle.importKey('raw', encKeyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, encKey, ct);
        const msg = JSON.parse(new TextDecoder().decode(plain));

        if (msg.device !== deviceCode) return null;
        if (typeof msg.ts !== 'number' || Math.abs(now - msg.ts) > MAX_CLOCK_SKEW_MS) return null;
        if (typeof msg.nonce !== 'string' || seenNonces.has(msg.nonce)) return null;

        seenNonces.set(msg.nonce, now);
        for (const [nonce, seenAt] of seenNonces) {
            if (now - seenAt > 2 * MAX_CLOCK_SKEW_MS) seenNonces.delete(nonce);
        }

        return msg.cmd as DeviceCommand;
    } catch {
        return null;
    }
}
