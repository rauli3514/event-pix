-- ==============================================================================
-- Color del evento (Diseño → Color del evento)
-- ==============================================================================
-- Color de acento en hex (#d4af37). Lo usan el botón "Subí tu foto" del
-- celular, el aviso de foto nueva y los detalles del muro. Vacío = el violeta
-- de siempre, así que los eventos existentes no cambian.

ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS accent_color TEXT;

NOTIFY pgrst, 'reload schema';
