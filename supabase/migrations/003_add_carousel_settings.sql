-- Add carousel settings to event_settings table
ALTER TABLE event_settings 
ADD COLUMN carousel_max_loops INTEGER DEFAULT 3,
ADD COLUMN carousel_interval_ms INTEGER DEFAULT 5000,
ADD COLUMN wall_show_controls BOOLEAN DEFAULT true;
