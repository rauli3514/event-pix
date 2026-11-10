-- Display Digital: Mosaico (una imagen repartida entre varias pantallas).
--
-- Se suma el modo 'wall' a las pantallas sincronizadas (ver display_sync_modes):
-- todas van en espejo y cada una muestra su pedazo de la imagen.
--   wall_cols × wall_rows: forma del mosaico (2×1, 4×1, 2×2…).
--   wall_index: lugar de esta pantalla, de izquierda a derecha y de arriba
--               abajo, empezando en 0.
-- Se corre una sola vez en el SQL Editor de Supabase (ver docs/pantallas-sincronizadas.md).

ALTER TABLE public.display_assignments
    DROP CONSTRAINT IF EXISTS display_assignments_sync_mode_check;
ALTER TABLE public.display_assignments
    ADD CONSTRAINT display_assignments_sync_mode_check CHECK (sync_mode IN ('mirror', 'wave', 'wall'));

ALTER TABLE public.display_assignments
    ADD COLUMN IF NOT EXISTS wall_cols smallint CHECK (wall_cols BETWEEN 1 AND 8),
    ADD COLUMN IF NOT EXISTS wall_rows smallint CHECK (wall_rows BETWEEN 1 AND 8),
    ADD COLUMN IF NOT EXISTS wall_index smallint CHECK (wall_index >= 0);
