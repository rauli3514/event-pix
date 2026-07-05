-- Create Label Groups Table
CREATE TABLE public.display_label_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id UUID NOT NULL REFERENCES public.display_commerces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    labels JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.display_label_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can do all on display_label_groups"
    ON public.display_label_groups FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Users can manage label groups for assigned commerces"
    ON public.display_label_groups FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.display_commerce_users 
            WHERE display_commerce_users.commerce_id = display_label_groups.commerce_id 
            AND display_commerce_users.user_id = auth.uid()
        )
    );
