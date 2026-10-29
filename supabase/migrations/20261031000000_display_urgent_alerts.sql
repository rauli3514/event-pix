-- Display Digital: aviso urgente en las pantallas ("Hoy cerramos a las 18 h").
--
-- Un aviso se muestra encima de lo programado (franja abajo o pantalla
-- completa) desde que se crea hasta ends_at, o hasta que se quita. Puede ir a
-- todas las pantallas del comercio (device_ids null) o a algunas.
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).

CREATE TABLE IF NOT EXISTS public.display_urgent_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id uuid NOT NULL,
    message text NOT NULL CHECK (length(message) BETWEEN 1 AND 200),
    layout text NOT NULL DEFAULT 'banner' CHECK (layout IN ('banner', 'full')),
    color text NOT NULL DEFAULT 'red' CHECK (color IN ('red', 'yellow', 'blue', 'green', 'black')),
    device_ids uuid[],                 -- null = todas las pantallas del comercio
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz NOT NULL,
    cancelled_at timestamptz,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS display_urgent_alerts_commerce_idx
    ON public.display_urgent_alerts (commerce_id, ends_at DESC);

ALTER TABLE public.display_urgent_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage urgent alerts" ON public.display_urgent_alerts;
CREATE POLICY "Managers manage urgent alerts"
    ON public.display_urgent_alerts FOR ALL
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

-- La TV (sin sesión) pregunta con su código qué aviso tiene que mostrar ahora.
-- Devuelve el más reciente activo para esa pantalla, o null.
CREATE OR REPLACE FUNCTION public.display_device_active_alert(p_device_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'id', a.id,
        'message', a.message,
        'layout', a.layout,
        'color', a.color,
        'ends_at', a.ends_at
    )
    FROM public.display_devices d
    JOIN public.display_urgent_alerts a ON a.commerce_id = d.commerce_id
    WHERE d.device_id = p_device_code
      AND d.pairing_status = 'linked'
      AND a.cancelled_at IS NULL
      AND a.starts_at <= now()
      AND a.ends_at > now()
      AND (a.device_ids IS NULL OR d.id = ANY (a.device_ids))
    ORDER BY a.created_at DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.display_device_active_alert(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_active_alert(text) TO anon, authenticated;
