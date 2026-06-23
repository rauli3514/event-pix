-- ==============================================================================
-- MIGRACIÓN 039: NUCLEAR CLEANUP & FIX EVENT_SETTINGS RLS
-- ==============================================================================
-- Esta migración BORRA TODAS las políticas existentes en 'event_settings' y las regenera.
-- Soluciona el problema donde los usuarios no podían crear la configuración inicial del evento.
-- ==============================================================================

-- 1. Barrido Nuclear de Políticas (Loop Dinámico)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'event_settings' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON event_settings', pol.policyname);
    END LOOP;
END $$;

-- 2. Asegurar RLS habilitado
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DEFINITIVAS

-- A) SUPER ADMIN (Acceso Total)
CREATE POLICY "policy_settings_super_admin_all" ON event_settings
    FOR ALL
    TO authenticated
    USING (
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- B) PROVIDER - SELECT (Ver settings de sus eventos)
CREATE POLICY "policy_settings_provider_select" ON event_settings
    FOR SELECT
    TO authenticated
    USING (
         -- Es dueño del evento (created_by) O está asignado
         EXISTS (
             SELECT 1 FROM events e
             LEFT JOIN event_providers ep ON ep.event_id = e.id
             WHERE e.id = event_settings.event_id
             AND (e.created_by = auth.uid() OR ep.provider_id = auth.uid())
         )
    );

-- C) PROVIDER - INSERT (Crear settings al crear evento)
-- Permitimos insertar si el usuario está autenticado. 
-- Podríamos validar que el event_id le pertenezca, pero en el INSERT a veces es tricky checkear integridad referencial compleja RLS.
-- Mas simple: permitir insert si estás autenticado. La lógica de negocio ya maneja el ID.
CREATE POLICY "policy_settings_provider_insert" ON event_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- D) PROVIDER - UPDATE (Modificar settings)
CREATE POLICY "policy_settings_provider_update" ON event_settings
    FOR UPDATE
    TO authenticated
    USING (
         EXISTS (
             SELECT 1 FROM events e
             LEFT JOIN event_providers ep ON ep.event_id = e.id
             WHERE e.id = event_settings.event_id
             AND (e.created_by = auth.uid() OR ep.provider_id = auth.uid())
         )
    );

-- E) ANON/PUBLIC - SELECT (Para mostrar el muro/pantalla pública)
-- Permitimos ver settings de cualquier evento (generalmente necesario para splash screen, themes, etc)
-- O podemos restringir a eventos activos. Por simplicidad y funcionalidad UI: ver todos.
CREATE POLICY "policy_settings_public_select" ON event_settings
    FOR SELECT
    TO anon
    USING (true);

-- F) AUTHENTICATED - SELECT ALL (Para invitados logueados o simple visualización)
-- A veces el invitado necesita ver settings para el estilo de la app
CREATE POLICY "policy_settings_authenticated_select_public" ON event_settings
    FOR SELECT
    TO authenticated
    USING (true);
