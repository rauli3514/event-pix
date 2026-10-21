-- Cabina de video: moderación de la galería y envío por WhatsApp.
-- Necesita 20261021000000_video_clips.sql.

-- ─── Moderación ─────────────────────────────────────────────────────
-- hidden = true: el video no aparece en la galería pública (oculto por el panel,
-- o esperando aprobación si la galería es "con aprobación previa").
ALTER TABLE public.video_clips ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

-- El público ve solo los visibles; el panel (usuarios logueados) ve todos.
DROP POLICY IF EXISTS "video_clips public read" ON public.video_clips;
CREATE POLICY "video_clips public read" ON public.video_clips FOR SELECT TO anon USING (hidden = false);
DROP POLICY IF EXISTS "video_clips admin read" ON public.video_clips;
CREATE POLICY "video_clips admin read" ON public.video_clips FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "video_clips admin update" ON public.video_clips;
CREATE POLICY "video_clips admin update" ON public.video_clips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Los cambios (ocultar / borrar) también llegan en vivo a la pantalla de la galería
ALTER TABLE public.video_clips REPLICA IDENTITY FULL;

-- ─── Envíos por WhatsApp ────────────────────────────────────────────
-- Registro de cada envío (lo escribe solo la función send-video-whatsapp).
-- Guarda el teléfono: es dato personal, solo lo ve el panel.
CREATE TABLE IF NOT EXISTS public.video_sends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
    gallery TEXT,
    drive_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error TEXT,
    provider_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS video_sends_device_idx ON public.video_sends (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_sends_gallery_idx ON public.video_sends (gallery, created_at DESC);

ALTER TABLE public.video_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_sends admin read" ON public.video_sends;
CREATE POLICY "video_sends admin read" ON public.video_sends FOR SELECT TO authenticated USING (true);

-- Comprueba el equipo (código + clave secreta, como la IA) y cuenta sus envíos
-- de las últimas 24 h (para el tope diario). Solo la usa la función.
CREATE OR REPLACE FUNCTION public.kiosk_video_send_check(p_code TEXT, p_secret TEXT)
RETURNS TABLE (device_id UUID, sent_today INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
    v_device public.kiosk_devices%ROWTYPE;
BEGIN
    SELECT * INTO v_device FROM public.kiosk_devices WHERE device_code = upper(p_code);
    IF NOT FOUND OR v_device.pairing_status <> 'linked' THEN RAISE EXCEPTION 'device_not_linked'; END IF;
    IF v_device.device_secret_hash IS NULL OR p_secret IS NULL
       OR v_device.device_secret_hash <> encode(extensions.digest(p_secret, 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'device_auth';
    END IF;
    RETURN QUERY SELECT v_device.id,
        (SELECT count(*)::INTEGER FROM public.video_sends s
          WHERE s.device_id = v_device.id AND s.created_at > now() - interval '24 hours');
END;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_video_send_check(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_video_send_check(TEXT, TEXT) TO service_role;
