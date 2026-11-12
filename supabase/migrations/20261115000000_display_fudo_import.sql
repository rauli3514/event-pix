-- Display Digital: traer las listas de precios desde el menú de Fudo.
--
-- El menú online de Fudo (menu.fu.do/<local>) se arma con dos pedidos públicos:
--   https://integrations.fu.do/fudo/product-categories/?a=<local>
--   https://integrations.fu.do/fudo/products/?a=<local>
-- (encabezados fudo-account-id = base64(<local>) y fudo-app = online-menu).
-- Fudo no deja leerlos desde el navegador de otra página, así que los lee la base
-- con la extensión http.
--
-- Cada categoría de Fudo que se trae es una lista de precios con
--   source = { type: 'fudo', slug, categoryId, categoryName, parentName, syncedAt }
-- y un color. Si se trae de nuevo, se actualiza la misma lista (no se duplica):
--   - precios y productos nuevos vienen de Fudo;
--   - se respeta lo de acá: aclaraciones, "sin stock", nombres cambiados, el
--     descuento por tiempo y los productos agregados a mano;
--   - lo que ya no está en Fudo queda "sin stock" (por si lo usa un cartel).
-- Se actualiza sola una vez por día (pg_cron) o con "Actualizar desde Fudo".
--
-- Antes de correr: Dashboard de Supabase → Database → Extensions: activar "http"
-- (y pg_cron, que ya está si se corrió el de alertas). Se puede correr más de una vez.

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

ALTER TABLE public.display_price_lists ADD COLUMN IF NOT EXISTS source jsonb;
ALTER TABLE public.display_price_lists ADD COLUMN IF NOT EXISTS color text;

CREATE INDEX IF NOT EXISTS display_price_lists_fudo_idx
    ON public.display_price_lists ((source->>'slug'))
    WHERE source->>'type' = 'fudo';

-- Lee un recurso del menú de Fudo (uso interno).
CREATE OR REPLACE FUNCTION public.display_fudo_fetch(p_slug text, p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_slug text := trim(coalesce(p_slug, ''));
    r extensions.http_response;
BEGIN
    IF v_slug !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$' THEN
        RAISE EXCEPTION 'fudo_bad_slug';
    END IF;
    IF p_resource NOT IN ('product-categories', 'products') THEN
        RAISE EXCEPTION 'fudo_bad_resource';
    END IF;
    BEGIN
        PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    SELECT * INTO r FROM extensions.http((
        'GET',
        'https://integrations.fu.do/fudo/' || p_resource || '/?a=' || v_slug,
        ARRAY[
            extensions.http_header('fudo-account-id', encode(convert_to(v_slug, 'UTF8'), 'base64')),
            extensions.http_header('fudo-app', 'online-menu')
        ],
        NULL,
        NULL
    )::extensions.http_request);
    IF r.status = 401 OR r.status = 404 THEN
        RAISE EXCEPTION 'fudo_not_found';
    ELSIF r.status <> 200 THEN
        RAISE EXCEPTION 'fudo_http_%', r.status;
    END IF;
    RETURN r.content::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.display_fudo_fetch(text, text) FROM PUBLIC, anon, authenticated;

-- El menú completo, más simple: categorías y productos (para la vista previa del panel).
CREATE OR REPLACE FUNCTION public.display_fudo_menu(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cats jsonb;
    v_prods jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;
    v_cats := public.display_fudo_fetch(p_slug, 'product-categories')->'productCategories';
    v_prods := public.display_fudo_fetch(p_slug, 'products')->'products';
    RETURN jsonb_build_object(
        'categories', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', (c->>'id')::bigint,
                'name', c->>'name',
                'parentId', nullif(c->>'parentId', '')::bigint,
                'position', coalesce((c->>'position')::numeric, 0)
            ) ORDER BY coalesce((c->>'position')::numeric, 0))
            FROM jsonb_array_elements(coalesce(v_cats, '[]'::jsonb)) c
        ), '[]'::jsonb),
        'products', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', (p->>'id')::bigint,
                'name', p->>'name',
                'price', nullif(p->>'price', '')::numeric,
                'available', coalesce((p->>'isAvailable')::boolean, true),
                'categoryId', nullif(p->>'productCategoryId', '')::bigint,
                'position', coalesce((p->>'position')::numeric, 0)
            ) ORDER BY coalesce((p->>'position')::numeric, 0))
            FROM jsonb_array_elements(coalesce(v_prods, '[]'::jsonb)) p
        ), '[]'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.display_fudo_menu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.display_fudo_menu(text) TO authenticated;

