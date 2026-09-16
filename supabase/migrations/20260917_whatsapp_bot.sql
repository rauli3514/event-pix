-- ================================================================
-- EventPix Intelligence — Bot de WhatsApp (paso 1: WhatsApp)
-- Migration: 20260917_whatsapp_bot.sql
--
-- El webhook de WhatsApp corre en un servidor (función serverless de
-- Vercel), no en el navegador de nadie, así que necesita poder leer
-- el número/token de cada negocio directamente desde la base de
-- datos (hoy esas credenciales solo vivían en localStorage). Estas
-- columnas son las que el webhook usa para identificar a qué
-- negocio pertenece cada mensaje entrante.
-- ================================================================

ALTER TABLE intelligence_businesses
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

-- Búsqueda rápida por phone_number_id (así identifica el negocio
-- dueño de cada mensaje entrante sin recorrer toda la tabla).
CREATE UNIQUE INDEX IF NOT EXISTS idx_intelligence_businesses_whatsapp_phone
  ON intelligence_businesses (whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;
