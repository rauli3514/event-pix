-- Display Digital: Listas de precios (reemplazan a la página Etiquetas).
--
-- Una lista tiene nombre ("Pizzas", "Oferta de la tarde") y renglones:
--   items = [{ id, name, detail, price, available }]
--   price: número (null = sin precio); available = false: "sin stock".
-- Los precios llegan en vivo a la TV:
--   - display_device_price_lists: las listas del comercio de esa pantalla.
--   - display_device_label_texts: además de las etiquetas viejas, cada renglón
--     por su nombre ("muzzarella" -> "$ 5.000"), así lo que ya usaba etiquetas
--     por nombre (Menú dinámico, etc.) toma el precio de las listas.
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).

CREATE TABLE IF NOT EXISTS public.display_price_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id uuid NOT NULL,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
    sort_order integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS display_price_lists_commerce_idx
    ON public.display_price_lists (commerce_id, sort_order, created_at);

ALTER TABLE public.display_price_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage price lists" ON public.display_price_lists;
CREATE POLICY "Managers manage price lists"
    ON public.display_price_lists FOR ALL
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

CREATE OR REPLACE FUNCTION public.display_price_lists_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS display_price_lists_touch ON public.display_price_lists;
CREATE TRIGGER display_price_lists_touch
    BEFORE UPDATE ON public.display_price_lists
    FOR EACH ROW EXECUTE FUNCTION public.display_price_lists_touch();

-- "$ 5.000", "$ 1.234,50" (formato argentino).
CREATE OR REPLACE FUNCTION public.display_format_price(p numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p IS NULL THEN ''
        WHEN p = round(p) THEN '$ ' || replace(to_char(round(p), 'FM999,999,999,990'), ',', '.')
        ELSE '$ ' || translate(to_char(p, 'FM999,999,999,990.00'), ',.', '.,')
    END
$$;

-- La TV (sin sesión) lee las listas de su comercio con su código.
CREATE OR REPLACE FUNCTION public.display_device_price_lists(p_device_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'items', l.items, 'updated_at', l.updated_at
    ) ORDER BY l.sort_order NULLS LAST, l.created_at), '[]'::jsonb)
    FROM public.display_devices d
    JOIN public.display_price_lists l ON l.commerce_id = d.commerce_id
    WHERE d.device_id = p_device_code
      AND d.pairing_status = 'linked';
$$;

REVOKE ALL ON FUNCTION public.display_device_price_lists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_price_lists(text) TO anon, authenticated;

-- Textos por nombre para la TV: etiquetas viejas + renglones de las listas
-- (si un nombre está en los dos, manda la lista).
CREATE OR REPLACE FUNCTION public.display_device_label_texts(p_device_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        coalesce((
            SELECT jsonb_object_agg(lower(trim(l->>'name')), l->>'text')
            FROM public.display_devices d
            JOIN public.display_label_groups g ON g.commerce_id = d.commerce_id
            CROSS JOIN LATERAL jsonb_array_elements(coalesce(g.labels, '[]'::jsonb)) l
            WHERE d.device_id = p_device_code
              AND d.pairing_status = 'linked'
              AND nullif(trim(l->>'name'), '') IS NOT NULL
        ), '{}'::jsonb)
        ||
        coalesce((
            SELECT jsonb_object_agg(
                lower(trim(i->>'name')),
                CASE WHEN (i->>'available') = 'false' THEN 'Sin stock'
                     ELSE public.display_format_price(nullif(i->>'price', '')::numeric) END
            )
            FROM public.display_devices d
            JOIN public.display_price_lists pl ON pl.commerce_id = d.commerce_id
            CROSS JOIN LATERAL jsonb_array_elements(pl.items) i
            WHERE d.device_id = p_device_code
              AND d.pairing_status = 'linked'
              AND nullif(trim(i->>'name'), '') IS NOT NULL
        ), '{}'::jsonb)
$$;

REVOKE ALL ON FUNCTION public.display_device_label_texts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_label_texts(text) TO anon, authenticated;
