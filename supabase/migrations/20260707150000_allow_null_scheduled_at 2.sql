-- Allow scheduled_at to be null for recurring schedules
ALTER TABLE public.display_schedules ALTER COLUMN scheduled_at DROP NOT NULL;
