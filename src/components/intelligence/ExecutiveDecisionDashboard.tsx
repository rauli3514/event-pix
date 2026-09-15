// ================================================================
// ExecutiveDecisionDashboard.tsx
// Centro Ejecutivo de Inteligencia, Decisión y Acción para el Negocio
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, CheckCircle2,
  Sparkles, ArrowRight, Brain, Zap, MessageSquare,
  Play, Tv, BarChart3,
  Flame, LayoutDashboard, Radio, Plus
} from 'lucide-react';
import { IntelligencePost, BrandDNA } from '../../types/intelligence';
import { CRMConversation, CRMTask } from '../../types/crm';
import { CRMStorageService } from '../../services/intelligence/CRMStorageService';
import { CRMIntelligenceEngine } from '../../services/intelligence/CRMIntelligenceEngine';
import { toOptional, formatMetric, hasValue } from '../../services/intelligence/metricUtils';

interface ExecutiveDecisionDashboardProps {
  posts: IntelligencePost[];
  brandDna: BrandDNA;
  accountHandle: string;
  onSwitchToCanvas: () => void;
  onOpenCrm: () => void;
  onOpenExecutiveReport: () => void;
  onInspectPost: (post: IntelligencePost) => void;
  onApplyRecommendationToCanvas: () => void;
  onAddVariantToCanvas: (post: IntelligencePost) => void;
  onOpenTvPreview?: () => void;
  onOpenConnections?: () => void;
}

