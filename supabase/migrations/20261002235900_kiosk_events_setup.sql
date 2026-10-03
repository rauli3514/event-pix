-- Eventos y fotos del kiosco. La migración 20260427100002_kiosk_events.sql no
-- llegó a aplicarse en producción y además dejaba crear, editar y borrar sin
-- login. Esta es re-ejecutable y deja:
--   - sin login (kiosco): ver eventos y subir fotos a un evento existente
--   - con login (panel): todo lo demás

CREATE TABLE IF NOT EXISTS public.kiosk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    event_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kiosk_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_event_id UUID REFERENCES public.kiosk_events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kiosk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_photos ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de la migración original
DROP POLICY IF EXISTS "Allow public read kiosk events" ON public.kiosk_events;
DROP POLICY IF EXISTS "Allow public insert kiosk events" ON public.kiosk_events;
DROP POLICY IF EXISTS "Allow public update kiosk events" ON public.kiosk_events;
DROP POLICY IF EXISTS "Allow public delete kiosk events" ON public.kiosk_events;
DROP POLICY IF EXISTS "Allow public read kiosk photos" ON public.kiosk_photos;
DROP POLICY IF EXISTS "Allow public insert kiosk photos" ON public.kiosk_photos;
DROP POLICY IF EXISTS "Allow public delete kiosk photos" ON public.kiosk_photos;

DROP POLICY IF EXISTS "Anyone can read kiosk events" ON public.kiosk_events;
CREATE POLICY "Anyone can read kiosk events" ON public.kiosk_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can manage kiosk events" ON public.kiosk_events;
CREATE POLICY "Authenticated can manage kiosk events" ON public.kiosk_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read kiosk photos" ON public.kiosk_photos;
CREATE POLICY "Anyone can read kiosk photos" ON public.kiosk_photos
    FOR SELECT USING (true);

-- El kiosco sube fotos sin login, pero solo a un evento que exista
DROP POLICY IF EXISTS "Kiosk can add photos to an event" ON public.kiosk_photos;
CREATE POLICY "Kiosk can add photos to an event" ON public.kiosk_photos
    FOR INSERT TO anon, authenticated
    WITH CHECK (kiosk_event_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.kiosk_events e WHERE e.id = kiosk_event_id));

DROP POLICY IF EXISTS "Authenticated can manage kiosk photos" ON public.kiosk_photos;
CREATE POLICY "Authenticated can manage kiosk photos" ON public.kiosk_photos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
