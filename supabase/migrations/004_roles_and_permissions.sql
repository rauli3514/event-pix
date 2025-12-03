-- =====================================================
-- SISTEMA DE ROLES Y PERMISOS - EventPix
-- =====================================================

-- 1. TABLA DE PERFILES (PROFILES)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'provider')) DEFAULT 'provider',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Función para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        'provider'  -- Por defecto todos son providers
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auto-crear perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. MODIFICAR TABLA EVENTS (Agregar owner)
-- =====================================================
-- Agregar campos si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='events' AND column_name='created_by') THEN
        ALTER TABLE events ADD COLUMN created_by UUID REFERENCES profiles(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);


-- 3. TABLA EVENT_PROVIDERS (Relación muchos a muchos)
-- =====================================================
CREATE TABLE IF NOT EXISTS event_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES profiles(id),
    UNIQUE(event_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_event_providers_event ON event_providers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_providers_provider ON event_providers(provider_id);


-- 4. MODIFICAR TABLA SUBMISSIONS (Agregar campos de moderación)
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='submissions' AND column_name='moderated_by') THEN
        ALTER TABLE submissions ADD COLUMN moderated_by UUID REFERENCES profiles(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='submissions' AND column_name='moderated_at') THEN
        ALTER TABLE submissions ADD COLUMN moderated_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='submissions' AND column_name='uploaded_by_ip') THEN
        ALTER TABLE submissions ADD COLUMN uploaded_by_ip TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_moderated_by ON submissions(moderated_by);


-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- FUNCIÓN HELPER: Verificar si es super_admin
-- =====================================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FUNCIÓN HELPER: Verificar si tiene acceso a un evento
-- =====================================================
CREATE OR REPLACE FUNCTION has_event_access(event_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'
    ) OR EXISTS (
        SELECT 1 FROM event_providers ep
        WHERE ep.event_id = event_uuid AND ep.provider_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- RLS: TABLA PROFILES
-- =====================================================
DROP POLICY IF EXISTS "Super admin puede ver todos los perfiles" ON profiles;
CREATE POLICY "Super admin puede ver todos los perfiles"
    ON profiles FOR SELECT
    USING (is_super_admin());

DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON profiles;
CREATE POLICY "Usuarios pueden ver su propio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON profiles;
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role != 'super_admin'); -- No pueden cambiar su rol a super_admin

DROP POLICY IF EXISTS "Super admin puede crear perfiles" ON profiles;
CREATE POLICY "Super admin puede crear perfiles"
    ON profiles FOR INSERT
    WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admin puede actualizar perfiles" ON profiles;
CREATE POLICY "Super admin puede actualizar perfiles"
    ON profiles FOR UPDATE
    USING (is_super_admin());


-- =====================================================
-- RLS: TABLA EVENTS
-- =====================================================
DROP POLICY IF EXISTS "Super admin puede ver todos los eventos" ON events;
CREATE POLICY "Super admin puede ver todos los eventos"
    ON events FOR SELECT
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden ver sus eventos" ON events;
CREATE POLICY "Providers pueden ver sus eventos"
    ON events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM event_providers ep
            WHERE ep.event_id = events.id AND ep.provider_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Super admin puede crear eventos" ON events;
CREATE POLICY "Super admin puede crear eventos"
    ON events FOR INSERT
    WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden crear eventos" ON events;
CREATE POLICY "Providers pueden crear eventos"
    ON events FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Super admin puede actualizar eventos" ON events;
CREATE POLICY "Super admin puede actualizar eventos"
    ON events FOR UPDATE
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden actualizar sus eventos" ON events;
CREATE POLICY "Providers pueden actualizar sus eventos"
    ON events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM event_providers ep
            WHERE ep.event_id = events.id AND ep.provider_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Super admin puede eliminar eventos" ON events;
CREATE POLICY "Super admin puede eliminar eventos"
    ON events FOR DELETE
    USING (is_super_admin());


-- =====================================================
-- RLS: TABLA EVENT_PROVIDERS
-- =====================================================
DROP POLICY IF EXISTS "Super admin puede gestionar asignaciones" ON event_providers;
CREATE POLICY "Super admin puede gestionar asignaciones"
    ON event_providers FOR ALL
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden ver sus asignaciones" ON event_providers;
CREATE POLICY "Providers pueden ver sus asignaciones"
    ON event_providers FOR SELECT
    USING (provider_id = auth.uid());


-- =====================================================
-- RLS: TABLA EVENT_SETTINGS
-- =====================================================
DROP POLICY IF EXISTS "Super admin puede gestionar settings" ON event_settings;
CREATE POLICY "Super admin puede gestionar settings"
    ON event_settings FOR ALL
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden ver settings de sus eventos" ON event_settings;
CREATE POLICY "Providers pueden ver settings de sus eventos"
    ON event_settings FOR SELECT
    USING (has_event_access(event_id));

DROP POLICY IF EXISTS "Providers pueden actualizar settings de sus eventos" ON event_settings;
CREATE POLICY "Providers pueden actualizar settings de sus eventos"
    ON event_settings FOR UPDATE
    USING (has_event_access(event_id));


-- =====================================================
-- RLS: TABLA SUBMISSIONS
-- =====================================================
DROP POLICY IF EXISTS "Super admin puede ver todas las submissions" ON submissions;
CREATE POLICY "Super admin puede ver todas las submissions"
    ON submissions FOR SELECT
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden ver submissions de sus eventos" ON submissions;
CREATE POLICY "Providers pueden ver submissions de sus eventos"
    ON submissions FOR SELECT
    USING (has_event_access(event_id));

DROP POLICY IF EXISTS "Invitados pueden crear submissions" ON submissions;
CREATE POLICY "Invitados pueden crear submissions"
    ON submissions FOR INSERT
    WITH CHECK (true); -- Cualquiera puede subir (invitados sin auth)

DROP POLICY IF EXISTS "Super admin puede actualizar submissions" ON submissions;
CREATE POLICY "Super admin puede actualizar submissions"
    ON submissions FOR UPDATE
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden moderar submissions de sus eventos" ON submissions;
CREATE POLICY "Providers pueden moderar submissions de sus eventos"
    ON submissions FOR UPDATE
    USING (has_event_access(event_id));

DROP POLICY IF EXISTS "Super admin puede eliminar submissions" ON submissions;
CREATE POLICY "Super admin puede eliminar submissions"
    ON submissions FOR DELETE
    USING (is_super_admin());

DROP POLICY IF EXISTS "Providers pueden eliminar submissions de sus eventos" ON submissions;
CREATE POLICY "Providers pueden eliminar submissions de sus eventos"
    ON submissions FOR DELETE
    USING (has_event_access(event_id));


-- =====================================================
-- FUNCIONES ÚTILES PARA EL FRONTEND
-- =====================================================

-- Función para obtener eventos de un provider
CREATE OR REPLACE FUNCTION get_provider_events(provider_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    date DATE,
    location TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT e.id, e.name, e.slug, e.date, e.location, e.is_active, e.created_at
    FROM events e
    INNER JOIN event_providers ep ON e.id = ep.event_id
    WHERE ep.provider_id = provider_uuid
    ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- DATOS INICIALES (OPCIONAL)
-- =====================================================
-- Descomentar para crear un super_admin inicial
-- IMPORTANTE: Cambiar el email por el tuyo
/*
INSERT INTO profiles (id, email, name, role)
SELECT 
    id,
    email,
    'Super Admin',
    'super_admin'
FROM auth.users
WHERE email = 'tu-email@ejemplo.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
*/
