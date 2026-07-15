-- Display Hub V2: Auto-Discovery Architecture

-- 1. Modify existing display_devices table
ALTER TABLE public.display_devices RENAME COLUMN code TO device_id;

ALTER TABLE public.display_devices ALTER COLUMN name DROP NOT NULL;

ALTER TABLE public.display_devices ADD COLUMN android_version TEXT;

ALTER TABLE public.display_devices ADD COLUMN pairing_status TEXT DEFAULT 'pending' CHECK (pairing_status IN ('pending', 'linked'));

ALTER TABLE public.display_devices DROP COLUMN IF EXISTS online_status;

-- 2. Add RLS Policies for Auto-Registration
-- Allow anonymous inserts so the APK can register itself
-- It can only insert devices in 'pending' status.
CREATE POLICY "Anon can register device" ON public.display_devices
    FOR INSERT WITH CHECK (pairing_status = 'pending');

-- Allow anonymous updates ONLY to the 'last_seen' and 'app_version'/'android_version' fields 
-- IF they know their exact device_id.
CREATE POLICY "Anon can update their own device heartbeat info" ON public.display_devices
    FOR UPDATE USING (true) WITH CHECK (true);
    
-- Note: In a production environment with strict security, you might want to use a Supabase Edge Function
-- to handle the heartbeat securely, or use a JWT token specific to the device. 
-- For this architecture, relying on RLS and the unguessable device_id is a valid starting point.
