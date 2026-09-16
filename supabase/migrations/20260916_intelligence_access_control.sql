-- ================================================================
-- EventPix Intelligence — Aislamiento de Datos por Cliente (Multi-Tenant Real)
-- Migration: 20260916_intelligence_access_control.sql
--
-- Problema que resuelve:
--   Las políticas RLS creadas en 20260911_intelligence_saas_schema.sql y
--   20260912_intelligence_crm_schema.sql quedaron abiertas con
--   `USING (true)` ("políticas de desarrollo"). Como el frontend usa la
--   clave anon (pública, embebida en el bundle), cualquier visitante podía
--   leer y escribir los datos de TODOS los negocios/clientes sin loguearse.
--
-- Qué hace esta migración:
--   1. Asegura que el dueño de la plataforma sea super_admin (para no
--      perder acceso al aplicar las políticas nuevas).
--   2. Crea la tabla intelligence_business_users: qué usuario puede ver
--      qué negocio (igual patrón que ya usa event_providers/has_event_access
--      en 004_roles_and_permissions.sql).
--   3. Reemplaza TODAS las políticas "USING (true)" por políticas reales
--      basadas en esa tabla (o en ser super_admin).
-- ================================================================

-- ----------------------------------------------------------------
-- 0. Bootstrap: el dueño de la plataforma queda como super_admin
--    (requiere que ya se haya logueado alguna vez en /login con este
--    email; si no, este UPDATE simplemente no encuentra filas).
-- ----------------------------------------------------------------
INSERT INTO profiles (id, email, name, role)
SELECT id, email, 'Super Admin', 'super_admin'
FROM auth.users
WHERE email = 'rauli3514@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- ----------------------------------------------------------------
-- 1. Tabla de asignación Usuario <-> Negocio de Intelligence
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelligence_business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner', -- 'owner' | 'staff'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_business_users_user ON intelligence_business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_business_users_business ON intelligence_business_users(business_id);

ALTER TABLE intelligence_business_users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 2. Función helper: ¿el usuario actual puede ver este negocio?
--    (reutiliza is_super_admin(), ya definida en 004_roles_and_permissions.sql)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_intelligence_business_access(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_super_admin() OR EXISTS (
    SELECT 1 FROM intelligence_business_users ibu
    WHERE ibu.business_id = business_uuid AND ibu.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- 3. Políticas de intelligence_business_users
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS intelligence_business_users_select ON intelligence_business_users;
CREATE POLICY intelligence_business_users_select
  ON intelligence_business_users FOR SELECT
  USING (user_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS intelligence_business_users_manage ON intelligence_business_users;
CREATE POLICY intelligence_business_users_manage
  ON intelligence_business_users FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ----------------------------------------------------------------
-- 4. Reemplazo de políticas abiertas — Schema de Negocios
--    (20260911_intelligence_saas_schema.sql)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS intelligence_businesses_all ON intelligence_businesses;
CREATE POLICY intelligence_businesses_select ON intelligence_businesses FOR SELECT
  USING (has_intelligence_business_access(id));
CREATE POLICY intelligence_businesses_insert ON intelligence_businesses FOR INSERT
  WITH CHECK (is_super_admin());
CREATE POLICY intelligence_businesses_update ON intelligence_businesses FOR UPDATE
  USING (has_intelligence_business_access(id));
CREATE POLICY intelligence_businesses_delete ON intelligence_businesses FOR DELETE
  USING (is_super_admin());

DROP POLICY IF EXISTS intelligence_brand_dna_all ON intelligence_brand_dna;
CREATE POLICY intelligence_brand_dna_access ON intelligence_brand_dna FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

DROP POLICY IF EXISTS intelligence_posts_all ON intelligence_posts;
CREATE POLICY intelligence_posts_access ON intelligence_posts FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

DROP POLICY IF EXISTS intelligence_reports_all ON intelligence_reports;
CREATE POLICY intelligence_reports_access ON intelligence_reports FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

DROP POLICY IF EXISTS intelligence_canvas_state_all ON intelligence_canvas_state;
CREATE POLICY intelligence_canvas_state_access ON intelligence_canvas_state FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

-- ----------------------------------------------------------------
-- 5. Reemplazo de políticas abiertas — Schema de CRM
--    (20260912_intelligence_crm_schema.sql)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS intelligence_crm_leads_all ON intelligence_crm_leads;
CREATE POLICY intelligence_crm_leads_access ON intelligence_crm_leads FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

DROP POLICY IF EXISTS intelligence_crm_convs_all ON intelligence_crm_conversations;
CREATE POLICY intelligence_crm_convs_access ON intelligence_crm_conversations FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

-- Los mensajes no tienen business_id directo: se valida vía su conversación.
DROP POLICY IF EXISTS intelligence_crm_msgs_all ON intelligence_crm_messages;
CREATE POLICY intelligence_crm_msgs_access ON intelligence_crm_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM intelligence_crm_conversations c
      WHERE c.id = intelligence_crm_messages.conversation_id
        AND has_intelligence_business_access(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM intelligence_crm_conversations c
      WHERE c.id = intelligence_crm_messages.conversation_id
        AND has_intelligence_business_access(c.business_id)
    )
  );

DROP POLICY IF EXISTS intelligence_crm_automations_all ON intelligence_crm_automations;
CREATE POLICY intelligence_crm_automations_access ON intelligence_crm_automations FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

DROP POLICY IF EXISTS intelligence_crm_tasks_all ON intelligence_crm_tasks;
CREATE POLICY intelligence_crm_tasks_access ON intelligence_crm_tasks FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

DROP POLICY IF EXISTS intelligence_crm_kb_all ON intelligence_business_knowledge_base;
CREATE POLICY intelligence_crm_kb_access ON intelligence_business_knowledge_base FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

-- ----------------------------------------------------------------
-- 6. Vincular los negocios YA EXISTENTES al super_admin
--    (para no perder acceso a tecno_eventos_arg / shop_plumas / etc.
--    apenas se aplique esta migración). Un negocio sin fila en
--    intelligence_business_users solo lo va a poder ver un super_admin.
-- ----------------------------------------------------------------
INSERT INTO intelligence_business_users (business_id, user_id, role)
SELECT b.id, p.id, 'owner'
FROM intelligence_businesses b
CROSS JOIN profiles p
WHERE p.email = 'rauli3514@gmail.com'
ON CONFLICT (business_id, user_id) DO NOTHING;
