// ================================================================
// CRMStorageService.ts
// Capa de Persistencia Híbrida para CRM, Leads, Conversaciones y Automatizaciones
// EventPix Intelligence — SaaS Platform
// ================================================================

import { supabase } from '../../lib/supabase';
import { CRMConversation, CRMAutomationRule, CRMTask, LeadStage, CRMMessage, CRMLead } from '../../types/crm';
import { INITIAL_CRM_RULES, INITIAL_CRM_CONVERSATIONS } from './mockCRMData';

const LOCAL_STORAGE_KEYS = {
  CONVERSATIONS: 'eventpix_crm_conversations',
  RULES: 'eventpix_crm_rules',
  TASKS: 'eventpix_crm_tasks',
};

export class CRMStorageService {
  private static isSupabaseAvailable = false;
  private static checkedSupabase = false;

  private static async testSupabase(): Promise<boolean> {
    if (this.checkedSupabase) return this.isSupabaseAvailable;
    try {
      const { error } = await supabase.from('intelligence_crm_leads').select('id').limit(1);
      this.isSupabaseAvailable = !error;
    } catch {
      this.isSupabaseAvailable = false;
    }
    this.checkedSupabase = true;
    return this.isSupabaseAvailable;
  }

  // =========================================================================
  // 1. CONVERSACIONES & LEADS
  // =========================================================================

  static async loadConversations(businessId?: string): Promise<CRMConversation[]> {
    const isSupa = await this.testSupabase();

    if (isSupa && businessId) {
      try {
        const { data, error } = await supabase
          .from('intelligence_crm_conversations')
          .select(`
            *,
            lead:intelligence_crm_leads(*)
          `)
          .eq('business_id', businessId)
          .order('updated_at', { ascending: false });

        // Supabase respondió: confiamos en su resultado tal cual, incluso si
        // está vacío (negocio real sin conversaciones todavía). Antes, un
        // array vacío caía al fallback demo y un cliente real veía
        // conversaciones inventadas en su propio panel.
        if (!error && data) {
          return data as CRMConversation[];
        }
      } catch (err) {
        console.warn('Fallback to local storage for CRM conversations:', err);
      }
    }

    // Sin negocio real: modo demo/preview (no debería ocurrir en producción,
    // todos los llamadores reales pasan businessId).
    if (!businessId) {
      return INITIAL_CRM_CONVERSATIONS;
    }

    // Supabase no disponible: fallback a caché local aislada a ESTE negocio.
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEYS.CONVERSATIONS}_${businessId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CRMConversation[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading conversations from localStorage', e);
    }

    return [];
  }

