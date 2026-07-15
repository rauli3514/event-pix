-- ==============================================================================
-- MIGRACIÓN 018: Reparar RLS de Eventos para Providers (Definitivo)
-- ==============================================================================

-- 1. Eliminar políticas conflictivas previas
DROP POLICY IF EXISTS "PROVIDER_READ_ASSIGNED_EVENTS" ON events;
DROP POLICY IF EXISTS "Providers pueden ver sus eventos" ON events;
DROP POLICY IF EXISTS "PROVIDER_READ_EVENTS" ON events;

-- 2. POLÍTICA: Proveedores AUTENTICADOS solo ven SUS eventos asignados
-- Esta versión combina super admin y providers para no dejar huecos
CREATE POLICY "PROVIDER_READ_ASSIGNED_EVENTS" ON events
    FOR SELECT
    TO authenticated
    USING (
        -- A) Es Super Admin
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        ) 
        OR
        -- B) Es Provider asignado explícitamente
        EXISTS (
            SELECT 1 FROM event_providers
            WHERE event_id = events.id 
            AND provider_id = auth.uid()
        )
        OR
        -- C) Es el creador del evento
        (created_by = auth.uid())
    );
