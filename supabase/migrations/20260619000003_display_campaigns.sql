-- Display Hub V4: Campaigns (Playlists) Architecture

-- 1. Rename templates to campaigns
ALTER TABLE public.display_templates RENAME TO display_campaigns;

-- 2. Modify campaigns table for Multi-Tenant and JSON structure
ALTER TABLE public.display_campaigns ADD COLUMN commerce_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.display_campaigns RENAME COLUMN layout_json TO items_json;

-- Set a default empty array for existing rows
UPDATE public.display_campaigns SET items_json = '[]'::jsonb WHERE items_json = '{}'::jsonb;
ALTER TABLE public.display_campaigns ALTER COLUMN items_json SET DEFAULT '[]'::jsonb;

-- 3. Modify assignments table
-- Since the system generated the constraint name automatically, we drop it by name
ALTER TABLE public.display_assignments DROP CONSTRAINT IF EXISTS display_assignments_template_id_fkey;
ALTER TABLE public.display_assignments RENAME COLUMN template_id TO campaign_id;
ALTER TABLE public.display_assignments ADD CONSTRAINT display_assignments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.display_campaigns(id) ON DELETE SET NULL;

-- Drop the old static URL column
ALTER TABLE public.display_assignments DROP COLUMN IF EXISTS url;

-- 4. RLS Policies for Campaigns
DROP POLICY IF EXISTS "Super admin can manage display_templates" ON public.display_campaigns;

CREATE POLICY "Super admin can manage display_campaigns" ON public.display_campaigns
    FOR ALL USING (public.is_super_admin());

CREATE POLICY "Providers can manage their own campaigns" ON public.display_campaigns
    FOR ALL USING (commerce_id = auth.uid());
