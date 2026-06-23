-- Add media_id to display_assignments
ALTER TABLE public.display_assignments ADD COLUMN media_id UUID REFERENCES public.display_media(id) ON DELETE SET NULL;

-- Update the check constraint to allow media_id or campaign_id
ALTER TABLE public.display_assignments DROP CONSTRAINT IF EXISTS check_assignment_target;

-- An assignment must target a device OR a group
ALTER TABLE public.display_assignments ADD CONSTRAINT check_assignment_target CHECK (
    (device_id IS NOT NULL AND group_id IS NULL) OR 
    (device_id IS NULL AND group_id IS NOT NULL)
);

-- An assignment should ideally have EITHER a campaign OR a media, but we can enforce it in the app logic or here:
ALTER TABLE public.display_assignments ADD CONSTRAINT check_assignment_content CHECK (
    (campaign_id IS NOT NULL AND media_id IS NULL) OR 
    (campaign_id IS NULL AND media_id IS NOT NULL) OR
    (campaign_id IS NULL AND media_id IS NULL) -- Allow empty assignments
);
