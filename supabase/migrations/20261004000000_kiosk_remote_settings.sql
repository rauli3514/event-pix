-- Configuración del kiosco a distancia (panel admin → TV box).
-- Re-ejecutable. Requiere 20261003000000_kiosk_devices.sql.
--
--   settings      ajustes que se cambian desde el panel (se aplican sobre los del equipo)
--   settings_rev  sube cada vez que el panel guarda; el equipo aplica si es mayor que applied_rev
--   applied_rev   última versión que el equipo aplicó (la informa en el checkin)
--   reported      ajustes actuales del equipo (los informa en el checkin, para mostrarlos en el panel)

ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS settings_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS applied_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS reported JSONB;
ALTER TABLE public.kiosk_devices ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ;

-- El checkin cambia de forma: se borra el anterior. Los parámetros nuevos tienen
-- valor por defecto, así los equipos con la app vieja (p_code, p_app_version) siguen andando.
DROP FUNCTION IF EXISTS public.kiosk_device_checkin(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB);

CREATE FUNCTION public.kiosk_device_checkin(
    p_code TEXT,
    p_app_version TEXT DEFAULT NULL,
    p_applied_rev INTEGER DEFAULT NULL,
    p_report JSONB DEFAULT NULL
)
RETURNS TABLE (
    device_code TEXT,
    name TEXT,
    pairing_status TEXT,
    kiosk_event_id UUID,
    event_name TEXT,
    settings JSONB,
    settings_rev INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
BEGIN
    IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{6}$' THEN
        RAISE EXCEPTION 'Código de equipo inválido';
    END IF;
    -- Un reporte enorme no tiene sentido (el equipo manda solo ajustes de texto)
    IF p_report IS NOT NULL AND length(p_report::text) > 20000 THEN
        p_report := NULL;
    END IF;

    INSERT INTO public.kiosk_devices (device_code, app_version, last_seen)
    VALUES (p_code, p_app_version, now())
    ON CONFLICT ON CONSTRAINT kiosk_devices_device_code_key DO UPDATE
        SET last_seen = now(),
            app_version = COALESCE(EXCLUDED.app_version, public.kiosk_devices.app_version);

    -- Solo un equipo vinculado informa sus ajustes y lo que aplicó
    UPDATE public.kiosk_devices d
        SET applied_rev = COALESCE(p_applied_rev, d.applied_rev),
            reported = COALESCE(p_report, d.reported),
            reported_at = CASE WHEN p_report IS NULL THEN d.reported_at ELSE now() END
        WHERE d.device_code = p_code AND d.pairing_status = 'linked'
          AND (p_applied_rev IS NOT NULL OR p_report IS NOT NULL);

    RETURN QUERY
        SELECT d.device_code, d.name, d.pairing_status, d.kiosk_event_id, e.name,
               CASE WHEN d.pairing_status = 'linked' THEN d.settings ELSE '{}'::jsonb END,
               CASE WHEN d.pairing_status = 'linked' THEN d.settings_rev ELSE 0 END
        FROM public.kiosk_devices d
        LEFT JOIN public.kiosk_events e ON e.id = d.kiosk_event_id
        WHERE d.device_code = p_code;
END;
$fn$;

REVOKE ALL ON FUNCTION public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_device_checkin(TEXT, TEXT, INTEGER, JSONB) TO anon, authenticated;

-- Archivos que el panel manda a los equipos (marcos PNG): lectura pública, carga con login
INSERT INTO storage.buckets (id, name, public)
VALUES ('kiosk-assets', 'kiosk-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Anyone can read kiosk assets" ON storage.objects;
CREATE POLICY "Anyone can read kiosk assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'kiosk-assets');

DROP POLICY IF EXISTS "Authenticated can manage kiosk assets" ON storage.objects;
CREATE POLICY "Authenticated can manage kiosk assets" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'kiosk-assets') WITH CHECK (bucket_id = 'kiosk-assets');
