-- Cabina de video (app EventPix Video): equipos, configuración a distancia,
-- galería online, envíos por WhatsApp y archivos del panel. Todo separado del
-- kiosco: tablas, funciones y bucket propios.
-- Panel: /admin/cabina-video (usuarios logueados del panel de EventPix).

-- ─── Equipos ────────────────────────────────────────────────────────
-- El equipo genera su código de 6 caracteres y una clave secreta, se registra
-- solo como 'pending' y desde el panel se vincula. Nunca inicia sesión.
CREATE TABLE IF NOT EXISTS public.video_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code TEXT NOT NULL UNIQUE CHECK (device_code ~ '^[A-Z0-9]{6}$'),
    name TEXT,
    pairing_status TEXT NOT NULL DEFAULT 'pending' CHECK (pairing_status IN ('pending', 'linked')),
    secret_hash TEXT,
    app_version TEXT,
    last_seen TIMESTAMPTZ,
    -- Configuración que manda el panel (settings_rev sube con cada cambio)
    settings JSONB,
    settings_rev INTEGER NOT NULL DEFAULT 0,
    -- Lo que el equipo aplicó e informa
    applied_rev INTEGER NOT NULL DEFAULT 0,
    reported JSONB,
    reported_at TIMESTAMPTZ,
    linked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_devices panel" ON public.video_devices;
CREATE POLICY "video_devices panel" ON public.video_devices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comprueba código + clave (la clave se registra en el primer checkin)
CREATE OR REPLACE FUNCTION public.video_device_verify(p_code TEXT, p_secret TEXT)
RETURNS public.video_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_device public.video_devices%ROWTYPE;
BEGIN
    SELECT * INTO v_device FROM public.video_devices WHERE device_code = upper(p_code);
    IF NOT FOUND OR v_device.pairing_status <> 'linked' THEN RAISE EXCEPTION 'device_not_linked'; END IF;
    IF v_device.secret_hash IS NULL OR p_secret IS NULL
       OR v_device.secret_hash <> encode(extensions.digest(p_secret, 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'device_auth';
    END IF;
    RETURN v_device;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_device_verify(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Checkin del equipo (cada minuto): lo registra si es nuevo, guarda su clave la
-- primera vez, actualiza last_seen y, si la clave coincide, recibe lo que aplicó
-- e informa, y devuelve la configuración del panel.
CREATE OR REPLACE FUNCTION public.video_device_checkin(
    p_code TEXT,
    p_secret TEXT,
    p_app_version TEXT DEFAULT NULL,
    p_applied_rev INTEGER DEFAULT NULL,
    p_report JSONB DEFAULT NULL
)
RETURNS TABLE (name TEXT, pairing_status TEXT, settings JSONB, settings_rev INTEGER)
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
        CASE WHEN d.pairing_status = 'linked' THEN d.settings_rev ELSE 0 END
    FROM public.video_devices d WHERE d.device_code = v_code;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_device_checkin(TEXT, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.video_device_checkin(TEXT, TEXT, TEXT, INTEGER, JSONB) TO anon, authenticated;

-- ─── Galería online ─────────────────────────────────────────────────
-- Cada video subido a Drive se anota con el código de la galería; la página
-- /galeria-video/<código> los muestra. hidden = oculto por el panel o esperando
-- aprobación (galería con aprobación previa).
CREATE TABLE IF NOT EXISTS public.video_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery TEXT NOT NULL CHECK (char_length(gallery) BETWEEN 6 AND 40),
    drive_id TEXT NOT NULL CHECK (char_length(drive_id) BETWEEN 10 AND 120),
    thumb_id TEXT CHECK (thumb_id IS NULL OR char_length(thumb_id) BETWEEN 10 AND 120),
    title TEXT CHECK (title IS NULL OR char_length(title) <= 120),
    mode TEXT CHECK (mode IS NULL OR char_length(mode) <= 30),
    device_id UUID REFERENCES public.video_devices(id) ON DELETE SET NULL,
    hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (gallery, drive_id)
);
CREATE INDEX IF NOT EXISTS video_clips_gallery_idx ON public.video_clips (gallery, created_at DESC);

ALTER TABLE public.video_clips ENABLE ROW LEVEL SECURITY;
-- El público ve solo los visibles; el panel ve y modera todo
DROP POLICY IF EXISTS "video_clips public read" ON public.video_clips;
CREATE POLICY "video_clips public read" ON public.video_clips FOR SELECT TO anon USING (hidden = false);
DROP POLICY IF EXISTS "video_clips panel" ON public.video_clips;
CREATE POLICY "video_clips panel" ON public.video_clips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Los equipos anotan videos solo con su clave (nadie más puede llenar una galería)
CREATE OR REPLACE FUNCTION public.video_clip_add(
    p_code TEXT, p_secret TEXT, p_gallery TEXT, p_drive_id TEXT,
    p_thumb_id TEXT DEFAULT NULL, p_title TEXT DEFAULT NULL, p_mode TEXT DEFAULT NULL, p_hidden BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_device public.video_devices%ROWTYPE;
BEGIN
    v_device := public.video_device_verify(p_code, p_secret);
    INSERT INTO public.video_clips (gallery, drive_id, thumb_id, title, mode, device_id, hidden)
    VALUES (p_gallery, p_drive_id, p_thumb_id, left(p_title, 120), left(p_mode, 30), v_device.id, COALESCE(p_hidden, false))
    ON CONFLICT (gallery, drive_id) DO NOTHING;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- Cambios en vivo (videos nuevos, ocultos, borrados) para la galería y el panel
ALTER TABLE public.video_clips REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.video_clips;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

-- ─── Envíos por WhatsApp ────────────────────────────────────────────
-- Los escribe solo la función send-video-whatsapp. Guarda el teléfono (dato
-- personal): solo lo ve el panel.
CREATE TABLE IF NOT EXISTS public.video_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.video_devices(id) ON DELETE SET NULL,
    gallery TEXT,
    drive_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error TEXT,
    provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_sends_device_idx ON public.video_sends (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_sends_gallery_idx ON public.video_sends (gallery, created_at DESC);
ALTER TABLE public.video_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_sends panel read" ON public.video_sends;
CREATE POLICY "video_sends panel read" ON public.video_sends FOR SELECT TO authenticated USING (true);

-- Para la función: comprueba el equipo y cuenta sus envíos de las últimas 24 h
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
    v_device := public.video_device_verify(p_code, p_secret);
    RETURN QUERY SELECT v_device.id,
        (SELECT count(*)::INTEGER FROM public.video_sends s
          WHERE s.device_id = v_device.id AND s.created_at > now() - interval '24 hours');
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_send_check(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.video_send_check(TEXT, TEXT) TO service_role;

-- ─── Archivos del panel (marcos, logo, música, animación) ───────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-assets', 'video-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Anyone can read video assets" ON storage.objects;
CREATE POLICY "Anyone can read video assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'video-assets');

DROP POLICY IF EXISTS "Authenticated can manage video assets" ON storage.objects;
CREATE POLICY "Authenticated can manage video assets" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'video-assets') WITH CHECK (bucket_id = 'video-assets');
