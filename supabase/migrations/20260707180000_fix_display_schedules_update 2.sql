-- Ensure columns exist (just in case they were not applied properly)
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS previous_campaign_id UUID REFERENCES public.display_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.display_schedules ADD COLUMN IF NOT EXISTS previous_media_id UUID REFERENCES public.display_media(id) ON DELETE SET NULL;

-- Ensure RLS is enabled
ALTER TABLE public.display_schedules ENABLE ROW LEVEL SECURITY;

-- 1. Ensure the user can INSERT (create new schedules)
DROP POLICY IF EXISTS "Enable inserts for display_schedules" ON public.display_schedules;
CREATE POLICY "Enable inserts for display_schedules" ON public.display_schedules FOR INSERT WITH CHECK (true);

-- 2. Ensure the user can SELECT (read their schedules)
DROP POLICY IF EXISTS "Enable select for display_schedules" ON public.display_schedules;
CREATE POLICY "Enable select for display_schedules" ON public.display_schedules FOR SELECT USING (true);

-- 3. Ensure the user can UPDATE (crucial for auto-publish and revert!)
DROP POLICY IF EXISTS "Enable updates for display_schedules" ON public.display_schedules;
CREATE POLICY "Enable updates for display_schedules" ON public.display_schedules FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Ensure the user can DELETE (delete their schedules)
DROP POLICY IF EXISTS "Enable deletes for display_schedules" ON public.display_schedules;
CREATE POLICY "Enable deletes for display_schedules" ON public.display_schedules FOR DELETE USING (true);
