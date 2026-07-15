-- ============================================================================== 
-- MIGRACIÓN 020: Fix Submissions RLS (Permitir inserción pública)
-- ============================================================================== 

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'submissions' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON submissions', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 1. PUBLIC/ANON: Permitir subir fotos (INSERT)
CREATE POLICY "public_insert_submissions" ON submissions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 2. PUBLIC/ANON: Leer SOLO fotos aprobadas de eventos ACTIVOS (opcional, si es público)
-- (Normalmente el display pública usa anon key, así que esto es vital)
CREATE POLICY "public_view_approved_submissions" ON submissions
    FOR SELECT
    TO anon
    USING (status = 'approved');

-- 3. AUTHENTICATED (Providers/Admins): Leer TODO de sus eventos
CREATE POLICY "auth_view_submissions" ON submissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        EXISTS (SELECT 1 FROM event_providers WHERE event_id = submissions.event_id AND provider_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM events WHERE id = submissions.event_id AND created_by = auth.uid())
    );

-- 4. AUTHENTICATED (Providers/Admins): Modificar (Aprobar/Borrar)
CREATE POLICY "auth_update_submissions" ON submissions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        EXISTS (SELECT 1 FROM event_providers WHERE event_id = submissions.event_id AND provider_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM events WHERE id = submissions.event_id AND created_by = auth.uid())
    );

CREATE POLICY "auth_delete_submissions" ON submissions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR
        EXISTS (SELECT 1 FROM event_providers WHERE event_id = submissions.event_id AND provider_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM events WHERE id = submissions.event_id AND created_by = auth.uid())
    );