  static async saveConversations(businessId: string, conversations: CRMConversation[]): Promise<void> {
    this.saveConversationsLocally(businessId, conversations);

    const isSupa = await this.testSupabase();
    if (!isSupa || !businessId) return;

    try {
      for (const conv of conversations) {
        // Upsert Lead
        await supabase.from('intelligence_crm_leads').upsert({
          id: conv.lead.id,
          business_id: businessId,
          name: conv.lead.name,
          phone: conv.lead.phone,
          instagram_username: conv.lead.instagram_username,
          channel: conv.lead.channel,
          stage: conv.lead.stage,
          intent_score: conv.lead.intent_score,
          intent_label: conv.lead.intent_label,
          primary_interest: conv.lead.primary_interest,
          estimated_value: conv.lead.estimated_value,
          source: conv.lead.source,
          tags: conv.lead.tags,
          notes: conv.lead.notes,
          assigned_to: conv.lead.assigned_to,
          last_interaction_at: conv.lead.last_interaction_at,
          updated_at: new Date().toISOString()
        });

        // Upsert Conversation
        await supabase.from('intelligence_crm_conversations').upsert({
          id: conv.id,
          business_id: businessId,
          lead_id: conv.lead.id,
          channel: conv.channel,
          unread_count: conv.unread_count,
          ai_mode: conv.ai_mode,
          ai_summary: conv.ai_summary,
          ai_detected_intent: conv.ai_detected_intent,
          ai_purchase_intent_score: conv.ai_purchase_intent_score,
          messaging_window: conv.messaging_window,
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error syncing CRM conversations to Supabase:', err);
    }
  }

  private static saveConversationsLocally(businessId: string, conversations: CRMConversation[]): void {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEYS.CONVERSATIONS}_${businessId}`, JSON.stringify(conversations));
    } catch (e) {
      console.error('Error saving conversations to localStorage', e);
    }
  }

  // Las tres funciones de abajo antes operaban sobre un array cargado sin
  // businessId (loadConversations() sin argumento), lo que las hacía
  // trabajar sobre datos demo/fantasma en vez del negocio real: la etapa
  // del lead, el score y hasta las respuestas del operador quedaban solo en
  // un cache local sin scopear, nunca llegaban a Supabase, y por eso el
  // polling de mensajes reales (loadMessages) las hacía "desaparecer" a los
  // 15 segundos. Ahora escriben directo en Supabase, scopeadas al negocio.

  static async updateLeadStage(businessId: string, leadId: string, newStage: LeadStage): Promise<boolean> {
    const isSupa = await this.testSupabase();
    if (!isSupa) return false;
    try {
      const { error } = await supabase
        .from('intelligence_crm_leads')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('business_id', businessId);
      return !error;
    } catch (err) {
      console.error('Error actualizando etapa del lead en Supabase:', err);
      return false;
    }
  }

  static async updateLeadScore(businessId: string, leadId: string, newScore: number): Promise<boolean> {
    let label: CRMLead['intent_label'] = 'Curiosidad';
    if (newScore >= 80) label = 'Listo para Comprar';
    else if (newScore >= 60) label = 'Alta Intención';
    else if (newScore >= 40) label = 'Interesado';

    const isSupa = await this.testSupabase();
    if (!isSupa) return false;
    try {
      const { error } = await supabase
        .from('intelligence_crm_leads')
        .update({ intent_score: newScore, intent_label: label, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('business_id', businessId);
      return !error;
    } catch (err) {
      console.error('Error actualizando score del lead en Supabase:', err);
      return false;
    }
  }

  // Inserta un mensaje real (respuesta del operador o auto-respuesta de una
  // automatización) en la misma tabla que llena el webhook, y limpia el
  // contador de no leídos. Es lo que hace que la respuesta sobreviva al
  // siguiente polling de loadMessages en vez de desaparecer.
  static async insertMessage(conversationId: string, message: Omit<CRMMessage, 'id' | 'created_at'>): Promise<CRMMessage | null> {
    const isSupa = await this.testSupabase();
    if (!isSupa) return null;
    try {
      const { data, error } = await supabase
        .from('intelligence_crm_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: message.sender_type,
          sender_name: message.sender_name,
          content: message.content,
          status: message.status,
          message_type: message.message_type,
          ai_metadata: message.ai_metadata || null
        })
        .select('*')
        .single();

      if (error || !data) return null;

      await supabase
        .from('intelligence_crm_conversations')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_type: data.sender_type,
        sender_name: data.sender_name || undefined,
        content: data.content,
        status: data.status,
        message_type: data.message_type,
        ai_metadata: data.ai_metadata,
        created_at: data.created_at
      };
    } catch (err) {
      console.error('Error insertando mensaje real en Supabase:', err);
      return null;
    }
  }

  // =========================================================================
  // 2. AUTOMATIZACIONES (RULES)
  // =========================================================================
  // Estas reglas las tiene que poder leer también el webhook del bot
  // (corre en el servidor, sin sesión de navegador), así que viven en
  // Supabase scopeadas por negocio — no alcanza con localStorage.

  static async loadRules(businessId?: string): Promise<CRMAutomationRule[]> {
    const isSupa = await this.testSupabase();

    if (isSupa && businessId) {
      try {
        const { data, error } = await supabase
          .from('intelligence_crm_automations')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((row: any): CRMAutomationRule => ({
            id: row.id,
            business_id: row.business_id,
            name: row.name,
            description: row.description || '',
            trigger_event: row.trigger_event,
            trigger_keyword: row.trigger_keyword || undefined,
            action_type: row.action_type,
            action_payload: row.action_payload || {},
            requires_human_approval: row.requires_human_approval,
            is_active: row.is_active
          }));
        }
      } catch (err) {
        console.warn('Fallback to local storage for CRM rules:', err);
      }
    }

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.RULES);
      if (stored) {
        const parsed = JSON.parse(stored) as CRMAutomationRule[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading rules from localStorage', e);
    }

    this.saveRulesLocally(INITIAL_CRM_RULES);
    return INITIAL_CRM_RULES;
  }

  static async resetDefaultRules(): Promise<CRMAutomationRule[]> {
    this.saveRulesLocally(INITIAL_CRM_RULES);
    return INITIAL_CRM_RULES;
  }

  static async saveRules(businessId: string, rules: CRMAutomationRule[]): Promise<void> {
    this.saveRulesLocally(rules);

    const isSupa = await this.testSupabase();
    if (!isSupa || !businessId) return;

    try {
      const { data: existing } = await supabase
        .from('intelligence_crm_automations')
        .select('id')
        .eq('business_id', businessId);

      const currentIds = new Set(rules.map(r => r.id));
      const idsToDelete = (existing || [])
        .map((r: any) => r.id)
        .filter((id: string) => !currentIds.has(id));
      if (idsToDelete.length > 0) {
        await supabase.from('intelligence_crm_automations').delete().in('id', idsToDelete);
      }

      for (const rule of rules) {
        // IDs generados en el navegador (ej. "rule_1234") no son UUID válidos:
        // dejamos que Supabase genere el suyo en el primer guardado.
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rule.id);
        await supabase.from('intelligence_crm_automations').upsert({
          ...(isValidUuid ? { id: rule.id } : {}),
          business_id: businessId,
          name: rule.name,
          description: rule.description,
          trigger_event: rule.trigger_event,
          trigger_keyword: rule.trigger_keyword,
          action_type: rule.action_type,
          action_payload: rule.action_payload,
          requires_human_approval: rule.requires_human_approval,
          is_active: rule.is_active
        });
      }
    } catch (err) {
      console.error('Error syncing CRM rules to Supabase:', err);
    }
  }

  private static saveRulesLocally(rules: CRMAutomationRule[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.RULES, JSON.stringify(rules));
    } catch (e) {
      console.error('Error saving rules to localStorage', e);
    }
  }

  // =========================================================================
  // 2b. MENSAJES REALES DE UNA CONVERSACIÓN (incluye los que llegan por el
  //     webhook del bot, no solo los enviados desde esta pantalla)
  // =========================================================================

  static async loadMessages(conversationId: string): Promise<CRMMessage[]> {
    const isSupa = await this.testSupabase();
    if (!isSupa || !conversationId) return [];

    try {
      const { data, error } = await supabase
        .from('intelligence_crm_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((row: any): CRMMessage => ({
        id: row.id,
        conversation_id: row.conversation_id,
        sender_type: row.sender_type,
        sender_name: row.sender_name || undefined,
        content: row.content,
        status: row.status,
        message_type: row.message_type,
        ai_metadata: row.ai_metadata,
        created_at: row.created_at
      }));
    } catch (err) {
      console.warn('No se pudieron cargar mensajes reales de Supabase:', err);
      return [];
    }
  }

  // =========================================================================
  // 3. TAREAS & SEGUIMIENTO (FOLLOW-UP)
  // =========================================================================

  static async loadTasks(_businessId?: string): Promise<CRMTask[]> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.TASKS);
      if (stored) {
        return JSON.parse(stored) as CRMTask[];
      }
    } catch (e) {
      console.error('Error reading tasks from localStorage', e);
    }

    // Sin tareas por defecto (0-base)
    return [];
  }

  static toggleTaskCompleted(taskId: string): Promise<CRMTask[]> {
    return this.loadTasks().then(current => {
      const updated = current.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t);
      this.saveTasksLocally(updated);
      return updated;
    });
  }

  static async createTask(task: Omit<CRMTask, 'id' | 'created_at'>): Promise<CRMTask[]> {
    const current = await this.loadTasks();
    const newTask: CRMTask = {
      ...task,
      id: `task_${Date.now()}`,
      created_at: new Date().toISOString()
    };
    const updated = [newTask, ...current];
    this.saveTasksLocally(updated);
    return updated;
  }

  static async saveTasks(tasks: CRMTask[]): Promise<void> {
    this.saveTasksLocally(tasks);
  }

  private static saveTasksLocally(tasks: CRMTask[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error saving tasks to localStorage', e);
    }
  }

  static clearAllData(businessId: string): void {
    try {
      // Legacy sin scopear (versiones viejas)
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CONVERSATIONS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.TASKS);
      // Cache real de este negocio. Deliberadamente NO borramos conversaciones,
      // leads ni mensajes reales de Supabase acá: son comunicaciones reales de
      // clientes, no datos demo, y no deben poder perderse con un botón de reset.
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.CONVERSATIONS}_${businessId}`);
    } catch (e) {
      console.error('Error clearing CRM data', e);
    }
  }
}
