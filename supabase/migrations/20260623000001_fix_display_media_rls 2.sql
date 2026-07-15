-- =====================================================
-- Migration: Fix Display Media RLS
-- =====================================================

-- Allow super admins to do everything
CREATE POLICY "Super admins can do all on display_media"
    ON public.display_media FOR ALL
    USING (
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Redefine provider policies to ensure they don't conflict, using OR logic for super_admin
DROP POLICY IF EXISTS "Providers can insert their own media" ON public.display_media;
CREATE POLICY "Providers can insert their own media"
    ON public.display_media FOR INSERT
    WITH CHECK (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "Providers can update their own media" ON public.display_media;
CREATE POLICY "Providers can update their own media"
    ON public.display_media FOR UPDATE
    USING (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "Providers can delete their own media" ON public.display_media;
CREATE POLICY "Providers can delete their own media"
    ON public.display_media FOR DELETE
    USING (auth.uid() = commerce_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Fix storage bucket policies to allow super_admin
DROP POLICY IF EXISTS "Authenticated users can upload display media" ON storage.objects;
CREATE POLICY "Authenticated users can upload display media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'display-media' AND auth.role() = 'authenticated');

-- We don't need to change storage update/delete since they just check authenticated.
