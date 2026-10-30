-- Display Digital: orden de las pantallas en el panel.
--
-- En Pantallas se pueden arrastrar las tarjetas para ordenarlas; el orden
-- queda guardado acá para que se vea igual desde cualquier computadora.
-- (Sin esta columna, el panel guarda el orden solo en el navegador.)
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).

ALTER TABLE public.display_devices ADD COLUMN IF NOT EXISTS sort_order integer;
