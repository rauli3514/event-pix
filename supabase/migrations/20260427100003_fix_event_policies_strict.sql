
-- ==============================================================================
-- MIGRACIÓN 035: FINAL FIX FOR EVENTS VISIBILITY
-- ==============================================================================

-- 1. DROP ALL EXISTING POLICIES ON EVENTS (Nuclear Option again to be safe)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON events', pol.policyname);
    END LOOP;
END $$;

-- 2. Ensure RLS is enabled
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. RE-CREATE STRICT POLICIES

-- A) SUPER ADMIN: FULL ACCESS
-- Can see, edit, delete EVERYTHING.
CREATE POLICY "admin_all_events" ON events
    FOR ALL
    TO authenticated
    USING (
         (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- B) PROVIDER: VIEW ASSIGNED OR CREATED
-- Can only see events they are assigned to OR they created.
CREATE POLICY "provider_view_events" ON events
    FOR SELECT
    TO authenticated
    USING (
         (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' -- Admin fallback (redundant but safe)
         OR
         created_by = auth.uid()
         OR
         EXISTS (
             SELECT 1 FROM event_providers
             WHERE event_id = events.id AND provider_id = auth.uid()
         )
    );

-- C) PROVIDER: CREATE EVENTS
-- Any authenticated user (who is not anon) can create events.
CREATE POLICY "provider_create_events" ON events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by); -- Ensure they claim ownership

-- D) PROVIDER: UPDATE OWN ASSIGNED/CREATED
CREATE POLICY "provider_update_events" ON events
    FOR UPDATE
    TO authenticated
    USING (
         (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
         OR
         created_by = auth.uid()
         OR
         EXISTS (
             SELECT 1 FROM event_providers
             WHERE event_id = events.id AND provider_id = auth.uid()
         )
    );

-- E) PUBLIC/ANON: VIEW ACTIVE ONLY
-- Guests can only see active events.
CREATE POLICY "public_view_active_events" ON events
    FOR SELECT
    TO anon
    USING (status = 'active');

