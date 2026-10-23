-- Cabina de video: vista previa animada de cada video para la pantalla de la galería
-- (una imagen con 24 cuadros del video, subida a Drive como la miniatura).
-- Correr en Supabase → SQL Editor. Se puede correr más de una vez.

ALTER TABLE public.video_clips ADD COLUMN IF NOT EXISTS preview_id TEXT
    CHECK (preview_id IS NULL OR char_length(preview_id) BETWEEN 10 AND 120);

-- La función de siempre, con la vista previa al final
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
    v_device := public.video_device_verify(p_code, p_secret);
    INSERT INTO public.video_clips (gallery, drive_id, thumb_id, preview_id, title, mode, device_id, hidden)
    VALUES (p_gallery, p_drive_id, p_thumb_id, p_preview_id, left(p_title, 120), left(p_mode, 30), v_device.id, COALESCE(p_hidden, false))
    ON CONFLICT (gallery, drive_id) DO NOTHING;
END;
$fn$;
REVOKE ALL ON FUNCTION public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.video_clip_add(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
