-- Display Digital: avisos por email cuando una pantalla se queda sin señal.
--
-- Cada 5 minutos (pg_cron) se revisan las pantallas vinculadas. Si una no manda
-- señal hace más de 10 minutos, dentro del horario del local, se manda UN email
-- al comercio y otro al administrador. Cuando vuelve, se avisa que volvió.
-- Los emails salen por Resend (https://resend.com) usando pg_net.
--
-- Antes de correr este archivo (una sola vez, ver docs/avisos-pantallas.md):
--   1. Dashboard de Supabase → Database → Extensions: activar pg_cron y pg_net.
--   2. Guardar la clave de Resend y los datos del envío en el Vault:
--        select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
--        select vault.create_secret('EventPix <avisos@event-pix.com.ar>', 'alerts_from');
--        select vault.create_secret('tu-email@ejemplo.com', 'alerts_admin_email');

-- 1. Configuración de avisos por comercio (horario del local en hora argentina).
ALTER TABLE public.display_commerces
    ADD COLUMN IF NOT EXISTS alerts_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS alert_email text,
    ADD COLUMN IF NOT EXISTS alert_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}', -- 0 = domingo
    ADD COLUMN IF NOT EXISTS alert_from time NOT NULL DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS alert_to time NOT NULL DEFAULT '21:00',
    ADD COLUMN IF NOT EXISTS alert_timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

-- 2. Cuándo se avisó la caída actual de cada pantalla (null = no se avisó).
ALTER TABLE public.display_devices
    ADD COLUMN IF NOT EXISTS down_alert_at timestamptz;

