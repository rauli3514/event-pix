// ================================================================
// AutoDmStudioModal.tsx
// Estudio de Automatización de Comentarios, Auto-DM y WhatsApp
// Alternativa nativa sin ManyChat para EventPix Intelligence
// ================================================================

import React, { useState, useEffect } from 'react';
import {
  X, Zap, Send,
  Smartphone, RefreshCw, Play, Flame
} from 'lucide-react';
import { toast } from 'sonner';
import { CRMStorageService } from '../../services/intelligence/CRMStorageService';
import { CRMAutomationRule } from '../../types/crm';

interface AutoDmStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptHook?: string;
  scriptCta?: string;
  onOpenCrm?: () => void;
  businessId?: string;
}

export const AutoDmStudioModal: React.FC<AutoDmStudioModalProps> = ({
  isOpen,
  onClose,
  scriptHook,
  scriptCta,
  onOpenCrm,
  businessId = 'biz_001'
}) => {
  // Extraer palabra clave recomendada del CTA
  const detectedKeyword = (() => {
    if (!scriptCta) return 'PANTALLA';
    const match = scriptCta.match(/["']([A-Za-z0-9_-]+)["']/);
    return match ? match[1].toUpperCase() : 'PANTALLA';
  })();

  const [keyword, setKeyword] = useState(detectedKeyword);
  
  // Respuestas públicas rotativas para evitar detección de spam y alimentar el algoritmo
  const [publicReplies, setPublicReplies] = useState<string[]>([
    '¡Hola @usuario! Te mandé el catálogo con precios al privado 📩',
    '¡Qué bueno verte por acá! Ya te escribí por mensaje directo con los detalles 🙌',
    '¡Listo! Te dejé toda la info y las opciones en cuotas en tus mensajes directos 🚀'
  ]);

  // Mensaje Privado DM / WhatsApp
  const [privateDmMessage, setPrivateDmMessage] = useState(
    `¡Hola @usuario! 👋 Gracias por tu interés en nuestras pantallas verticales Display Digital.\n\n` +
    `Acá tenés el catálogo interactivo de Shop de Plumas con stock disponible en tiempo real:\n` +
    `👉 https://eventpix.app/shop/catalogo\n\n` +
    `¿Tenés un local comercial, showroom o restaurante? Contame y te paso la medida ideal.`
  );


  // Estados del Simulador de iPhone
  const [simulationState, setSimulationState] = useState<'idle' | 'commented' | 'replied' | 'dm_received' | 'chat_open'>('idle');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedComment, setSimulatedComment] = useState(keyword);
  const [activeTab, setActiveTab] = useState<'flow' | 'simulation'>('flow');

  useEffect(() => {
    if (detectedKeyword) {
      setKeyword(detectedKeyword);
      setSimulatedComment(detectedKeyword);
    }
  }, [detectedKeyword]);

  if (!isOpen) return null;

  // Ejecución de la simulación paso a paso
  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimulationState('commented');

    // Paso 1: Usuario comenta
    setTimeout(() => {
      setSimulationState('replied');
      toast.info(`Comentario detectado con keyword "${keyword}". Respondiendo públicamente...`);

      // Paso 2: Bot responde públicamente y manda DM
      setTimeout(() => {
        setSimulationState('dm_received');
        toast.success(`¡Auto-DM disparado a @cliente_potencial en 0.8 segundos!`);
        setIsSimulating(false);
      }, 1200);
    }, 900);
  };

  const handleResetSimulation = () => {
    setSimulationState('idle');
    setIsSimulating(false);
  };

  // Guardar Automatización en el CRM
  const handleSaveAutomation = async () => {
    const newRule: CRMAutomationRule = {
      id: `rule_autodm_${Date.now()}`,
      business_id: businessId,
      name: `Auto-DM Reel: ${keyword}`,
      description: `Dispara respuesta pública y DM privado cuando comentan "${keyword}" en Instagram Reels`,
      trigger_event: 'keyword_match',
      trigger_keyword: keyword.toUpperCase(),
      action_type: 'send_auto_reply',
      action_payload: {
        message_template: privateDmMessage,
        target_stage: 'contactado',
        task_title: `Lead originado por Reel con palabra clave ${keyword}`,
        trigger_channel: 'comment',
        public_reply_templates: publicReplies.map(r => r.trim()).filter(Boolean)
      },
      requires_human_approval: false,
      is_active: true
    };

    // Antes acá se inyectaba un lead/conversación/mensajes 100% inventados
    // ("Martín Comercio", score de intención 92) directo en el CRM real del
    // negocio, mezclado con leads verdaderos sin forma de distinguirlos. La
    // regla ya queda activa y el webhook de Instagram la va a disparar de
    // verdad la próxima vez que alguien comente la palabra clave — no hace
    // falta simular un cliente falso para "mostrar cómo queda".
    const existingRules = await CRMStorageService.loadRules(businessId);
    await CRMStorageService.saveRules(businessId, [newRule, ...existingRules]);

    toast.success(`¡Automatización "${newRule.name}" activada! Se va a disparar la próxima vez que alguien comente "${keyword}" en tus Reels.`);
    onClose();

    if (onOpenCrm) {
      setTimeout(() => {
        onOpenCrm();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header Principal */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Motor de Auto-DM & Conversión (ManyChat Killer)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Sin costo mensual
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Meta Graph API Directo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Convierte a los usuarios que comentan tus Reels en clientes por mensaje directo y WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Vista Mobile/Flujo */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 sm:hidden">
              <button
                onClick={() => setActiveTab('flow')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${activeTab === 'flow' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
              >
                Regla
              </button>
              <button
                onClick={() => setActiveTab('simulation')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${activeTab === 'simulation' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
              >
                Simulador
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido en 2 Columnas: Configurador y Simulador de iPhone */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 custom-scrollbar">
          
          {/* Columna Izquierda: Configuración del Embudo (7 cols) */}
          <div className={`p-6 space-y-6 lg:col-span-7 border-b lg:border-b-0 lg:border-r border-slate-800 ${activeTab === 'simulation' ? 'hidden sm:block' : ''}`}>
            
            {/* PASO 1: Disparador (Keyword) */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center text-[11px] font-mono text-pink-300">1</span>
                  Disparador en Instagram Reel
                </span>
                <span className="text-[10px] text-slate-500">Detectado del CTA de tu guión</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Cuando alguien comente esta palabra clave:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">"</span>
                    <input
                      type="text"
                      value={keyword}
                      onChange={e => setKeyword(e.target.value.toUpperCase())}
                      placeholder="PANTALLA, DIGITAL, PRECIO..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-6 pr-3 py-2 text-pink-400 font-mono font-bold text-sm focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setKeyword('PANTALLA');
                      setSimulatedComment('PANTALLA');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                  >
                    PANTALLA
                  </button>
                  <button
                    onClick={() => {
                      setKeyword('DIGITAL');
                      setSimulatedComment('DIGITAL');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                  >
                    DIGITAL
                  </button>
                </div>
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  disabled
                  title="Todavía no disponible: por ahora la regla aplica a todos tus Reels"
                  className="flex-1 py-1.5 px-3 rounded-lg font-medium border text-[11px] bg-slate-950 border-slate-800/60 text-slate-600 cursor-not-allowed"
                >
                  Solo en el Reel actual (pronto)
                </button>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-1.5 px-3 rounded-lg font-medium border text-[11px] bg-pink-600/20 border-pink-500/50 text-pink-300 cursor-default"
                >
                  En todos mis Reels ✓
                </button>
              </div>
            </div>

            {/* PASO 2: Respuesta Pública (Algorithmic Multiplier) */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[11px] font-mono text-amber-300">2</span>
                  Respuesta Pública en el Comentario
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Multiplica alcance de Meta
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                El bot responderá públicamente rotando entre estas frases para que Instagram interprete conversación orgánica y viralice el Reel:
              </p>

              <div className="space-y-2">
                {publicReplies.map((reply, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500 w-4">#{idx + 1}</span>
                    <input
                      type="text"
                      value={reply}
                      onChange={e => {
                        const copy = [...publicReplies];
                        copy[idx] = e.target.value;
                        setPublicReplies(copy);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* PASO 3: Mensaje Privado DM / WhatsApp */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[11px] font-mono text-violet-300">3</span>
                  Mensaje Privado (DM / WhatsApp)
                </span>
                <span className="text-[10px] text-slate-500">Con enlace directo al catálogo</span>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={privateDmMessage}
                  onChange={e => setPrivateDmMessage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-violet-500 custom-scrollbar leading-relaxed font-sans"
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                  <span>Variables disponibles: <code className="text-violet-400">@usuario</code>, <code className="text-violet-400">#catalogo</code></span>
                  <span>{privateDmMessage.length} caracteres</span>
                </div>
              </div>
            </div>

            {/* Botón de Acción Principal */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveAutomation}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-pink-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Zap className="w-4 h-4" />
                Activar Automatización & Enviar al CRM
              </button>
            </div>
          </div>

          {/* Columna Derecha: Simulador iPhone en Vivo (5 cols) */}
          <div className={`p-6 bg-slate-950 flex flex-col items-center justify-center lg:col-span-5 ${activeTab === 'flow' ? 'hidden sm:flex' : ''}`}>
            
            <div className="w-full max-w-[320px] space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Smartphone className="w-3.5 h-3.5 text-pink-400" />
                  <span>Simulador iPhone en Vivo</span>
                </div>
                <button
                  onClick={handleResetSimulation}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reiniciar
                </button>
              </div>

              {/* Teléfono Mockup */}
              <div className="w-full bg-slate-900 border-4 border-slate-800 rounded-[38px] p-3 shadow-2xl relative overflow-hidden flex flex-col h-[520px]">
                
                {/* Notch / Dynamic Island */}
                <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800/80 ml-auto mr-1.5" />
                </div>

                {/* Notificación Flotante Push si hay DM */}
                {simulationState === 'dm_received' && (
                  <div className="absolute top-10 left-3 right-3 bg-slate-800/95 border border-pink-500/40 rounded-2xl p-2.5 shadow-2xl z-40 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-[8px] font-bold text-white">
                        IG
                      </div>
                      <span className="text-[10px] font-bold text-slate-200">Instagram • ahora</span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-semibold line-clamp-1">
                      display_digital te envió un mensaje
                    </p>
                    <p className="text-[9px] text-slate-400 line-clamp-1">
                      ¡Hola! Gracias por tu interés...
                    </p>
                  </div>
                )}

                {/* Pantalla del Celular */}
                <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden flex flex-col relative border border-slate-800/60">
                  
                  {/* Top Bar Instagram */}
                  <div className="p-2.5 border-b border-slate-900 flex items-center justify-between text-[11px] font-bold text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-amber-500 flex items-center justify-center text-[9px] text-white font-bold">
                        D
                      </div>
                      <span>display_digital</span>
                    </div>
                    <span className="text-[10px] text-pink-400 font-normal">Siguiendo</span>
                  </div>

                  {/* Feed / Video Reel Preview */}
                  <div className="flex-1 bg-gradient-to-b from-slate-900 to-slate-950 p-3 flex flex-col justify-end relative">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:12px_12px]" />
                    
                    {/* Caption y CTA en el video */}
                    <div className="relative z-10 space-y-1 mb-2">
                      <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">
                        {scriptHook || '¿Sabías por qué los locales que más venden ya no usan carteles fijos?'}
                      </p>
                      <span className="inline-block bg-pink-500/30 text-pink-300 border border-pink-500/40 text-[9px] px-2 py-0.5 rounded-md font-bold">
                        Comentá "{keyword}" y te mando el catálogo
                      </span>
                    </div>

                    {/* Área de Comentarios del Reel */}
                    <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 space-y-2 relative z-10 text-[10px]">
                      
                      {/* Comentario del Cliente */}
                      {simulationState !== 'idle' && (
                        <div className="space-y-1 animate-in fade-in duration-200">
                          <div className="flex items-start gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-cyan-600 flex items-center justify-center text-[8px] font-bold text-white">
                              C
                            </div>
                            <div>
                              <span className="font-bold text-slate-300 mr-1">cliente_potencial</span>
                              <span className="text-pink-400 font-bold font-mono">{simulatedComment}</span>
                            </div>
                          </div>

                          {/* Respuesta Pública Automática del Bot */}
                          {(simulationState === 'replied' || simulationState === 'dm_received') && (
                            <div className="ml-5 pl-2 border-l-2 border-pink-500/40 space-y-0.5 animate-in slide-in-from-left-2 duration-300">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-pink-400 text-[9px]">display_digital</span>
                                <span className="text-[8px] bg-pink-500/20 text-pink-300 px-1 rounded font-bold">BOT</span>
                              </div>
                              <p className="text-slate-300 text-[9px] leading-tight">
                                {publicReplies[0]}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {simulationState === 'idle' && (
                        <div className="text-center py-3 text-slate-500 text-[10px]">
                          Esperando que alguien comente en el Reel...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Input de Comentario Simulado */}
                  <div className="p-2 bg-slate-900 border-t border-slate-800/80 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={simulatedComment}
                      onChange={e => setSimulatedComment(e.target.value.toUpperCase())}
                      placeholder="Escribí PANTALLA..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-pink-500 font-mono"
                    />
                    <button
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      className="p-1.5 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                      title="Enviar comentario de prueba"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="w-20 h-1 bg-slate-700 rounded-full mx-auto mt-2 shrink-0" />
              </div>

              {/* Botón Disparador de Prueba */}
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
              >
                <Play className="w-3 h-3 text-pink-400" />
                {isSimulating ? 'Simulando respuesta...' : `Probar Simulación ("${simulatedComment}")`}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
