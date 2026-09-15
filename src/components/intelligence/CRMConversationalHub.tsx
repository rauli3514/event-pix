// ================================================================
// CRMConversationalHub.tsx
// Bandeja de Entrada Centralizada, Pipeline y Automatización IA
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState, useMemo } from 'react';
import {
  MessageSquare, Users, Sparkles, Send,
  Clock, ShieldAlert, Check,
  Search, ArrowRight, AlertTriangle,
  X, Instagram, PhoneCall, Zap, Plus, Edit2,
  Trash2, Play, DollarSign, Flame, Activity, ShieldCheck, RotateCcw
} from 'lucide-react';
import {
  CRMConversation,
  CRMAutomationRule,
  CRMTask,
  CRMMessage,
  LeadStage,
  CRMChannel,
  CommercialOpportunity,
  CRMAutomationLog
} from '../../types/crm';
import { CRMIntelligenceEngine } from '../../services/intelligence/CRMIntelligenceEngine';
import { CRMStorageService } from '../../services/intelligence/CRMStorageService';
import { INITIAL_CRM_CONVERSATIONS } from '../../services/intelligence/mockCRMData';
import { BrandDNA } from '../../types/intelligence';
import { AutomationRuleBuilderModal } from './AutomationRuleBuilderModal';
import { ConnectionStorageService } from '../../services/intelligence/ConnectionStorageService';
import { WhatsAppCloudService } from '../../services/meta/WhatsAppCloudService';
import { AIProviderService } from '../../services/intelligence/AIProviderService';
import { AutomationEngineService } from '../../services/intelligence/AutomationEngineService';
import { UnifiedConnectionsState } from '../../types/connections';
import { toast } from 'sonner';

interface CRMConversationalHubProps {
  isOpen: boolean;
  onClose: () => void;
  brandDna?: BrandDNA;
  onNavigateToPost?: (postId: string) => void;
  businessId?: string;
}

