-- Display Digital: pantallas sincronizadas (Espejo y Olas).
--
-- Al mandar el mismo contenido a varias pantallas se elige cómo se ven:
--   'mirror' (Espejo): todas muestran lo mismo al mismo tiempo.
--   'wave'   (Olas):   la misma lista, cada pantalla atrasada sync_offset_s
--                       segundos respecto de la anterior.
-- Sin sync_mode (null) cada pantalla va a su ritmo, como antes.
-- Se corre una sola vez en el SQL Editor de Supabase (ver docs/pantallas-sincronizadas.md).

ALTER TABLE public.display_assignments
    ADD COLUMN IF NOT EXISTS sync_mode text CHECK (sync_mode IN ('mirror', 'wave')),
    ADD COLUMN IF NOT EXISTS sync_offset_s integer NOT NULL DEFAULT 0;

-- Hora del servidor: las TV la usan para corregir su reloj y así ir juntas
-- aunque alguna tenga la hora corrida unos segundos.
CREATE OR REPLACE FUNCTION public.display_server_time()
RETURNS timestamptz
LANGUAGE sql
VOLATILE
AS $$
    SELECT clock_timestamp()
$$;

GRANT EXECUTE ON FUNCTION public.display_server_time() TO anon, authenticated;
