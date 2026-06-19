-- Display Hub V3: Multi-Tenant Architecture (Commerces and Zones)

-- 1. Modify display_groups to belong to a commerce (provider profile)
ALTER TABLE public.display_groups ADD COLUMN commerce_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Modify display_devices to belong to a commerce and a group
ALTER TABLE public.display_devices ADD COLUMN commerce_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.display_devices ADD COLUMN group_id UUID REFERENCES public.display_groups(id) ON DELETE SET NULL;

-- 3. RLS Policies for Providers (Commerces)
-- Allow providers to manage their own groups
CREATE POLICY "Providers can manage their own groups" ON public.display_groups
    FOR ALL USING (commerce_id = auth.uid());

-- Allow providers to manage their own devices
CREATE POLICY "Providers can manage their own devices" ON public.display_devices
    FOR ALL USING (commerce_id = auth.uid());

-- Allow providers to read assignments for their devices
CREATE POLICY "Providers can manage assignments for their devices" ON public.display_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.display_devices d 
            WHERE d.id = display_assignments.device_id AND d.commerce_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.display_groups g
            WHERE g.id = display_assignments.group_id AND g.commerce_id = auth.uid()
        )
    );
