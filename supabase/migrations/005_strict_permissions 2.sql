-- ==============================================================================
-- MIGRACIÓN 005: PERMISOS ESTRICTOS Y CASCADA (VERSIÓN NUCLEAR)
-- ==============================================================================

-- 1. FUNCIONES HELPER
-- ==============================================================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_assigned_provider(event_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM event_providers
        WHERE event_id = event_uuid AND provider_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ARREGLAR CLAVES FORÁNEAS (ON DELETE CASCADE)
-- ==============================================================================
ALTER TABLE event_providers
DROP CONSTRAINT IF EXISTS event_providers_provider_id_fkey,
ADD CONSTRAINT event_providers_provider_id_fkey
    FOREIGN KEY (provider_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE event_providers
DROP CONSTRAINT IF EXISTS event_providers_event_id_fkey,
ADD CONSTRAINT event_providers_event_id_fkey
    FOREIGN KEY (event_id)
    REFERENCES events(id)
    ON DELETE CASCADE;

-- 3. TABLA EVENTS (Blindaje Nuclear)
-- ==============================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Borrado recursivo de políticas antiguas para evitar conflictos
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON events', pol.policyname); 
    END LOOP; 
END $$;

-- A) SUPER ADMIN: Acceso Total
CREATE POLICY "SA_FULL_EVENTS" ON events
    FOR ALL
    TO authenticated
    USING (is_super_admin());

-- B) PROVIDER: Solo Lectura de sus eventos asignados
CREATE POLICY "PROVIDER_READ_EVENTS" ON events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM event_providers WHERE event_id = events.id AND provider_id = auth.uid())
    );

-- 4. TABLA EVENT_PROVIDERS (Asignaciones)
-- ==============================================================================
ALTER TABLE event_providers ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'event_providers' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON event_providers', pol.policyname); 
    END LOOP; 
END $$;

-- A) SUPER ADMIN: Gestión Total
CREATE POLICY "SA_FULL_ASSIGNMENTS" ON event_providers
    FOR ALL
    USING (is_super_admin());

-- B) PROVIDER: Ver sus propias asignaciones
CREATE POLICY "PROVIDER_READ_ASSIGNMENTS" ON event_providers
    FOR SELECT
    USING (provider_id = auth.uid());

-- 5. TABLA SUBMISSIONS (Fotos)
-- ==============================================================================
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'submissions' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON submissions', pol.policyname); 
    END LOOP; 
END $$;

-- A) SUPER ADMIN: Acceso Total
CREATE POLICY "SA_FULL_SUBMISSIONS" ON submissions
    FOR ALL
    USING (is_super_admin());

-- B) PROVIDER: Ver fotos de sus eventos
CREATE POLICY "PROVIDER_READ_SUBMISSIONS" ON submissions
    FOR SELECT
    USING (is_assigned_provider(event_id));

-- C) PROVIDER: Modificar (Aprobar/Rechazar) fotos de sus eventos
CREATE POLICY "PROVIDER_UPDATE_SUBMISSIONS" ON submissions
    FOR UPDATE
    USING (is_assigned_provider(event_id));

-- D) PROVIDER: Eliminar fotos de sus eventos
CREATE POLICY "PROVIDER_DELETE_SUBMISSIONS" ON submissions
    FOR DELETE
    USING (is_assigned_provider(event_id));

-- E) INVITADOS: Subir fotos (Insert público)
CREATE POLICY "PUBLIC_INSERT_SUBMISSIONS" ON submissions
    FOR INSERT
    WITH CHECK (true);
