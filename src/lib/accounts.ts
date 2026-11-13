// Estado de cada negocio de cartelería: cliente, en prueba (7 días), prueba
// vencida o baja. Ver la migración display_trials.

import { whatsappNumber } from '@/lib/posters';

export type AccountPlan = 'cliente' | 'prueba' | 'baja';
export type AccountStatus = 'cliente' | 'prueba' | 'vencida' | 'baja';

export interface TrialSignup {
    id: string;
    commerce_id: string | null;
    contact_name: string;
    business_name: string;
    rubro: string | null;
    whatsapp: string;
    email: string;
    city: string | null;
    tv_count: string | null;
    uses_fudo: string | null;
    source: string | null;
    notes: string | null;
    created_at: string;
}

export interface AdminAccount {
    id: string;
    plan: AccountPlan;
    trial_ends_at: string | null;
    plan_changed_at: string | null;
    created_at: string;
    screens: number;
    posters: number;
    last_sign_in_at: string | null;
    signup: TrialSignup | null;
}

export const TRIAL_DAYS = 7;
// Lo que armó alguien que no contrató se guarda este tiempo después de vencer.
export const KEEP_DAYS_AFTER_END = 30;

export function accountStatus(a: Pick<AdminAccount, 'plan' | 'trial_ends_at'> | null | undefined, now = Date.now()): AccountStatus {
    if (!a) return 'cliente';
    if (a.plan === 'baja') return 'baja';
    if (a.plan === 'prueba') return a.trial_ends_at && Date.parse(a.trial_ends_at) <= now ? 'vencida' : 'prueba';
    return 'cliente';
}

// Días que quedan (redondeado hacia arriba: con 30 horas quedan "2 días").
export function daysLeft(trialEndsAt: string | null | undefined, now = Date.now()): number {
    if (!trialEndsAt) return 0;
    return Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now) / 86400000));
}

export const STATUS_LABEL: Record<AccountStatus, string> = {
    cliente: 'Cliente',
    prueba: 'En prueba',
    vencida: 'Prueba vencida',
    baja: 'Baja',
};

// "¡Hola Ana! Te escribo de Display Digital por la prueba de La Esquina…"
export function trialWhatsappUrl(s: Pick<TrialSignup, 'whatsapp' | 'contact_name' | 'business_name'>): string | null {
    const n = whatsappNumber(s.whatsapp);
    if (!n) return null;
    const first = s.contact_name.trim().split(/\s+/)[0] || '';
    const text = `¡Hola ${first}! Te escribo de Display Digital por la prueba de ${s.business_name}. ¿Cómo te fue? ¿Te puedo ayudar con algo?`;
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

// Mensaje para el error de la base.
export function accountsErrorText(message?: string): string {
    const m = message || '';
    if (/display_admin_|display_trial|PGRST202|does not exist|schema cache/i.test(m)) {
        return 'Falta un paso en Supabase: correr supabase/migrations/20261116000000_display_trials.sql.';
    }
    if (/forbidden/.test(m)) return 'Solo el super admin puede hacer esto.';
    return 'No se pudo guardar. Probá de nuevo.';
}
