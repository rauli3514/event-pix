ALTER TABLE event_settings ALTER COLUMN promo_banner_enabled SET DEFAULT FALSE;

-- Optional: Reset existing events to disabled to solve the "stuck" issue for current users
UPDATE event_settings SET promo_banner_enabled = FALSE;