-- Junta los renglones de una lista con los productos de su categoría en Fudo (uso interno).
-- p_products: [{ id, name, price, available, position }] de display_fudo_menu.
CREATE OR REPLACE FUNCTION public.display_fudo_merge(p_old jsonb, p_products jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_out jsonb := '[]'::jsonb;
    v_seen bigint[] := ARRAY[]::bigint[];
    p jsonb;
    prev jsonb;
    item jsonb;
    v_fid bigint;
    v_name text;
    v_avail boolean;
BEGIN
    -- 1. Productos de Fudo, en el orden de Fudo.
    FOR p IN SELECT value FROM jsonb_array_elements(coalesce(p_products, '[]'::jsonb))
             ORDER BY coalesce((value->>'position')::numeric, 0) LOOP
        v_fid := (p->>'id')::bigint;
        v_seen := v_seen || v_fid;
        SELECT value INTO prev FROM jsonb_array_elements(coalesce(p_old, '[]'::jsonb))
            WHERE (value->>'fudoId')::bigint = v_fid LIMIT 1;
        -- Si se le cambió el nombre acá, se respeta.
        v_name := CASE WHEN prev IS NOT NULL AND (prev->>'name') IS DISTINCT FROM (prev->>'fudoName')
                       THEN prev->>'name' ELSE p->>'name' END;
        -- Sin stock: si Fudo lo marca, o si se marcó acá a mano.
        v_avail := CASE
            WHEN NOT coalesce((p->>'available')::boolean, true) THEN false
            WHEN prev IS NULL OR coalesce((prev->>'fudoOff')::boolean, false) THEN true
            ELSE coalesce((prev->>'available')::boolean, true)
        END;
        item := jsonb_build_object(
            'id', coalesce(prev->>'id', 'fudo-' || v_fid),
            'name', v_name,
            'price', p->'price',
            'available', v_avail,
            'fudoId', v_fid,
            'fudoName', p->>'name',
            'fudoOff', NOT coalesce((p->>'available')::boolean, true)
        );
        IF prev ? 'detail' AND nullif(prev->>'detail', '') IS NOT NULL THEN
            item := item || jsonb_build_object('detail', prev->>'detail');
        END IF;
        v_out := v_out || jsonb_build_array(item);
        prev := NULL;
    END LOOP;

    -- 2. Lo que ya no está en Fudo: queda, sin stock. 3. Lo agregado a mano: queda igual.
    FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) LOOP
        IF item ? 'fudoId' THEN
            IF NOT ((item->>'fudoId')::bigint = ANY (v_seen)) THEN
                v_out := v_out || jsonb_build_array(item || jsonb_build_object('available', false, 'fudoOff', true));
            END IF;
        ELSE
            v_out := v_out || jsonb_build_array(item);
        END IF;
    END LOOP;
    RETURN v_out;
END;
$$;

