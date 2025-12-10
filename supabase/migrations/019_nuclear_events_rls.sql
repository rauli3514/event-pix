-- ==============================================================================
-- MIGRACIÓN 019: NUCLEAR CLEANUP & FIX EVENTS RLS
-- ==============================================================================
-- Esta migración BORRA TODAS las políticas existentes en 'events' y las regenera.
-- Es la solución definitiva para evitar políticas "fantasma" que filtren datos.
-- ==============================================================================

-- 1. Barrido Nuclear de Políticas (Loop Dinámico)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON events', pol.policyname);
    END LOOP;
END $$;

-- 2. Asegurar RLS habilitado
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DEFINITIVAS (Solo 3 políticas claras)

-- A) SUPER ADMIN (Acceso Total)
CREATE POLICY "policy_events_super_admin_all" ON events
    FOR ALL
    TO authenticated
    USING (
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- B) PROVIDER (Solo Asignados o Creados)
CREATE POLICY "policy_events_provider_select" ON events
    FOR SELECT
    TO authenticated
    USING (
         EXISTS (
             SELECT 1 FROM event_providers
             WHERE event_id = events.id AND provider_id = auth.uid()
         )
         OR
         created_by = auth.uid()
    );

CREATE POLICY "policy_events_provider_insert" ON events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL); -- Providers pueden crear

CREATE POLICY "policy_events_provider_update" ON events
    FOR UPDATE
    TO authenticated
    USING (
         EXISTS (
             SELECT 1 FROM event_providers
             WHERE event_id = events.id AND provider_id = auth.uid()
         )
         OR
         created_by = auth.uid()
    );

-- C) ANON/PUBLIC (Solo Lectura de Eventos Activos para invitados/QR)
CREATE POLICY "policy_events_anon_active" ON events
    FOR SELECT
    TO anon
    USING (status = 'active');
