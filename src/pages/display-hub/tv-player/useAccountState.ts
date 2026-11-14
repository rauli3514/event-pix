import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ¿El negocio de esta pantalla sigue activo? 'ok', 'trial_ended' (terminó la
// prueba) o 'baja'. Se revisa al prender y cada 10 minutos. Sin internet, o si
// el servidor todavía no tiene la función (falta el SQL), queda lo último que
// se supo; si nunca se supo, la TV sigue como siempre.
export type AccountState = 'ok' | 'trial_ended' | 'baja';

const POLL_MS = 10 * 60 * 1000;
const cacheKey = (code: string) => `account_state:${code}`;

function readCached(code?: string): AccountState {
    if (!code) return 'ok';
    try {
        const v = localStorage.getItem(cacheKey(code));
        return v === 'trial_ended' || v === 'baja' ? v : 'ok';
    } catch {
        return 'ok';
    }
}

export function useAccountState(deviceCode?: string): AccountState {
    const [state, setState] = useState<AccountState>(() => readCached(deviceCode));

    useEffect(() => {
        if (!deviceCode) return;
        let cancelled = false;
        const load = async () => {
            const { data, error } = await supabase.rpc('display_device_account', { p_device_code: deviceCode });
            if (cancelled || error) return;
            const next: AccountState = data === 'trial_ended' || data === 'baja' ? data : 'ok';
            setState(next);
            try { localStorage.setItem(cacheKey(deviceCode), next); } catch { /* sin espacio */ }
        };
        load();
        const poll = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(poll);
        };
    }, [deviceCode]);

    return state;
}
