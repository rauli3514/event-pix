-- ================================================================
-- EventPix Intelligence — Bot de Facebook Messenger (mismo patrón que
-- Instagram DM / WhatsApp)
-- Migration: 20260930_facebook_messenger_bot.sql
--
-- El webhook de Facebook Messenger corre en el servidor (función
-- serverless), no en el navegador de nadie. Necesita:
--   1. Poder identificar a qué negocio pertenece cada mensaje entrante
--      (por el ID de la Página de Facebook receptora).
--   2. Guardar el token de acceso de esa Página para poder responder.
--   3. Guardar el PSID (Page-Scoped ID) de cada lead, el identificador
--      real que exige la API de Messenger para enviar una respuesta.
-- ================================================================

ALTER TABLE intelligence_businesses
  ADD COLUMN IF NOT EXISTS facebook_page_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_intelligence_businesses_facebook_page
  ON intelligence_businesses (facebook_page_id)
  WHERE facebook_page_id IS NOT NULL;

ALTER TABLE intelligence_crm_leads
  ADD COLUMN IF NOT EXISTS facebook_scoped_id TEXT;

CREATE INDEX IF NOT EXISTS idx_intelligence_crm_leads_facebook_scoped
  ON intelligence_crm_leads (business_id, facebook_scoped_id)
  WHERE facebook_scoped_id IS NOT NULL;
