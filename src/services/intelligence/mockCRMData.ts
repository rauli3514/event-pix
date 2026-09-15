// ================================================================
// mockCRMData.ts
// Datos de Prueba Realistas para el CRM Conversacional y Automatización
// EventPix Intelligence — SaaS Platform
// ================================================================

import { CRMConversation, CRMAutomationRule, CRMTask } from '../../types/crm';

export const INITIAL_CRM_CONVERSATIONS: CRMConversation[] = [
  {
    id: 'conv_001',
    business_id: 'biz_default',
    lead_id: 'lead_001',
    channel: 'whatsapp',
    unread_count: 1,
    ai_mode: 'suggestion',
    ai_summary: 'Martín (Dueño de GastroBar). Llegó por Reel de Pantallas Verticales. Consultó precio de pantalla de 55" para la entrada de su local. Se le enviaron dimensiones y solicitó presupuesto con instalación.',
    ai_detected_intent: 'Solicitud de Presupuesto',
    ai_purchase_intent_score: 85,
    messaging_window: {
      is_open: true,
      expires_at: new Date(Date.now() + 18 * 3600000).toISOString(),
      hours_remaining: 18
    },
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60000).toISOString(),
    lead: {
      id: 'lead_001',
      business_id: 'biz_default',
      name: 'Martín Benítez',
      phone: '+54 9 362 489-1123',
      channel: 'whatsapp',
      stage: 'presupuesto',
      intent_score: 85,
      intent_label: 'Listo para Comprar',
      primary_interest: 'Pantalla Vertical 55" para Vidriera Gastro',
      estimated_value: 580000,
      source: {
        type: 'instagram_organic',
        post_id: 'reel_001',
        post_title: '3 Razones para instalar Pantallas Digitales en tu Local',
        keyword_triggered: 'APP',
        attribution_confidence: 'alta'
      },
      tags: ['Gastronomía', 'Alta Intención', 'Resistencia Centro'],
      notes: 'Tiene bar céntrico con 2 vidrieras a la calle. Quiere pasar promociones del happy hour y carta QR.',
      assigned_to: 'Raúl Gutiérrez',
      last_interaction_at: new Date(Date.now() - 15 * 60000).toISOString(),
      created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 60000).toISOString()
    },
    last_message: {
      id: 'msg_003',
      conversation_id: 'conv_001',
      sender_type: 'lead',
      sender_name: 'Martín Benítez',
      content: 'Hola! Vi el Reel de las pantallas verticales en Instagram y comenté "APP". ¿Me podrán cotizar una pantalla de 55" con soporte de techo para instalar en el local?',
      status: 'received',
      message_type: 'incoming',
      ai_metadata: {
        suggested_reply: '¡Hola Martín! Qué bueno saludarte. Sí, para tu local la de 55" con soporte articulado es ideal. El kit completo incluye el reproductor Tanix, soporte y la app para cambiar promos desde el celular. ¿Te gustaría que coordinemos una visita técnica sin cargo para medir la vidriera?',
        reasoning: 'El lead demostró alta intención al pedir presupuesto formal. Se sugiere cerrar con visita técnica o cotización formal.',
        detected_intent: 'Solicitud de Presupuesto',
        confidence: 0.95,
        requires_human_approval: true
      },
      created_at: new Date(Date.now() - 15 * 60000).toISOString()
    }
  },
  {
    id: 'conv_002',
    business_id: 'biz_default',
    lead_id: 'lead_002',
    channel: 'instagram_dm',
    unread_count: 0,
    ai_mode: 'suggestion',
    ai_summary: 'Luciana (Farmacia & Perfumería). Consultó por Meta Ads de Prospección B2B. Preguntó si el software permite programar turnos y ofertas que roten solas.',
    ai_detected_intent: 'Consulta de Funcionalidades y Precios',
    ai_purchase_intent_score: 65,
    messaging_window: {
      is_open: true,
      expires_at: new Date(Date.now() + 10 * 3600000).toISOString(),
      hours_remaining: 10
    },
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    lead: {
      id: 'lead_002',
      business_id: 'biz_default',
      name: 'Luciana Herrera',
      instagram_username: '@luciana_herrera_ok',
      channel: 'instagram_dm',
      stage: 'interesado',
      intent_score: 65,
      intent_label: 'Alta Intención',
      primary_interest: 'Tótem Vertical 43" para Farmacia',
      estimated_value: 420000,
      source: {
        type: 'meta_ads',
        campaign_id: 'camp_001',
        campaign_name: 'Prospección B2B — Pantallas Verticales para Locales',
        attribution_confidence: 'alta'
      },
      tags: ['Farmacia', 'Meta Ads', 'Interesada'],
      notes: 'Preguntó por rotación automática de farmacia de turno y combos de perfumería.',
      assigned_to: 'Ventas EventPix',
      last_interaction_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    last_message: {
      id: 'msg_005',
      conversation_id: 'conv_002',
      sender_type: 'operator',
      sender_name: 'Ventas EventPix',
      content: '¡Hola Luciana! Exactamente, podés programar desde el celular los horarios de las ofertas y dejar fijas las farmacias de turno. ¿Tenés un TV en el local o necesitas el equipo completo?',
      status: 'sent',
      message_type: 'business_initiated',
      created_at: new Date(Date.now() - 2 * 3600000).toISOString()
    }
  },
  {
    id: 'conv_003',
    business_id: 'biz_default',
    lead_id: 'lead_003',
    channel: 'whatsapp',
    unread_count: 0,
    ai_mode: 'automatic',
    ai_summary: 'Claudio (Centro de Estética). Venta cerrada e instalada. Pantalla de 43" en recepción conectada a EventPix Display Hub.',
    ai_detected_intent: 'Cierre Exitoso',
    ai_purchase_intent_score: 100,
    messaging_window: {
      is_open: false,
      expires_at: new Date(Date.now() - 12 * 3600000).toISOString(),
      hours_remaining: 0
    },
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    lead: {
      id: 'lead_003',
      business_id: 'biz_default',
      name: 'Claudio Morales',
      phone: '+54 9 362 411-9988',
      channel: 'whatsapp',
      stage: 'ganado',
      intent_score: 100,
      intent_label: 'Listo para Comprar',
      primary_interest: 'Pantalla 43" Recepción + App Móvil',
      estimated_value: 490000,
      source: {
        type: 'instagram_organic',
        post_id: 'reel_002',
        post_title: 'Display Digital en Vivo: Mirá cómo este local duplicó sus ventas',
        attribution_confidence: 'alta'
      },
      tags: ['Cliente Activo', 'Instalado', 'Estética'],
      notes: 'Instalación completada con éxito. Ya tiene la app configurada en su teléfono.',
      assigned_to: 'Raúl Gutiérrez',
      last_interaction_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    last_message: {
      id: 'msg_009',
      conversation_id: 'conv_003',
      sender_type: 'operator',
      sender_name: 'Soporte EventPix',
      content: '¡Excelente Claudio! Ya dejamos la pantalla vinculada al Workspace de tu local. Cualquier duda con el cargador de videos nos avisás.',
      status: 'read',
      message_type: 'business_initiated',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString()
    }
  }
];

export const INITIAL_CRM_RULES: CRMAutomationRule[] = [
  {
    id: 'rule_001',
    business_id: 'biz_default',
    name: 'Auto-Envío Demo por Palabra Clave ("APP")',
    description: 'Cuando un usuario comenta o envía "APP" en un Reel o WhatsApp, califica el lead y despacha la demo de la app móvil.',
    trigger_event: 'keyword_match',
    trigger_keyword: 'APP',
    action_type: 'send_auto_reply',
    action_payload: {
      message_template: '¡Hola {nombre}! Acá te comparto la demo en video de cómo se administran las pantallas verticales desde el celular en 10 segundos: podés subir ofertas, promos y cambiar videos sin cables. ¿Para qué tipo de local estás buscando instalarla?',
      target_stage: 'contactado'
    },
    requires_human_approval: false,
    is_active: true
  },
  {
    id: 'rule_002',
    business_id: 'biz_default',
    name: 'Auto-Ficha Técnica & Precios ("PRECIO" o "CUOTAS")',
    description: 'Detecta preguntas sobre precios, costos o financiación y prepara la propuesta comercial con los valores de Shop de Plumas.',
    trigger_event: 'price_inquiry',
    action_type: 'suggest_ai_response',
    action_payload: {
      message_template: '¡Hola {nombre}! En Shop de Plumas tenemos 2 opciones listas para vidrieras y locales: Pantalla 55" Vertical Comercial ($580.000) y Pantalla 43" ($420.000). Ambos kits vienen completos con soporte reforzado, reproductor Tanix programado y app móvil. Hacemos Factura A y disponemos de 3 y 6 cuotas. ¿Querés que coordinemos una visita técnica en tu local?',
      target_stage: 'presupuesto'
    },
    requires_human_approval: true,
    is_active: true
  },
  {
    id: 'rule_003',
    business_id: 'biz_default',
    name: 'Alerta de Alta Intención Comercial (> 75 pts)',
    description: 'Si la IA detecta pedido de presupuesto formal, CBU o datos de facturación, alerta al vendedor y crea tarea urgente de cierre.',
    trigger_event: 'high_intent',
    action_type: 'notify_seller',
    action_payload: {
      task_title: 'Llamar urgente para cerrar compra y solicitar datos de facturación / instalación',
      target_stage: 'negociacion'
    },
    requires_human_approval: false,
    is_active: true
  },
  {
    id: 'rule_004',
    business_id: 'biz_default',
    name: 'Seguimiento Automático de Presupuestos (Inactividad 48h)',
    description: 'Si se envió un presupuesto y no hubo respuesta en 48 horas, genera un recordatorio y prepara un seguimiento comercial suave.',
    trigger_event: 'no_reply_48h',
    action_type: 'create_task',
    action_payload: {
      message_template: '¡Hola {nombre}! Quería consultarte si pudiste revisar la cotización que te enviamos para la pantalla vertical. Si querés te paso fotos de cómo quedó instalada en locales similares al tuyo.',
      task_title: 'Follow-up de presupuesto: Consultar dudas sobre instalación y facilidades de pago',
      target_stage: 'seguimiento'
    },
    requires_human_approval: true,
    is_active: true
  }
];

export const INITIAL_CRM_TASKS: CRMTask[] = [
  {
    id: 'task_001',
    business_id: 'biz_default',
    lead_id: 'lead_001',
    lead_name: 'Martín Benítez',
    title: 'Enviar presupuesto de pantalla 55" vertical con soporte a Martín (Bar)',
    due_date: new Date(Date.now() + 4 * 3600000).toISOString(),
    is_completed: false,
    assigned_to: 'Raúl Gutiérrez',
    priority: 'high',
    created_at: new Date().toISOString()
  },
  {
    id: 'task_002',
    business_id: 'biz_default',
    lead_id: 'lead_002',
    lead_name: 'Luciana Herrera',
    title: 'Verificar compatibilidad de TV actual de Farmacia Luciana con Tanix',
    due_date: new Date(Date.now() + 24 * 3600000).toISOString(),
    is_completed: false,
    assigned_to: 'Ventas EventPix',
    priority: 'medium',
    created_at: new Date().toISOString()
  }
];
