import { supabase } from '@/lib/supabase';

// Precios de los packs de créditos de IA y contacto para comprarlos (tabla
// kiosk_store_settings, se editan en el panel). El equipo guarda la última copia
// para mostrarla aunque no tenga internet.

export interface CreditPack { credits: number; ars: number; usd: number }
export interface StoreSettings { packs: CreditPack[]; contact_phone: string | null; contact_note: string | null }

export const DEFAULT_STORE: StoreSettings = {
  packs: [
    { credits: 10, ars: 5000, usd: 3 },
    { credits: 20, ars: 9500, usd: 6 },
    { credits: 50, ars: 24000, usd: 15 },
    { credits: 100, ars: 45000, usd: 30 },
  ],
  contact_phone: null,
  contact_note: 'Pesos solo en Argentina; dólares para otros países.',
};

const CACHE_KEY = 'kiosk_store_settings';

export const getCachedStore = (): StoreSettings => {
  try {
    return { ...DEFAULT_STORE, ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') };
  } catch {
    return DEFAULT_STORE;
  }
};

export async function loadStore(): Promise<StoreSettings> {
  const { data, error } = await supabase.from('kiosk_store_settings').select('packs, contact_phone, contact_note').eq('id', 1).maybeSingle();
  if (error || !data) return getCachedStore();
  const store: StoreSettings = {
    packs: Array.isArray(data.packs) && data.packs.length ? data.packs as CreditPack[] : DEFAULT_STORE.packs,
    contact_phone: data.contact_phone,
    contact_note: data.contact_note,
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); } catch { /* sin espacio */ }
  return store;
}

export async function saveStore(store: StoreSettings) {
  const { error } = await supabase.from('kiosk_store_settings').upsert({ id: 1, ...store, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export const formatArs = (n: number) => `$${n.toLocaleString('es-AR')}`;

/** Link de WhatsApp para pedir créditos (con el código del equipo en el mensaje). */
export const whatsappLink = (phone: string, deviceCode: string, pack?: CreditPack) => {
  const text = pack
    ? `Hola! Quiero comprar el pack de ${pack.credits} créditos de IA para mi equipo EventPix (código ${deviceCode}).`
    : `Hola! Quiero comprar créditos de IA para mi equipo EventPix (código ${deviceCode}).`;
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
};
