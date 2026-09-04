import React, { useState } from 'react';
import { IntelligencePost } from '../../types/intelligence';
import { X, Eye, Heart, MessageSquare, Share2, Bookmark, Flame, Target, Layers, Zap } from 'lucide-react';

interface ReelBreakdownModalProps {
  post: IntelligencePost | null;
  onClose: () => void;
}

export const ReelBreakdownModal: React.FC<ReelBreakdownModalProps> = ({ post, onClose }) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'diagnosis' | 'transcript'>('layers');

  if (!post || !post.analysis) return null;

  const { analysis, metrics } = post;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Despiece Multimodal (5 Capas de IA)
                <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-mono">Reel</span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{post.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Metrics Bar */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-950/80 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="font-bold text-slate-200 font-mono">{metrics.views.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">Vistas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <div>
                <div className="font-bold text-slate-200 font-mono">{metrics.likes}</div>
                <div className="text-[10px] text-slate-400">Likes ({metrics.like_rate}%)</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="font-bold text-slate-200 font-mono">{metrics.comments}</div>
                <div className="text-[10px] text-slate-400">Comentarios</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-bold text-slate-200 font-mono">{metrics.shares}</div>
                <div className="text-[10px] text-slate-400">Compartidos</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-violet-400" />
              <div>
                <div className="font-bold text-slate-200 font-mono">{metrics.saves}</div>
                <div className="text-[10px] text-slate-400">Guardados ({metrics.save_rate}%)</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-semibold px-4">
          <button
            onClick={() => setActiveTab('layers')}
            className={`py-3 px-4 border-b-2 transition-all ${
              activeTab === 'layers' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Despiece por Segments (0-3s, etc.)
          </button>
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 px-4 border-b-2 transition-all ${
              activeTab === 'diagnosis' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Diagnóstico de Rendimiento IA
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
          {activeTab === 'layers' && (
            <>
              {/* Capa 1: Hook Analysis Box */}
              <div className="bg-gradient-to-r from-violet-950/40 to-slate-900 border border-violet-500/30 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                    <Zap className="w-4 h-4 text-violet-400" />
                    Capa 1: Análisis del Hook (0-3 segundos)
                  </span>
                  <span className="bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold font-mono">
                    Score Hook: {analysis.hook_data.curiosity_score}/100
                  </span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <p className="text-slate-100 font-semibold text-sm italic">"{analysis.hook_data.text}"</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Tipo de Gancho</span>
                    <span className="font-bold text-slate-200 capitalize">{analysis.hook_data.type.replace('_', ' ')}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Fuerza Auditiva</span>
                    <span className="font-bold text-emerald-400 uppercase">{analysis.hook_data.auditory_strength}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Texto OCR en Pantalla</span>
                    <span className="font-bold text-cyan-400">{analysis.hook_data.has_text_on_screen ? 'Sí (Texto Dinámico)' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Capa 2: Segmentos Temporales */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Capa 2: Línea de Tiempo y Estructura Narrativa
                </h4>
                <div className="space-y-2.5">
                  {analysis.time_segments.map((seg, idx) => (
                    <div key={idx} className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-20 bg-slate-800 text-slate-200 font-mono font-bold px-2.5 py-1 rounded-lg text-center text-[11px] shrink-0">
                        {seg.range}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-violet-400 uppercase text-[10px] tracking-wider">{seg.narrative_role}</span>
                          <span className="text-slate-500 text-[10px]">{seg.visual_cue}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs">{seg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capa 3: Emoción, Tono y Lenguaje */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Flame className="w-4 h-4 text-amber-400" />
                    Capa 3: Emociones Gatilladas
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.emotions.map((emo, i) => (
                      <span key={i} className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium text-[11px] capitalize">
                        {emo}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Capa 4: Llamado a la Acción (CTA)
                  </h5>
                  <p className="text-slate-300 text-xs italic font-medium">"{analysis.cta_data.text}"</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>Fuerza: <strong className="text-emerald-400 uppercase">{analysis.cta_data.strength}</strong></span>
                    <span>•</span>
                    <span>Tipo: <strong className="text-slate-200">{analysis.cta_data.type}</strong></span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'diagnosis' && (
            <div className="space-y-4">
              {/* Lo que funcionó */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-emerald-400 text-xs uppercase tracking-wider">🟢 Puntos Fuertes (Qué Funcionó)</h5>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {analysis.diagnosis.what_worked.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lo que falló */}
              <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-rose-400 text-xs uppercase tracking-wider">🔴 Puntos a Mejorar (Qué Falló)</h5>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {analysis.diagnosis.what_failed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hipótesis de Rendimiento */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-amber-400 text-xs uppercase tracking-wider">💡 Hipótesis de Rendimiento Algorítmico</h5>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {analysis.diagnosis.hypotheses.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
