-- Fix RLS Policies for new Commerce Architecture

-- 1. display_media
DROP POLICY IF EXISTS "Providers can insert their own media" ON public.display_media;
CREATE POLICY "Providers can insert their own media" ON public.display_media FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_media.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Providers can update their own media" ON public.display_media;
CREATE POLICY "Providers can update their own media" ON public.display_media FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_media.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "Providers can delete their own media" ON public.display_media;
CREATE POLICY "Providers can delete their own media" ON public.display_media FOR DELETE
USING (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_media.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 2. display_groups
DROP POLICY IF EXISTS "Providers can manage their own groups" ON public.display_groups;
CREATE POLICY "Providers can manage their own groups" ON public.display_groups FOR ALL
USING (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_groups.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 3. display_devices
DROP POLICY IF EXISTS "Providers can manage their own devices" ON public.display_devices;
CREATE POLICY "Providers can manage their own devices" ON public.display_devices FOR ALL
USING (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_devices.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 4. display_campaigns
DROP POLICY IF EXISTS "Providers can manage their own campaigns" ON public.display_campaigns;
CREATE POLICY "Providers can manage their own campaigns" ON public.display_campaigns FOR ALL
USING (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_campaigns.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 5. display_schedules
DROP POLICY IF EXISTS "Providers can manage their own schedules" ON public.display_schedules;
CREATE POLICY "Providers can manage their own schedules" ON public.display_schedules FOR ALL
USING (
    EXISTS (SELECT 1 FROM display_commerce_users WHERE commerce_id = display_schedules.commerce_id AND user_id = auth.uid()) 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
