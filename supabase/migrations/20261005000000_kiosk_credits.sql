-- Clientes y créditos de IA del kiosco. Re-ejecutable.
-- Requiere 20261003000000_kiosk_devices.sql y 20261004000000_kiosk_remote_settings.sql.
--
-- La cabina clásica es libre. Cada conversión con IA gasta 1 crédito del cliente
-- dueño del equipo. Los créditos se cargan desde el panel (packs de 10/20/30/50/100)
-- y solo la función generate-ai-photo (con la clave de servicio) puede gastarlos o
-- devolverlos. El equipo se identifica con su código + una clave secreta que genera
-- él mismo y registra en su primer checkin.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.kiosk_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact TEXT,
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kiosk_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.kiosk_accounts(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('purchase', 'generation', 'refund', 'adjust')),
    device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
    -- generation: id del trabajo de IA; refund: id del movimiento de generation que devuelve
    job_id TEXT,
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiosk_credit_ledger_account_idx ON public.kiosk_credit_ledger (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_credit_ledger_job_idx ON public.kiosk_credit_ledger (job_id);
-- Una generación se devuelve una sola vez
CREATE UNIQUE INDEX IF NOT EXISTS kiosk_credit_ledger_one_refund ON public.kiosk_credit_ledger (job_id) WHERE reason = 'refund';

ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.kiosk_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS device_secret_hash TEXT;

ALTER TABLE public.kiosk_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_credit_ledger ENABLE ROW LEVEL SECURITY;

-- Panel (con login): ve y edita clientes; el saldo solo cambia con kiosk_credits_add
DROP POLICY IF EXISTS "Authenticated can read kiosk accounts" ON public.kiosk_accounts;
CREATE POLICY "Authenticated can read kiosk accounts" ON public.kiosk_accounts
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can create kiosk accounts" ON public.kiosk_accounts;
CREATE POLICY "Authenticated can create kiosk accounts" ON public.kiosk_accounts
    FOR INSERT TO authenticated WITH CHECK (credits = 0);
DROP POLICY IF EXISTS "Authenticated can delete kiosk accounts" ON public.kiosk_accounts;
CREATE POLICY "Authenticated can delete kiosk accounts" ON public.kiosk_accounts
    FOR DELETE TO authenticated USING (true);
-- Editar nombre y contacto, no el saldo
REVOKE UPDATE ON public.kiosk_accounts FROM authenticated;
GRANT UPDATE (name, contact) ON public.kiosk_accounts TO authenticated;
DROP POLICY IF EXISTS "Authenticated can edit kiosk accounts" ON public.kiosk_accounts;
CREATE POLICY "Authenticated can edit kiosk accounts" ON public.kiosk_accounts
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can read credit ledger" ON public.kiosk_credit_ledger;
CREATE POLICY "Authenticated can read credit ledger" ON public.kiosk_credit_ledger
    FOR SELECT TO authenticated USING (true);

-- ─── Panel: cargar o ajustar créditos ──────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_credits_add(
    p_account UUID,
    p_delta INTEGER,
    p_reason TEXT DEFAULT 'purchase',
    p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Hace falta iniciar sesión'; END IF;
    IF p_reason NOT IN ('purchase', 'adjust') THEN RAISE EXCEPTION 'Motivo inválido'; END IF;
    IF p_delta = 0 THEN RAISE EXCEPTION 'La cantidad no puede ser 0'; END IF;

    UPDATE public.kiosk_accounts SET credits = credits + p_delta
        WHERE id = p_account AND credits + p_delta >= 0
        RETURNING credits INTO v_balance;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Cliente inexistente o saldo insuficiente'; END IF;

    INSERT INTO public.kiosk_credit_ledger (account_id, delta, reason, note, created_by)
    VALUES (p_account, p_delta, p_reason, p_note, auth.uid());
    RETURN v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_credits_add(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_credits_add(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- ─── Función de IA (clave de servicio): gastar y devolver ──────────
-- Descuenta 1 crédito del cliente del equipo. Devuelve el id del movimiento
-- (para devolverlo si la IA falla) y el saldo que queda.
CREATE OR REPLACE FUNCTION public.kiosk_ai_charge(p_code TEXT, p_secret TEXT)
RETURNS TABLE (ledger_id UUID, credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_device public.kiosk_devices%ROWTYPE;
    v_balance INTEGER;
    v_ledger UUID;
BEGIN
    SELECT * INTO v_device FROM public.kiosk_devices WHERE device_code = upper(p_code);
    IF NOT FOUND OR v_device.pairing_status <> 'linked' THEN RAISE EXCEPTION 'device_not_linked'; END IF;
    IF v_device.device_secret_hash IS NULL OR p_secret IS NULL
       OR v_device.device_secret_hash <> encode(extensions.digest(p_secret, 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'device_auth';
    END IF;
    IF v_device.account_id IS NULL THEN RAISE EXCEPTION 'no_account'; END IF;

    UPDATE public.kiosk_accounts a SET credits = a.credits - 1
        WHERE a.id = v_device.account_id AND a.credits > 0
        RETURNING a.credits INTO v_balance;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'no_credits'; END IF;

    INSERT INTO public.kiosk_credit_ledger (account_id, delta, reason, device_id)
    VALUES (v_device.account_id, -1, 'generation', v_device.id)
    RETURNING id INTO v_ledger;
    RETURN QUERY SELECT v_ledger, v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_ai_charge(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_ai_charge(TEXT, TEXT) TO service_role;

-- Anota el trabajo de IA del cobro (para encontrarlo al consultar el estado)
CREATE OR REPLACE FUNCTION public.kiosk_ai_set_job(p_ledger UUID, p_job TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.kiosk_credit_ledger SET job_id = p_job WHERE id = p_ledger AND reason = 'generation';
$$;
REVOKE ALL ON FUNCTION public.kiosk_ai_set_job(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_ai_set_job(UUID, TEXT) TO service_role;

-- Devuelve el crédito de una generación que falló (por id de movimiento o de trabajo). Una sola vez.
CREATE OR REPLACE FUNCTION public.kiosk_ai_refund(p_ledger UUID DEFAULT NULL, p_job TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gen public.kiosk_credit_ledger%ROWTYPE;
BEGIN
    SELECT * INTO v_gen FROM public.kiosk_credit_ledger
        WHERE reason = 'generation' AND ((p_ledger IS NOT NULL AND id = p_ledger) OR (p_job IS NOT NULL AND job_id = p_job))
        LIMIT 1;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    BEGIN
        INSERT INTO public.kiosk_credit_ledger (account_id, delta, reason, device_id, job_id, note)
        VALUES (v_gen.account_id, 1, 'refund', v_gen.device_id, v_gen.id::text, 'La IA no pudo generar la foto');
    EXCEPTION WHEN unique_violation THEN
        RETURN FALSE; -- ya devuelto
    END;
    UPDATE public.kiosk_accounts SET credits = credits + 1 WHERE id = v_gen.account_id;
    RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_ai_refund(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_ai_refund(UUID, TEXT) TO service_role;

-- ─── Checkin: registra la clave del equipo e informa el saldo ──────
DROP FUNCTION IF EXISTS public.kiosk_device_checkin(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB, TEXT);

CREATE FUNCTION public.kiosk_device_checkin(
    p_code TEXT,
    p_app_version TEXT DEFAULT NULL,
    p_applied_rev INTEGER DEFAULT NULL,
    p_report JSONB DEFAULT NULL,
    p_secret TEXT DEFAULT NULL
)
RETURNS TABLE (
    device_code TEXT,
    name TEXT,
    pairing_status TEXT,
    kiosk_event_id UUID,
    event_name TEXT,
    settings JSONB,
    settings_rev INTEGER,
    account_name TEXT,
    ai_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{6}$' THEN
        RAISE EXCEPTION 'Código de equipo inválido';
    END IF;
    IF p_report IS NOT NULL AND length(p_report::text) > 20000 THEN
        p_report := NULL;
    END IF;

    INSERT INTO public.kiosk_devices (device_code, app_version, last_seen)
    VALUES (p_code, p_app_version, now())
    ON CONFLICT ON CONSTRAINT kiosk_devices_device_code_key DO UPDATE
        SET last_seen = now(),
            app_version = COALESCE(EXCLUDED.app_version, public.kiosk_devices.app_version);

    -- La clave del equipo se registra la primera vez y no se cambia más
    IF p_secret IS NOT NULL AND length(p_secret) >= 32 THEN
        UPDATE public.kiosk_devices d
            SET device_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
            WHERE d.device_code = p_code AND d.device_secret_hash IS NULL;
    END IF;

    UPDATE public.kiosk_devices d
        SET applied_rev = COALESCE(p_applied_rev, d.applied_rev),
            reported = COALESCE(p_report, d.reported),
            reported_at = CASE WHEN p_report IS NULL THEN d.reported_at ELSE now() END
        WHERE d.device_code = p_code AND d.pairing_status = 'linked'
          AND (p_applied_rev IS NOT NULL OR p_report IS NOT NULL);

    RETURN QUERY
        SELECT d.device_code, d.name, d.pairing_status, d.kiosk_event_id, e.name,
               CASE WHEN d.pairing_status = 'linked' THEN d.settings ELSE '{}'::jsonb END,
               CASE WHEN d.pairing_status = 'linked' THEN d.settings_rev ELSE 0 END,
               a.name,
               CASE WHEN d.pairing_status = 'linked' THEN a.credits ELSE NULL END
        FROM public.kiosk_devices d
        LEFT JOIN public.kiosk_events e ON e.id = d.kiosk_event_id
        LEFT JOIN public.kiosk_accounts a ON a.id = d.account_id
        WHERE d.device_code = p_code;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB, TEXT) TO anon, authenticated;
