-- Cabina de video: licencias por equipo (demo / cliente) para vender la app.
-- - Los equipos nuevos arrancan en DEMO: todo funciona, pero los videos salen con
--   la marca de agua "DEMO". Los que ya existían quedan como CLIENTE (son tuyos).
-- - Desde el panel (/admin/cabina-video → Equipos → Licencia) se pasa a CLIENTE,
--   con vencimiento opcional. El equipo se entera en su próximo checkin (~1 min).
-- - La galería funciona para todos los equipos (vinculados o no); el WhatsApp,
--   que cuesta cada mensaje, solo para equipos con licencia vigente.
-- Correr en Supabase → SQL Editor. Se puede correr más de una vez.

-- ─── Columnas de la licencia ────────────────────────────────────────
-- Las filas que ya existen quedan 'full'; las nuevas, 'demo'
ALTER TABLE public.video_devices ADD COLUMN IF NOT EXISTS license TEXT NOT NULL DEFAULT 'full'
    CHECK (license IN ('demo', 'full'));
ALTER TABLE public.video_devices ALTER COLUMN license SET DEFAULT 'demo';
ALTER TABLE public.video_devices ADD COLUMN IF NOT EXISTS license_until TIMESTAMPTZ;
ALTER TABLE public.video_devices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.video_devices ADD COLUMN IF NOT EXISTS customer_contact TEXT;
ALTER TABLE public.video_devices ADD COLUMN IF NOT EXISTS license_plan TEXT;
ALTER TABLE public.video_devices ADD COLUMN IF NOT EXISTS license_notes TEXT;

-- ¿Tiene licencia vigente?
CREATE OR REPLACE FUNCTION public.video_license_ok(d public.video_devices)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $fn$
    SELECT d.license = 'full' AND (d.license_until IS NULL OR d.license_until > now());
$fn$;

-- ─── Equipo por código + clave (vinculado o no) ─────────────────────
CREATE OR REPLACE FUNCTION public.video_device_auth(p_code TEXT, p_secret TEXT)
RETURNS public.video_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_device public.video_devices%ROWTYPE;
BEGIN
    SELECT * INTO v_device FROM public.video_devices WHERE device_code = upper(p_code);
    IF NOT FOUND OR v_device.secret_hash IS NULL OR p_secret IS NULL
       OR v_device.secret_hash <> encode(extensions.digest(p_secret, 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'device_auth';
    END IF;
    RETURN v_device;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_device_auth(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ─── Checkin: ahora también devuelve la licencia ────────────────────
DROP FUNCTION IF EXISTS public.video_device_checkin(TEXT, TEXT, TEXT, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.video_device_checkin(
    p_code TEXT,
    p_secret TEXT,
    p_app_version TEXT DEFAULT NULL,
    p_applied_rev INTEGER DEFAULT NULL,
    p_report JSONB DEFAULT NULL
)
RETURNS TABLE (name TEXT, pairing_status TEXT, settings JSONB, settings_rev INTEGER, license TEXT, license_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
    v_code TEXT := upper(trim(p_code));
    v_hash TEXT;
    v_ok BOOLEAN;
BEGIN
    IF v_code !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'invalid_code'; END IF;
    IF p_secret IS NULL OR length(p_secret) < 32 THEN RAISE EXCEPTION 'device_auth'; END IF;
    v_hash := encode(extensions.digest(p_secret, 'sha256'), 'hex');

    INSERT INTO public.video_devices (device_code, secret_hash, app_version, last_seen)
    VALUES (v_code, v_hash, p_app_version, now())
    ON CONFLICT (device_code) DO NOTHING;

    UPDATE public.video_devices d SET secret_hash = v_hash WHERE d.device_code = v_code AND d.secret_hash IS NULL;
    SELECT d.secret_hash = v_hash INTO v_ok FROM public.video_devices d WHERE d.device_code = v_code;
    -- Otro equipo con el mismo código: no se le muestra nada de este
    IF NOT v_ok THEN RAISE EXCEPTION 'device_auth'; END IF;

    UPDATE public.video_devices d SET
        last_seen = now(),
        app_version = COALESCE(p_app_version, d.app_version),
        applied_rev = COALESCE(p_applied_rev, d.applied_rev),
        reported = COALESCE(p_report, d.reported),
        reported_at = CASE WHEN p_report IS NOT NULL THEN now() ELSE d.reported_at END
    WHERE d.device_code = v_code;

    RETURN QUERY SELECT d.name, d.pairing_status,
        CASE WHEN d.pairing_status = 'linked' THEN d.settings ELSE NULL END,
        CASE WHEN d.pairing_status = 'linked' THEN d.settings_rev ELSE 0 END,
        d.license, d.license_until
    FROM public.video_devices d WHERE d.device_code = v_code;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_device_checkin(TEXT, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.video_device_checkin(TEXT, TEXT, TEXT, INTEGER, JSONB) TO anon, authenticated;

-- ─── Galería: cualquier equipo con su clave (vinculado o no) ────────
-- Se crea con la vista previa (por si 20261023000000_video_clip_preview.sql no se corrió)
ALTER TABLE public.video_clips ADD COLUMN IF NOT EXISTS preview_id TEXT
    CHECK (preview_id IS NULL OR char_length(preview_id) BETWEEN 10 AND 120);
DROP FUNCTION IF EXISTS public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.video_clip_add(
    p_code TEXT, p_secret TEXT, p_gallery TEXT, p_drive_id TEXT,
    p_thumb_id TEXT DEFAULT NULL, p_title TEXT DEFAULT NULL, p_mode TEXT DEFAULT NULL, p_hidden BOOLEAN DEFAULT false,
    p_preview_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_device public.video_devices%ROWTYPE;
BEGIN
    v_device := public.video_device_auth(p_code, p_secret);
    INSERT INTO public.video_clips (gallery, drive_id, thumb_id, preview_id, title, mode, device_id, hidden)
    VALUES (p_gallery, p_drive_id, p_thumb_id, p_preview_id, left(p_title, 120), left(p_mode, 30), v_device.id, COALESCE(p_hidden, false))
    ON CONFLICT (gallery, drive_id) DO NOTHING;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;

-- ─── WhatsApp: solo equipos con licencia vigente ────────────────────
CREATE OR REPLACE FUNCTION public.video_send_check(p_code TEXT, p_secret TEXT)
RETURNS TABLE (device_id UUID, sent_today INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
    v_device public.video_devices%ROWTYPE;
BEGIN
    v_device := public.video_device_auth(p_code, p_secret);
    IF NOT public.video_license_ok(v_device) THEN RAISE EXCEPTION 'license_required'; END IF;
    RETURN QUERY SELECT v_device.id,
        (SELECT count(*)::INTEGER FROM public.video_sends s
          WHERE s.device_id = v_device.id AND s.created_at > now() - interval '24 hours');
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_send_check(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.video_send_check(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
