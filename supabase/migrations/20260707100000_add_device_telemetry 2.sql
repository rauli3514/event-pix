-- Add telemetry column to display_devices
ALTER TABLE public.display_devices ADD COLUMN telemetry JSONB DEFAULT '{}'::jsonb;
