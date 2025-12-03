-- ==============================================================================
-- MIGRACIÓN 015: Arreglar Permisos de Lectura de Eventos (Públicos + Proveedores)
-- ==============================================================================

-- Eliminar todas las políticas de SELECT en events
DROP POLICY IF EXISTS "Eventos públicos son visibles para todos" ON events;
DROP POLICY IF EXISTS "PROVIDER_READ_EVENTS" ON events;
DROP POLICY IF EXISTS "SA_FULL_EVENTS" ON events;

-- POLÍTICA 1: Super Admins pueden ver TODO (y hacer TODO)
CREATE POLICY "SA_FULL_EVENTS" ON events
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- POLÍTICA 2: Usuarios ANÓNIMOS pueden ver eventos ACTIVOS
-- (Esto permite que los QR funcionen)
CREATE POLICY "PUBLIC_READ_ACTIVE_EVENTS" ON events
    FOR SELECT
    TO anon
    USING (status = 'active');

-- POLÍTICA 3: Proveedores AUTENTICADOS solo ven SUS eventos asignados
CREATE POLICY "PROVIDER_READ_ASSIGNED_EVENTS" ON events
    FOR SELECT
    TO authenticated
    USING (
        -- El usuario NO es super admin (ya tiene acceso por POLÍTICA 1)
        -- Y está asignado al evento
        NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
        AND EXISTS (
            SELECT 1 FROM event_providers
            WHERE event_id = events.id AND provider_id = auth.uid()
        )
    );
