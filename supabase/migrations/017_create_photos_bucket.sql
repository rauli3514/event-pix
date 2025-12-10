-- =====================================================
-- Migration 017: Create Photos Bucket
-- =====================================================
-- Crear bucket específico para fotos de invitados,
-- separado del bucket 'event-images' que contiene
-- assets del sistema (fondos, logos, marcos, etc.)
-- =====================================================

-- Crear el bucket 'photos' público para las fotos de los invitados
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- POLÍTICAS DE ACCESO
-- =====================================================

-- Política 1: Cualquiera puede VER las fotos (público)
-- Esto permite que el muro muestre las fotos sin autenticación
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Política 2: Cualquiera puede SUBIR fotos
-- Permite que los invitados suban fotos sin necesidad de login
CREATE POLICY "Anyone can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos');

-- Política 3: Solo usuarios autenticados pueden ACTUALIZAR
-- Los admins y providers pueden modificar las fotos si es necesario
CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Política 4: Solo usuarios autenticados pueden ELIMINAR
-- Solo admins y providers pueden eliminar fotos
CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- =====================================================
-- NOTAS:
-- =====================================================
-- - Este bucket está separado de 'event-images'
-- - 'event-images' = fondos, logos, marcos (assets del sistema)
-- - 'photos' = fotos subidas por invitados
-- - Ambos buckets son públicos pero con diferentes propósitos
-- =====================================================
