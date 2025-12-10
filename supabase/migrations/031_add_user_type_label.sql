-- Add user_type column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('client', 'provider', 'admin')) DEFAULT 'provider';

-- Update existing profiles to have a default type based on role
UPDATE profiles SET user_type = 'admin' WHERE role = 'super_admin';
UPDATE profiles SET user_type = 'provider' WHERE role = 'provider' AND user_type IS NULL;

-- Function to handle new user creation with metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, user_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        'provider', -- Role is always provider for non-super-admins
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'provider') -- Use metadata or default
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
