-- ==============================================================================
-- Muro de fotos: interruptores para lo que se muestra en pantalla
-- ==============================================================================
-- Todo prendido por defecto (como hasta ahora). Desde el panel del evento →
-- Pantalla se puede apagar cada cosa, por ejemplo para un evento corporativo.

ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS wall_spotlight_enabled BOOLEAN NOT NULL DEFAULT true; -- "¡NUEVA FOTO!" + aviso al invitado
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS wall_collage_enabled BOOLEAN NOT NULL DEFAULT true;   -- collage de 12 fotos cada tanto
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS wall_ranking_enabled BOOLEAN NOT NULL DEFAULT true;   -- ranking de los que más suben
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS wall_counter_enabled BOOLEAN NOT NULL DEFAULT true;   -- contador de fotos e invitados
