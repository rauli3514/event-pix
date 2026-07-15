-- Add recurring schedule fields to display_schedules
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS days_of_week JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS end_time TEXT;
