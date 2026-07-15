ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS ai_moderation_level TEXT DEFAULT 'medium'; -- low, medium, high
