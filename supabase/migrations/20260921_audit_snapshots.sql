-- ================================================================
-- EventPix Intelligence — Punto de partida para la Auditoría Personalizada
-- Migration: 20260921_audit_snapshots.sql
--
-- Guarda una "foto" del puntaje de auditoría (overall + las 5 categorías
-- + métricas de soporte) en un momento dado, para poder comparar contra
-- ella a los 30/60/90 días y mostrar progreso real, no solo un número
-- suelto sin contexto histórico.
-- ================================================================

CREATE TABLE IF NOT EXISTS intelligence_audit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  is_baseline BOOLEAN NOT NULL DEFAULT false,
  overall_score INTEGER,
  category_scores JSONB NOT NULL,
  supporting_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_audit_snapshots_business
  ON intelligence_audit_snapshots (business_id, created_at DESC);

-- Como mucho un punto de partida activo por negocio.
CREATE UNIQUE INDEX IF NOT EXISTS idx_intelligence_audit_snapshots_one_baseline
  ON intelligence_audit_snapshots (business_id)
  WHERE is_baseline;

ALTER TABLE intelligence_audit_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intelligence_audit_snapshots_access ON intelligence_audit_snapshots;
CREATE POLICY intelligence_audit_snapshots_access ON intelligence_audit_snapshots FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));
