import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getDeviceCode, getDeviceSecret } from './device';

// Envío del video al WhatsApp del invitado, por la función send-video-whatsapp
// (API oficial de WhatsApp). El equipo se identifica con su código y su clave.

/** Prefijo por defecto: Argentina, celulares (54 + 9). */
export const DEFAULT_WA_PREFIX = '549';

/**
 * Número completo para WhatsApp: prefijo + lo que tipeó el invitado, sin el 0
 * del código de área. En Argentina tampoco va el 15 (se avisa en pantalla).
 */
export function fullPhone(prefix: string, typed: string) {
  const p = prefix.replace(/\D/g, '');
  const t = typed.replace(/\D/g, '').replace(/^0+/, '');
  return p + t;
}

export const validPhone = (phone: string) => /^\d{10,15}$/.test(phone);

export async function sendVideoWhatsApp(opts: { phone: string; driveId: string; title?: string; gallery?: string; mode?: string }) {
  if (!isSupabaseConfigured) throw new Error('Esta app no tiene servidor configurado');
  const { data, error } = await supabase.functions.invoke('send-video-whatsapp', {
    body: { ...opts, device: { code: getDeviceCode(), secret: getDeviceSecret() } },
  });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error || 'No se pudo conectar con el servidor de WhatsApp');
  }
  const json = data as { ok?: boolean; error?: string } | null;
  if (!json?.ok) throw new Error(json?.error || 'WhatsApp no respondió');
}
