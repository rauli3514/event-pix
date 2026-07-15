-- Agrega el nuevo toggle para la funcionalidad de IA
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS ai_generation_enabled boolean DEFAULT false;
