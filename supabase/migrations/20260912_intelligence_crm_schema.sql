-- ================================================================
-- EventPix Intelligence — CRM & Meta/WhatsApp Messaging Schema
-- Migration: 20260912_intelligence_crm_schema.sql
-- ================================================================

-- 1. Tabla de Leads Comerciales
CREATE TABLE IF NOT EXISTS intelligence_crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  instagram_username TEXT,
  avatar_url TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'instagram_dm' | 'meta_ads' | 'qr_display' | 'direct'
  stage TEXT NOT NULL DEFAULT 'nuevo', -- 'nuevo' | 'contactado' | 'interesado' | 'presupuesto' | 'negociacion' | 'ganado' | 'perdido' | 'seguimiento'
  intent_score INTEGER DEFAULT 10,
  intent_label TEXT DEFAULT 'Curiosidad',
  primary_interest TEXT,
  estimated_value NUMERIC DEFAULT 0,
  source JSONB DEFAULT '{}'::jsonb, -- { type, post_id, campaign_id, keyword_triggered, attribution_confidence }
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  assigned_to TEXT,
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Conversaciones
CREATE TABLE IF NOT EXISTS intelligence_crm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES intelligence_crm_leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  unread_count INTEGER DEFAULT 0,
  ai_mode TEXT DEFAULT 'suggestion', -- 'suggestion' | 'automatic' | 'disabled'
  ai_summary TEXT,
  ai_detected_intent TEXT,
  ai_purchase_intent_score INTEGER DEFAULT 10,
  messaging_window JSONB DEFAULT '{"is_open": true, "hours_remaining": 24}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Mensajes
CREATE TABLE IF NOT EXISTS intelligence_crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES intelligence_crm_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL, -- 'lead' | 'operator' | 'ai_suggested' | 'ai_auto' | 'system'
  sender_name TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'received', -- 'received' | 'suggested' | 'approved' | 'sent' | 'delivered' | 'read' | 'rejected'
  message_type TEXT DEFAULT 'incoming', -- 'incoming' | 'auto_reply' | 'approved_template' | 'business_initiated' | 'ai_generated'
  ai_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Reglas de Automatización
CREATE TABLE IF NOT EXISTS intelligence_crm_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_keyword TEXT,
  action_type TEXT NOT NULL,
  action_payload JSONB DEFAULT '{}'::jsonb,
  requires_human_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Tareas de Seguimiento (Follow-ups)
CREATE TABLE IF NOT EXISTS intelligence_crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES intelligence_crm_leads(id) ON DELETE CASCADE,
  lead_name TEXT,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  assigned_to TEXT,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tabla de Base de Conocimiento Comercial
CREATE TABLE IF NOT EXISTS intelligence_business_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES intelligence_businesses(id) ON DELETE CASCADE UNIQUE,
  business_description TEXT,
  products_and_services JSONB DEFAULT '[]'::jsonb,
  pricing_policy TEXT,
  operating_hours TEXT,
  location_and_shipping TEXT,
  payment_methods JSONB DEFAULT '[]'::jsonb,
  faqs JSONB DEFAULT '[]'::jsonb,
  disclaimers TEXT DEFAULT 'Si no se conoce el precio o stock, derivar de inmediato a un asesor comercial humano.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_crm_leads_business ON intelligence_crm_leads(business_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON intelligence_crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_business ON intelligence_crm_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_crm_messages_conversation ON intelligence_crm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_business ON intelligence_crm_tasks(business_id);

-- Habilitar RLS
ALTER TABLE intelligence_crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_crm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_crm_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_business_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Políticas de desarrollo abiertas
DO $$
BEGIN
  CREATE POLICY intelligence_crm_leads_all ON intelligence_crm_leads FOR ALL USING (true);
  CREATE POLICY intelligence_crm_convs_all ON intelligence_crm_conversations FOR ALL USING (true);
  CREATE POLICY intelligence_crm_msgs_all ON intelligence_crm_messages FOR ALL USING (true);
  CREATE POLICY intelligence_crm_automations_all ON intelligence_crm_automations FOR ALL USING (true);
  CREATE POLICY intelligence_crm_tasks_all ON intelligence_crm_tasks FOR ALL USING (true);
  CREATE POLICY intelligence_crm_kb_all ON intelligence_business_knowledge_base FOR ALL USING (true);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