-- Actualiza las listas de Fudo de un comercio (o de todos) con el menú de hoy (uso interno).
CREATE OR REPLACE FUNCTION public.display_fudo_refresh_lists(p_commerce_id uuid DEFAULT NULL, p_slug text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slug text;
    v_prods jsonb;
    v_count integer := 0;
    l record;
BEGIN
    FOR v_slug IN
        SELECT DISTINCT source->>'slug' FROM public.display_price_lists
        WHERE source->>'type' = 'fudo'
          AND (p_commerce_id IS NULL OR commerce_id = p_commerce_id)
          AND (p_slug IS NULL OR source->>'slug' = p_slug)
    LOOP
        BEGIN
            v_prods := public.display_fudo_fetch(v_slug, 'products')->'products';
        EXCEPTION WHEN OTHERS THEN
            -- Si Fudo no responde, se siguen mostrando los últimos precios.
            UPDATE public.display_price_lists
               SET source = source || jsonb_build_object('lastError', SQLERRM, 'lastErrorAt', now())
             WHERE source->>'type' = 'fudo' AND source->>'slug' = v_slug
               AND (p_commerce_id IS NULL OR commerce_id = p_commerce_id);
            CONTINUE;
        END;
        FOR l IN
            SELECT * FROM public.display_price_lists
            WHERE source->>'type' = 'fudo' AND source->>'slug' = v_slug
              AND (p_commerce_id IS NULL OR commerce_id = p_commerce_id)
        LOOP
            UPDATE public.display_price_lists
               SET items = public.display_fudo_merge(l.items, (
                       SELECT coalesce(jsonb_agg(jsonb_build_object(
                           'id', (p->>'id')::bigint,
                           'name', p->>'name',
                           'price', nullif(p->>'price', '')::numeric,
                           'available', coalesce((p->>'isAvailable')::boolean, true),
                           'position', coalesce((p->>'position')::numeric, 0)
                       )), '[]'::jsonb)
                       FROM jsonb_array_elements(coalesce(v_prods, '[]'::jsonb)) p
                       WHERE nullif(p->>'productCategoryId', '')::bigint = (l.source->>'categoryId')::bigint
                   )),
                   source = (l.source - 'lastError' - 'lastErrorAt') || jsonb_build_object('syncedAt', now())
             WHERE id = l.id;
            v_count := v_count + 1;
        END LOOP;
    END LOOP;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.display_fudo_refresh_lists(uuid, text) FROM PUBLIC, anon, authenticated;

-- Panel: traer categorías de Fudo como listas (o actualizar las que ya están).
-- p_categories: [{ id, name, parentName, color }]
CREATE OR REPLACE FUNCTION public.display_fudo_import(p_commerce_id uuid, p_slug text, p_categories jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c jsonb;
    v_slug text := trim(coalesce(p_slug, ''));
    v_exists boolean;
    v_count integer := 0;
BEGIN
    IF NOT public.display_can_manage(p_commerce_id) THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;
    FOR c IN SELECT value FROM jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.display_price_lists
            WHERE commerce_id = p_commerce_id AND source->>'type' = 'fudo'
              AND source->>'slug' = v_slug AND (source->>'categoryId')::bigint = (c->>'id')::bigint
        ) INTO v_exists;
        IF NOT v_exists THEN
            INSERT INTO public.display_price_lists (commerce_id, name, items, source, color)
            VALUES (
                p_commerce_id,
                left(coalesce(nullif(trim(c->>'name'), ''), 'Fudo'), 80),
                '[]'::jsonb,
                jsonb_build_object('type', 'fudo', 'slug', v_slug, 'categoryId', (c->>'id')::bigint,
                                   'categoryName', c->>'name', 'parentName', c->>'parentName'),
                nullif(c->>'color', '')
            );
        END IF;
        v_count := v_count + 1;
    END LOOP;
    PERFORM public.display_fudo_refresh_lists(p_commerce_id, v_slug);
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.display_fudo_import(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.display_fudo_import(uuid, text, jsonb) TO authenticated;

-- Panel: "Actualizar desde Fudo".
CREATE OR REPLACE FUNCTION public.display_fudo_refresh(p_commerce_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.display_can_manage(p_commerce_id) THEN
        RAISE EXCEPTION 'not_allowed';
    END IF;
    RETURN public.display_fudo_refresh_lists(p_commerce_id, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.display_fudo_refresh(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.display_fudo_refresh(uuid) TO authenticated;

-- Una vez por día, a las 5 de la mañana de Argentina (8 UTC): todas las listas de Fudo.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('display-fudo-daily')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'display-fudo-daily');
        PERFORM cron.schedule('display-fudo-daily', '0 8 * * *', 'select public.display_fudo_refresh_lists()');
    ELSE
        RAISE NOTICE 'pg_cron no está activado: las listas de Fudo se actualizan solo con el botón.';
    END IF;
END;
$$;
