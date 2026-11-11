-- Display Digital: descuento (o aumento) temporal en una lista de precios.
--
-- La lista guarda el cambio aparte, sin tocar los precios:
--   promo = { percent: -10, roundTo: 50, startsAt: "...", endsAt: "..." }
-- Mientras now() < endsAt, las pantallas muestran el precio con el cambio
-- (redondeado hacia arriba al múltiplo de roundTo), y los carteles el precio
-- original tachado. Al pasar endsAt vuelve solo a los precios de siempre.
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).
-- Necesita haber corrido antes 20261113000000_display_price_lists.sql.

ALTER TABLE public.display_price_lists
    ADD COLUMN IF NOT EXISTS promo jsonb;

-- Precio con el cambio temporal, si está vigente (si no, el mismo precio).
CREATE OR REPLACE FUNCTION public.display_promo_price(p numeric, promo jsonb)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p IS NULL OR promo IS NULL
             OR nullif(promo->>'endsAt', '') IS NULL
             OR (promo->>'endsAt')::timestamptz <= now()
             OR (nullif(promo->>'startsAt', '') IS NOT NULL AND (promo->>'startsAt')::timestamptz > now())
            THEN p
        ELSE greatest(0, round(
            ceil(p * (1 + coalesce((promo->>'percent')::numeric, 0) / 100)
                 / greatest(coalesce((promo->>'roundTo')::numeric, 1), 1) - 0.000000001)
            * greatest(coalesce((promo->>'roundTo')::numeric, 1), 1), 2))
    END
$$;

-- La TV lee las listas con el cambio temporal (lo aplica ella misma, con su hora).
CREATE OR REPLACE FUNCTION public.display_device_price_lists(p_device_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'items', l.items, 'promo', l.promo, 'updated_at', l.updated_at
    ) ORDER BY l.sort_order NULLS LAST, l.created_at), '[]'::jsonb)
    FROM public.display_devices d
    JOIN public.display_price_lists l ON l.commerce_id = d.commerce_id
    WHERE d.device_id = p_device_code
      AND d.pairing_status = 'linked';
$$;

REVOKE ALL ON FUNCTION public.display_device_price_lists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_price_lists(text) TO anon, authenticated;

-- Textos por nombre (Menú dinámico, etc.): con el cambio temporal aplicado.
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
                     ELSE public.display_format_price(
                         public.display_promo_price(nullif(i->>'price', '')::numeric, pl.promo)) END
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
