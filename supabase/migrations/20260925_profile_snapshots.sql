-- ================================================================
-- EventPix Intelligence — Historial de seguidores/engagement por perfil
-- Migration: 20260925_profile_snapshots.sql
--
-- Meta y TikTok no exponen histórico de seguidores hacia atrás (ni para
-- la cuenta propia ni para competencia) — el gráfico de "Crecimiento de
-- Seguidores" solo puede empezar a construirse desde el día que arrancamos
-- a guardar una foto diaria. Una fila por perfil (propio o de competencia)
-- por día; el índice único permite un upsert "solo si no existe hoy" en
-- vez de necesitar un cron — se guarda sola la primera vez que se mira
-- ese perfil en el día.
-- ================================================================

CREATE TABLE IF NOT EXISTS intelligence_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  -- 'own' = la cuenta del negocio; 'competitor' = un perfil de competencia guardado en Auditoría.
  profile_kind TEXT NOT NULL CHECK (profile_kind IN ('own', 'competitor')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  handle TEXT NOT NULL,
  follower_count INTEGER,
  following_count INTEGER,
  media_count INTEGER,
  total_likes INTEGER,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intelligence_profile_snapshots_daily
  ON intelligence_profile_snapshots (business_id, platform, handle, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_intelligence_profile_snapshots_lookup
  ON intelligence_profile_snapshots (business_id, platform, handle, snapshot_date DESC);

ALTER TABLE intelligence_profile_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intelligence_profile_snapshots_access ON intelligence_profile_snapshots;
CREATE POLICY intelligence_profile_snapshots_access ON intelligence_profile_snapshots FOR ALL
  USING (has_intelligence_business_access(business_id))
  WITH CHECK (has_intelligence_business_access(business_id));