-- 3. Guardar la configuración desde el panel (el cliente solo puede leer
--    display_commerces; esto le deja cambiar solo sus avisos).
CREATE OR REPLACE FUNCTION public.display_update_alert_settings(
    p_commerce uuid,
    p_enabled boolean,
    p_email text,
    p_days int[],
    p_from time,
    p_to time
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text := nullif(trim(coalesce(p_email, '')), '');
BEGIN
    IF NOT coalesce(public.display_can_manage(p_commerce), false) THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;
    IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'invalid_email';
    END IF;
    IF p_from >= p_to THEN
        RAISE EXCEPTION 'invalid_hours';
    END IF;

    UPDATE public.display_commerces
    SET alerts_enabled = coalesce(p_enabled, true),
        alert_email = v_email,
        alert_days = (SELECT coalesce(array_agg(DISTINCT d ORDER BY d), '{}') FROM unnest(p_days) d WHERE d BETWEEN 0 AND 6),
        alert_from = p_from,
        alert_to = p_to
    WHERE id = p_commerce;
END;
$$;

REVOKE ALL ON FUNCTION public.display_update_alert_settings(uuid, boolean, text, int[], time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_update_alert_settings(uuid, boolean, text, int[], time, time) TO authenticated;

-- Los nombres de comercios y pantallas van dentro del HTML del email.
CREATE OR REPLACE FUNCTION public.display_html_escape(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- 4. Mandar un email por Resend (no espera la respuesta: pg_net es asíncrono).
CREATE OR REPLACE FUNCTION public.display_send_alert_email(p_to text[], p_subject text, p_html text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
    v_from text;
BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
    SELECT decrypted_secret INTO v_from FROM vault.decrypted_secrets WHERE name = 'alerts_from' LIMIT 1;
    IF v_key IS NULL OR coalesce(array_length(p_to, 1), 0) = 0 THEN
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
            'from', coalesce(v_from, 'EventPix <avisos@event-pix.com.ar>'),
            'to', to_jsonb(p_to),
            'subject', p_subject,
            'html', p_html
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.display_send_alert_email(text[], text, text) FROM PUBLIC;

-- 5. La revisión que corre cada 5 minutos.
CREATE OR REPLACE FUNCTION public.display_check_down_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin text;
    v_site constant text := 'https://app.event-pix.com.ar';
    c record;
    d record;
    v_to text[];
    v_rows text;
    v_names text;
    v_count int;
    v_ids uuid[];
BEGIN
    SELECT decrypted_secret INTO v_admin FROM vault.decrypted_secrets WHERE name = 'alerts_admin_email' LIMIT 1;

    FOR c IN
        SELECT cm.*,
               (now() AT TIME ZONE cm.alert_timezone) AS local_now
        FROM public.display_commerces cm
        WHERE EXISTS (SELECT 1 FROM public.display_devices dv WHERE dv.commerce_id = cm.id AND dv.pairing_status = 'linked')
    LOOP
        -- Destinatarios: el comercio (si tiene los avisos prendidos) y el administrador.
        v_to := ARRAY[]::text[];
        IF c.alerts_enabled AND nullif(coalesce(c.alert_email, c.email), '') IS NOT NULL THEN
            v_to := v_to || coalesce(nullif(c.alert_email, ''), c.email);
        END IF;
        IF nullif(v_admin, '') IS NOT NULL AND NOT (v_admin = ANY (v_to)) THEN
            v_to := v_to || v_admin;
        END IF;

        -- Volvieron: se avisó la caída y después mandaron señal.
        v_rows := NULL; v_names := NULL; v_count := 0; v_ids := ARRAY[]::uuid[];
        FOR d IN
            SELECT * FROM public.display_devices
            WHERE commerce_id = c.id AND down_alert_at IS NOT NULL AND last_seen > down_alert_at
            ORDER BY name
        LOOP
            v_count := v_count + 1;
            v_ids := v_ids || d.id;
            v_names := coalesce(v_names || ', ', '') || coalesce(d.name, 'Pantalla');
            v_rows := coalesce(v_rows, '') || format('<li><b>%s</b> volvió a funcionar.</li>', display_html_escape(coalesce(d.name, 'Pantalla')));
        END LOOP;
        IF v_count > 0 THEN
            PERFORM public.display_send_alert_email(
                v_to,
                CASE WHEN v_count = 1 THEN format('✅ %s volvió a funcionar', v_names)
                     ELSE format('✅ %s pantallas volvieron a funcionar', v_count) END,
                format('<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                    || '<p>Buenas noticias de <b>%s</b>:</p><ul>%s</ul>'
                    || '<p><a href="%s/admin/display/commerce/%s/workspace/dashboard">Ver las pantallas</a></p>'
                    || '<p style="color:#888;font-size:12px">Display Digital · EventPix</p></div>',
                    display_html_escape(c.name), v_rows, v_site, c.id)
            );
            UPDATE public.display_devices SET down_alert_at = NULL WHERE id = ANY (v_ids);
        END IF;

        -- Caídas: solo en los días y el horario del local (más 30 minutos al
        -- abrir, para dar tiempo a que prendan las pantallas).
        CONTINUE WHEN NOT (EXTRACT(DOW FROM c.local_now)::int = ANY (c.alert_days));
        CONTINUE WHEN c.local_now::time < c.alert_from + interval '30 minutes' OR c.local_now::time >= c.alert_to;

        v_rows := NULL; v_names := NULL; v_count := 0; v_ids := ARRAY[]::uuid[];
        FOR d IN
            SELECT * FROM public.display_devices
            WHERE commerce_id = c.id
              AND pairing_status = 'linked'
              AND down_alert_at IS NULL
              AND last_seen IS NOT NULL
              AND last_seen < now() - interval '10 minutes'
              AND last_seen > now() - interval '7 days'
            ORDER BY name
        LOOP
            v_count := v_count + 1;
            v_ids := v_ids || d.id;
            v_names := coalesce(v_names || ', ', '') || coalesce(d.name, 'Pantalla');
            v_rows := coalesce(v_rows, '') || format(
                '<li><b>%s</b>: sin señal desde el %s (<a href="%s/admin/display/%s">ver detalles</a>)</li>',
                display_html_escape(coalesce(d.name, 'Pantalla')),
                to_char(d.last_seen AT TIME ZONE c.alert_timezone, 'DD/MM "a las" HH24:MI'),
                v_site, d.id);
        END LOOP;
        IF v_count > 0 THEN
            PERFORM public.display_send_alert_email(
                v_to,
                CASE WHEN v_count = 1 THEN format('⚠️ %s se quedó sin señal', v_names)
                     ELSE format('⚠️ %s pantallas sin señal en %s', v_count, c.name) END,
                format('<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                    || '<p>En <b>%s</b> hay pantallas que no se están viendo:</p><ul>%s</ul>'
                    || '<p><b>Qué hacer:</b></p><ol>'
                    || '<li>Fijate que el equipo esté prendido y la TV en la entrada HDMI correcta.</li>'
                    || '<li>Revisá que tenga internet (el Wi-Fi del local o el cable).</li>'
                    || '<li>Desenchufalo 10 segundos y volvé a enchufarlo.</li></ol>'
                    || '<p>Te avisamos de nuevo cuando vuelva.</p>'
                    || '<p style="color:#888;font-size:12px">Display Digital · EventPix. Podés cambiar el horario de los avisos desde Inicio, en el panel.</p></div>',
                    display_html_escape(c.name), v_rows)
            );
            UPDATE public.display_devices SET down_alert_at = now() WHERE id = ANY (v_ids);
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.display_check_down_alerts() FROM PUBLIC;

-- 6. Programar la revisión cada 5 minutos (necesita pg_cron activado).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'display-down-alerts';
        PERFORM cron.schedule('display-down-alerts', '*/5 * * * *', 'select public.display_check_down_alerts()');
    ELSE
        RAISE NOTICE 'pg_cron no está activado: activalo y volvé a correr este archivo para programar los avisos.';
    END IF;
END $$;
