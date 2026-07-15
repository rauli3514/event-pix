-- 1. Redefine Security Helpers with search_path to prevent issues and ensure robustness
-- This fixes potential RLS recursion by using SECURITY DEFINER with a clean search_path
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.has_event_access(event_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    ) OR EXISTS (
        SELECT 1 FROM event_providers
        WHERE event_id = event_uuid AND provider_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger to auto-assign creator to event_providers
--    This ensures that when a provider creates an event, they can immediately see/manage it.
CREATE OR REPLACE FUNCTION public.auto_assign_event_provider()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        INSERT INTO event_providers (event_id, provider_id, assigned_by)
        VALUES (NEW.id, auth.uid(), auth.uid())
        ON CONFLICT (event_id, provider_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_event_created_auto_assign ON events;
CREATE TRIGGER on_event_created_auto_assign
    AFTER INSERT ON events
    FOR EACH ROW EXECUTE FUNCTION public.auto_assign_event_provider();

-- 3. Dev Helper: Claim Super Admin (Reset role to super_admin)
--    Allows checking if user is blocked just by role issue
CREATE OR REPLACE FUNCTION public.claim_super_admin()
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    UPDATE profiles
    SET role = 'super_admin'
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql;
