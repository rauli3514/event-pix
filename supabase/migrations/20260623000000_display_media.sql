-- =====================================================
-- Migration: Display Media Table and Bucket
-- =====================================================

-- 1. Create the bucket for Display Media
INSERT INTO storage.buckets (id, name, public)
VALUES ('display-media', 'display-media', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket Policies
CREATE POLICY "Public can view display media"
ON storage.objects FOR SELECT
USING (bucket_id = 'display-media');

CREATE POLICY "Authenticated users can upload display media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'display-media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update display media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'display-media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete display media"
ON storage.objects FOR DELETE
USING (bucket_id = 'display-media' AND auth.role() = 'authenticated');

-- 2. Create the display_media table
CREATE TABLE IF NOT EXISTS public.display_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_display_media_commerce_id ON public.display_media(commerce_id);
CREATE INDEX IF NOT EXISTS idx_display_media_type ON public.display_media(type);

-- Enable RLS
ALTER TABLE public.display_media ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for display_media table

-- Allow public read access (so screens can read media metadata if needed, though they usually just use the URL)
CREATE POLICY "Public can read display media"
    ON public.display_media FOR SELECT
    USING (true);

-- Allow authenticated users to insert their own media
CREATE POLICY "Providers can insert their own media"
    ON public.display_media FOR INSERT
    WITH CHECK (auth.uid() = commerce_id);

-- Allow authenticated users to update their own media
CREATE POLICY "Providers can update their own media"
    ON public.display_media FOR UPDATE
    USING (auth.uid() = commerce_id);

-- Allow authenticated users to delete their own media
CREATE POLICY "Providers can delete their own media"
    ON public.display_media FOR DELETE
    USING (auth.uid() = commerce_id);

-- Trigger for updated_at (if we ever need it, though currently not in schema)
