-- ==============================================================================
-- MIGRACIÓN 037: NUCLEAR RESET SUBMISSIONS RLS
-- ==============================================================================

-- 1. Intentar borrar todas las políticas conocidas por nombre
DROP POLICY IF EXISTS "public_insert_submissions" ON submissions;
DROP POLICY IF EXISTS "public_view_approved_submissions" ON submissions;
DROP POLICY IF EXISTS "auth_view_submissions" ON submissions;
DROP POLICY IF EXISTS "auth_update_submissions" ON submissions;
DROP POLICY IF EXISTS "auth_delete_submissions" ON submissions;
DROP POLICY IF EXISTS "Invitados pueden crear submissions" ON submissions;
DROP POLICY IF EXISTS "Super admin puede ver todas las submissions" ON submissions;
DROP POLICY IF EXISTS "Providers pueden ver submissions de sus eventos" ON submissions;
DROP POLICY IF EXISTS "Super admin puede actualizar submissions" ON submissions;
DROP POLICY IF EXISTS "Providers pueden moderar submissions de sus eventos" ON submissions;
DROP POLICY IF EXISTS "Super admin puede eliminar submissions" ON submissions;
DROP POLICY IF EXISTS "Providers pueden eliminar submissions de sus eventos" ON submissions;

-- 2. Asegurar que RLS está activo
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 3. Crear política UNIVERSAL de INSERCIÓN (Para todos: Anon/Auth)
CREATE POLICY "universal_insert_submissions" ON submissions
    FOR INSERT
    TO public
    WITH CHECK (true);

-- 4. Crear política UNIVERSAL de LECTURA (Filtrada por estado para anon, total para admins)
CREATE POLICY "universal_select_submissions" ON submissions
    FOR SELECT
    TO public
    USING (
        -- Si es super admin, ve todo
        (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
        OR
        -- Si es provider asignado, ve todo
        (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM event_providers WHERE event_id = submissions.event_id AND provider_id = auth.uid()))
        OR
        -- Si es provider creador, ve todo
        (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM events WHERE id = submissions.event_id AND created_by = auth.uid()))
        OR
        -- Si es público (o cualquiera), ve las aprobadas
        (status = 'approved')
    );

-- 5. Crear política UNIVERSAL de UPDATE (Solo Admins/Providers)
CREATE POLICY "universal_update_submissions" ON submissions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        EXISTS (SELECT 1 FROM event_providers WHERE event_id = submissions.event_id AND provider_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM events WHERE id = submissions.event_id AND created_by = auth.uid())
    );

-- 6. Crear política UNIVERSAL de DELETE (Solo Admins/Providers)
CREATE POLICY "universal_delete_submissions" ON submissions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        EXISTS (SELECT 1 FROM event_providers WHERE event_id = submissions.event_id AND provider_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM events WHERE id = submissions.event_id AND created_by = auth.uid())
    );
