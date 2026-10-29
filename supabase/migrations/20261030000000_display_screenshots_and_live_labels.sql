-- Display Digital: foto de lo que se ve en cada TV y precios en vivo en las TVs.
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).

-- ---------------------------------------------------------------------------
-- 1. Foto de la pantalla
-- ---------------------------------------------------------------------------
-- La TV manda cada 5 minutos (o cuando se pide desde el panel) una foto chica
-- de lo que muestra y qué elemento está pasando. Se guarda solo la última.

CREATE TABLE IF NOT EXISTS public.display_device_screens (
    device_id uuid PRIMARY KEY REFERENCES public.display_devices(id) ON DELETE CASCADE,
    image text,                 -- JPEG en base64 (sin el prefijo data:)
    now_playing jsonb,          -- { name, type } del elemento en pantalla
    image_at timestamptz,       -- cuándo se sacó la foto
    captured_at timestamptz NOT NULL DEFAULT now() -- último reporte (foto o no)
);

ALTER TABLE public.display_device_screens ADD COLUMN IF NOT EXISTS image_at timestamptz;

ALTER TABLE public.display_device_screens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view screens" ON public.display_device_screens;
CREATE POLICY "Managers can view screens"
    ON public.display_device_screens FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.display_devices d
        WHERE d.id = display_device_screens.device_id
          AND public.display_can_manage(d.commerce_id)
    ));

-- La TV se identifica con su código, igual que en el latido.
CREATE OR REPLACE FUNCTION public.display_device_screenshot(
    p_device_code text,
    p_image text DEFAULT NULL,
    p_now_playing jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_device uuid;
    v_last timestamptz;
BEGIN
    IF p_device_code IS NULL OR length(p_device_code) > 64 THEN
        RETURN;
    END IF;
    SELECT id INTO v_device FROM public.display_devices
    WHERE device_id = p_device_code AND pairing_status = 'linked';
    IF v_device IS NULL THEN
        RETURN;
    END IF;

    -- Solo fotos JPEG razonables (unos 300 KB como mucho).
    IF p_image IS NOT NULL AND (length(p_image) > 400000 OR left(p_image, 4) <> '/9j/') THEN
        p_image := NULL;
    END IF;
    IF p_now_playing IS NOT NULL AND pg_column_size(p_now_playing) > 2048 THEN
        p_now_playing := NULL;
    END IF;

    -- Como mucho una cada 15 segundos por pantalla.
    SELECT captured_at INTO v_last FROM public.display_device_screens WHERE device_id = v_device;
    IF v_last IS NOT NULL AND v_last > now() - interval '15 seconds' THEN
        RETURN;
    END IF;

    INSERT INTO public.display_device_screens (device_id, image, image_at, now_playing, captured_at)
    VALUES (v_device, p_image, CASE WHEN p_image IS NOT NULL THEN now() END, p_now_playing, now())
    ON CONFLICT (device_id) DO UPDATE
        SET image = coalesce(EXCLUDED.image, display_device_screens.image),
            image_at = coalesce(EXCLUDED.image_at, display_device_screens.image_at),
            now_playing = EXCLUDED.now_playing,
            captured_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.display_device_screenshot(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_screenshot(text, text, jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Textos de las etiquetas para la TV
-- ---------------------------------------------------------------------------
-- La página "Etiquetas" guarda precios por nombre (display_label_groups) y la
-- app de Etiquetas los muestra en vivo. La TV no tiene sesión, así que no podía
-- leerlos y seguía mostrando el precio viejo. Esto le da los textos de su
-- comercio: { "nombre en minúsculas": "texto" }.
CREATE OR REPLACE FUNCTION public.display_device_label_texts(p_device_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_object_agg(lower(trim(l->>'name')), l->>'text'), '{}'::jsonb)
    FROM public.display_devices d
    JOIN public.display_label_groups g ON g.commerce_id = d.commerce_id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(g.labels, '[]'::jsonb)) l
    WHERE d.device_id = p_device_code
      AND d.pairing_status = 'linked'
      AND nullif(trim(l->>'name'), '') IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.display_device_label_texts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_label_texts(text) TO anon, authenticated;
