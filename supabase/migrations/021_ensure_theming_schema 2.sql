
-- Ensure critical columns exist for theming
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'inter';
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS frame_image_url text;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS frame_enabled boolean DEFAULT true;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS splash_logo_url text;
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS show_splash_logo boolean DEFAULT true;

-- Ensure permissions are correct (re-apply to be safe)
GRANT ALL ON TABLE event_settings TO authenticated;
GRANT ALL ON TABLE event_settings TO service_role;
GRANT SELECT ON TABLE event_settings TO anon;