export const CRMConversationalHub: React.FC<CRMConversationalHubProps> = ({
  isOpen,
  onClose,
  brandDna,
  onNavigateToPost,
  businessId = 'biz_default'
}) => {
  const [conversations, setConversations] = useState<CRMConversation[]>([]);
  const [rules, setRules] = useState<CRMAutomationRule[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [automationLogs, setAutomationLogs] = useState<CRMAutomationLog[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'opportunities' | 'pipeline' | 'automations' | 'attribution'>('inbox');
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<CRMAutomationRule> | null>(null);
  const [activeTriggerAlert, setActiveTriggerAlert] = useState<{
    ruleName: string;
    reason: string;
    actionText: string;
    template?: string;
    isAutoSent: boolean;
  } | null>(null);
  
  // Filtros de Inbox
  const [channelFilter, setChannelFilter] = useState<'all' | CRMChannel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');

  // Input de mensaje y edición de sugerencia IA
  const [messageInput, setMessageInput] = useState('');
  const [isEditingSuggestion, setIsEditingSuggestion] = useState(false);
  const [customSuggestionText, setCustomSuggestionText] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');

  // Motor de IA en vivo para respuestas de CRM (Claude Sonnet 4.6 vs GPT-4o)
  const [selectedAIProvider, setSelectedAIProvider] = useState<'claude' | 'openai'>('claude');
  const [isGeneratingLiveAI, setIsGeneratingLiveAI] = useState(false);
  const [liveAIResult, setLiveAIResult] = useState<{
    reply: string;
    reasoning: string;
    intent: string;
    providerUsed: string;
  } | null>(null);

  // Panel de simulación de objeciones y clientes
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [customInquiryInput, setCustomInquiryInput] = useState('');

  // Conexiones unificadas (WhatsApp, Shop de Plumas, OpenAI, Claude)
  const [connections, setConnections] = useState<UnifiedConnectionsState>(() =>
    ConnectionStorageService.loadConnections(businessId)
  );

  // Cargar datos iniciales y refrescar conexiones al abrir
  React.useEffect(() => {
    let isMounted = true;
    async function loadData() {
      const convs = await CRMStorageService.loadConversations();
      const r = await CRMStorageService.loadRules();
      const t = await CRMStorageService.loadTasks();
      const logs = AutomationEngineService.loadLogs();
      const conns = ConnectionStorageService.loadConnections(businessId);
      if (!isMounted) return;
      setConversations(convs);
      setRules(r);
      setTasks(t);
      setAutomationLogs(logs);
      setConnections(conns);
      if (convs.length > 0 && !selectedConvId) {
        setSelectedConvId(convs[0].id);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedConvId, businessId, isOpen]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedConvId) || conversations[0] || null;
  }, [conversations, selectedConvId]);

  const lastLeadMessage = useMemo(() => {
    if (!activeConversation) return null;
    const msgs = activeConversation.messages && activeConversation.messages.length > 0
      ? activeConversation.messages
      : (activeConversation.last_message ? [activeConversation.last_message] : []);
    return msgs.slice().reverse().find(m => m.sender_type === 'lead') || null;
  }, [activeConversation]);

  // Sugerencia de IA activa permanente (incluso si el operador ya envió mensajes previos)
  const activeAISuggestion = useMemo(() => {
    if (!activeConversation) return null;

    // Si la IA en vivo (Claude / OpenAI) generó un resultado, tiene prioridad máxima
    if (liveAIResult) {
      return liveAIResult;
    }

    if (lastLeadMessage?.ai_metadata?.suggested_reply) {
      return {
        reply: lastLeadMessage.ai_metadata.suggested_reply,
        reasoning: lastLeadMessage.ai_metadata.reasoning || 'El cliente demostró alto interés en pantallas verticales.',
        intent: lastLeadMessage.ai_metadata.detected_intent || 'Solicitud de Presupuesto',
        providerUsed: 'IA Sugerida'
      };
    }

    const catalogProducts = connections.shopDePlumas.status === 'connected'
      ? connections.shopDePlumas.syncedProducts
      : [];

    const generated = CRMIntelligenceEngine.generateAISuggestion(
      lastLeadMessage?.content || activeConversation.lead.primary_interest || 'Cotización de pantalla vertical',
      activeConversation.lead,
      brandDna,
      catalogProducts
    );

    return {
      reply: generated.suggestedReply,
      reasoning: generated.reasoning,
      intent: generated.detectedIntent,
      providerUsed: 'Motor Determinístico'
    };
  }, [activeConversation, lastLeadMessage, connections.shopDePlumas, brandDna, liveAIResult]);

  const funnelMetrics = useMemo(() => {
    return CRMIntelligenceEngine.calculateFunnelMetrics(conversations);
  }, [conversations]);

  // Conversaciones filtradas
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
      if (stageFilter !== 'all' && c.lead.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.lead.name.toLowerCase().includes(q);
        const matchPhone = c.lead.phone?.includes(q) || false;
        const matchIg = c.lead.instagram_username?.toLowerCase().includes(q) || false;
        const matchInterest = c.lead.primary_interest?.toLowerCase().includes(q) || false;
        return matchName || matchPhone || matchIg || matchInterest;
      }
      return true;
    });
  }, [conversations, channelFilter, stageFilter, searchQuery]);

  // Cambiar etapa del Lead
  const handleStageChange = async (newStage: LeadStage) => {
    if (!activeConversation) return;
    const updated = await CRMStorageService.updateLeadStage(activeConversation.id, newStage);
    setConversations(updated);
    toast.success(`Lead movido a etapa: ${newStage.toUpperCase()}`);
  };

  // Guardar nuevo número de teléfono para el lead (para pruebas reales)
  const handleSavePhone = async () => {
    if (!activeConversation || !phoneDraft.trim()) return;
    const cleanNumber = phoneDraft.trim();
    const updatedConvs = conversations.map(c => {
      if (c.id === activeConversation.id) {
        return {
          ...c,
          lead: { ...c.lead, phone: cleanNumber }
        };
      }
      return c;
    });
    setConversations(updatedConvs);
    await CRMStorageService.saveConversations(businessId, updatedConvs);
    setIsEditingPhone(false);
    toast.success(`Número actualizado a: ${cleanNumber}`);
  };

  // Generar respuesta en vivo con el motor de IA real (Claude Sonnet 4.6 o GPT-4o)
  const handleGenerateLiveAIReply = async (customInquiry?: string, forceProvider?: 'claude' | 'openai') => {
    if (!activeConversation) return;

    const providerToUse = forceProvider || selectedAIProvider;
    setIsGeneratingLiveAI(true);
    const msgs = activeConversation.messages && activeConversation.messages.length > 0
      ? activeConversation.messages
      : (activeConversation.last_message ? [activeConversation.last_message] : []);

    const catalogProducts = connections.shopDePlumas.status === 'connected'
      ? connections.shopDePlumas.syncedProducts
      : [];

    const inquiryToUse = customInquiry || lastLeadMessage?.content || activeConversation.lead.primary_interest || 'Cotización de pantalla vertical';

    toast.info(`🧠 ${providerToUse === 'claude' ? 'Claude Sonnet 4.6' : 'GPT-4o'} analizando la consulta...`);

    try {
      const res = await AIProviderService.generateCRMReply({
        lead: activeConversation.lead,
        chatHistory: msgs,
        brandDna,
        catalogProducts,
        connections,
        clientInquiry: inquiryToUse,
        overrideProvider: providerToUse
      });

      setLiveAIResult({
        reply: res.suggestedReply,
        reasoning: res.reasoning,
        intent: res.detectedIntent,
        providerUsed: res.providerUsed
      });

      if (res.updatedScore && res.updatedScore !== activeConversation.lead.intent_score) {
        const updated = await CRMStorageService.updateLeadScore(activeConversation.lead.id, res.updatedScore);
        setConversations(updated);
      }

      toast.success(`✨ Respuesta redactada por ${res.providerUsed}`);
    } catch (err: any) {
      toast.error('Error al generar respuesta con IA.');
    } finally {
      setIsGeneratingLiveAI(false);
    }
  };

  // Simular un mensaje entrante del cliente para probar el motor de IA y el embudo
  const handleSimulateClientInquiry = async (inquiryText: string) => {
    if (!activeConversation || !inquiryText.trim()) return;

    const newInquiry: CRMMessage = {
      id: `msg_sim_${Date.now()}`,
      conversation_id: activeConversation.id,
      sender_type: 'lead',
      sender_name: activeConversation.lead.name,
      content: inquiryText.trim(),
      status: 'received',
      message_type: 'incoming',
      created_at: new Date().toISOString()
    };

    const updatedConvs = conversations.map(c => {
      if (c.id === activeConversation.id) {
        const prev = c.messages && c.messages.length > 0
          ? c.messages
          : (c.last_message ? [c.last_message] : []);
        return {
          ...c,
          unread_count: (c.unread_count || 0) + 1,
          messages: [...prev, newInquiry],
          last_message: newInquiry,
          updated_at: new Date().toISOString()
        };
      }
      return c;
    });

    setConversations(updatedConvs);
    await CRMStorageService.saveConversations(businessId, updatedConvs);
    setCustomInquiryInput('');
    toast.info(`Cliente "${activeConversation.lead.name}" consultó: "${inquiryText.slice(0, 30)}..."`);

    // Evaluar disparadores automáticos en tiempo real
    const matchedTriggers = AutomationEngineService.evaluateIncomingMessage(
      inquiryText.trim(),
      activeConversation,
      rules
    );

    let wasAutoReplied = false;

    if (matchedTriggers.length > 0) {
      for (const match of matchedTriggers) {
        const execRes = await AutomationEngineService.executeRule(
          match.rule,
          activeConversation,
          businessId
        );

        setActiveTriggerAlert({
          ruleName: match.rule.name,
          reason: match.matchedReason,
          actionText: execRes.log.action_summary,
          template: match.rule.action_payload?.message_template,
          isAutoSent: !match.rule.requires_human_approval && match.rule.action_type === 'send_auto_reply'
        });

        if (execRes.autoMessageSent) {
          toast.success(`⚡ Automatización "${match.rule.name}": Auto-respuesta despachada.`);
          wasAutoReplied = true;
          // Despacho por WhatsApp Cloud API si está conectado
          if (
            activeConversation.channel === 'whatsapp' &&
            connections.whatsapp.status === 'connected' &&
            connections.whatsapp.accessToken &&
            connections.whatsapp.phoneNumberId &&
            activeConversation.lead.phone
          ) {
            WhatsAppCloudService.sendMessage(
              connections.whatsapp.accessToken,
              connections.whatsapp.phoneNumberId,
              activeConversation.lead.phone,
              execRes.autoMessageSent.content
            ).catch(console.error);
          }
        } else if (execRes.suggestedText) {
          setMessageInput(execRes.suggestedText);
          toast.info(`⚡ Regla "${match.rule.name}": Sugerencia comercial preparada.`);
        }

        if (execRes.taskCreated) {
          toast.warning(`📋 Tarea comercial creada: "${execRes.taskCreated.title}"`);
        }
      }

      // Refrescar conversaciones, tareas y logs actualizados
      const freshConvs = await CRMStorageService.loadConversations();
      const freshTasks = await CRMStorageService.loadTasks();
      setConversations(freshConvs);
      setTasks(freshTasks);
      setAutomationLogs(AutomationEngineService.loadLogs());
    }

    // Si no hubo auto-respuesta directa, generar recomendación en vivo con la IA
    if (!wasAutoReplied) {
      await handleGenerateLiveAIReply(inquiryText.trim());
    }
  };

  // Enviar mensaje del operador (con despacho real a WhatsApp Cloud API si está configurado)
  const handleSendMessage = async (contentToSend?: string) => {
    const text = contentToSend || messageInput;
    if (!text.trim() || !activeConversation) return;

    const { updated } = await CRMStorageService.sendMessage(activeConversation.id, {
      conversation_id: activeConversation.id,
      sender_type: 'operator',
      sender_name: 'Asesor Comercial',
      content: text.trim(),
      status: 'sent',
      message_type: 'business_initiated'
    });

    setConversations(updated);
    setMessageInput('');
    setIsEditingSuggestion(false);

    // Si el canal es WhatsApp y la API de Meta está conectada, despachamos vía Cloud API real
    let apiDispatched = false;
    if (
      activeConversation.channel === 'whatsapp' &&
      connections.whatsapp.status === 'connected' &&
      connections.whatsapp.accessToken &&
      connections.whatsapp.phoneNumberId
    ) {
      const recipientPhone = activeConversation.lead.phone;
      if (recipientPhone) {
        try {
          const apiRes = await WhatsAppCloudService.sendMessage(
            connections.whatsapp.accessToken,
            connections.whatsapp.phoneNumberId,
            recipientPhone,
            text.trim()
          );
          if (apiRes.success) {
            apiDispatched = true;
            toast.success('🚀 Despachado por WhatsApp Cloud API en tiempo real!');
          } else {
            toast.warning(`Registrado en CRM. Advertencia WhatsApp API: ${apiRes.error}`);
          }
        } catch (err: any) {
          toast.warning(`Registrado en CRM. Error WhatsApp API: ${err.message || 'desconocido'}`);
        }
      } else {
        toast.info('Mensaje registrado en CRM (el lead no tiene número asignado)');
      }
    }

    if (!apiDispatched) {
      toast.success('Mensaje registrado en el CRM.');
    }
  };

  // Toggle de tarea de seguimiento
  const handleToggleTask = async (taskId: string) => {
    const updated = await CRMStorageService.toggleTaskCompleted(taskId);
    setTasks(updated);
    toast.info('Estado de tarea actualizado.');
  };

  // Oportunidades comerciales y automatizaciones recomendadas
  const opportunities = useMemo(() => {
    return CRMIntelligenceEngine.detectCommercialOpportunities(conversations, tasks);
  }, [conversations, tasks]);

  const recommendedAutomations = useMemo(() => {
    return CRMIntelligenceEngine.recommendAutomations(conversations);
  }, [conversations]);

  // Guardar regla desde el constructor
  const handleSaveRule = async (newRule: CRMAutomationRule) => {
    const exists = rules.some(r => r.id === newRule.id);
    const updated = exists
      ? rules.map(r => r.id === newRule.id ? newRule : r)
      : [newRule, ...rules];
    setRules(updated);
    await CRMStorageService.saveRules(businessId, updated);
    toast.success(`Automatización "${newRule.name}" guardada y activa.`);
  };

  // Probar una regla en vivo sobre la conversación activa
  const handleTestRule = async (rule: CRMAutomationRule) => {
    if (!activeConversation) {
      toast.error('No hay una conversación activa seleccionada para probar la regla.');
      return;
    }

    try {
      const result = await AutomationEngineService.executeRule(
        rule,
        activeConversation,
        businessId,
        { forceImmediate: !rule.requires_human_approval }
      );

      // Refrescar estado global
      const freshConvs = await CRMStorageService.loadConversations();
      const freshTasks = await CRMStorageService.loadTasks();
      setConversations(freshConvs);
      setTasks(freshTasks);
      setAutomationLogs(AutomationEngineService.loadLogs());

      setActiveTriggerAlert({
        ruleName: rule.name,
        reason: `Prueba en vivo con ${activeConversation.lead.name}`,
        actionText: result.log.action_summary,
        template: rule.action_payload?.message_template,
        isAutoSent: !rule.requires_human_approval && rule.action_type === 'send_auto_reply'
      });

      if (result.autoMessageSent) {
        toast.success(`⚡ ¡Regla probada! Auto-mensaje enviado a "${activeConversation.lead.name}".`);
      } else if (result.suggestedText) {
        setMessageInput(result.suggestedText);
        toast.info(`💡 Sugerencia generada por "${rule.name}" y lista en el chat.`);
      }

      if (result.stageUpdated) {
        toast.success(`🎯 Lead movido a la etapa "${result.stageUpdated.toUpperCase()}".`);
      }

      if (result.taskCreated) {
        toast.warning(`📋 Tarea creada: "${result.taskCreated.title}".`);
      }
    } catch (e: any) {
      toast.error('Error al probar la automatización.');
    }
  };

  // Eliminar una regla
  const handleDeleteRule = async (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    setRules(updated);
    await CRMStorageService.saveRules(businessId, updated);
    toast.success('Automatización eliminada.');
  };

  // Restaurar reglas comerciales recomendadas de Shop de Plumas
  const handleResetDefaultRules = async () => {
    const defaults = await CRMStorageService.resetDefaultRules();
    setRules(defaults);
    toast.success('Reglas comerciales oficiales de Shop de Plumas restauradas.');
  };

  // Limpiar historial de auditoría
  const handleClearAutomationLogs = () => {
    AutomationEngineService.clearLogs();
    setAutomationLogs([]);
    toast.info('Historial de ejecuciones limpiado.');
  };

  // Acción rápida desde tarjeta de oportunidad
  const handleActionOpportunity = async (opp: CommercialOpportunity) => {
    if (opp.suggested_action_type === 'create_task' && opp.lead_id && opp.lead_name) {
      const updatedTasks = await CRMStorageService.createTask({
        business_id: 'biz_default',
        lead_id: opp.lead_id,
        lead_name: opp.lead_name,
        title: `Seguimiento prioritario: ${opp.lead_name}`,
        due_date: new Date(Date.now() + 24 * 3600000).toISOString(),
        is_completed: false,
        assigned_to: 'Ventas EventPix',
        priority: opp.severity === 'high' ? 'high' : 'medium'
      });
      setTasks(updatedTasks);
      toast.success(`Tarea de seguimiento creada para ${opp.lead_name}`);
    } else if (opp.suggested_action_type === 'open_chat' && opp.lead_id) {
      const conv = conversations.find(c => c.lead.id === opp.lead_id);
      if (conv) {
        setSelectedConvId(conv.id);
        setActiveTab('inbox');
      }
    } else if (opp.suggested_action_type === 'view_content' && opp.post_id) {
      if (onNavigateToPost) {
        onNavigateToPost(opp.post_id);
      } else {
        toast.info(`Contenido destacado: ${opp.post_id}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-7xl h-[92vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* HEADER DEL CRM HUB */}
        <div className="h-16 px-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight uppercase">EventPix CRM Conversacional</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  Meta + WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inteligencia → Conversación → Conversión
              </p>
            </div>
          </div>

          {/* Selector de Vistas */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'inbox' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Bandeja ({conversations.reduce((sum, c) => sum + c.unread_count, 0)})
            </button>
            <button
              onClick={() => setActiveTab('opportunities')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all relative ${
                activeTab === 'opportunities' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Oportunidades & Alertas
              {opportunities.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                  {opportunities.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'pipeline' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Pipeline ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('automations')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'automations' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Automatizaciones
              {rules.filter(r => r.is_active).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                  {rules.filter(r => r.is_active).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('attribution')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'attribution' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Atribución de Ventas
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUERPO PRINCIPAL SEGÚN PESTAÑA */}
        <div className="flex-1 flex overflow-hidden">

          {/* ========================================================================= */}
          {/* TAB 1: INBOX CON LAS 3 COLUMNAS (DISEÑO ESPECIFICADO) */}
          {/* ========================================================================= */}
          {activeTab === 'inbox' && (
            <>
              {/* COLUMNA 1: LISTA DE CONVERSACIONES */}
              <div className="w-80 lg:w-96 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
                {/* Filtros rápidos de Canal */}
                <div className="p-3 border-b border-slate-800/80 space-y-2.5 bg-slate-900/40">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, teléfono o rubro..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      onClick={() => setChannelFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        channelFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setChannelFilter('whatsapp')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                        channelFilter === 'whatsapp' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-emerald-300'
                      }`}
                    >
                      <PhoneCall className="w-3 h-3 text-emerald-400" /> WhatsApp
                    </button>
                    <button
                      onClick={() => setChannelFilter('instagram_dm')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                        channelFilter === 'instagram_dm' ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40' : 'text-slate-400 hover:text-pink-300'
                      }`}
                    >
                      <Instagram className="w-3 h-3 text-pink-400" /> Instagram
                    </button>
                  </div>

                  {/* Filtro por Etapa */}
                  <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-1 custom-scrollbar">
                    {(['all', 'nuevo', 'interesado', 'presupuesto', 'ganado'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => setStageFilter(st)}
                        className={`px-2 py-0.5 rounded-md uppercase font-semibold shrink-0 transition-colors ${
                          stageFilter === st ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {st === 'all' ? 'Etapas' : st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista Scrolleable */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 custom-scrollbar">
                  {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                        <MessageSquare className="w-6 h-6 text-slate-500" />
                      </div>
                      <p className="text-xs font-bold text-slate-300">Bandeja de entrada vacía</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Los mensajes de clientes de WhatsApp y DMs aparecerán aquí en tiempo real cuando vincules tus canales.
                      </p>
                      {(channelFilter !== 'all' || stageFilter !== 'all' || searchQuery.trim() !== '') && (
                        <button
                          onClick={() => {
                            setChannelFilter('all');
                            setStageFilter('all');
                            setSearchQuery('');
                          }}
                          className="mt-2 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                        >
                          Restablecer Filtros (Ver Todos)
                        </button>
                      )}

                      {conversations.length === 0 && (
                        <div>
                          <button
                            onClick={async () => {
                              await CRMStorageService.saveConversations(businessId, INITIAL_CRM_CONVERSATIONS);
                              setConversations(INITIAL_CRM_CONVERSATIONS);
                              setSelectedConvId(INITIAL_CRM_CONVERSATIONS[0].id);
                              toast.success('Leads de prueba cargados con éxito.');
                            }}
                            className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all inline-flex items-center gap-2 shadow-lg shadow-emerald-950"
                          >
                            🧪 Cargar Leads de Prueba
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredConversations.map(conv => {
                      const isSelected = conv.id === selectedConvId;
                      return (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConvId(conv.id)}
                        className={`p-3.5 cursor-pointer transition-all hover:bg-slate-900/80 ${
                          isSelected ? 'bg-slate-900/90 border-l-4 border-emerald-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {conv.channel === 'whatsapp' ? (
                              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <PhoneCall className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                                <Instagram className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">
                              {conv.lead.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Score de Intención */}
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                              conv.lead.intent_score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              conv.lead.intent_score >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {conv.lead.intent_score} pts
                            </span>
                            {conv.unread_count > 0 && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-1 mb-1.5">
                          {conv.last_message?.content || 'Sin mensajes aún'}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="uppercase font-semibold tracking-wider text-slate-400">
                            {conv.lead.stage}
                          </span>
                          <span>
                            {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>

              {/* COLUMNA 2: CHAT ACTIVO & SUGERENCIA IA CON CONTROL HUMANO */}
              <div className="flex-1 flex flex-col bg-[#0B0F19] relative">
                {activeConversation ? (
                  <>
                    {/* Header del Chat */}
                    <div className="h-14 px-5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                          {activeConversation.lead.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">{activeConversation.lead.name}</span>
                            {isEditingPhone ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={phoneDraft}
                                  onChange={(e) => setPhoneDraft(e.target.value)}
                                  placeholder="+54911..."
                                  className="bg-slate-900 border border-emerald-500 rounded px-2 py-0.5 text-[11px] font-mono text-emerald-300 w-36 focus:outline-none"
                                />
                                <button
                                  onClick={handleSavePhone}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setIsEditingPhone(false)}
                                  className="text-slate-400 hover:text-slate-200 text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {activeConversation.lead.phone || activeConversation.lead.instagram_username}
                                </span>
                                {activeConversation.channel === 'whatsapp' && (
                                  <button
                                    onClick={() => {
                                      setPhoneDraft(activeConversation.lead.phone || '');
                                      setIsEditingPhone(true);
                                    }}
                                    title="Cambiar número para probar con tu propio WhatsApp"
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 underline flex items-center gap-0.5 ml-1"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" /> Cambiar número
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Interés: <strong className="text-slate-300">{activeConversation.lead.primary_interest}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Estado de Canal y Ventana 24h */}
                      <div className="flex items-center gap-2 text-[11px]">
                        {activeConversation.channel === 'whatsapp' && (
                          connections.whatsapp.status === 'connected' ? (
                            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[10px] font-mono">
                              🟢 Meta Cloud API Conectado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-mono" title="Configurá las credenciales en Conectar APIs">
                              ⚪ Simulado (API no vinculada)
                            </span>
                          )
                        )}

                        {activeConversation.messaging_window.is_open ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-xl font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Ventana 24h abierta ({activeConversation.messaging_window.hours_remaining}h restantes)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-xl font-medium" title="Solo plantillas aprobadas permitidas fuera de 24h">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Ventana cerrada (Requiere Plantilla Meta)
                          </span>
                        )}

                        {/* Botón para abrir/cerrar simulador de objeciones */}
                        <button
                          onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
                          className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all text-[11px] border ${
                            isSimulatorOpen
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-900/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                          title="Simular preguntas reales de clientes para probar la IA"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          {isSimulatorOpen ? 'Ocultar Simulador' : '⚡ Probar con Objeciones'}
                        </button>
                      </div>
                    </div>

                    {/* Mensajes del Chat */}
                    <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                      {/* PANEL DESPLEGABLE: SIMULADOR DE OBJECIONES DE CLIENTE */}
                      {isSimulatorOpen && (
                        <div className="bg-gradient-to-b from-amber-950/20 to-slate-950 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                                ⚡
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-amber-300">Simulador de Objeciones del Cliente</h4>
                                <p className="text-[10px] text-slate-400">Hacé click en cualquier objeción para simular la pregunta del cliente y ver a la IA redactar la respuesta en vivo</p>
                              </div>
                            </div>
                            <span className="text-[10px] bg-slate-900 text-amber-400/80 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                              Pruebas en Vivo
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => handleSimulateClientInquiry('¿Cuánto sale la de 55"? En MercadoLibre vi una tele común por $250.000, ¿por qué tanta diferencia?')}
                              className="text-left p-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 rounded-xl transition-all group"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-300 group-hover:text-amber-200">
                                <span>🏷️</span> Objeción: Precio vs TV Común
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                "En MercadoLibre vi una tele por $250.000..."
                              </p>
                            </button>

                            <button
                              onClick={() => handleSimulateClientInquiry('¿Es muy difícil cambiar los videos y promociones desde el celular? No entiendo nada de computadoras.')}
                              className="text-left p-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-[11px] text-cyan-300 group-hover:text-cyan-200">
                                <span>📱</span> Objeción: Dificultad Tecnológica
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                "¿Es difícil cambiar promos desde el cel?..."
                              </p>
                            </button>

                            <button
                              onClick={() => handleSimulateClientInquiry('¿Cómo hacen la instalación en la vidriera de mi local y cuánto tardan en venir?')}
                              className="text-left p-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition-all group"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-300 group-hover:text-emerald-200">
                                <span>🛠️</span> Consulta: Instalación y Plazos
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                "¿Cómo hacen la instalación y cuánto tardan?..."
                              </p>
                            </button>

                            <button
                              onClick={() => handleSimulateClientInquiry('¿Tienen cuotas fijas y hacen Factura A para presentar en la empresa?')}
                              className="text-left p-2.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-violet-500/50 rounded-xl transition-all group"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-[11px] text-violet-300 group-hover:text-violet-200">
                                <span>💳</span> Consulta: Financiación y Factura A
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                "¿Tienen cuotas y hacen Factura A?..."
                              </p>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                            <input
                              type="text"
                              placeholder="O escribí cualquier otra pregunta que haría un cliente real..."
                              value={customInquiryInput}
                              onChange={(e) => setCustomInquiryInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && customInquiryInput.trim() && handleSimulateClientInquiry(customInquiryInput)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => customInquiryInput.trim() && handleSimulateClientInquiry(customInquiryInput)}
                              disabled={!customInquiryInput.trim()}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1 shadow-sm"
                            >
                              <Zap className="w-3 h-3" /> Simular
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Banner de Disparador Automático Activado */}
                      {activeTriggerAlert && (
                        <div className="bg-gradient-to-r from-violet-950/70 via-slate-900 to-indigo-950/70 border border-violet-500/40 rounded-2xl p-3.5 flex items-center justify-between text-xs animate-in fade-in shadow-lg">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
                              <Zap className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-violet-200">
                                  ⚡ Regla Disparada: {activeTriggerAlert.ruleName}
                                </span>
                                {activeTriggerAlert.isAutoSent ? (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                                    Despachado Auto
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                    Requiere Aprobación
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {activeTriggerAlert.reason} → {activeTriggerAlert.actionText}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {activeTriggerAlert.template && !activeTriggerAlert.isAutoSent && (
                              <button
                                onClick={() => {
                                  setMessageInput(activeTriggerAlert.template || '');
                                  toast.success('Plantilla de la regla copiada al mensaje.');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-violet-600/40 hover:bg-violet-600 text-violet-200 text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Cargar al Chat
                              </button>
                            )}
                            <button
                              onClick={() => setActiveTriggerAlert(null)}
                              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                              title="Ocultar aviso"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Aviso y botón para restaurar consulta original si no hay mensajes del lead */}
                      {!lastLeadMessage && (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-[11px] text-slate-400">
                          <span>No hay mensajes entrantes del cliente en este hilo.</span>
                          <button
                            onClick={async () => {
                              const defaultInquiry = {
                                id: `msg_inquiry_${Date.now()}`,
                                conversation_id: activeConversation.id,
                                sender_type: 'lead' as const,
                                sender_name: activeConversation.lead.name,
                                content: 'Hola! Vi el Reel de las pantallas verticales en Instagram y comenté "APP". ¿Me podrán cotizar una pantalla de 55" con soporte para instalar en el local?',
                                status: 'received' as const,
                                message_type: 'incoming' as const,
                                ai_metadata: {
                                  suggested_reply: '¡Hola Martín! Qué bueno saludarte. Sí, para tu local la de 55" con soporte articulado es ideal. El kit completo incluye el reproductor Tanix, soporte y la app para cambiar promos desde el celular. ¿Te gustaría que coordinemos una visita técnica sin cargo para medir la vidriera?',
                                  reasoning: 'El lead demostró alta intención al pedir presupuesto formal. Se sugiere cerrar con visita técnica o cotización formal.',
                                  detected_intent: 'Solicitud de Presupuesto',
                                  confidence: 0.95,
                                  requires_human_approval: true
                                },
                                created_at: new Date(Date.now() - 60000).toISOString()
                              };
                              const updatedConvs = conversations.map(c => {
                                if (c.id === activeConversation.id) {
                                  const prev = c.messages || (c.last_message ? [c.last_message] : []);
                                  return {
                                    ...c,
                                    messages: [defaultInquiry, ...prev],
                                    last_message: defaultInquiry
                                  };
                                }
                                return c;
                              });
                              setConversations(updatedConvs);
                              await CRMStorageService.saveConversations(businessId, updatedConvs);
                              toast.success('Consulta del cliente restaurada.');
                            }}
                            className="px-2.5 py-1 bg-violet-600/30 hover:bg-violet-600/40 text-violet-200 border border-violet-500/30 rounded-lg font-medium transition-colors flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            Restaurar Consulta Inicial de {activeConversation.lead.name}
                          </button>
                        </div>
                      )}

                      {/* Burbujas del Chat (Historial Completo) */}
                      {(() => {
                        const msgs = activeConversation.messages && activeConversation.messages.length > 0
                          ? activeConversation.messages
                          : (activeConversation.last_message ? [activeConversation.last_message] : []);

                        return msgs.map(msg => {
                          const isOperator = msg.sender_type === 'operator';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isOperator ? 'items-end ml-auto' : 'items-start'} max-w-[80%]`}
                            >
                              <div
                                className={`p-3.5 rounded-2xl text-slate-100 shadow-md space-y-1 ${
                                  isOperator
                                    ? 'bg-emerald-600/90 border border-emerald-500/50 rounded-tr-sm'
                                    : 'bg-slate-900 border border-slate-800 rounded-tl-sm'
                                }`}
                              >
                                <span className={`text-[10px] font-bold block ${isOperator ? 'text-emerald-200 text-right' : 'text-emerald-400'}`}>
                                  {isOperator ? 'Vos (Asesor Comercial)' : activeConversation.lead.name}
                                </span>
                                <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                              </div>
                              <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        });
                      })()}

                      {/* CAJA DE SUGERENCIA IA CON CONTROL HUMANO (SIEMPRE DISPONIBLE) */}
                      {activeAISuggestion && (
                        <div className="bg-gradient-to-b from-violet-950/40 to-slate-950 border border-violet-500/40 rounded-2xl p-4 shadow-xl space-y-3 animate-in slide-in-from-bottom-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-500/20 pb-2.5">
                            <div className="flex items-center gap-2 text-violet-300 font-bold text-xs">
                              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                              <span>Sugerencia de Respuesta de IA (Control Humano)</span>
                            </div>

                            {/* Selector de Motor IA: Claude vs GPT-4o */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAIProvider('claude');
                                    handleGenerateLiveAIReply(undefined, 'claude');
                                  }}
                                  className={`px-2 py-0.5 rounded font-bold transition-all ${
                                    selectedAIProvider === 'claude'
                                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  ✨ Claude Sonnet
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAIProvider('openai');
                                    handleGenerateLiveAIReply(undefined, 'openai');
                                  }}
                                  className={`px-2 py-0.5 rounded font-bold transition-all ${
                                    selectedAIProvider === 'openai'
                                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  🤖 GPT-4o
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleGenerateLiveAIReply()}
                                disabled={isGeneratingLiveAI}
                                className="px-2.5 py-1 bg-violet-600/30 hover:bg-violet-600/50 disabled:opacity-50 text-violet-200 border border-violet-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                                title="Volver a generar la respuesta con el motor seleccionado"
                              >
                                <Sparkles className={`w-3 h-3 ${isGeneratingLiveAI ? 'animate-spin' : 'text-amber-300'}`} />
                                {isGeneratingLiveAI ? 'Pensando...' : 'Regenerar con IA'}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">
                              Motor activo: <strong className="text-violet-300">{activeAISuggestion.providerUsed || (selectedAIProvider === 'claude' ? 'Claude Sonnet 4.6' : 'GPT-4o')}</strong>
                            </span>
                            <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono font-bold">
                              Intención: {activeAISuggestion.intent}
                            </span>
                          </div>

                          {isGeneratingLiveAI ? (
                            <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-xl flex items-center gap-2 text-xs text-violet-300 animate-pulse">
                              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                              <span>{selectedAIProvider === 'claude' ? 'Claude Sonnet 4.6' : 'GPT-4o'} está analizando la objeción y consultando el catálogo de Shop de Plumas...</span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              💡 Razón: "{activeAISuggestion.reasoning}"
                            </p>
                          )}

                          {/* Modo edición o vista */}
                          {isEditingSuggestion ? (
                            <textarea
                              value={customSuggestionText}
                              onChange={(e) => setCustomSuggestionText(e.target.value)}
                              rows={3}
                              className="w-full bg-slate-900 border border-violet-500/50 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none"
                            />
                          ) : (
                            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-slate-200 leading-relaxed font-sans text-xs">
                              "{activeAISuggestion.reply}"
                            </div>
                          )}

                          {/* Botones de Control Humano: Enviar, Editar, Descartar */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSendMessage(isEditingSuggestion ? customSuggestionText : activeAISuggestion.reply)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30"
                              >
                                <Send className="w-3.5 h-3.5" />
                                {isEditingSuggestion ? 'Enviar Editado' : 'Aprobar y Enviar Sugerencia'}
                              </button>
                              
                              <button
                                onClick={() => {
                                  if (!isEditingSuggestion) {
                                    setCustomSuggestionText(activeAISuggestion.reply);
                                  }
                                  setIsEditingSuggestion(!isEditingSuggestion);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2.5 rounded-xl text-xs transition-colors"
                              >
                                {isEditingSuggestion ? 'Cancelar Edición' : 'Editar antes de enviar'}
                              </button>
                            </div>

                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                              No se envía sin tu confirmación
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input para Escribir Mensaje Manual */}
                    <div className="p-3.5 border-t border-slate-800 bg-slate-950 shrink-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Escribí un mensaje o respuesta al cliente..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        {activeAISuggestion && (
                          <button
                            type="button"
                            onClick={() => setMessageInput(activeAISuggestion.reply)}
                            className="bg-violet-950/70 hover:bg-violet-900/80 text-violet-300 border border-violet-500/40 font-semibold px-3 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                            title="Pegar sugerencia de IA en el campo de texto"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            Cargar Sugerencia IA
                          </button>
                        )}
                        <button
                          onClick={() => handleSendMessage()}
                          disabled={!messageInput.trim()}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Enviar
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                      <MessageSquare className="w-7 h-7 text-emerald-500/40" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h4 className="text-xs font-bold text-slate-200">
                        Sin conversación seleccionada
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Vinculá WhatsApp Cloud API o tu cuenta de Instagram en <strong>Conectar APIs</strong> para sincronizar mensajes reales de tus clientes.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* COLUMNA 3: FICHA DEL LEAD, ATRIBUCIÓN & TAREAS */}
              {activeConversation && (
                <div className="w-80 lg:w-96 border-l border-slate-800 bg-slate-950 p-4 flex flex-col overflow-y-auto space-y-4 custom-scrollbar text-xs shrink-0">
                  {/* Calificación de Intención */}
                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold text-[11px]">Intención de Compra:</span>
                      <span className="text-emerald-400 font-bold font-mono text-sm">
                        {activeConversation.lead.intent_score}/100
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${activeConversation.lead.intent_score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block text-right font-medium">
                      Estado: <strong className="text-slate-200">{activeConversation.lead.intent_label}</strong>
                    </span>
                  </div>

                  {/* Selector de Etapa Comercial (Pipeline) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400">Etapa del Pipeline:</label>
                    <select
                      value={activeConversation.lead.stage}
                      onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="nuevo">NUEVO</option>
                      <option value="contactado">CONTACTADO</option>
                      <option value="interesado">INTERESADO</option>
                      <option value="presupuesto">PRESUPUESTO ENVIADO</option>
                      <option value="negociacion">NEGOCIACIÓN ACTIVA</option>
                      <option value="ganado">GANADO (VENTA CERRADA)</option>
                      <option value="perdido">PERDIDO</option>
                      <option value="seguimiento">EN SEGUIMIENTO</option>
                    </select>
                  </div>

                  {/* ATRIBUCIÓN DE ORIGEN: CONEXIÓN CON REEL / META ADS */}
                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Atribución de Origen
                    </span>

                    {activeConversation.lead.source.type === 'instagram_organic' && (
                      <div className="space-y-1 text-[11px]">
                        <div className="text-slate-400">Originado por Reel Orgánico:</div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 font-medium text-slate-200">
                          "{activeConversation.lead.source.post_title}"
                        </div>
                        {activeConversation.lead.source.keyword_triggered && (
                          <div className="text-[10px] text-violet-300">
                            Palabra clave detectada: <strong className="bg-violet-950/60 px-1.5 py-0.5 rounded border border-violet-500/30 font-mono font-bold">{activeConversation.lead.source.keyword_triggered}</strong>
                          </div>
                        )}
                        {activeConversation.lead.source.post_id && onNavigateToPost && (
                          <button
                            onClick={() => onNavigateToPost(activeConversation.lead.source.post_id!)}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 pt-1"
                          >
                            Ver Reel en el Canvas <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {activeConversation.lead.source.type === 'meta_ads' && (
                      <div className="space-y-1 text-[11px]">
                        <div className="text-slate-400">Originado por Anuncio Meta Ads:</div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-cyan-500/30 text-cyan-200 font-medium">
                          {activeConversation.lead.source.campaign_name}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumen Ejecutivo IA de la Conversación */}
                  {activeConversation.ai_summary && (
                    <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Resumen para el Equipo
                      </span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {activeConversation.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* Tareas de Seguimiento */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span>Tareas & Follow-ups</span>
                      <span className="text-[10px] text-slate-500">{tasks.filter(t => t.lead_id === activeConversation.lead.id).length} activas</span>
                    </span>

                    <div className="space-y-1.5">
                      {tasks
                        .filter(t => t.lead_id === activeConversation.lead.id)
                        .map(task => (
                          <div
                            key={task.id}
                            onClick={() => handleToggleTask(task.id)}
                            className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition-colors ${
                              task.is_completed ? 'bg-slate-950/40 border-slate-800 text-slate-500 line-through' : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border ${
                              task.is_completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700'
                            }`}>
                              {task.is_completed && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-[11px] leading-snug flex-1">{task.title}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: OPORTUNIDADES & ALERTAS COMERCIALES (DETECCIÓN PROACTIVA) */}
          {/* ========================================================================= */}
          {activeTab === 'opportunities' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar max-w-5xl mx-auto">
              {/* Banner de Inteligencia Proactiva */}
              <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-violet-950/30 border border-amber-500/20 p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Detección Proactiva de Oportunidades y Fugas Comerciales
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {opportunities.length} alertas detectadas
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  EventPix Intelligence analiza en tiempo real tus conversaciones de WhatsApp e Instagram para detectar leads en riesgo de abandono, cotizaciones estancadas y patrones repetitivos para automatizar.
                </p>
              </div>

              {/* Sección 1: Alertas Críticas & Leads en Riesgo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Leads en Riesgo de Abandono & Presupuestos Estancados
                  </h4>
                  <span className="text-[11px] text-slate-500">Acciones inmediatas</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {opportunities.length === 0 ? (
                    <div className="col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
                      <Check className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-200">Sin alertas comerciales pendientes</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Tus conversaciones están al día. Cuando un prospecto cotice o pase más de 24h sin respuesta, aparecerá aquí.
                      </p>
                    </div>
                  ) : (
                    opportunities.map(opp => (
                    <div
                      key={opp.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                        opp.severity === 'high'
                          ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-500/50'
                          : opp.severity === 'medium'
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                          : 'bg-indigo-950/15 border-indigo-500/30 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            opp.severity === 'high'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {opp.metric_highlight || 'Atención requerida'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {opp.type === 'lead_abandoned' ? 'Lead Caliente' : opp.type === 'budget_stalled' ? 'Presupuesto' : 'Meta Window'}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-100">{opp.title}</h5>
                        <p className="text-xs text-slate-400 leading-relaxed">{opp.description}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {opp.lead_name ? `Contacto: ${opp.lead_name}` : 'Atribución de Contenido'}
                        </span>
                        <button
                          onClick={() => handleActionOpportunity(opp)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {opp.suggested_action_type === 'create_task' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                          {opp.suggested_action_type === 'open_chat' && <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />}
                          {opp.suggested_action_type === 'view_content' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                          {opp.action_label}
                        </button>
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>

              {/* Sección 2: Inteligencia que crea Automatizaciones (Recomendaciones de IA) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    Automatizaciones Recomendadas por EventPix
                  </h4>
                  <span className="text-[11px] text-slate-500">Basadas en tus consultas reales</span>
                </div>

                <div className="space-y-3">
                  {recommendedAutomations.map(rec => (
                    <div
                      key={rec.id}
                      className="bg-slate-900 border border-slate-800 hover:border-violet-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">{rec.title}</span>
                          <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-semibold">
                            {rec.detected_frequency}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{rec.reason}</p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                          <span>⚡ Disparador: <strong className="text-slate-300">{rec.trigger_summary}</strong></span>
                          <span className="text-emerald-400">📈 {rec.projected_impact}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingRule(rec.suggested_rule);
                          setIsRuleBuilderOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-violet-600/20 flex items-center gap-1.5 shrink-0 transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Revisar y Activar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PIPELINE KANBAN */}
          {/* ========================================================================= */}
          {activeTab === 'pipeline' && (
            <div className="flex-1 p-6 overflow-x-auto overflow-y-hidden flex gap-4 bg-slate-950 custom-scrollbar">
              {(['nuevo', 'contactado', 'interesado', 'presupuesto', 'negociacion', 'ganado'] as LeadStage[]).map(stage => {
                const stageLeads = conversations.filter(c => c.lead.stage === stage);
                const totalValue = stageLeads.reduce((sum, c) => sum + (c.lead.estimated_value || 0), 0);

                return (
                  <div key={stage} className="w-72 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col shrink-0">
                    <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 rounded-t-2xl">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          {stage} ({stageLeads.length})
                        </h4>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          ${(totalValue / 1000).toFixed(0)}k proyectados
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                      {stageLeads.map(conv => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            setSelectedConvId(conv.id);
                            setActiveTab('inbox');
                          }}
                          className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all space-y-1.5 group shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                              {conv.lead.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-400">
                              {conv.lead.intent_score} pts
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {conv.lead.primary_interest}
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-800/60">
                            <span>{conv.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}</span>
                            <span className="text-slate-300 font-mono">
                              ${conv.lead.estimated_value?.toLocaleString() || '0'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: REGLAS DE AUTOMATIZACIÓN & CONTROL HUMANO */}
          {/* ========================================================================= */}
          {activeTab === 'automations' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar max-w-5xl mx-auto">
              
              {/* Header con métricas de automatización */}
              <div className="bg-gradient-to-r from-violet-950/40 via-slate-900 to-indigo-950/40 border border-violet-500/20 p-6 rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-slate-100 uppercase tracking-tight">
                        Motor de Automatizaciones & Disparadores
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Detecta palabras clave, consultas de precios e intenciones de compra en tiempo real respetando la ventana de Meta.
                    </p>
                  </div>

                  {/* Acciones del Header */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={handleResetDefaultRules}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Restaura las 4 reglas oficiales recomendadas para Shop de Plumas"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      Restaurar Reglas Shop
                    </button>
                    <button
                      onClick={() => {
                        setEditingRule(null);
                        setIsRuleBuilderOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-600/25 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Automatización
                    </button>
                  </div>
                </div>

                {/* Chips de estado */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Reglas Activas</span>
                    <span className="text-lg font-black text-emerald-400">
                      {rules.filter(r => r.is_active).length} / {rules.length}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Modo 100% Auto</span>
                    <span className="text-lg font-black text-violet-400">
                      {rules.filter(r => !r.requires_human_approval && r.is_active).length}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Modo Sugerencia IA</span>
                    <span className="text-lg font-black text-amber-400">
                      {rules.filter(r => r.requires_human_approval && r.is_active).length}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Disparos Registrados</span>
                    <span className="text-lg font-black text-cyan-400">
                      {automationLogs.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* LISTA DE REGLAS CONFIGURADAS */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-violet-400" />
                    Reglas Disponibles ({rules.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Lead de prueba actual: <strong className="text-slate-300">{activeConversation?.lead?.name || 'Ninguno'}</strong>
                  </span>
                </div>

                <div className="space-y-3">
                  {rules.map(rule => {
                    const isPrice = rule.trigger_event === 'price_inquiry';
                    const isHighIntent = rule.trigger_event === 'high_intent';
                    const isKeyword = rule.trigger_event === 'keyword_match';
                    const is48h = rule.trigger_event === 'no_reply_48h';

                    return (
                      <div
                        key={rule.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          rule.is_active
                            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/60 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          
                          {/* Info de la regla */}
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className={`p-1.5 rounded-lg border ${
                                isPrice ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' :
                                isHighIntent ? 'bg-amber-950/40 border-amber-500/30 text-amber-400' :
                                isKeyword ? 'bg-violet-950/40 border-violet-500/30 text-violet-400' :
                                'bg-indigo-950/40 border-indigo-500/30 text-indigo-400'
                              }`}>
                                {isPrice && <DollarSign className="w-4 h-4" />}
                                {isHighIntent && <Flame className="w-4 h-4" />}
                                {isKeyword && <Zap className="w-4 h-4" />}
                                {is48h && <Clock className="w-4 h-4" />}
                                {!isPrice && !isHighIntent && !isKeyword && !is48h && <Activity className="w-4 h-4" />}
                              </div>

                              <span className="text-sm font-bold text-slate-100">{rule.name}</span>

                              {/* Badges de Disparador */}
                              {isKeyword && rule.trigger_keyword && (
                                <span className="text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                                  KEYWORD: "{rule.trigger_keyword}"
                                </span>
                              )}
                              {isPrice && (
                                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                  💰 Consulta de Precios & Cuotas
                                </span>
                              )}
                              {isHighIntent && (
                                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                  🔥 Alta Intención (&gt; 75 pts)
                                </span>
                              )}
                              {is48h && (
                                <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                  ⏳ Inactividad (48 horas)
                                </span>
                              )}

                              {/* Badge de Control */}
                              {rule.requires_human_approval ? (
                                <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Modo Sugerencia
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  100% Automático
                                </span>
                              )}

                              {/* Badge de Etapa de Destino */}
                              {rule.action_payload?.target_stage && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                                  🎯 Mueve a: {rule.action_payload.target_stage.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed">
                              {rule.description}
                            </p>

                            {/* Preview del mensaje o tarea */}
                            {rule.action_payload?.message_template && (
                              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 font-sans leading-relaxed">
                                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                                  Plantilla del Mensaje:
                                </span>
                                <span className="italic text-slate-300">"{rule.action_payload.message_template}"</span>
                              </div>
                            )}

                            {rule.action_payload?.task_title && (
                              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-xs text-amber-300/90 font-mono">
                                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                                  Tarea Generada:
                                </span>
                                📋 {rule.action_payload.task_title}
                              </div>
                            )}
                          </div>

                          {/* Botones de Control de la Regla */}
                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                            
                            {/* Botón Probar Disparador en vivo */}
                            <button
                              onClick={() => handleTestRule(rule)}
                              disabled={!activeConversation}
                              className="px-3.5 py-2 rounded-xl bg-violet-600/25 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                              title={`Ejecutar prueba de esta regla en el lead activo (${activeConversation?.lead?.name || 'Cliente'})`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Probar Disparador
                            </button>

                            <div className="flex items-center gap-1.5">
                              {/* Toggle Activa/Pausada */}
                              <button
                                onClick={() => {
                                  const updated = rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r);
                                  setRules(updated);
                                  CRMStorageService.saveRules(businessId, updated);
                                  toast.success(`Regla "${rule.name}" ${!rule.is_active ? 'activada' : 'pausada'}.`);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                  rule.is_active
                                    ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}
                              >
                                {rule.is_active ? 'Activa' : 'Pausada'}
                              </button>

                              {/* Editar */}
                              <button
                                onClick={() => {
                                  setEditingRule(rule);
                                  setIsRuleBuilderOpen(true);
                                }}
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                                title="Editar regla"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar */}
                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar la automatización "${rule.name}"?`)) {
                                    handleDeleteRule(rule.id);
                                  }
                                }}
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-colors"
                                title="Eliminar regla"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 3: HISTORIAL DE EJECUCIONES EN TIEMPO REAL (AUDIT LOG) */}
              <div className="space-y-3 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Historial de Ejecuciones en Tiempo Real
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Registro de disparos automáticos y sugerencias preparadas
                    </p>
                  </div>

                  {automationLogs.length > 0 && (
                    <button
                      onClick={handleClearAutomationLogs}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpiar Historial
                    </button>
                  )}
                </div>

                {automationLogs.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                    <Zap className="w-6 h-6 text-violet-400/50 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">Sin ejecuciones registradas todavía</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Hacé click en <strong className="text-violet-300">"Probar Disparador"</strong> en cualquiera de las reglas de arriba, o simulá consultas con palabras como <span className="text-slate-300">"PRECIO"</span> o <span className="text-slate-300">"APP"</span> en el chat.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {automationLogs.map(log => (
                      <div
                        key={log.id}
                        className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
                            log.status === 'executed'
                              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                              : 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                          }`}>
                            {log.status === 'executed' ? <Zap className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200">{log.rule_name}</span>
                              <span className="text-[10px] text-slate-400">
                                → Contacto: <strong className="text-slate-300">{log.lead_name}</strong>
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{log.action_summary}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 text-[11px]">
                          <span className="text-slate-500 font-mono">
                            {new Date(log.executed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} hs
                          </span>
                          <button
                            onClick={() => {
                              const targetConv = conversations.find(c => c.lead.id === log.lead_id);
                              if (targetConv) {
                                setSelectedConvId(targetConv.id);
                                setActiveTab('inbox');
                              } else {
                                setActiveTab('inbox');
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-400" />
                            Ver en Chat
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: ATRIBUCIÓN DE VENTAS (CONTENIDO → LEAD → VENTA) */}
          {/* ========================================================================= */}
          {activeTab === 'attribution' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar max-w-5xl mx-auto">
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 border border-slate-800 p-6 rounded-3xl space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Embudo Completo: Del Contenido a la Facturación
                </span>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  No medimos solo reproducciones. EventPix Intelligence rastrea la cadena completa:
                  qué Reel generó el comentario, qué conversación inició, quién fue calificado y cuántas ventas cerró.
                </p>

                {/* Métricas del Embudo */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 block">Conversaciones</span>
                    <span className="text-base font-bold font-mono text-slate-200">{funnelMetrics.total_conversations}</span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 block">Leads Calificados</span>
                    <span className="text-base font-bold font-mono text-cyan-400">{funnelMetrics.qualified_leads}</span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 block">Presupuestos</span>
                    <span className="text-base font-bold font-mono text-amber-400">{funnelMetrics.budgets_requested}</span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 block">Ventas Cerradas</span>
                    <span className="text-base font-bold font-mono text-emerald-400">{funnelMetrics.deals_won}</span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 block">Facturación Total</span>
                    <span className="text-base font-bold font-mono text-emerald-300">
                      ${(funnelMetrics.total_sales_value / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>
              </div>

              {/* Ranking de Reels con Atribución Real */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Ranking de Contenido que Genera Clientes (Atribución Real)
                </h4>

                <div className="space-y-2">
                  {funnelMetrics.top_converting_content.map((item, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <h5 className="text-xs font-bold text-slate-100">{item.post_title}</h5>
                          <span className="text-[10px] text-slate-400">
                            {item.leads_count} conversaciones iniciadas → {item.sales_count} ventas cerradas
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                          {item.sales_count > 0 ? `${item.sales_count} Ventas` : 'Leads en Proceso'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL CONSTRUCTOR VISUAL DE AUTOMATIZACIONES */}
      <AutomationRuleBuilderModal
        isOpen={isRuleBuilderOpen}
        onClose={() => setIsRuleBuilderOpen(false)}
        initialRule={editingRule}
        onSaveRule={handleSaveRule}
      />
    </div>
  );
};
