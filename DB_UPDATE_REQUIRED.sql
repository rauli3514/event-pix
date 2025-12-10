
-- 🛠️ EJECUTA ESTO EN EL SQL EDITOR DE SUPABASE PARA HABILITAR LOS NUEVOS TEMAS 🛠️

-- 1. Agrega soporte para fuentes personalizadas (Neon, Manuscrita, Elegante)
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'inter';

-- 2. Agrega soporte para Marcos Decorativos y Logos
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS frame_image_url text;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS frame_enabled boolean DEFAULT true;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS splash_logo_url text;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS show_splash_logo boolean DEFAULT true;

-- 3. Agrega soporte para modos especiales (si faltan)
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS public_gallery_enabled boolean DEFAULT false;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS dj_mode_enabled boolean DEFAULT false;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS photo_booth_enabled boolean DEFAULT false;

-- 4. Asegura que el bucket de almacenamiento de fotos exista y sea público
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Crear políticas de almacenamiento para que cualquiera pueda ver los marcos/fondos
CREATE POLICY "Public Access to Event Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'event-images' );

-- Mensaje de confirmación (aparecerá en los resultados)
SELECT '✅ Base de datos actualizada correctamente. Ahora puedes usar los Temas.' as status;
