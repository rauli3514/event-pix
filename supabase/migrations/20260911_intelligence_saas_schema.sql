-- ================================================================
-- EventPix Intelligence — SaaS Multi-tenant Schema
-- Migration: 20260911_intelligence_saas_schema.sql
-- ================================================================

-- 1. Tabla de Negocios / Cuentas Comerciales
CREATE TABLE IF NOT EXISTS intelligence_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instagram_handle TEXT,
  facebook_page_id TEXT,
  instagram_account_id TEXT,
  niche TEXT,
  target_audience TEXT,
  avg_ticket NUMERIC DEFAULT 0,
  commercial_goal TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de ADN de Marca (Brand DNA)
CREATE TABLE IF NOT EXISTS intelligence_brand_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE UNIQUE,
  identity JSONB DEFAULT '{}'::jsonb,
  voice_and_tone JSONB DEFAULT '{}'::jsonb,
  offers JSONB DEFAULT '{}'::jsonb,
  samples JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Publicaciones y Reels Históricos Analizados
CREATE TABLE IF NOT EXISTS intelligence_posts (
  id TEXT PRIMARY KEY, -- ID de Instagram (ej: '178414...')
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  platform TEXT DEFAULT 'instagram',
  title TEXT,
  caption TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER DEFAULT 30,
  objective TEXT DEFAULT 'engagement',
  published_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}'::jsonb,
  score JSONB DEFAULT '{}'::jsonb,
  analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Informes Ejecutivos de Inteligencia
CREATE TABLE IF NOT EXISTS intelligence_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  account_handle TEXT,
  health_score INTEGER DEFAULT 70,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Estado del Canvas Estratégico
CREATE TABLE IF NOT EXISTS intelligence_canvas_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE UNIQUE,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_intelligence_businesses_user_id ON intelligence_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_posts_business_id ON intelligence_posts(business_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_reports_business_id ON intelligence_reports(business_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_reports_created_at ON intelligence_reports(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE intelligence_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_brand_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_canvas_state ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Acceso por usuario autenticado o anónimo en desarrollo)
DO $$
BEGIN
  -- Businesses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_businesses_all') THEN
    CREATE POLICY intelligence_businesses_all ON intelligence_businesses FOR ALL USING (true);
  END IF;

  -- Brand DNA
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_brand_dna_all') THEN
    CREATE POLICY intelligence_brand_dna_all ON intelligence_brand_dna FOR ALL USING (true);
  END IF;

  -- Posts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_posts_all') THEN
    CREATE POLICY intelligence_posts_all ON intelligence_posts FOR ALL USING (true);
  END IF;

  -- Reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_reports_all') THEN
    CREATE POLICY intelligence_reports_all ON intelligence_reports FOR ALL USING (true);
  END IF;

  -- Canvas State
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intelligence_canvas_state_all') THEN
    CREATE POLICY intelligence_canvas_state_all ON intelligence_canvas_state FOR ALL USING (true);
  END IF;
END $$;
