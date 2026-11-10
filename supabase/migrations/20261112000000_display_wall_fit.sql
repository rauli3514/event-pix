-- Display Digital: Mosaico, cómo entra la imagen.
--   'cover'   (por defecto): llena todo el mosaico y recorta lo que sobra.
--   'contain': se ve completa, con franjas negras donde no llega.
-- Se corre una sola vez en el SQL Editor de Supabase (ver docs/pantallas-sincronizadas.md).

ALTER TABLE public.display_assignments
    ADD COLUMN IF NOT EXISTS wall_fit text CHECK (wall_fit IN ('cover', 'contain'));
