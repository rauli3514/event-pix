ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS previous_campaign_id UUID REFERENCES public.display_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS previous_media_id UUID REFERENCES public.display_media(id) ON DELETE SET NULL;
