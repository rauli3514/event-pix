ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS audio_messages_enabled BOOLEAN DEFAULT TRUE;
