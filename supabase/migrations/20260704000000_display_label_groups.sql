-- Create Label Groups Table
CREATE TABLE public.display_label_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commerce_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE POLICY "Providers can insert their own label groups"
    ON public.display_label_groups FOR INSERT
    WITH CHECK (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Providers can update their own label groups"
    ON public.display_label_groups FOR UPDATE
    USING (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Providers can delete their own label groups"
    ON public.display_label_groups FOR DELETE
    USING (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Providers can read their own label groups"
    ON public.display_label_groups FOR SELECT
    USING (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
