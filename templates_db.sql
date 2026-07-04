-- ==========================================
-- DISPLAY HUB: CANVA TEMPLATES
-- Ejecuta este script en el SQL Editor de Supabase
-- ==========================================

-- 1. Tabla de Categorías de Plantillas
CREATE TABLE IF NOT EXISTS public.display_template_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    icon text, -- Emoji o URL corta
    order_index integer DEFAULT 0,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.display_template_categories ENABLE ROW LEVEL SECURITY;

-- Políticas para Categorías
-- Todo el mundo puede ver las categorías activas
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.display_template_categories FOR SELECT 
USING ( true );

-- Solo admins pueden insertar/modificar
CREATE POLICY "Super admins can insert template categories" 
ON public.display_template_categories FOR INSERT 
WITH CHECK ( is_super_admin() );

CREATE POLICY "Super admins can update template categories" 
ON public.display_template_categories FOR UPDATE 
USING ( is_super_admin() );

CREATE POLICY "Super admins can delete template categories" 
ON public.display_template_categories FOR DELETE 
USING ( is_super_admin() );


-- 2. Tabla de Plantillas
CREATE TABLE IF NOT EXISTS public.display_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES public.display_template_categories(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    thumbnail_url text,
    canva_url text NOT NULL,
    orientation text DEFAULT 'vertical' CHECK (orientation IN ('vertical', 'horizontal', 'square')),
    format text, -- ej: '1080x1920'
    order_index integer DEFAULT 0,
    status text DEFAULT 'active' CHECK (status IN ('active', 'draft')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.display_templates ENABLE ROW LEVEL SECURITY;

-- Políticas para Plantillas
-- Todo el mundo puede ver las plantillas (útil para que los clientes las vean)
CREATE POLICY "Public templates are viewable by everyone." 
ON public.display_templates FOR SELECT 
USING ( true );

-- Solo admins pueden insertar/modificar
CREATE POLICY "Super admins can insert templates" 
ON public.display_templates FOR INSERT 
WITH CHECK ( is_super_admin() );

CREATE POLICY "Super admins can update templates" 
ON public.display_templates FOR UPDATE 
USING ( is_super_admin() );

CREATE POLICY "Super admins can delete templates" 
ON public.display_templates FOR DELETE 
USING ( is_super_admin() );

-- Opcional: Mensaje de confirmación
SELECT '✅ Tablas display_template_categories y display_templates creadas correctamente con sus políticas de seguridad.' as status;
