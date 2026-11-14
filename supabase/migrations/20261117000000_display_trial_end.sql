-- Cuando termina una prueba (o se da de baja un negocio), y los emails de las pruebas.
-- Necesita 20261116000000_display_trials.sql. Ver docs/pruebas.md.
--
--   - La TV pregunta cada 10 minutos si su negocio sigue activo (display_device_account)
--     y, si la prueba terminó o el negocio está de baja, muestra un cartel en vez del
--     contenido. El panel muestra "Tu prueba terminó" (eso lo hace la app).
--   - En la prueba se pueden vincular hasta 2 pantallas; con la prueba vencida o de baja,
--     ninguna. Los clientes no tienen límite (no cambia nada para ellos).
--   - Emails (Resend, los mismos datos del Vault que los avisos de pantallas):
--       al equipo: cuando alguien se registra y cuando termina una prueba;
--       al que prueba: cuando le quedan 2 días y cuando termina.

-- 1. Para no mandar dos veces el mismo email, y cuándo se borraron los archivos.
ALTER TABLE public.display_commerces
    ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS trial_ended_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS data_cleaned_at timestamptz;

-- 2. ¿El negocio está frenado? null = no; 'trial_ended' = terminó la prueba; 'baja'.
CREATE OR REPLACE FUNCTION public.display_account_blocked(p_commerce uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN c.plan = 'baja' THEN 'baja'
        WHEN c.plan = 'prueba' AND c.trial_ends_at IS NOT NULL AND c.trial_ends_at <= now() THEN 'trial_ended'
        ELSE NULL
    END
    FROM public.display_commerces c
    WHERE c.id = p_commerce;
$$;

REVOKE ALL ON FUNCTION public.display_account_blocked(uuid) FROM PUBLIC;

-- 3. Para la TV (sin sesión, con su código): 'ok', 'trial_ended' o 'baja'.
CREATE OR REPLACE FUNCTION public.display_device_account(p_device_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(public.display_account_blocked(d.commerce_id), 'ok')
    FROM public.display_devices d
    WHERE d.device_id = upper(trim(p_device_code))
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.display_device_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_account(text) TO anon, authenticated;

-- 4. Al vincular una pantalla: hasta 2 en la prueba, ninguna si terminó o está de baja.
--    (Va como trigger para no tocar display_link_device, que usan todos los clientes.)
CREATE OR REPLACE FUNCTION public.display_devices_trial_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan text;
    v_blocked text;
BEGIN
    IF NEW.pairing_status IS DISTINCT FROM 'linked' OR NEW.commerce_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.pairing_status = 'linked' AND OLD.commerce_id IS NOT DISTINCT FROM NEW.commerce_id THEN
        RETURN NEW;   -- ya estaba vinculada a este negocio (renombrar, mover de zona, etc.)
    END IF;
    IF public.is_super_admin() THEN
        RETURN NEW;
    END IF;

    SELECT plan INTO v_plan FROM public.display_commerces WHERE id = NEW.commerce_id;
    IF v_plan IS NULL OR v_plan = 'cliente' THEN
        RETURN NEW;
    END IF;

    v_blocked := public.display_account_blocked(NEW.commerce_id);
    IF v_blocked = 'trial_ended' THEN
        RAISE EXCEPTION 'Tu prueba terminó. Escribinos para contratar Display Digital y seguir usándolo.' USING ERRCODE = 'P0001';
    ELSIF v_blocked = 'baja' THEN
        RAISE EXCEPTION 'Esta cuenta está dada de baja. Escribinos para volver a activarla.' USING ERRCODE = 'P0001';
    END IF;

    IF v_plan = 'prueba' AND (
        SELECT count(*) FROM public.display_devices
        WHERE commerce_id = NEW.commerce_id AND pairing_status = 'linked' AND id IS DISTINCT FROM NEW.id
    ) >= 2 THEN
        RAISE EXCEPTION 'En la prueba podés vincular hasta 2 pantallas. Borrá una o escribinos para contratar más.' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS display_devices_trial_guard ON public.display_devices;
CREATE TRIGGER display_devices_trial_guard
    BEFORE INSERT OR UPDATE OF pairing_status, commerce_id ON public.display_devices
    FOR EACH ROW EXECUTE FUNCTION public.display_devices_trial_guard();

-- 5. Admin: al extender una prueba se vuelven a mandar los avisos cuando corresponda.
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
        trial_reminder_sent_at = CASE WHEN p_plan = 'prueba' AND p_extend_days IS NOT NULL THEN NULL ELSE trial_reminder_sent_at END,
        trial_ended_sent_at = CASE WHEN p_plan = 'prueba' AND p_extend_days IS NOT NULL THEN NULL ELSE trial_ended_sent_at END,
        plan_changed_at = CASE WHEN plan IS DISTINCT FROM p_plan THEN now() ELSE plan_changed_at END
    WHERE id = p_commerce;
END;
$$;

REVOKE ALL ON FUNCTION public.display_admin_set_plan(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_admin_set_plan(uuid, text, int) TO authenticated;

-- 6. Email al equipo cuando alguien se registra para probar.
CREATE OR REPLACE FUNCTION public.display_trial_signup_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin text;
    v_wa text := public.display_phone_digits(NEW.whatsapp);
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_admin FROM vault.decrypted_secrets WHERE name = 'alerts_admin_email' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_admin := NULL;
    END;
    IF v_admin IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        PERFORM public.display_send_alert_email(
            ARRAY[v_admin],
            format('🆕 Nueva prueba: %s', NEW.business_name),
            format('<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                || '<p><b>%s</b> empezó a probar Display Digital.</p><ul>'
                || '<li>Contacto: <b>%s</b></li>'
                || '<li>WhatsApp: <a href="https://wa.me/549%s">%s</a></li>'
                || '<li>Email: %s</li>'
                || '<li>Rubro: %s</li></ul>'
                || '<p><a href="https://app.event-pix.com.ar/admin">Ver en el panel (Display Digital → En prueba)</a></p>'
                || '<p style="color:#888;font-size:12px">Display Digital · EventPix</p></div>',
                display_html_escape(NEW.business_name), display_html_escape(NEW.contact_name),
                v_wa, display_html_escape(NEW.whatsapp), display_html_escape(NEW.email),
                display_html_escape(coalesce(NEW.rubro, '—')))
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;   -- sin pg_net o sin la función de avisos: el registro sigue igual
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS display_trial_signup_notify ON public.display_trial_signups;
CREATE TRIGGER display_trial_signup_notify
    AFTER INSERT ON public.display_trial_signups
    FOR EACH ROW EXECUTE FUNCTION public.display_trial_signup_notify();

-- 7. Revisión de las pruebas (cada hora): aviso de 2 días y de fin, al que prueba y al equipo.
CREATE OR REPLACE FUNCTION public.display_check_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_site constant text := 'https://app.event-pix.com.ar';
    v_wa constant text := 'https://wa.me/5493624547382';
    v_admin text;
    r record;
    v_first text;
BEGIN
    BEGIN
        SELECT decrypted_secret INTO v_admin FROM vault.decrypted_secrets WHERE name = 'alerts_admin_email' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_admin := NULL;
    END;

    -- Quedan 2 días (o menos).
    FOR r IN
        SELECT c.id, c.name, c.trial_ends_at, s.email, s.contact_name
        FROM public.display_commerces c
        JOIN LATERAL (
            SELECT email, contact_name FROM public.display_trial_signups
            WHERE commerce_id = c.id ORDER BY created_at DESC LIMIT 1
        ) s ON true
        WHERE c.plan = 'prueba'
          AND c.trial_reminder_sent_at IS NULL
          AND c.trial_ends_at > now()
          AND c.trial_ends_at <= now() + interval '2 days'
    LOOP
        v_first := split_part(btrim(r.contact_name), ' ', 1);
        PERFORM public.display_send_alert_email(
            ARRAY[r.email],
            format('⏳ Te quedan 2 días de prueba de Display Digital'),
            format('<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                || '<p>¡Hola %s!</p>'
                || '<p>Tu prueba de Display Digital con <b>%s</b> termina el <b>%s</b>.</p>'
                || '<p>Aprovechá para armar tus carteles, cargar tus precios y verlos en la pantalla de prueba. '
                || 'Si querés seguir, escribinos y lo dejamos funcionando en tu TV con el equipo Display Digital: '
                || 'no perdés nada de lo que armaste.</p>'
                || '<p><a href="%s/usuarios">Entrar a mi panel</a> · <a href="%s?text=%s">Quiero contratarlo</a></p>'
                || '<p style="color:#888;font-size:12px">Display Digital · EventPix</p></div>',
                display_html_escape(v_first), display_html_escape(r.name),
                to_char(r.trial_ends_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI'),
                v_site, v_wa, replace(format('¡Hola! Quiero contratar Display Digital para %s', r.name), ' ', '%20'))
        );
        UPDATE public.display_commerces SET trial_reminder_sent_at = now() WHERE id = r.id;
    END LOOP;

    -- Terminó.
    FOR r IN
        SELECT c.id, c.name, c.trial_ends_at, s.email, s.contact_name, s.whatsapp
        FROM public.display_commerces c
        JOIN LATERAL (
            SELECT email, contact_name, whatsapp FROM public.display_trial_signups
            WHERE commerce_id = c.id ORDER BY created_at DESC LIMIT 1
        ) s ON true
        WHERE c.plan = 'prueba'
          AND c.trial_ended_sent_at IS NULL
          AND c.trial_ends_at <= now()
    LOOP
        v_first := split_part(btrim(r.contact_name), ' ', 1);
        PERFORM public.display_send_alert_email(
            ARRAY[r.email],
            'Terminó tu prueba de Display Digital',
            format('<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                || '<p>¡Hola %s!</p>'
                || '<p>Terminó tu prueba de Display Digital con <b>%s</b>. Gracias por probarlo.</p>'
                || '<p>Guardamos todo lo que armaste durante 30 días. Si lo contratás, lo dejamos funcionando en tu TV '
                || 'con el equipo Display Digital y seguís con tus carteles y tus precios tal cual.</p>'
                || '<p><a href="%s?text=%s">Quiero contratarlo</a></p>'
                || '<p style="color:#888;font-size:12px">Display Digital · EventPix</p></div>',
                display_html_escape(v_first), display_html_escape(r.name),
                v_wa, replace(format('¡Hola! Terminó mi prueba de Display Digital con %s y quiero contratarlo', r.name), ' ', '%20'))
        );
        IF v_admin IS NOT NULL THEN
            PERFORM public.display_send_alert_email(
                ARRAY[v_admin],
                format('⌛ Terminó la prueba de %s', r.name),
                format('<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                    || '<p>Terminó la prueba de <b>%s</b> (%s, WhatsApp <a href="https://wa.me/549%s">%s</a>).</p>'
                    || '<p>Buen momento para escribirle. <a href="%s/admin">Ver en el panel (Display Digital → Pruebas vencidas)</a></p>'
                    || '<p style="color:#888;font-size:12px">Display Digital · EventPix</p></div>',
                    display_html_escape(r.name), display_html_escape(r.contact_name),
                    public.display_phone_digits(r.whatsapp), display_html_escape(r.whatsapp), v_site)
            );
        END IF;
        UPDATE public.display_commerces SET trial_ended_sent_at = now() WHERE id = r.id;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.display_check_trials() FROM PUBLIC;

-- 8. Admin: el listado ahora dice también si ya se borraron los archivos.
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
                c.data_cleaned_at,
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

-- 9. Programarla cada hora (necesita pg_cron, igual que los avisos de pantallas).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'display-trials';
        PERFORM cron.schedule('display-trials', '17 * * * *', 'select public.display_check_trials()');
    ELSE
        RAISE NOTICE 'pg_cron no está activado: activalo y volvé a correr este archivo para programar los emails de las pruebas.';
    END IF;
END $$;
