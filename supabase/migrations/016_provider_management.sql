
-- Add is_active column to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='is_active') THEN
        ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Create a function to update user password (requires elevated privileges)
-- Note: This is tricky in Supabase because we can't easily update auth.users from a normal function.
-- However, we can create a function with SECURITY DEFINER that updates the password.
-- BUT, Supabase blocks direct updates to auth.users.encrypted_password usually.
-- The recommended way is using the Admin API.
-- Since we are in a "client-side only" environment (presumably), we have a limitation.

-- WORKAROUND: We will create a function that uses the `supabase_admin` role (if available) or just try to update.
-- Actually, we can use `pgcrypto` extension if enabled, but `auth.users` is protected.

-- Let's try to create a function that updates the password using the `supabase_functions` schema if available, or just standard update.
-- Warning: This might fail if the user doesn't have permissions.
-- But we can try to create a wrapper.

CREATE OR REPLACE FUNCTION update_user_password(user_id UUID, new_password TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Check if the executing user is a super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    UPDATE auth.users 
    SET encrypted_password = crypt(new_password, gen_salt('bf')) 
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;
