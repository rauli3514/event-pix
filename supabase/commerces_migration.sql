-- 1. Crear la tabla de Comercios (Display Digital)
CREATE TABLE IF NOT EXISTS public.display_commerces (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en display_commerces
ALTER TABLE public.display_commerces ENABLE ROW LEVEL SECURITY;

-- Los Super Admins pueden ver y modificar todo en comercios
CREATE POLICY "Super admins can manage commerces"
ON public.display_commerces FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- Los usuarios normales pueden ver los comercios que tienen asignados
CREATE POLICY "Users can view assigned commerces"
ON public.display_commerces FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.display_commerce_users 
    WHERE display_commerce_users.commerce_id = display_commerces.id 
    AND display_commerce_users.user_id = auth.uid()
  )
);

-- 2. Crear la tabla de asignación (Si no la creaste antes)
CREATE TABLE IF NOT EXISTS public.display_commerce_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    commerce_id uuid REFERENCES public.display_commerces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'admin',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(commerce_id, user_id)
);

-- Habilitar RLS en display_commerce_users
ALTER TABLE public.display_commerce_users ENABLE ROW LEVEL SECURITY;

-- Políticas de asignación
CREATE POLICY "Super admins can manage commerce users"
ON public.display_commerce_users FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Users can view their own commerce assignments"
ON public.display_commerce_users FOR SELECT
USING (user_id = auth.uid());
