import React, { useState, useMemo } from 'react';
import { BusinessAuditReport, IntelligenceBusiness, IntelligencePost } from '../../types/intelligence';
import { Activity, AlertTriangle, CheckCircle, Lightbulb, ChevronRight, ChevronLeft, ArrowUpRight, Share2, Sparkles, MessageSquare, Bot, FileImage, ShieldCheck, Tv, Users, Instagram, Target } from 'lucide-react';
import { CompetitorAnalysisPanel } from './CompetitorAnalysisPanel';
import { MetaConnectionPanel } from './MetaConnectionPanel';
import { MetaAdsAuditPanel } from './MetaAdsAuditPanel';
import { MetaAdsIntelligenceEngine } from '../../services/intelligence/MetaAdsIntelligenceEngine';
import { MetaAdCampaign } from '../../types/ads';
import { MetaMediaItem, MetaMediaInsights } from '../../services/meta/MetaGraphService';

import { UnifiedConnectionsState } from '../../types/connections';

interface BusinessAuditPanelProps {
  business: IntelligenceBusiness;
  auditReport: BusinessAuditReport;
  isOpen: boolean;
  onToggle: () => void;
  onAddReelToCanvas?: (reel: MetaMediaItem & { insights?: MetaMediaInsights }) => void;
  onOpenExecutiveReport?: () => void;
  onAddAdToCanvas?: (campaign: MetaAdCampaign) => void;
  onPromoteReelToAd?: (reelTitle: string) => void;
  posts?: IntelligencePost[];
  accountHandle?: string;
  connections?: UnifiedConnectionsState;
  onOpenConnections?: () => void;
}

