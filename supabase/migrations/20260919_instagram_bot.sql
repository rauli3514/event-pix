-- ================================================================
-- EventPix Intelligence — Bot de Instagram DM (mismo patrón que WhatsApp)
-- Migration: 20260919_instagram_bot.sql
--
-- El webhook de Instagram corre en el servidor (función serverless),
-- no en el navegador de nadie. Necesita:
--   1. Poder identificar a qué negocio pertenece cada mensaje entrante
--      (por el ID de la cuenta de Instagram receptora).
--   2. Guardar el token de acceso de esa cuenta para poder responder.
--   3. Guardar el ID "instagram-scoped" (IGSID) de cada lead, que es
--      el identificador real que exige la API de Meta para enviar
--      una respuesta (el @usuario visible no alcanza para eso).
-- ================================================================

ALTER TABLE intelligence_businesses
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_intelligence_businesses_instagram_account
  ON intelligence_businesses (instagram_account_id)
  WHERE instagram_account_id IS NOT NULL;

ALTER TABLE intelligence_crm_leads
  ADD COLUMN IF NOT EXISTS instagram_scoped_id TEXT;

CREATE INDEX IF NOT EXISTS idx_intelligence_crm_leads_instagram_scoped
  ON intelligence_crm_leads (business_id, instagram_scoped_id)
  WHERE instagram_scoped_id IS NOT NULL;
