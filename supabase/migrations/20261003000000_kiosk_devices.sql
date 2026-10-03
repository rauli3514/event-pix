-- Equipos del kiosco (TV box con la app "EventPix Kiosco").
-- Igual que Display Digital: el equipo muestra un código de 6 caracteres, se
-- registra solo como 'pending' y desde el panel se vincula y se le asigna el
-- evento al que sube las fotos. El equipo nunca inicia sesión.

CREATE TABLE IF NOT EXISTS public.kiosk_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code TEXT NOT NULL UNIQUE CHECK (device_code ~ '^[A-Z0-9]{6}$'),
    name TEXT,
    pairing_status TEXT NOT NULL DEFAULT 'pending' CHECK (pairing_status IN ('pending', 'linked')),
    kiosk_event_id UUID REFERENCES public.kiosk_events(id) ON DELETE SET NULL,
    linked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    app_version TEXT,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

-- El panel (usuarios logueados) administra los equipos
CREATE POLICY "Authenticated can manage kiosk devices" ON public.kiosk_devices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- El equipo (anónimo) no toca la tabla directamente: solo usa esta función,
-- que lo registra si es nuevo, actualiza last_seen y devuelve su estado.
CREATE OR REPLACE FUNCTION public.kiosk_device_checkin(p_code TEXT, p_app_version TEXT DEFAULT NULL)
RETURNS TABLE (
    device_code TEXT,
    name TEXT,
    pairing_status TEXT,
    kiosk_event_id UUID,
    event_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{6}$' THEN
        RAISE EXCEPTION 'Código de equipo inválido';
    END IF;

    INSERT INTO public.kiosk_devices (device_code, app_version, last_seen)
    VALUES (p_code, p_app_version, now())
    ON CONFLICT ON CONSTRAINT kiosk_devices_device_code_key DO UPDATE
        SET last_seen = now(),
            app_version = COALESCE(EXCLUDED.app_version, public.kiosk_devices.app_version);

    RETURN QUERY
        SELECT d.device_code, d.name, d.pairing_status, d.kiosk_event_id, e.name
        FROM public.kiosk_devices d
        LEFT JOIN public.kiosk_events e ON e.id = d.kiosk_event_id
        WHERE d.device_code = p_code;
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_device_checkin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_device_checkin(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_devices_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER kiosk_devices_updated_at
    BEFORE UPDATE ON public.kiosk_devices
    FOR EACH ROW EXECUTE FUNCTION public.kiosk_devices_touch_updated_at();
