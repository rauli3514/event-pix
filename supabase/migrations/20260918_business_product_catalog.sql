-- ================================================================
-- EventPix Intelligence — Catálogo de Productos por Negocio
-- Migration: 20260918_business_product_catalog.sql
--
-- Base para que el bot de WhatsApp pueda mandar fotos reales de
-- productos cuando un cliente pregunta por ellos, y para que los
-- pagos confirmados (comprobantes) se puedan vincular a un producto
-- y así medir demanda real.
-- ================================================================

CREATE TABLE IF NOT EXISTS intelligence_business_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_business_products_business
  ON intelligence_business_products(business_id);

ALTER TABLE intelligence_business_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intelligence_business_products_access ON intelligence_business_products;
CREATE POLICY intelligence_business_products_access ON intelligence_business_products FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));

-- ----------------------------------------------------------------
-- Bucket público para las fotos de producto (mismo patrón que el
-- bucket "photos" ya usado para fotos de invitados).
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view product photos" ON storage.objects;
CREATE POLICY "Public can view product photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

DROP POLICY IF EXISTS "Authenticated users can upload product photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload product photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update product photos" ON storage.objects;
CREATE POLICY "Authenticated users can update product photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete product photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete product photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-photos' AND auth.role() = 'authenticated');
