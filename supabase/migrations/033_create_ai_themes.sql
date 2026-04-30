-- Create AI Themes Table
CREATE TABLE IF NOT EXISTS public.ai_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    cover_image_url TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.ai_themes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active themes
CREATE POLICY "Allow public read access to active ai_themes"
    ON public.ai_themes FOR SELECT
    USING (is_active = true);

-- Allow authenticated users to manage themes
CREATE POLICY "Allow authenticated users to manage ai_themes"
    ON public.ai_themes FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert some default themes
INSERT INTO public.ai_themes (name, category, prompt, negative_prompt, cover_image_url) VALUES
('Jugador de Fútbol', 'Deportes', 'ultra realistic portrait of a professional football player, standing in a stadium at night with bright lights, centered composition, looking directly at the camera, sharp focus, highly detailed face, natural skin texture, cinematic lighting, 85mm lens, shallow depth of field, high detail, professional sports photography', 'bad quality, worst quality, text, signature, watermark, extra limbs, cartoon, anime', 'https://images.unsplash.com/photo-1518605368461-1e1e1fd51ed4?w=500&q=80'),
('Estilo Cyberpunk', 'Fantasía', 'portrait in cyberpunk style, neon lights, futuristic city background, highly detailed, glowing colors, cinematic lighting, 8k resolution', 'bad quality, blurry, dark, low resolution, realistic', 'https://images.unsplash.com/photo-1533972751384-5432616f3987?w=500&q=80'),
('Gala de Lujo', 'Elegante', 'portrait in elegant gala style, red carpet background, paparazzi flashes, luxury clothing, photorealistic, 85mm lens, cinematic lighting', 'casual clothes, bad quality, blurry', 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=500&q=80');
