-- Pruebas de 7 días ("Probalo" en la web) y estado de cada negocio.
--
-- Cada negocio de cartelería tiene un estado:
--   'cliente' → contrató (todos los que ya existen quedan así; no cambia nada para ellos)
--   'prueba'  → se registró solo para probar; vence en trial_ends_at
--   'baja'    → se dio de baja
-- "Prueba vencida" no es un estado aparte: es 'prueba' con trial_ends_at ya pasado.
--
-- Los datos que deja cada persona al registrarse quedan en display_trial_signups
-- (solo los ve el super admin), aunque después no contrate.
--
-- Los clientes solo pueden LEER display_commerces (ver commerces_migration.sql),
-- así que el estado lo cambia únicamente el super admin.

-- 1. Estado del negocio.
ALTER TABLE public.display_commerces
    ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'cliente',
    ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
    ADD COLUMN IF NOT EXISTS plan_changed_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'display_commerces_plan_check') THEN
        ALTER TABLE public.display_commerces
            ADD CONSTRAINT display_commerces_plan_check CHECK (plan IN ('cliente', 'prueba', 'baja'));
    END IF;
END $$;

-- 2. Datos de quienes se registran para probar.
CREATE TABLE IF NOT EXISTS public.display_trial_signups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id uuid REFERENCES public.display_commerces(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    contact_name text NOT NULL,
    business_name text NOT NULL,
    rubro text,
    whatsapp text NOT NULL,
    whatsapp_digits text NOT NULL,   -- solo números, para no repetir pruebas
    email text NOT NULL,
    city text,
    tv_count text,
    uses_fudo text,
    source text,
    notes text,                      -- notas del equipo (por ejemplo "lo llamé el martes")
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS display_trial_signups_whatsapp_idx ON public.display_trial_signups (whatsapp_digits);
CREATE INDEX IF NOT EXISTS display_trial_signups_email_idx ON public.display_trial_signups (lower(email));
CREATE INDEX IF NOT EXISTS display_trial_signups_commerce_idx ON public.display_trial_signups (commerce_id);

ALTER TABLE public.display_trial_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage trial signups" ON public.display_trial_signups;
CREATE POLICY "Super admins manage trial signups"
    ON public.display_trial_signups FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Número argentino sin adornos, igual que whatsappNumber() en src/lib/posters.ts:
-- "362 454-7382", "+54 9 362 4547382", "0362 15 454-7382" → "3624547382".
CREATE OR REPLACE FUNCTION public.display_phone_digits(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
    a int;
BEGIN
    IF left(d, 2) = '00' THEN d := substr(d, 3); END IF;
    IF left(d, 2) = '54' THEN
        d := substr(d, 3);
        IF left(d, 1) = '9' THEN d := substr(d, 2); END IF;
    END IF;
    IF left(d, 1) = '0' THEN d := substr(d, 2); END IF;
    -- "362 15 454-7382": se saca el 15 que va después de la característica.
    IF length(d) = 12 THEN
        FOREACH a IN ARRAY ARRAY[4, 3, 2] LOOP
            IF substr(d, a + 1, 2) = '15' THEN
                d := left(d, a) || substr(d, a + 3);
                EXIT;
            END IF;
        END LOOP;
    END IF;
    RETURN d;
END;
$$;

-- 3. Empezar una prueba. Lo llama la página /probar, ya con la cuenta creada
--    (supabase.auth.signUp). Crea el negocio en prueba, lo vincula al usuario y
--    guarda sus datos. Devuelve el id del negocio.
--    Errores: not_authenticated, missing_fields, already_has_commerce, trial_used.
CREATE OR REPLACE FUNCTION public.display_start_trial(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_email text;
    v_contact text := btrim(coalesce(p->>'contact_name', ''));
    v_business text := btrim(coalesce(p->>'business_name', ''));
    v_whatsapp text := btrim(coalesce(p->>'whatsapp', ''));
    v_digits text := public.display_phone_digits(p->>'whatsapp');
    v_commerce uuid;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    IF v_contact = '' OR v_business = '' OR length(v_digits) < 8 OR coalesce(v_email, '') = '' THEN
        RAISE EXCEPTION 'missing_fields';
    END IF;

    -- Una cuenta, un negocio: si ya tiene uno (cliente o prueba), no se crea otro.
    IF EXISTS (SELECT 1 FROM public.display_commerce_users WHERE user_id = v_uid) THEN
        RAISE EXCEPTION 'already_has_commerce';
    END IF;

    -- Una prueba por email y por WhatsApp.
    IF EXISTS (
        SELECT 1 FROM public.display_trial_signups
        WHERE whatsapp_digits = v_digits OR lower(email) = lower(v_email)
    ) THEN
        RAISE EXCEPTION 'trial_used';
    END IF;

    INSERT INTO public.display_commerces (name, email, plan, trial_ends_at, plan_changed_at)
    VALUES (left(v_business, 120), v_email, 'prueba', now() + interval '7 days', now())
    RETURNING id INTO v_commerce;

    INSERT INTO public.display_commerce_users (commerce_id, user_id, role)
    VALUES (v_commerce, v_uid, 'admin');

    INSERT INTO public.display_trial_signups
        (commerce_id, user_id, contact_name, business_name, rubro, whatsapp, whatsapp_digits, email, city, tv_count, uses_fudo, source)
    VALUES (
        v_commerce, v_uid, left(v_contact, 120), left(v_business, 120),
        left(nullif(btrim(p->>'rubro'), ''), 80), left(v_whatsapp, 40), v_digits, v_email,
        left(nullif(btrim(p->>'city'), ''), 80), left(nullif(btrim(p->>'tv_count'), ''), 20),
        left(nullif(btrim(p->>'uses_fudo'), ''), 20), left(nullif(btrim(p->>'source'), ''), 80)
    );

    RETURN v_commerce;
END;
$$;

REVOKE ALL ON FUNCTION public.display_start_trial(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_start_trial(jsonb) TO authenticated;

-- Completar los datos del paso 2 del formulario (ciudad, TV, Fudo, cómo nos conoció).
CREATE OR REPLACE FUNCTION public.display_trial_details(p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    UPDATE public.display_trial_signups SET
        city = coalesce(left(nullif(btrim(p->>'city'), ''), 80), city),
        tv_count = coalesce(left(nullif(btrim(p->>'tv_count'), ''), 20), tv_count),
        uses_fudo = coalesce(left(nullif(btrim(p->>'uses_fudo'), ''), 20), uses_fudo),
        source = coalesce(left(nullif(btrim(p->>'source'), ''), 80), source)
    WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.display_trial_details(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_trial_details(jsonb) TO authenticated;

-- 4. Admin: todos los negocios con su estado, los datos del registro y cuánto usaron
--    la cuenta (pantallas vinculadas, carteles, último ingreso).
CREATE OR REPLACE FUNCTION public.display_admin_accounts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    RETURN coalesce((
        SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC)
        FROM (
            SELECT
                c.id,
                c.plan,
                c.trial_ends_at,
                c.plan_changed_at,
                c.created_at,
                (SELECT count(*) FROM public.display_devices d
                  WHERE d.commerce_id = c.id AND d.pairing_status = 'linked') AS screens,
                (SELECT count(*) FROM public.display_media m
                  WHERE m.commerce_id = c.id AND m.type = 'app' AND m.metadata->>'appId' = 'poster') AS posters,
                (SELECT max(u.last_sign_in_at) FROM public.display_commerce_users cu
                  JOIN auth.users u ON u.id = cu.user_id WHERE cu.commerce_id = c.id) AS last_sign_in_at,
                (SELECT to_jsonb(s) - 'whatsapp_digits' - 'user_id' FROM public.display_trial_signups s
                  WHERE s.commerce_id = c.id ORDER BY s.created_at DESC LIMIT 1) AS signup
            FROM public.display_commerces c
        ) x
    ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.display_admin_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_admin_accounts() TO authenticated;

-- 5. Admin: cambiar el estado. p_plan = 'cliente' | 'prueba' | 'baja'.
--    Con 'prueba' y p_extend_days, suma días desde hoy (o desde el vencimiento, si
--    todavía no venció).
CREATE OR REPLACE FUNCTION public.display_admin_set_plan(p_commerce uuid, p_plan text, p_extend_days int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'forbidden';
    END IF;
    IF p_plan NOT IN ('cliente', 'prueba', 'baja') THEN
        RAISE EXCEPTION 'bad_plan';
    END IF;

    UPDATE public.display_commerces SET
        plan = p_plan,
        trial_ends_at = CASE
            WHEN p_plan = 'prueba' AND p_extend_days IS NOT NULL
                THEN greatest(now(), coalesce(trial_ends_at, now())) + make_interval(days => p_extend_days)
            ELSE trial_ends_at
        END,
        plan_changed_at = CASE WHEN plan IS DISTINCT FROM p_plan THEN now() ELSE plan_changed_at END
    WHERE id = p_commerce;
END;
$$;

REVOKE ALL ON FUNCTION public.display_admin_set_plan(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_admin_set_plan(uuid, text, int) TO authenticated;
