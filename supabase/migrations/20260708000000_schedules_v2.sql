-- Drop the old display_schedules entirely
DROP TABLE IF EXISTS public.display_schedules CASCADE;

-- Create the new display_schedules table (The "Schedule Object")
CREATE TABLE public.display_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commerce_id UUID NOT NULL REFERENCES public.display_commerces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_campaign_id UUID REFERENCES public.display_campaigns(id) ON DELETE SET NULL,
    default_media_id UUID REFERENCES public.display_media(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((default_campaign_id IS NOT NULL AND default_media_id IS NULL) OR (default_campaign_id IS NULL AND default_media_id IS NOT NULL) OR (default_campaign_id IS NULL AND default_media_id IS NULL))
);

-- Create the schedule events table (The "Timed Items" inside the schedule)
CREATE TABLE public.display_schedule_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES public.display_schedules(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.display_campaigns(id) ON DELETE SET NULL,
    media_id UUID REFERENCES public.display_media(id) ON DELETE SET NULL,
    start_time TEXT NOT NULL, -- Stored as HH:MM
    end_time TEXT NOT NULL, -- Stored as HH:MM
    days_of_week INTEGER[] NOT NULL, -- [0, 1, 2, 3, 4, 5, 6] where 0=Sun
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((campaign_id IS NOT NULL AND media_id IS NULL) OR (campaign_id IS NULL AND media_id IS NOT NULL))
);

-- Allow assignments to target a schedule instead of just campaign/media
ALTER TABLE public.display_assignments ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.display_schedules(id) ON DELETE SET NULL;

-- Relax the check constraint on display_assignments so it accepts schedule_id
ALTER TABLE public.display_assignments DROP CONSTRAINT IF EXISTS "display_assignments_content_check";
ALTER TABLE public.display_assignments ADD CONSTRAINT "display_assignments_content_check" CHECK (
    (campaign_id IS NOT NULL AND media_id IS NULL AND schedule_id IS NULL) OR
    (campaign_id IS NULL AND media_id IS NOT NULL AND schedule_id IS NULL) OR
    (campaign_id IS NULL AND media_id IS NULL AND schedule_id IS NOT NULL)
);

-- RLS for display_schedules
ALTER TABLE public.display_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for display_schedules" ON public.display_schedules USING (true) WITH CHECK (true);

-- RLS for display_schedule_events
ALTER TABLE public.display_schedule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for display_schedule_events" ON public.display_schedule_events USING (true) WITH CHECK (true);
