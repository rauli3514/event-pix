// ================================================================
// crm.ts
// Tipos del CRM Conversacional y Automatización Meta/WhatsApp
// EventPix Intelligence — SaaS Platform
// ================================================================

export type CRMChannel = 'whatsapp' | 'instagram_dm' | 'meta_ads' | 'qr_display' | 'direct';

export type LeadStage = 
  | 'nuevo'          // Acaba de iniciar conversación
  | 'contactado'     // Ya recibió primera respuesta
  | 'interesado'     // Demostró interés en pantallas o servicios
  | 'presupuesto'    // Solicitó precio o cotización formal
  | 'negociacion'    // Conversación comercial activa con objeciones
  | 'ganado'         // Se convirtió en cliente (compra/instalación)
  | 'perdido'        // No compró o descartado
  | 'seguimiento';   // Requiere contacto posterior programado

export type MessageSenderType = 'lead' | 'operator' | 'ai_suggested' | 'ai_auto' | 'system';

export type MessageDeliveryStatus = 'received' | 'suggested' | 'approved' | 'sent' | 'delivered' | 'read' | 'rejected';

export type MetaMessageType = 
  | 'incoming'             // Mensaje entrante del cliente
  | 'auto_reply'           // Respuesta automática dentro de la ventana de 24h
  | 'approved_template'    // Plantilla aprobada por Meta (WhatsApp HSM)
  | 'business_initiated'   // Iniciado por el operador
  | 'ai_generated';        // Generado por IA

export interface CRMLead {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  instagram_username?: string;
  avatar_url?: string;
  channel: CRMChannel;
  stage: LeadStage;
  
  // Scoring e Intención Cuantificable
  intent_score: number; // 0 a 100
  intent_label: 'Curiosidad' | 'Interesado' | 'Alta Intención' | 'Listo para Comprar';
  primary_interest?: string; // Ej: "Pantalla Vertical 55 pulgadas para Local"
  estimated_value?: number; // En moneda local (ej: $450.000)
  
  // Atribución de Origen
  source: {
    type: 'instagram_organic' | 'meta_ads' | 'qr_display' | 'direct';
    post_id?: string;         // ID del Reel que originó la conversación
    post_title?: string;      // Título o gancho del Reel
    campaign_id?: string;     // Campaña de Meta Ads si provino de pauta
    campaign_name?: string;
    keyword_triggered?: string; // Ej: "APP" o "PANTALLA"
    attribution_confidence: 'alta' | 'media' | 'no_atribuible';
  };

  tags: string[];
  notes?: string;
  assigned_to?: string;
  last_interaction_at: string;
  created_at: string;
  updated_at: string;
}

export interface CRMMessage {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  sender_name?: string;
  content: string;
  status: MessageDeliveryStatus;
  message_type: MetaMessageType;
  
  // Metadatos de IA y Meta
  ai_metadata?: {
    suggested_reply?: string;
    reasoning?: string;
    detected_intent?: string;
    confidence?: number;
    requires_human_approval: boolean;
  };
  
  created_at: string;
}

export interface CRMConversation {
  id: string;
  business_id: string;
  lead_id: string;
  lead: CRMLead;
  channel: CRMChannel;
  unread_count: number;
  last_message?: CRMMessage;
  messages?: CRMMessage[];
  
  // Configuración de Asistente IA
  ai_mode: 'suggestion' | 'automatic' | 'disabled';
  ai_summary?: string;
  ai_detected_intent?: string;
  ai_purchase_intent_score: number; // 0 - 100
  
  // Ventana de Meta (24 Horas)
  messaging_window: {
    is_open: boolean;
    expires_at: string; // ISO String
    hours_remaining: number;
  };

  created_at: string;
  updated_at: string;
}

export interface CRMTask {
  id: string;
  business_id: string;
  lead_id: string;
  lead_name: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  assigned_to: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface CRMAutomationRule {
  id: string;
  business_id: string;
  name: string;
  description: string;
  trigger_event: 'new_lead' | 'keyword_match' | 'price_inquiry' | 'high_intent' | 'out_of_hours' | 'no_reply_48h';
  trigger_keyword?: string;
  action_type: 'send_auto_reply' | 'suggest_ai_response' | 'notify_seller' | 'create_task' | 'change_stage';
  action_payload: {
    message_template?: string;
    target_stage?: LeadStage;
    task_title?: string;
  };
  requires_human_approval: boolean; // Modo sugerencia
  is_active: boolean;
}

export interface CRMAutomationLog {
  id: string;
  rule_id: string;
  rule_name: string;
  trigger_event: CRMAutomationRule['trigger_event'];
  lead_id: string;
  lead_name: string;
  action_type: CRMAutomationRule['action_type'];
  action_summary: string;
  executed_at: string;
  requires_human_approval: boolean;
  status: 'executed' | 'suggested' | 'approved';
}

export interface CRMFunnelMetrics {
  total_conversations: number;
  total_leads: number;
  qualified_leads: number; // Intent Score >= 50
  budgets_requested: number;
  deals_won: number;
  deals_lost: number;
  conversion_rate_pct: number;
  total_sales_value: number;
  avg_response_time_minutes: number;
  top_converting_content: {
    post_id: string;
    post_title: string;
    leads_count: number;
    sales_count: number;
  }[];
}

export interface CommercialOpportunity {
  id: string;
  type: 'lead_abandoned' | 'budget_stalled' | 'meta_window_expiring' | 'high_intent_unassigned' | 'content_converting';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'info';
  action_label: string;
  lead_id?: string;
  lead_name?: string;
  post_id?: string;
  suggested_action_type: 'create_task' | 'open_chat' | 'activate_automation' | 'view_content';
  metric_highlight?: string;
}

export interface RecommendedAutomation {
  id: string;
  title: string;
  reason: string;
  trigger_summary: string;
  suggested_rule: Omit<CRMAutomationRule, 'id' | 'business_id' | 'is_active'>;
  detected_frequency: string;
  projected_impact: string;
}
