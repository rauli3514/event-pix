-- Precios de los packs de créditos de IA y contacto para comprarlos. Los equipos los
-- muestran en Ajustes → Equipo (hasta que se agregue la compra directa con Mercado Pago)
-- y se editan desde el panel (Clientes y créditos). Una sola fila. Re-ejecutable.

CREATE TABLE IF NOT EXISTS public.kiosk_store_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    -- [{ "credits": 10, "ars": 5000, "usd": 3 }, ...]
    packs JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- WhatsApp con código de país, solo números (ej. 5491122334455)
    contact_phone TEXT,
    contact_note TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kiosk_store_settings ENABLE ROW LEVEL SECURITY;

-- Los equipos (sin login) leen los precios; el panel (con login) los edita
DROP POLICY IF EXISTS "Anyone can read kiosk store" ON public.kiosk_store_settings;
CREATE POLICY "Anyone can read kiosk store" ON public.kiosk_store_settings
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can edit kiosk store" ON public.kiosk_store_settings;
CREATE POLICY "Authenticated can edit kiosk store" ON public.kiosk_store_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (id = 1);

INSERT INTO public.kiosk_store_settings (id, packs, contact_note) VALUES (1,
  '[{"credits":10,"ars":5000,"usd":3},{"credits":20,"ars":9500,"usd":6},{"credits":50,"ars":24000,"usd":15},{"credits":100,"ars":45000,"usd":30}]'::jsonb,
  'Pesos solo en Argentina; dólares para otros países.')
ON CONFLICT (id) DO NOTHING;
