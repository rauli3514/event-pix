-- Cabina de video: galería online del evento.
-- Cada video subido a Drive se anota acá con el código de la galería; la página
-- /galeria-video/<código> los muestra (en el celular o en una pantalla del evento).
-- Los equipos no inician sesión: pueden anotar videos y cualquiera con el código
-- puede verlos (el código es largo y al azar). Borrar: solo desde el panel.

CREATE TABLE IF NOT EXISTS video_clips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gallery TEXT NOT NULL CHECK (char_length(gallery) BETWEEN 6 AND 40),
    drive_id TEXT NOT NULL CHECK (char_length(drive_id) BETWEEN 10 AND 120),
    thumb_id TEXT CHECK (thumb_id IS NULL OR char_length(thumb_id) BETWEEN 10 AND 120),
    title TEXT CHECK (title IS NULL OR char_length(title) <= 120),
    mode TEXT CHECK (mode IS NULL OR char_length(mode) <= 30),
    device_code TEXT CHECK (device_code IS NULL OR char_length(device_code) <= 30),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (gallery, drive_id)
);

CREATE INDEX IF NOT EXISTS video_clips_gallery_idx ON video_clips (gallery, created_at DESC);

ALTER TABLE video_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_clips public read" ON video_clips;
CREATE POLICY "video_clips public read" ON video_clips FOR SELECT USING (true);

DROP POLICY IF EXISTS "video_clips device insert" ON video_clips;
CREATE POLICY "video_clips device insert" ON video_clips FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "video_clips admin delete" ON video_clips;
CREATE POLICY "video_clips admin delete" ON video_clips FOR DELETE TO authenticated USING (true);

-- Videos nuevos en vivo en la pantalla de la galería
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE video_clips;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