export const ExecutiveDecisionDashboard: React.FC<ExecutiveDecisionDashboardProps> = ({
  posts,
  accountHandle,
  onSwitchToCanvas,
  onOpenCrm,
  onOpenExecutiveReport,
  onInspectPost,
  onApplyRecommendationToCanvas,
  onAddVariantToCanvas,
  onOpenTvPreview,
  onOpenConnections
}) => {
  // Carga asíncrona de datos reales del CRM
  const [conversations, setConversations] = useState<CRMConversation[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchCrmData() {
      try {
        const convs = await CRMStorageService.loadConversations();
        const t = await CRMStorageService.loadTasks();
        if (isMounted) {
          setConversations(convs);
          setTasks(t);
        }
      } catch (err) {
        console.error('Error cargando datos de CRM:', err);
      }
    }
    fetchCrmData();
    return () => { isMounted = false; };
  }, []);

  // Cálculos dinámicos de CRM
  const funnelMetrics = useMemo(() => {
    return CRMIntelligenceEngine.calculateFunnelMetrics(conversations);
  }, [conversations]);

  const commercialOpportunities = useMemo(() => {
    return CRMIntelligenceEngine.detectCommercialOpportunities(conversations, tasks);
  }, [conversations, tasks]);

  // Cálculos dinámicos de Publicaciones
  const safePosts = Array.isArray(posts) ? posts : [];
  const postsCount = safePosts.length;
  // `|| 0` sobre un MetricValue 'no_disponible' (string, truthy) concatenaba
  // en vez de sumar; toOptional lo normaliza a undefined antes del `?? 0`.
  const totalViews = useMemo(() => safePosts.reduce((acc, p) => acc + (toOptional(p?.metrics?.views) ?? 0), 0), [safePosts]);
  const totalLikes = useMemo(() => safePosts.reduce((acc, p) => acc + (toOptional(p?.metrics?.likes) ?? 0), 0), [safePosts]);
  const totalComments = useMemo(() => safePosts.reduce((acc, p) => acc + (toOptional(p?.metrics?.comments) ?? 0), 0), [safePosts]);
  const totalSaves = useMemo(() => safePosts.reduce((acc, p) => acc + (toOptional(p?.metrics?.saves) ?? 0), 0), [safePosts]);
  const totalInteractions = totalLikes + totalComments + totalSaves;
  const avgEngagement = totalViews > 0 ? ((totalInteractions / totalViews) * 100).toFixed(1) : '0.0';

  // Top Reel con mayor impacto
  const topReel = safePosts.length > 0 ? safePosts[0] : null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#080C14] text-slate-100 p-4 sm:p-6 lg:p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ========================================================================= */}
        {/* NIVEL 1 — ENCABEZADO HUMANO Y CONTEXTUAL */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                Panel de Decisión Estratégica 👋
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold font-mono">
                {accountHandle}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Métricas reales y diagnóstico de conversión para tu negocio.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchToCanvas}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 transition-all shadow-sm"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-violet-400" />
              <span>Ver en Lienzo Interactivo</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NIVEL 1 — 4 INDICADORES PRINCIPALES (DINÁMICOS 100%) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Contenido */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contenido
              </span>
              <span className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400">
                <Play className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-slate-100">{postsCount}</span>
                {postsCount > 0 ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> Activo
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-500">Sin cargar</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {postsCount === 0
                  ? 'Sin contenidos cargados. Agregá tu primer Reel en el Lienzo.'
                  : `${postsCount} publicación(es) analizada(s) en la base de datos.`}
              </p>
            </div>
          </div>

          {/* 2. Engagement */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Engagement
              </span>
              <span className="p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400">
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-cyan-400">{avgEngagement}%</span>
                {Number(avgEngagement) > 0 ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> Real
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-500">0.0%</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {postsCount === 0
                  ? 'Calculado automáticamente sobre métricas de tus Reels reales.'
                  : `${totalSaves} guardados y ${totalComments} comentarios registrados.`}
              </p>
            </div>
          </div>

          {/* 3. Conversaciones */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Conversaciones
              </span>
              <span className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400">
                <MessageSquare className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-400">{conversations.length}</span>
                {conversations.length > 0 ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> Activas
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-500">0</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {conversations.length === 0
                  ? 'Sin mensajes aún. Conectá WhatsApp Cloud API en Conectar APIs.'
                  : `${funnelMetrics.qualified_leads} prospectos calificados en seguimiento.`}
              </p>
            </div>
          </div>

          {/* 4. Conversión Comercial */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Conversión
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {funnelMetrics.conversion_rate_pct}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {funnelMetrics.total_sales_value === 0
                  ? '$0 ARS en ventas registradas en el CRM.'
                  : `$${funnelMetrics.total_sales_value.toLocaleString('es-AR')} ARS en ventas cerradas.`}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CUERPO PRINCIPAL EN DOS COLUMNAS DE JERARQUÍA */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================================= */}
          {/* COLUMNA PRINCIPAL (7 de 12 columnas en Desktop) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-6">

            {/* 🔴 BLOQUE 1: REQUIERE ATENCIÓN (URGENTE & ACCIONABLE) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Requiere tu Atención Hoy
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {commercialOpportunities.length > 0
                    ? `${commercialOpportunities.length} asuntos prioritarios`
                    : postsCount === 0
                    ? '3 pasos de configuración'
                    : '1 asunto prioritario'}
                </span>
              </div>

              <div className="space-y-3">
                {/* Caso 1: Sin contenido ni conversaciones (Onboarding 0-base) */}
                {postsCount === 0 && conversations.length === 0 ? (
                  <>
                    {/* Alerta 1: Importar primer reel */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-violet-500/40 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-violet-500" />
                          <span className="text-xs font-bold text-slate-200">Importá tu primer Reel de Instagram</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Pegá la URL de un Reel o tu cuenta <strong className="text-slate-200">{accountHandle}</strong> en el Lienzo para auditar métricas reales, retención y transcribir el audio.
                        </p>
                      </div>
                      <button
                        onClick={onSwitchToCanvas}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shrink-0 transition-colors shadow-sm"
                      >
                        Ir al Lienzo
                      </button>
                    </div>

                    {/* Alerta 2: Conectar APIs */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-slate-200">Conectar APIs de IA & WhatsApp</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Vinculá tu API Key de OpenAI (requiere saldo prepago en OpenAI Platform) o WhatsApp Cloud API para automatizar respuestas en tiempo real.
                        </p>
                      </div>
                      {onOpenConnections && (
                        <button
                          onClick={onOpenConnections}
                          className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold shrink-0 transition-colors"
                        >
                          Conectar APIs
                        </button>
                      )}
                    </div>

                    {/* Alerta 3: Pantallas Display TV */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-500/40 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-500" />
                          <span className="text-xs font-bold text-slate-200">Vincular Pantallas Display TV</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Sincronizá tus pantallas verticales o vidrieras físicas para transmitir automáticamente los ganchos y promociones generadas.
                        </p>
                      </div>
                      {onOpenTvPreview && (
                        <button
                          onClick={onOpenTvPreview}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 shrink-0 transition-colors"
                        >
                          Ver Display TV
                        </button>
                      )}
                    </div>
                  </>
                ) : commercialOpportunities.length > 0 ? (
                  /* Caso 2: Alertas reales provenientes de CRM */
                  commercialOpportunities.slice(0, 3).map(opp => (
                    <div
                      key={opp.id}
                      className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-rose-500/40 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-xs font-bold text-slate-200">{opp.title}</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {opp.description}
                        </p>
                      </div>
                      <button
                        onClick={onOpenCrm}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 shrink-0 transition-colors"
                      >
                        {opp.action_label}
                      </button>
                    </div>
                  ))
                ) : (
                  /* Caso 3: Datos cargados sin alertas urgentes */
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-slate-200">Operación comercial al día</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        No tenés presupuestos estancados ni mensajes de clientes fuera de la ventana de 24 horas.
                      </p>
                    </div>
                    <button
                      onClick={onOpenCrm}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 shrink-0 transition-colors"
                    >
                      Abrir CRM
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 🧠 BLOQUE 2: NODO SÍNTESIS IA (EL CEREBRO DEL NEGOCIO) */}
            <div className="bg-gradient-to-br from-violet-950/40 via-slate-900 to-indigo-950/30 border border-violet-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-600/30 border border-violet-500/40 text-violet-300">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-violet-300">
                      Síntesis IA — El Cerebro de tu Negocio
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Cruce holístico: Contenido orgánico + Conversaciones de WhatsApp + Ventas
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold font-mono">
                  {postsCount > 0 ? 'IA Activa' : 'Esperando Reels'}
                </span>
              </div>

              {postsCount === 0 ? (
                <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-violet-500/20 text-xs">
                  <div>
                    <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wider block mb-1">
                      🎯 Estado del Motor
                    </span>
                    <p className="text-sm font-semibold text-slate-100">
                      "Agregá publicaciones al Lienzo para activar el análisis."
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <p className="text-slate-300 leading-relaxed">
                      El motor extraerá ganchos de alta retención, preguntas de clientes y ofertas de pantallas para redactar el guión óptimo.
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      onClick={onSwitchToCanvas}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cargar Primer Reel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-violet-500/20 text-xs">
                  <div>
                    <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wider block mb-1">
                      🎯 Tu principal oportunidad ahora
                    </span>
                    <p className="text-sm font-semibold text-slate-100">
                      "Optimizar el remate de tus Reels para derivar tráfico a WhatsApp."
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      ¿Por qué?
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      Tus videos tienen {totalViews > 0 ? `${totalViews} vistas y ${totalSaves} guardados` : 'audiencia interesada'}, pero falta una llamada a la acción con palabra clave para activar el envío automático de presupuestos.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">
                      Qué recomendamos hacer:
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      Cerrar los videos con: <strong className="text-emerald-300">"Comentá 'APP' o 'PANTALLA' y te pasamos el catálogo en video"</strong> y automatizar el primer mensaje.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      onClick={onApplyRecommendationToCanvas}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 flex items-center gap-2 transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Aplicar Recomendación en el Lienzo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 💡 BLOQUE 3: RECOMENDACIONES PRIORIZADAS */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Recomendaciones Priorizadas para vos
                </h3>
                <span className="text-[11px] text-slate-500">Ordenadas por retorno esperado</span>
              </div>

              <div className="space-y-2.5">
                {/* Rec 1 */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-all">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <h5 className="font-bold text-slate-200">
                        {postsCount === 0 ? 'Auditar primer Reel de @display_digital' : 'Optimizar llamada a la acción (CTA)'}
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        {postsCount === 0
                          ? 'Ingresá el link del Reel para evaluar el gancho inicial y retención.'
                          : 'Reemplazar el remate final por la palabra clave "APP" para captar mensajes.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onSwitchToCanvas}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs shrink-0 transition-colors"
                  >
                    {postsCount === 0 ? 'Auditar' : 'Aplicar'}
                  </button>
                </div>

                {/* Rec 2 */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-all">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <h5 className="font-bold text-slate-200">Vincular WhatsApp Cloud API o Meta Suite</h5>
                      <p className="text-[11px] text-slate-400">Configurar credenciales para recibir chats y automatizar presupuestos.</p>
                    </div>
                  </div>
                  {onOpenConnections && (
                    <button
                      onClick={onOpenConnections}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs shrink-0 transition-colors"
                    >
                      Conectar
                    </button>
                  )}
                </div>

                {/* Rec 3 */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-all">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <h5 className="font-bold text-slate-200">Transmitir contenidos a Pantallas TV</h5>
                      <p className="text-[11px] text-slate-400">Emitir el formato vertical en las vidrieras físicas de comercios.</p>
                    </div>
                  </div>
                  {onOpenTvPreview && (
                    <button
                      onClick={onOpenTvPreview}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs shrink-0 transition-colors"
                    >
                      Transmitir
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* COLUMNA LATERAL (5 de 12 columnas en Desktop) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">

            {/* 🔥 BLOQUE 4: LO QUE ESTÁ FUNCIONANDO (INTERPRETACIÓN DEL GANADOR) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Lo que está funcionando
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                  {topReel ? 'Top Rendimiento' : 'Esperando Contenido'}
                </span>
              </div>

              {topReel ? (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-100 line-clamp-2">
                      "{topReel.title}"
                    </h4>
                  </div>

                  {/* Métricas destacadas */}
                  <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Vistas / Alcance</span>
                      <span className="text-xs font-bold text-slate-200">
                        {hasValue(topReel.metrics?.views) ? formatMetric(topReel.metrics?.views) : formatMetric(topReel.metrics?.reach)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Guardados</span>
                      <span className="text-xs font-bold text-cyan-400">
                        {formatMetric(topReel.metrics?.saves)}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Likes / Comentarios</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {formatMetric(topReel.metrics?.likes)} / {formatMetric(topReel.metrics?.comments)}
                      </span>
                    </div>
                  </div>

                  {/* Por qué funcionó */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Diagnóstico del Reel
                    </span>
                    <ul className="space-y-1 text-slate-300">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span><strong>Gancho:</strong> {topReel.analysis?.hook_data?.text ? `"${topReel.analysis.hook_data.text.slice(0, 50)}..."` : 'Gancho visual dinámico.'}</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span><strong>Retención:</strong> {topReel.metrics?.retention_percentage ? `${topReel.metrics.retention_percentage}%` : 'Calculada por duración de video.'}</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span><strong>Objetivo:</strong> {topReel.objective || 'Atracción de clientes para local comercial.'}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => onAddVariantToCanvas(topReel)}
                      className="flex-1 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/20 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Crear Variante
                    </button>
                    <button
                      onClick={() => onInspectPost(topReel)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      Analizar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    Todavía no hay publicaciones registradas. Agregá tu primer Reel en el Lienzo para que el sistema identifique tu contenido con mayor impacto.
                  </p>
                  <button
                    onClick={onSwitchToCanvas}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-violet-400" />
                    <span>Agregar Reel en Lienzo</span>
                  </button>
                </div>
              )}
            </div>

            {/* ⚡ BLOQUE 5: ACCIONES RÁPIDAS (JERARQUIZADAS) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-violet-400" />
                Acciones Rápidas
              </h3>

              <div className="space-y-2">
                {/* Acción 1: CRM */}
                <button
                  onClick={onOpenCrm}
                  className="w-full p-3 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/40 hover:border-emerald-500/60 flex items-center justify-between text-left group transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-200 group-hover:text-emerald-100 block">
                        Gestionar Conversaciones y WhatsApp
                      </span>
                      <span className="text-[11px] text-emerald-300/80">
                        {conversations.length === 0
                          ? '0 conversaciones (conectar canal)'
                          : `${conversations.length} conversación(es) registradas`}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Acción 2: Emitir en TV */}
                {onOpenTvPreview && (
                  <button
                    onClick={onOpenTvPreview}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-800 text-amber-400">
                        <Tv className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          Emitir en Pantallas TV del Local
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Vista previa y sincronización de pantallas
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}

                {/* Acción 3: Abrir Informe Completo */}
                <button
                  onClick={onOpenExecutiveReport}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left group transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-800 text-violet-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Ver Informe Ejecutivo de Inteligencia
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Diagnóstico cuantitativo de retención y ganchos
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Acción 4: Conectar APIs */}
                {onOpenConnections && (
                  <button
                    onClick={onOpenConnections}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-800 text-indigo-400">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          Conectar APIs & Catálogo Externo
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Shop de Plumas, Meta/WhatsApp, OpenAI & Claude
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
