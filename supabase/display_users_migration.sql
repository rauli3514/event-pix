-- 1. Crear la tabla de asignación de usuarios a comercios de cartelería
CREATE TABLE IF NOT EXISTS public.display_commerce_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    commerce_id uuid REFERENCES public.display_commerces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'admin', -- 'admin', 'editor', 'viewer'
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(commerce_id, user_id)
);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.display_commerce_users ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso (RLS)
-- Los Super Admins pueden ver y modificar todo
CREATE POLICY "Super admins can manage commerce users"
ON public.display_commerce_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
);

-- Los usuarios normales pueden ver sus propias asignaciones
CREATE POLICY "Users can view their own commerce assignments"
ON public.display_commerce_users
FOR SELECT
USING (user_id = auth.uid());
