-- Create event_settings table
CREATE TABLE IF NOT EXISTS event_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Mi Evento',
    description TEXT DEFAULT 'Comparte tus momentos especiales',
    background_image_url TEXT,
    display_template TEXT NOT NULL DEFAULT 'grid' CHECK (display_template IN ('grid', 'slideshow', 'masonry')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO event_settings (title, description, display_template)
VALUES ('Mi Evento', 'Comparte tus momentos especiales', 'grid')
ON CONFLICT DO NOTHING;

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');
