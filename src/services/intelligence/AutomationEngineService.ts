// ================================================================
// AutomationEngineService.ts
// Motor Inteligente de Reglas, Disparadores y Automatizaciones
// EventPix Intelligence — SaaS Platform
// ================================================================

import { 
  CRMAutomationRule, 
  CRMAutomationLog, 
  CRMConversation, 
  CRMMessage, 
  CRMTask, 
  LeadStage 
} from '../../types/crm';
import { CRMStorageService } from './CRMStorageService';

const LOCAL_STORAGE_KEYS = {
  AUTOMATION_LOGS: 'eventpix_crm_automation_logs'
};

export interface TriggerEvaluationResult {
  rule: CRMAutomationRule;
  matchedTrigger: CRMAutomationRule['trigger_event'];
  matchedReason: string;
}

export interface AutomationExecutionResult {
  success: boolean;
  rule: CRMAutomationRule;
  requiresHumanApproval: boolean;
  autoMessageSent?: CRMMessage;
  suggestedText?: string;
  stageUpdated?: LeadStage;
  taskCreated?: CRMTask;
  notificationMessage?: string;
  log: CRMAutomationLog;
}

export class AutomationEngineService {

  // =========================================================================
  // 1. EVALUADOR DE DISPARADORES (TRIGGERS)
  // =========================================================================

  /**
   * Evalúa las reglas activas contra un mensaje entrante de un prospecto
   */
  static evaluateIncomingMessage(
    messageText: string,
    conversation: CRMConversation,
    rules: CRMAutomationRule[]
  ): TriggerEvaluationResult[] {
    const activeRules = rules.filter(r => r.is_active);
    const results: TriggerEvaluationResult[] = [];
    const textLower = messageText.toLowerCase().trim();

    for (const rule of activeRules) {
      // 1. Coincidencia por Palabra Clave (Keyword Match)
      if (rule.trigger_event === 'keyword_match' && rule.trigger_keyword) {
        const kw = rule.trigger_keyword.toLowerCase().trim();
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(textLower) || textLower.includes(kw)) {
          results.push({
            rule,
            matchedTrigger: 'keyword_match',
            matchedReason: `Palabra clave detectada: "${rule.trigger_keyword}"`
          });
          continue;
        }
      }

      // 2. Consulta de Precios y Condiciones Comerciales (Price Inquiry)
      if (rule.trigger_event === 'price_inquiry') {
        const priceRegex = /precio|cu[aá]nto\s+sale|cu[aá]nto\s+cuesta|cu[aá]l\s+es\s+el\s+costo|tarifa|cotizaci[oó]n|presupuesto|\$|cuotas|financiaci[oó]n/i;
        if (priceRegex.test(textLower)) {
          results.push({
            rule,
            matchedTrigger: 'price_inquiry',
            matchedReason: 'Detectada consulta sobre precios, cuotas o presupuesto'
          });
          continue;
        }
      }

      // 3. Alta Intención Comercial (High Intent)
      if (rule.trigger_event === 'high_intent') {
        const highIntentRegex = /comprar|encargar|factura\s*a|transferir|cbu|alias|visita\s*t[eé]cnica|coordinar|se[ñn]ar|quiero\s+la\s+de/i;
        const isHighIntentScore = (conversation.ai_purchase_intent_score || conversation.lead.intent_score || 0) >= 75;
        
        if (highIntentRegex.test(textLower) || isHighIntentScore) {
          results.push({
            rule,
            matchedTrigger: 'high_intent',
            matchedReason: isHighIntentScore 
              ? `Score comercial elevado (${conversation.lead.intent_score} pts)` 
              : 'Detectada intención explícita de compra o facturación'
          });
          continue;
        }
      }
    }

