-- ================================================================
-- EventPix Intelligence — Alta real de negocios (self-signup)
-- Migration: 20260920_self_signup_business.sql
--
-- Bug encontrado: cualquier negocio creado desde la propia app (tanto
-- el registro público /register como el modal "Agregar cliente" del
-- super_admin) usaba un id de texto tipo "biz_1234567890_ab12" en vez
-- de un UUID real. La columna intelligence_businesses.id es UUID, así
-- que ese insert fallaba silenciosamente (atrapado por un try/catch)
-- y el negocio quedaba viviendo SOLO en localStorage del navegador —
-- nunca llegaba a existir en la base de datos real. Eso rompía, entre
-- otras cosas, que el webhook de WhatsApp pudiera encontrar el negocio.
--
-- Además, ningún código insertaba nunca una fila en
-- intelligence_business_users, así que aunque el negocio se hubiese
-- creado bien, su propio dueño quedaba sin acceso bajo RLS (las
-- políticas de intelligence_businesses_insert / _manage exigen
-- is_super_admin()).
--
-- Esta función resuelve ambos problemas para el caso real: un usuario
-- ya autenticado (recién registrado) crea SU PROPIO negocio y queda
-- vinculado como 'owner' en el mismo paso, sin necesitar ser
-- super_admin. SECURITY DEFINER le permite saltar esas políticas de
-- forma segura porque el negocio y la membresía quedan atados
-- explícitamente a auth.uid(), nunca a un usuario arbitrario.
-- ================================================================

CREATE OR REPLACE FUNCTION register_intelligence_business(
  p_id UUID,
  p_name TEXT,
  p_instagram_handle TEXT DEFAULT NULL,
  p_niche TEXT DEFAULT NULL,
  p_target_audience TEXT DEFAULT NULL,
  p_brand_tone TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'register_intelligence_business requiere un usuario autenticado';
  END IF;

  INSERT INTO intelligence_businesses (id, user_id, name, instagram_handle, niche, target_audience, brand_tone)
  VALUES (p_id, auth.uid(), p_name, p_instagram_handle, p_niche, p_target_audience, p_brand_tone)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    instagram_handle = EXCLUDED.instagram_handle,
    niche = EXCLUDED.niche,
    target_audience = EXCLUDED.target_audience,
    brand_tone = EXCLUDED.brand_tone,
    updated_at = now();

  INSERT INTO intelligence_business_users (business_id, user_id, role)
  VALUES (p_id, auth.uid(), 'owner')
  ON CONFLICT (business_id, user_id) DO NOTHING;

  RETURN p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION register_intelligence_business(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
