// ================================================================
// ExecutiveIntelligenceReportModal.tsx
// Informe de Inteligencia Estratégica para Dueños de Negocio
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState } from 'react';
import {
  X, Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Bookmark, Eye, Target, ShieldCheck, Zap,
  Layers, Copy, Check, HelpCircle,
  BarChart3
} from 'lucide-react';
import { ExecutiveIntelligenceReport } from '../../services/intelligence/ContentIntelligenceEngine';
import { toast } from 'sonner';

interface ExecutiveIntelligenceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExecutiveIntelligenceReport;
  onApplyNextPostToCanvas?: () => void;
}

export const ExecutiveIntelligenceReportModal: React.FC<ExecutiveIntelligenceReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onApplyNextPostToCanvas,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumen' | 'ganadores' | 'patrones' | 'plan_accion'>('resumen');

  if (!isOpen) return null;

  const handleCopyReport = () => {
    const text = `
📊 INFORME DE INTELIGENCIA — EVENTPIX
Cuenta: ${report.account_handle}
Health Score: ${report.global_health_score}/100
Publicaciones Analizadas: ${report.analyzed_posts_count}

DIAGNÓSTICO:
${report.account_status_summary}

QUÉ DEJAR DE HACER:
${report.what_to_stop.map(s => `- ${s.action} (Evidencia: ${s.evidence})`).join('\n')}

QUÉ REPETIR:
${report.what_to_repeat.map(r => `- ${r.action} (Evidencia: ${r.evidence})`).join('\n')}

PRÓXIMO REEL SUGERIDO:
Hook: "${report.next_recommended_post.hook}"
Estructura: ${report.next_recommended_post.structure}
CTA: "${report.next_recommended_post.cta}"
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedSection('all');
    toast.success('Informe copiado al portapapeles!');
    setTimeout(() => setCopiedSection(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 border border-violet-400/30 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  Informe de Inteligencia Estratégica
                </h2>
                <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  {report.account_handle}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoría basada en evidencia real de {report.analyzed_posts_count} publicaciones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              {copiedSection === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'all' ? 'Copiado' : 'Copiar'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Summary Metric Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/90 border-b border-slate-800 shrink-0 text-xs">
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="text-2xl font-black font-mono text-emerald-400">
              {report.global_health_score}<span className="text-xs text-slate-500">/100</span>
            </div>
            <div>
              <div className="font-bold text-slate-200 text-[11px]">Score General</div>
              <div className="text-[10px] text-slate-400">Salud del contenido</div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="text-2xl font-black font-mono text-cyan-400">
              {report.layer_averages.avg_reach.toLocaleString()}
            </div>
            <div>
              <div className="font-bold text-slate-200 text-[11px]">Alcance Promedio</div>
              <div className="text-[10px] text-slate-400">Reproducciones/post</div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="text-2xl font-black font-mono text-violet-400">
              {report.layer_averages.avg_interest_rate}%
            </div>
            <div>
              <div className="font-bold text-slate-200 text-[11px]">Tasa de Interés</div>
              <div className="text-[10px] text-slate-400">Guardados + Shares</div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="text-2xl font-black font-mono text-amber-400">
              {report.layer_averages.avg_commercial_intent_rate}%
            </div>
            <div>
              <div className="font-bold text-slate-200 text-[11px]">Intención Comercial</div>
              <div className="text-[10px] text-slate-400">Visitas & Leads proxy</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-semibold px-4 shrink-0">
          {[
            { id: 'resumen', label: '1. Diagnóstico Ejecutivo', icon: BarChart3 },
            { id: 'ganadores', label: '2. Ganadores & Perdedores', icon: TrendingUp },
            { id: 'patrones', label: '3. Patrones Demostrados', icon: Layers },
            { id: 'plan_accion', label: '4. Plan de Acción & Próximo Post', icon: Target },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-violet-500 text-violet-300 font-bold bg-violet-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
          
          {/* TAB 1: RESUMEN EJECUTIVO */}
          {activeTab === 'resumen' && (
            <div className="space-y-5">
              {/* Diagnóstico principal */}
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  ¿Qué está pasando con la cuenta?
                </div>
                <p className="text-slate-200 text-sm leading-relaxed font-normal">
                  {report.account_status_summary}
                </p>
              </div>

              {/* Separación de las 3 capas: ALCANCE vs INTERÉS vs INTENCIÓN */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-200 text-xs flex items-center gap-2 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Las 3 Capas del Rendimiento: Separando Viralidad de Negocio
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Capa 1: Alcance */}
                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-400 text-xs">Capa 1: ALCANCE</span>
                      <Eye className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Mide cuán lejos llega el contenido y cuánta gente lo reproduce.
                    </p>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Promedio:</span>
                      <span className="font-mono font-bold text-slate-200">{report.layer_averages.avg_reach} views</span>
                    </div>
                  </div>

                  {/* Capa 2: Interés */}
                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-violet-400 text-xs">Capa 2: INTERÉS</span>
                      <Bookmark className="w-4 h-4 text-violet-400" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Mide si el contenido vale la pena guardar para después o compartir con socios.
                    </p>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Tasa de Interés:</span>
                      <span className="font-mono font-bold text-slate-200">{report.layer_averages.avg_interest_rate}%</span>
                    </div>
                  </div>

                  {/* Capa 3: Intención Comercial */}
                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 text-xs">Capa 3: INTENCIÓN</span>
                      <Target className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Mide si el contenido genera visitas al perfil, comentarios con palabras clave o consultas.
                    </p>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Tasa Comercial:</span>
                      <span className="font-mono font-bold text-slate-200">{report.layer_averages.avg_commercial_intent_rate}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-violet-950/20 border border-violet-500/30 rounded-2xl text-[11px] text-violet-300 flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Veredicto de Alcance vs Intención:</strong> {report.layer_averages.reach_vs_intent_verdict}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GANADORES & PERDEDORES */}
          {activeTab === 'ganadores' && (
            <div className="space-y-5">
              {/* Ganadores */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  Contenidos Ganadores (Top Performers con Evidencia)
                </div>

                {report.top_performers.length === 0 ? (
                  <p className="text-slate-500 text-xs">No hay suficientes posts analizados para clasificar ganadores.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.top_performers.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-950 border border-emerald-500/30 rounded-2xl space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-200 text-xs line-clamp-2">
                            {item.post.title}
                          </h4>
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-mono font-bold text-[10px] shrink-0">
                            Score: {item.score.total_score}/100
                          </span>
                        </div>

                        <p className="text-[11px] text-emerald-300 font-medium">
                          {item.score.verdict}
                        </p>

                        <div className="space-y-1 pt-2 border-t border-slate-800">
                          {item.evidence.map((ev, i) => (
                            <div key={i} className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{ev}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Perdedores */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                  Contenidos Perdedores (Qué falló y qué penalizó)
                </div>

                {report.bottom_performers.length === 0 ? (
                  <p className="text-slate-500 text-xs">No se detectaron publicaciones con bajo rendimiento crítico.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.bottom_performers.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-950 border border-rose-500/30 rounded-2xl space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-200 text-xs line-clamp-2">
                            {item.post.title}
                          </h4>
                          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full font-mono font-bold text-[10px] shrink-0">
                            Score: {item.score.total_score}/100
                          </span>
                        </div>

                        <p className="text-[11px] text-rose-300 font-medium">
                          {item.score.verdict}
                        </p>

                        <div className="space-y-1 pt-2 border-t border-slate-800">
                          {item.score.penalties.map((pen, i) => (
                            <div key={i} className="text-[10px] text-rose-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{pen}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PATRONES DEMOSTRADOS */}
          {activeTab === 'patrones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400">
                  <Layers className="w-4 h-4" />
                  Patrones Detectados en las Publicaciones
                </div>
                <span className="text-[10px] text-slate-500">
                  Muestra: {report.analyzed_posts_count} publicaciones
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.patterns.map((pat, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs">{pat.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        pat.recommendation === 'repetir'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {pat.recommendation}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {pat.reasoning}
                    </p>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Métricas clave:</span>
                      <span className="text-violet-300 font-mono font-bold">
                        Interés {pat.avg_interest_score}/100 · Comercial {pat.avg_commercial_score}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PLAN DE ACCIÓN & PRÓXIMO POST */}
          {activeTab === 'plan_accion' && (
            <div className="space-y-6">
              
              {/* QUÉ DEJAR DE HACER */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Qué Dejar de Hacer (Eliminar de Inmediato)
                </h4>
                <div className="space-y-2">
                  {report.what_to_stop.map((item, idx) => (
                    <div key={idx} className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-1">
                      <div className="font-bold text-rose-300 text-xs">{item.action}</div>
                      <div className="text-[11px] text-slate-400">
                        <strong>Evidencia:</strong> {item.evidence}
                      </div>
                      <div className="text-[10px] text-rose-400 font-medium">
                        ⚠️ Impacto negativo: {item.estimated_budget_waste}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUÉ REPETIR */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Qué Repetir (Patrones Comprobados)
                </h4>
                <div className="space-y-2">
                  {report.what_to_repeat.map((item, idx) => (
                    <div key={idx} className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1">
                      <div className="font-bold text-emerald-300 text-xs">{item.action}</div>
                      <div className="text-[11px] text-slate-400">
                        <strong>Evidencia:</strong> {item.evidence}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-medium">
                        ✨ Ganancia estimada: {item.expected_gain}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRÓXIMO REEL PARA PUBLICAR */}
              <div className="p-5 bg-gradient-to-br from-violet-950/50 to-indigo-950/50 border-2 border-violet-500/40 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                    <h4 className="font-bold text-violet-200 text-sm">
                      Próximo Reel Recomendado para Grabar
                    </h4>
                  </div>
                  <span className="text-[10px] bg-violet-500/30 text-violet-300 px-2.5 py-1 rounded-full font-mono font-bold">
                    Duración: {report.next_recommended_post.duration_seconds}s
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-pink-400 block mb-1">
                      Gancho de Apertura (0 - 3s):
                    </span>
                    <p className="text-slate-100 font-medium text-xs">
                      "{report.next_recommended_post.hook}"
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">
                      Estructura Narrativa:
                    </span>
                    <p className="text-slate-300 text-xs">
                      {report.next_recommended_post.structure}
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">
                      Llamado a la Acción (CTA de Conversión):
                    </span>
                    <p className="text-slate-200 text-xs font-semibold">
                      "{report.next_recommended_post.cta}"
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  💡 {report.next_recommended_post.justification}
                </p>

                {onApplyNextPostToCanvas && (
                  <button
                    onClick={onApplyNextPostToCanvas}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all hover:scale-102"
                  >
                    <Sparkles className="w-4 h-4" />
                    Cargar este Guión Recomendado al Canvas
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0 text-xs">
          <span className="text-[11px] text-slate-500">
            EventPix Intelligence Engine · Algoritmo Cuantitativo v2.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Cerrar Informe
          </button>
        </div>

      </div>
    </div>
  );
};
