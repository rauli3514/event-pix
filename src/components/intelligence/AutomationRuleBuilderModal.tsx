// ================================================================
// AutomationRuleBuilderModal.tsx
// Constructor Visual de Automatizaciones Paso a Paso (No-Code)
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState, useEffect } from 'react';
import {
  X, Zap, ShieldCheck, CheckCircle2, Sparkles
} from 'lucide-react';
import { CRMAutomationRule, LeadStage } from '../../types/crm';

interface AutomationRuleBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRule?: Partial<CRMAutomationRule> | null;
  onSaveRule: (rule: CRMAutomationRule) => void;
  businessId: string;
}

export const AutomationRuleBuilderModal: React.FC<AutomationRuleBuilderModalProps> = ({
  isOpen,
  onClose,
  initialRule,
  onSaveRule,
  businessId
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<CRMAutomationRule['trigger_event']>('keyword_match');
  const [triggerKeyword, setTriggerKeyword] = useState('APP');
  const [actionType, setActionType] = useState<CRMAutomationRule['action_type']>('suggest_ai_response');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [targetStage, setTargetStage] = useState<LeadStage>('contactado');
  const [taskTitle, setTaskTitle] = useState('');
  const [requiresHumanApproval, setRequiresHumanApproval] = useState(true);

  useEffect(() => {
    if (initialRule) {
      setName(initialRule.name || '');
      setDescription(initialRule.description || '');
      setTriggerEvent(initialRule.trigger_event || 'keyword_match');
      setTriggerKeyword(initialRule.trigger_keyword || '');
      setActionType(initialRule.action_type || 'suggest_ai_response');
      setMessageTemplate(initialRule.action_payload?.message_template || '');
      setTargetStage(initialRule.action_payload?.target_stage || 'contactado');
      setTaskTitle(initialRule.action_payload?.task_title || '');
      setRequiresHumanApproval(initialRule.requires_human_approval ?? true);
    } else {
      setName('Nueva Automatización');
      setDescription('Responde a clientes calificados');
      setTriggerEvent('keyword_match');
      setTriggerKeyword('APP');
      setActionType('suggest_ai_response');
      setMessageTemplate('¡Hola! Gracias por consultar. Acá tenés la demo en video de cómo funcionan las pantallas verticales.');
      setTargetStage('contactado');
      setTaskTitle('');
      setRequiresHumanApproval(true);
    }
  }, [initialRule, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newRule: CRMAutomationRule = {
      id: initialRule?.id || `rule_${Date.now()}`,
      business_id: businessId,
      name: name.trim() || 'Automatización sin título',
      description: description.trim() || 'Automatización de mensajes',
      trigger_event: triggerEvent,
      trigger_keyword: triggerEvent === 'keyword_match' ? triggerKeyword.trim().toUpperCase() : undefined,
      action_type: actionType,
      action_payload: {
        message_template: messageTemplate.trim() || undefined,
        target_stage: targetStage,
        task_title: taskTitle.trim() || undefined
      },
      requires_human_approval: requiresHumanApproval,
      is_active: true
    };
    onSaveRule(newRule);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {initialRule?.id ? 'Editar Automatización' : 'Constructor Visual de Automatización'}
              </h2>
              <p className="text-xs text-slate-400">
                Configurá el flujo: Disparador → Filtro → Acción comercial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* Nombre y Descripción */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nombre de la Regla
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Auto-DM Catálogo cuando comentan APP"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Objetivo Comercial
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ej: Convertir comentarios de Reels en conversaciones calificadas de WhatsApp"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* PASO 1: DISPARADOR (TRIGGER) */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-violet-400">
              <span className="w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-[10px] font-bold text-violet-300">
                1
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Disparador (¿Cuándo se activa?)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                triggerEvent === 'keyword_match' 
                  ? 'bg-violet-950/30 border-violet-500/60 text-violet-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="triggerEvent"
                  value="keyword_match"
                  checked={triggerEvent === 'keyword_match'}
                  onChange={() => setTriggerEvent('keyword_match')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Palabra Clave en Reel o DM</span>
                  <span className="text-[11px] text-slate-400">Cuando alguien comenta una palabra específica como "APP"</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                triggerEvent === 'price_inquiry' 
                  ? 'bg-violet-950/30 border-violet-500/60 text-violet-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="triggerEvent"
                  value="price_inquiry"
                  checked={triggerEvent === 'price_inquiry'}
                  onChange={() => setTriggerEvent('price_inquiry')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Consulta de Precio / Tarifa</span>
                  <span className="text-[11px] text-slate-400">Preguntan "cuánto sale", "costo", "precios"</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                triggerEvent === 'high_intent' 
                  ? 'bg-violet-950/30 border-violet-500/60 text-violet-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="triggerEvent"
                  value="high_intent"
                  checked={triggerEvent === 'high_intent'}
                  onChange={() => setTriggerEvent('high_intent')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Alta Intención de Compra (&gt; 75 pts)</span>
                  <span className="text-[11px] text-slate-400">Piden presupuesto formal o dejan número</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                triggerEvent === 'no_reply_48h' 
                  ? 'bg-violet-950/30 border-violet-500/60 text-violet-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="triggerEvent"
                  value="no_reply_48h"
                  checked={triggerEvent === 'no_reply_48h'}
                  onChange={() => setTriggerEvent('no_reply_48h')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Sin respuesta tras 48h</span>
                  <span className="text-[11px] text-slate-400">Cotización enviada sin confirmación del cliente</span>
                </div>
              </label>
            </div>

            {triggerEvent === 'keyword_match' && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-3">
                <span className="text-xs text-slate-400 shrink-0">Palabra clave detectada:</span>
                <input
                  type="text"
                  value={triggerKeyword}
                  onChange={e => setTriggerKeyword(e.target.value.toUpperCase())}
                  placeholder="Ej: APP"
                  className="bg-slate-900 border border-violet-500/40 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-violet-300 uppercase tracking-wider w-32 focus:outline-none focus:border-violet-400"
                />
                <span className="text-[11px] text-slate-500">Activará el flujo si el comentario o mensaje incluye este término.</span>
              </div>
            )}
          </div>

          {/* PASO 2: ACCIÓN INMEDIATA */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="w-5 h-5 rounded-full bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                2
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Acción Comercial (¿Qué debe hacer EventPix?)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                actionType === 'suggest_ai_response' 
                  ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="actionType"
                  value="suggest_ai_response"
                  checked={actionType === 'suggest_ai_response'}
                  onChange={() => setActionType('suggest_ai_response')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Sugerir Respuesta IA Calificada</span>
                  <span className="text-[11px] text-slate-400">Prepara la respuesta en el inbox para que el operador la apruebe</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                actionType === 'send_auto_reply' 
                  ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="actionType"
                  value="send_auto_reply"
                  checked={actionType === 'send_auto_reply'}
                  onChange={() => setActionType('send_auto_reply')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Enviar Mensaje Directo Instantáneo</span>
                  <span className="text-[11px] text-slate-400">Envía catálogo, video o enlace sin demora</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                actionType === 'notify_seller' 
                  ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="actionType"
                  value="notify_seller"
                  checked={actionType === 'notify_seller'}
                  onChange={() => setActionType('notify_seller')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Notificar al Vendedor</span>
                  <span className="text-[11px] text-slate-400">Emite alerta urgente para priorizar la llamada</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                actionType === 'create_task' 
                  ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200' 
                  : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
              }`}>
                <input
                  type="radio"
                  name="actionType"
                  value="create_task"
                  checked={actionType === 'create_task'}
                  onChange={() => setActionType('create_task')}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Crear Tarea de Seguimiento</span>
                  <span className="text-[11px] text-slate-400">Agenda un recordatorio con fecha límite en el CRM</span>
                </div>
              </label>
            </div>

            {/* Mensaje / Plantilla */}
            {(actionType === 'send_auto_reply' || actionType === 'suggest_ai_response') && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Texto o Guión del Mensaje:
                </label>
                <textarea
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  rows={3}
                  placeholder="Escribí el mensaje que recibirá el cliente..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Tarea de seguimiento */}
            {(actionType === 'create_task' || actionType === 'notify_seller') && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Título de la tarea o alerta:
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="Ej: Contactar para coordinar visita técnica y medidas"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Cambio de etapa en el embudo */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300">Mover automáticamente el Lead a la etapa:</span>
              <select
                value={targetStage}
                onChange={e => setTargetStage(e.target.value as LeadStage)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="interesado">Interesado</option>
                <option value="presupuesto">Presupuesto</option>
                <option value="seguimiento">Seguimiento</option>
              </select>
            </div>
          </div>

          {/* PASO 3: CONTROL HUMANO */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Nivel de Control Humano
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setRequiresHumanApproval(true)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  requiresHumanApproval
                    ? 'bg-emerald-950/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/40'
                    : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Modo Sugerencia (Recomendado)
                  </span>
                  {requiresHumanApproval && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  La IA prepara la respuesta o la tarea, pero un operador humano la aprueba o edita con 1 click antes de enviarla.
                </p>
              </div>

              <div
                onClick={() => setRequiresHumanApproval(false)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  !requiresHumanApproval
                    ? 'bg-amber-950/20 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Modo 100% Automático
                  </span>
                  {!requiresHumanApproval && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Se envía de inmediato cuando se cumple la condición. Recomendado solo para envío de catálogos con palabra clave exacta.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 flex items-center gap-2 transition-all"
            >
              <Zap className="w-4 h-4" />
              Guardar y Activar Automatización
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
