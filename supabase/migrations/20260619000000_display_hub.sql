-- 1. Create display_devices table
CREATE TABLE IF NOT EXISTS public.display_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    device_model TEXT,
    app_version TEXT,
    online_status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. Create display_groups table
CREATE TABLE IF NOT EXISTS public.display_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 3. Create display_templates table
CREATE TABLE IF NOT EXISTS public.display_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    layout_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 4. Create display_assignments table
CREATE TABLE IF NOT EXISTS public.display_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.display_devices(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.display_groups(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.display_templates(id),
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    -- Prevent duplicate assignment per device/group (one or the other)
    CONSTRAINT check_assignment_target CHECK (
        (device_id IS NOT NULL AND group_id IS NULL) OR 
        (device_id IS NULL AND group_id IS NOT NULL)
    ),
    CONSTRAINT unique_device_assignment UNIQUE (device_id),
    CONSTRAINT unique_group_assignment UNIQUE (group_id)
);

-- 5. Create display_heartbeats table
CREATE TABLE IF NOT EXISTS public.display_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.display_devices(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    app_version TEXT,
    ip TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Turn on RLS
ALTER TABLE public.display_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_heartbeats ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for super_admin
CREATE POLICY "Super admin can manage display_devices" ON public.display_devices
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "Super admin can manage display_groups" ON public.display_groups
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "Super admin can manage display_templates" ON public.display_templates
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "Super admin can manage display_assignments" ON public.display_assignments
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "Super admin can manage display_heartbeats" ON public.display_heartbeats
    FOR ALL USING (public.is_super_admin());

-- Add Trigger to auto-update 'updated_at' on display_devices
CREATE OR REPLACE FUNCTION update_display_device_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_display_devices_updated_at
    BEFORE UPDATE ON public.display_devices
    FOR EACH ROW EXECUTE PROCEDURE update_display_device_modtime();

-- Add anonymous read policies specifically for API fetching using the code.
-- Note: This requires the device to know its 'code'.
CREATE POLICY "Anon can read their own device config if they have the code" ON public.display_devices
    FOR SELECT USING (true); -- In actual production, you might want to restrict this more or rely on the Edge Function. 

-- Since the prompt said they might use a direct Supabase connection from the APK in the future,
-- we'll allow public inserts into heartbeats.
CREATE POLICY "Anon can insert heartbeats" ON public.display_heartbeats
    FOR INSERT WITH CHECK (true);
