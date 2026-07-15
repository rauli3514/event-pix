-- Función para que un super_admin pueda crear otros usuarios
-- NOTA: Esto crea el usuario en auth.users y su perfil
CREATE OR REPLACE FUNCTION create_provider_user(
    email TEXT,
    password TEXT,
    name TEXT
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- 1. Verificar que quien ejecuta es super_admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
    END IF;

    -- 2. Crear usuario en auth.users (Esto requiere permisos elevados, 
    -- normalmente no se puede hacer desde SQL simple sin extensiones o supabase_admin)
    -- TRUCO: En Supabase, la mejor forma desde el cliente es usar la API de administración
    -- o una Edge Function. Pero como queremos hacerlo rápido, usaremos un truco:
    -- Insertar en profiles no crea el auth user.
    
    -- REVISIÓN: Desde el cliente NO podemos crear usuarios en auth.users directamente por SQL
    -- sin la extensión pgsodium o similar configurada, o usando supabase_functions.
    
    RAISE EXCEPTION 'Por seguridad, la creación de usuarios debe hacerse mediante Edge Functions o el Dashboard de Supabase';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