    return results;
  }

  /**
   * Evalúa inactividad (48h o sin respuesta) en un lead
   */
  static evaluateInactivity(
    conversation: CRMConversation,
    rules: CRMAutomationRule[]
  ): TriggerEvaluationResult[] {
    const activeRules = rules.filter(r => r.is_active && r.trigger_event === 'no_reply_48h');
    const results: TriggerEvaluationResult[] = [];

    const lastMsgDate = conversation.last_message 
      ? new Date(conversation.last_message.created_at).getTime() 
      : new Date(conversation.updated_at).getTime();
    
    const hoursElapsed = (Date.now() - lastMsgDate) / (1000 * 60 * 60);

    // Si pasaron más de 24 horas sin interacción
    if (hoursElapsed >= 24) {
      for (const rule of activeRules) {
        results.push({
          rule,
          matchedTrigger: 'no_reply_48h',
          matchedReason: `Más de ${Math.round(hoursElapsed)} horas sin interacción tras la última propuesta`
        });
      }
    }

    return results;
  }

  // =========================================================================
  // 2. EJECUTOR DE ACCIONES (ACTIONS DISPATCHER)
  // =========================================================================

  /**
   * Ejecuta una regla sobre una conversación
   */
  static async executeRule(
    rule: CRMAutomationRule,
    conversation: CRMConversation,
    businessId: string,
    options: { forceImmediate?: boolean } = {}
  ): Promise<AutomationExecutionResult> {
    const shouldAutoSend = !rule.requires_human_approval || options.forceImmediate;
    let autoMessageSent: CRMMessage | undefined;
    let suggestedText: string | undefined;
    let stageUpdated: LeadStage | undefined;
    let taskCreated: CRMTask | undefined;
    let notificationMessage = '';

    // 1. Manejo de Mensajes (Auto-Envío o Sugerencia)
    const rawTemplate = rule.action_payload?.message_template || '';
    const personalizedText = this.personalizeMessage(rawTemplate, conversation);

    if (rule.action_type === 'send_auto_reply' && shouldAutoSend) {
      // Envío automático al chat
      const newMessage = await CRMStorageService.insertMessage(conversation.id, {
        conversation_id: conversation.id,
        sender_type: 'operator',
        sender_name: 'Bot EventPix (Automatización)',
        content: personalizedText,
        status: 'sent',
        message_type: 'business_initiated'
      });
      autoMessageSent = newMessage || undefined;
      notificationMessage = `⚡ Auto-respuesta despachada al cliente "${conversation.lead.name}".`;
    } else if (rule.action_type === 'suggest_ai_response' || !shouldAutoSend) {
      // Modo Asistido / Sugerencia Humana
      suggestedText = personalizedText;
      notificationMessage = `💡 Sugerencia lista para aprobación: regla "${rule.name}".`;
    }

    // 2. Actualización de Etapa en el Embudo (Pipeline)
    const targetStage = rule.action_payload?.target_stage;
    if (targetStage && targetStage !== conversation.lead.stage) {
      await CRMStorageService.updateLeadStage(businessId, conversation.lead.id, targetStage);
      stageUpdated = targetStage;
    }

    // 3. Creación de Tarea de Seguimiento o Notificación de Vendedor
    if (rule.action_type === 'create_task' || rule.action_type === 'notify_seller' || rule.action_payload?.task_title) {
      const title = rule.action_payload?.task_title || `Seguimiento automático: ${conversation.lead.name}`;
      const [newTask] = await CRMStorageService.createTask({
        business_id: businessId,
        lead_id: conversation.lead.id,
        lead_name: conversation.lead.name,
        title,
        due_date: new Date(Date.now() + 24 * 3600000).toISOString(),
        is_completed: false,
        assigned_to: conversation.lead.assigned_to || 'Asesor Comercial',
        priority: rule.action_type === 'notify_seller' ? 'high' : 'medium'
      });
      taskCreated = newTask;
    }

    // 4. Registrar en Auditoría de Automatizaciones (Log)
    const log: CRMAutomationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      rule_id: rule.id,
      rule_name: rule.name,
      trigger_event: rule.trigger_event,
      lead_id: conversation.lead.id,
      lead_name: conversation.lead.name,
      action_type: rule.action_type,
      action_summary: autoMessageSent 
        ? `Mensaje enviado: "${autoMessageSent.content.slice(0, 45)}..."`
        : suggestedText 
        ? `Sugerencia preparada: "${suggestedText.slice(0, 45)}..."`
        : taskCreated 
        ? `Tarea creada: "${taskCreated.title}"`
        : `Etapa actualizada a ${targetStage}`,
      executed_at: new Date().toISOString(),
      requires_human_approval: rule.requires_human_approval,
      status: shouldAutoSend ? 'executed' : 'suggested'
    };

    this.saveLogLocally(log);

    return {
      success: true,
      rule,
      requiresHumanApproval: !shouldAutoSend,
      autoMessageSent,
      suggestedText,
      stageUpdated,
      taskCreated,
      notificationMessage,
      log
    };
  }

  /**
   * Reemplaza variables en la plantilla de mensaje
   */
  private static personalizeMessage(template: string, conversation: CRMConversation): string {
    if (!template) return '';
    const leadName = conversation.lead.name.split(' ')[0] || 'Hola';
    const interest = conversation.lead.primary_interest || 'pantallas verticales';
    
    return template
      .replace(/{nombre}/gi, leadName)
      .replace(/{interes}/gi, interest)
      .replace(/{vendedor}/gi, conversation.lead.assigned_to || 'Shop de Plumas');
  }

  // =========================================================================
  // 3. GESTIÓN DEL HISTORIAL DE AUDITORÍA (LOGS)
  // =========================================================================

  static loadLogs(): CRMAutomationLog[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.AUTOMATION_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading automation logs', e);
    }
    return [];
  }

  static saveLogLocally(log: CRMAutomationLog): void {
    try {
      const current = this.loadLogs();
      const updated = [log, ...current].slice(0, 50); // Guardamos los últimos 50 eventos
      localStorage.setItem(LOCAL_STORAGE_KEYS.AUTOMATION_LOGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving automation log', e);
    }
  }

  static clearLogs(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTOMATION_LOGS);
    } catch (e) {
      console.error('Error clearing automation logs', e);
    }
  }
}