export const BusinessAuditPanel: React.FC<BusinessAuditPanelProps> = ({
  business,
  auditReport,
  isOpen,
  onToggle,
  onAddReelToCanvas,
  onOpenExecutiveReport,
  onAddAdToCanvas,
  onPromoteReelToAd,
  posts = [],
  accountHandle,
  connections,
  onOpenConnections
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'integrations' | 'competitors' | 'instagram' | 'ads'>('audit');

  const { myAvgViews, myAvgLikes, myAvgComments, myEngagementRate } = useMemo(() => {
    if (!posts || posts.length === 0) {
      return { myAvgViews: 0, myAvgLikes: 0, myAvgComments: 0, myEngagementRate: 0 };
    }
    const validViews = posts.map(p => p.metrics?.views || 0).filter(v => v > 0);
    const avgViews = validViews.length > 0 ? Math.round(validViews.reduce((a, b) => a + b, 0) / validViews.length) : 0;
    const avgLikes = Math.round(posts.reduce((s, p) => s + (p.metrics?.likes || 0), 0) / posts.length);
    const avgComments = Math.round(posts.reduce((s, p) => s + (p.metrics?.comments || 0), 0) / posts.length);
    const totalInteractions = posts.reduce((s, p) => s + (p.metrics?.likes || 0) + (p.metrics?.comments || 0), 0);
    const totalReach = posts.reduce((s, p) => s + (p.metrics?.reach || p.metrics?.views || 0), 0);
    const engRate = totalReach > 0 ? Math.round((totalInteractions / totalReach) * 1000) / 10 : 0;
    return { myAvgViews: avgViews, myAvgLikes: avgLikes, myAvgComments: avgComments, myEngagementRate: engRate };
  }, [posts]);

  const adsReport = useMemo(() => {
    return MetaAdsIntelligenceEngine.generateAdsReport();
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-24 z-40 bg-slate-900/90 border border-slate-800 border-r-0 text-emerald-400 p-2.5 rounded-l-xl shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all flex items-center gap-2 group"
        title="Abrir Auditoría de Comercio & Acciones"
      >
        <ChevronLeft className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold tracking-wide text-slate-200 hidden md:inline">Auditoría & Conectores</span>
        <Activity className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  const needleRotation = (auditReport.health_score / 100) * 180 - 90;

  return (
    <aside className="w-72 sm:w-80 lg:w-[320px] shrink-0 bg-slate-950/95 border-l border-slate-800/80 h-[calc(100vh-4rem)] flex flex-col z-30 shadow-2xl backdrop-blur-xl transition-all duration-300">
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Auditoría & Conectores
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono">LIVE</span>
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[190px]">{accountHandle || auditReport.instagram_handle || business.instagram_handle || '@display_digital'}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-5 p-1 bg-slate-900/80 border-b border-slate-800/60 text-[8px] font-medium gap-0.5">
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-all ${
            activeTab === 'audit' ? 'bg-emerald-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3 h-3" />
          Auditoría
        </button>
        <button
          onClick={() => setActiveTab('instagram')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-all ${
            activeTab === 'instagram' ? 'bg-pink-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Instagram className="w-3 h-3" />
          Instagram
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-all ${
            activeTab === 'ads' ? 'bg-cyan-600 text-white shadow-md font-bold' : 'text-cyan-400 hover:text-cyan-300'
          }`}
        >
          <Target className="w-3 h-3" />
          Meta Ads
        </button>
        <button
          onClick={() => setActiveTab('competitors')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-all ${
            activeTab === 'competitors' ? 'bg-violet-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3 h-3" />
          Competencia
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-all ${
            activeTab === 'integrations' ? 'bg-emerald-600 text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-3 h-3" />
          Conectores
        </button>
      </div>

      <div className={`flex-1 min-h-0 text-xs ${activeTab === 'competitors' || activeTab === 'instagram' || activeTab === 'ads' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-4 space-y-5 custom-scrollbar'}`}>

        {activeTab === 'audit' && (
          <>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center relative overflow-hidden">
              <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Calificación general del perfil</span>
                <span className="text-emerald-400 font-mono font-bold">{auditReport.health_score}/100</span>
              </div>

              <div className="relative w-44 h-24 my-2 flex items-end justify-center">
                <svg className="w-44 h-24 overflow-visible" viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1E293B" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 10 50 A 40 40 0 0 1 25.8 21.7" fill="none" stroke="#EF4444" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 25.8 21.7 A 40 40 0 0 1 74.2 21.7" fill="none" stroke="#F59E0B" strokeWidth="10" />
                  <path d="M 74.2 21.7 A 40 40 0 0 1 90 50" fill="none" stroke="#10B981" strokeWidth="10" strokeLinecap="round" />
                  <g transform={`rotate(${needleRotation}, 50, 50)`} className="transition-transform duration-700 ease-out">
                    <line x1="50" y1="50" x2="50" y2="16" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="5" fill="#38BDF8" stroke="#F8FAFC" strokeWidth="2" />
                  </g>
                </svg>
              </div>

              <div className="text-center">
                <span className="text-xl font-black text-slate-100 font-mono tracking-tight">{auditReport.health_score} <span className="text-xs font-normal text-slate-400">/100</span></span>
                <p className="text-[11px] font-semibold text-emerald-400">Excelente, sigue así</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
              <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Resumen Ejecutivo
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {auditReport.executive_summary}
              </p>
            </div>

            {onOpenExecutiveReport && (
              <button
                onClick={onOpenExecutiveReport}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all hover:scale-102"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Ver Informe de Inteligencia Completo
              </button>
            )}

            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-3">
              <h4 className="font-bold text-violet-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Optimizar Bio de Instagram
              </h4>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                <span className="text-[10px] text-slate-500 font-sans block mb-1 uppercase font-bold">Bio Actual:</span>
                {auditReport?.bio_audit?.current_bio || 'Sin biografía cargada'}
              </div>

              <div className="bg-rose-950/20 border border-rose-500/30 p-2.5 rounded-xl space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fuga de Conversión por Fecha
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {auditReport?.bio_audit?.weaknesses?.[0] || 'Optimizar llamado a la acción comercial.'}
                </p>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 p-2.5 rounded-xl space-y-1">
                <span className="font-bold text-emerald-400 flex items-center gap-1 text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5" /> Recomendación Evergreen (Atemporal)
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {auditReport?.bio_audit?.recommendations?.[0] || 'Agregar enlace directo a WhatsApp o catálogo.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Fortalezas Detectadas
              </h4>
              <div className="space-y-2">
                {auditReport.strengths.map((item, idx) => (
                  <div key={idx} className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-xl text-slate-300 leading-snug flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <h4 className="font-bold text-slate-200 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-violet-400" />
                  Acciones a Aplicar
                </span>
              </h4>
              
              <div className="space-y-2">
                {auditReport.immediate_actions.map((action, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-[11px]">{action.title}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'competitors' && (
          <CompetitorAnalysisPanel
            myAvgViews={myAvgViews}
            myAvgLikes={myAvgLikes}
            myAvgComments={myAvgComments}
            myEngagementRate={myEngagementRate}
            onAddReelToCanvas={onAddReelToCanvas}
          />
        )}

        {activeTab === 'instagram' && (
          <MetaConnectionPanel onAddReelToCanvas={onAddReelToCanvas} />
        )}

        {activeTab === 'ads' && (
          <MetaAdsAuditPanel
            report={adsReport}
            onAddAdToCanvas={onAddAdToCanvas}
            onPromoteReelToAd={onPromoteReelToAd}
          />
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-3">
            <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-xl space-y-1">
              <h4 className="font-bold text-violet-300 text-xs flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-violet-400" />
                Matriz de Conectores e Integraciones
              </h4>
              <p className="text-slate-400 text-[11px]">
                Estado real de tus canales para automatización, captación de leads y pantallas.
              </p>
            </div>

            <div className="space-y-2.5">
              {/* 1. Display Hub */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-200 text-xs">Display Hub (Pantallas TV)</span>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                    0 Pantallas
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] font-mono">
                  Sincronización con vidrieras físicas de comercios.
                </p>
              </div>

              {/* 2. WhatsApp Cloud API */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200 text-xs">WhatsApp Cloud API (Meta)</span>
                  </div>
                  {connections?.whatsapp?.status === 'connected' ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Activo
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                      No vinculado
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px] font-mono">
                  Estado: <span className="text-slate-200 font-semibold">{connections?.whatsapp?.status === 'connected' ? 'Número vinculado' : 'Sin configurar'}</span>
                </p>
              </div>

              {/* 3. OpenAI GPT-4o */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200 text-xs">OpenAI (GPT-4o)</span>
                  </div>
                  {connections?.openai?.status === 'connected' ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Activo
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                      Requiere saldo
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px] font-mono">
                  Cuenta: <span className="text-slate-200 font-semibold">{connections?.openai?.apiKey ? 'API Key guardada' : 'Sin API Key'}</span>
                </p>
              </div>

              {/* 4. Claude 3.5 */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-200 text-xs">Claude 3.5 Sonnet</span>
                  </div>
                  {connections?.claude?.status === 'connected' ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Activo
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                      No vinculado
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px] font-mono">
                  Cuenta: <span className="text-slate-200 font-semibold">{connections?.claude?.apiKey ? 'Clave guardada' : 'Sin configurar'}</span>
                </p>
              </div>

              {/* 5. Shop de Plumas */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-400" />
                    <span className="font-bold text-slate-200 text-xs">Catálogo Shop de Plumas</span>
                  </div>
                  {connections?.shopDePlumas?.status === 'connected' ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Conectado
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                      No sincronizado
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px] font-mono">
                  Productos: <span className="text-slate-200 font-semibold">{connections?.shopDePlumas?.syncedProducts?.length || 0} sincronizados</span>
                </p>
              </div>

              {/* 6. Canva */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-violet-400" />
                    <span className="font-bold text-slate-200 text-xs">Canva Design Kit</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    Listo
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] font-mono">
                  Exportación de plantillas para pantalla vertical.
                </p>
              </div>
            </div>

            {onOpenConnections && (
              <button
                onClick={onOpenConnections}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all mt-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Gestionar Conexiones & APIs</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
