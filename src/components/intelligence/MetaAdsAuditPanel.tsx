// ================================================================
// MetaAdsAuditPanel.tsx
// Panel de Auditoría y Estrategia de Meta Ads
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState } from 'react';
import {
  AlertTriangle, Target, Sparkles, Pause, Play, ArrowUpRight, Zap, Loader2
} from 'lucide-react';
import { AdsIntelligenceReport, MetaAdCampaign } from '../../types/ads';
import { MetaGraphService } from '../../services/meta/MetaGraphService';
import { toast } from 'sonner';

interface MetaAdsAuditPanelProps {
  report: AdsIntelligenceReport;
  businessId: string;
  onAddAdToCanvas?: (campaign: MetaAdCampaign) => void;
  onPromoteReelToAd?: (reelTitle: string) => void;
}

export const MetaAdsAuditPanel: React.FC<MetaAdsAuditPanelProps> = ({
  report,
  businessId,
  onAddAdToCanvas,
  onPromoteReelToAd,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'resumen' | 'campanas' | 'cruce_organico'>('resumen');
  const [pausedCampaignIds, setPausedCampaignIds] = useState<string[]>([]);
  const [togglingCampaignId, setTogglingCampaignId] = useState<string | null>(null);

  // Pausa/reactiva la campaña de verdad en Meta Ads Manager (no solo un toggle visual).
  const handleTogglePause = async (campaignId: string, campaignName: string) => {
    const isPaused = pausedCampaignIds.includes(campaignId);
    setTogglingCampaignId(campaignId);
    try {
      await MetaGraphService.setCampaignStatus(campaignId, isPaused ? 'ACTIVE' : 'PAUSED', businessId);
      if (isPaused) {
        setPausedCampaignIds(prev => prev.filter(id => id !== campaignId));
        toast.success(`Campaña "${campaignName}" reactivada en Meta Ads Manager.`);
      } else {
        setPausedCampaignIds(prev => [...prev, campaignId]);
        toast.success(`Campaña "${campaignName}" pausada en Meta Ads Manager.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar el estado de la campaña en Meta.');
    } finally {
      setTogglingCampaignId(null);
    }
  };

  if (!report.campaigns || report.campaigns.length === 0) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4 text-xs">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
          <Target className="w-7 h-7" />
        </div>
        <div className="max-w-xs space-y-1.5">
          <h4 className="text-sm font-bold text-slate-200">
            Cuenta de Meta Ads no vinculada
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            No hay campañas publicitarias activas vinculadas. Para auditar costos reales por lead, CPA y pausar anuncios con gasto excesivo, conectá tu cuenta en <strong>Conectar APIs</strong>.
          </p>
        </div>
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-left space-y-1 w-full max-w-xs">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Beneficio de vincular:</span>
          <p className="text-[10px] text-slate-400">
            • Detección de anuncios que queman presupuesto.<br />
            • Conversión automática de Reels ganadores a anuncios publicitarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs">
      {/* Header Banner de Cuenta Publicitaria */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Target className="w-4 h-4 text-cyan-400" />
              <span>{report.ad_account_name}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              ID: {report.ad_account_id}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400">Eficiencia:</span>
            <span className={`font-mono font-bold text-xs ${
              report.budget_efficiency_score >= 80 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {report.budget_efficiency_score}/100
            </span>
          </div>
        </div>

        {/* Métricas clave resumidas */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-500">Gasto Total</div>
            <div className="font-mono font-bold text-slate-200 text-xs">${report.total_spend.toFixed(0)}</div>
          </div>
          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-500">Leads / Conv.</div>
            <div className="font-mono font-bold text-cyan-400 text-xs">{report.total_conversions}</div>
          </div>
          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-500">CPA Promedio</div>
            <div className="font-mono font-bold text-emerald-400 text-xs">${report.avg_cpa.toFixed(2)}</div>
          </div>
          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] text-slate-500">ROAS Prom.</div>
            <div className="font-mono font-bold text-violet-400 text-xs">{report.avg_roas}x</div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="grid grid-cols-3 p-1 bg-slate-900/70 border-b border-slate-800 text-[11px] font-medium gap-1 shrink-0">
        <button
          onClick={() => setActiveSubTab('resumen')}
          className={`py-1.5 rounded-lg transition-all ${
            activeSubTab === 'resumen' ? 'bg-violet-600 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Diagnóstico Ads
        </button>
        <button
          onClick={() => setActiveSubTab('campanas')}
          className={`py-1.5 rounded-lg transition-all ${
            activeSubTab === 'campanas' ? 'bg-violet-600 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Campañas ({report.campaigns.length})
        </button>
        <button
          onClick={() => setActiveSubTab('cruce_organico')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'cruce_organico' ? 'bg-pink-600 text-white font-bold shadow-md' : 'text-pink-400 hover:text-pink-300'
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-300" />
          Cruce Orgánico
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        
        {/* SUB-TAB 1: DIAGNÓSTICO */}
        {activeSubTab === 'resumen' && (
          <div className="space-y-4">
            {/* Alerta de Desperdicio */}
            {report.wasted_budget_amount > 0 && (
              <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Drenaje de Presupuesto Detectado
                  </span>
                  <span className="font-mono font-bold text-rose-400 text-xs">
                    ${report.wasted_budget_amount.toFixed(2)} desperdiciados
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tenés anuncios con CPA 6x superior a la media o con gasto acumulado y cero conversiones.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      report.bleeding_campaigns.forEach(c => handleTogglePause(c.id, c.name));
                    }}
                    className="w-full py-2 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 rounded-xl font-bold text-[11px] transition-all"
                  >
                    Frenar Desperdicio (Pausar Anuncios Sangrantes)
                  </button>
                </div>
              </div>
            )}

            {/* Acciones Estratégicas Priorizadas */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Acciones Inmediatas Recomendadas
              </h4>

              {report.strategic_actions.map((act, idx) => (
                <div key={idx} className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs">{act.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                      act.priority === 'URGENTE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {act.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {act.description}
                  </p>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    {act.estimated_savings_or_gain}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB-TAB 2: LISTA DE CAMPAÑAS */}
        {activeSubTab === 'campanas' && (
          <div className="space-y-3">
            {report.campaigns.map(camp => {
              const isPaused = pausedCampaignIds.includes(camp.id);
              return (
                <div
                  key={camp.id}
                  className={`p-3.5 bg-slate-900/90 border rounded-2xl space-y-2.5 transition-all ${
                    camp.status_verdict === 'ganadora' ? 'border-emerald-500/40' :
                    camp.status_verdict === 'desperdiciando_presupuesto' ? 'border-rose-500/40' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs line-clamp-1">{camp.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 uppercase">{camp.objective}</span>
                        <span className="text-[10px] text-slate-600">·</span>
                        <span className="text-[10px] font-mono text-slate-400">${camp.daily_budget}/día</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase shrink-0 ${
                      isPaused ? 'bg-slate-800 text-slate-400' :
                      camp.status_verdict === 'ganadora' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      camp.status_verdict === 'desperdiciando_presupuesto' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {isPaused ? 'PAUSADA' : camp.status_verdict.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-4 gap-1.5 py-1.5 px-2 bg-slate-950 rounded-xl text-center text-[10px]">
                    <div>
                      <div className="text-slate-500 text-[9px]">Gasto</div>
                      <div className="font-mono font-bold text-slate-200">${camp.spend.toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[9px]">CTR</div>
                      <div className="font-mono font-bold text-cyan-400">{camp.ctr}%</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[9px]">CPA</div>
                      <div className="font-mono font-bold text-emerald-400">${camp.cpa.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[9px]">Leads</div>
                      <div className="font-mono font-bold text-amber-400">{camp.conversions}</div>
                    </div>
                  </div>

                  {/* Recomendación */}
                  <p className="text-[11px] text-slate-300 leading-snug">
                    💡 {camp.recommendation}
                  </p>

                  {/* Acciones */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => handleTogglePause(camp.id, camp.name)}
                      disabled={togglingCampaignId === camp.id}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 ${
                        isPaused
                          ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                          : 'bg-rose-600/20 text-rose-300 hover:bg-rose-600/30'
                      }`}
                    >
                      {togglingCampaignId === camp.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      {isPaused ? 'Reanudar' : 'Pausar Anuncio'}
                    </button>

                    {onAddAdToCanvas && (
                      <button
                        onClick={() => {
                          onAddAdToCanvas(camp);
                          toast.success(`Campaña "${camp.name}" agregada al Canvas!`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-[10px] font-semibold border border-violet-500/30 transition-all"
                      >
                        + Canvas
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUB-TAB 3: CRUCE ORGÁNICO -> PAID ADS */}
        {activeSubTab === 'cruce_organico' && (
          <div className="space-y-4">
            <div className="p-3 bg-pink-950/20 border border-pink-500/30 rounded-2xl space-y-1.5">
              <span className="font-bold text-pink-300 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pink-400" />
                Puente Orgánico $\rightarrow$ Anuncios Pagados
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                El error común es crear anuncios desde cero en Ads Manager. La estrategia ganadora es <strong>tomar los Reels orgánicos con mayor intención comercial demostrada</strong> y convertirlos en creativos de prospección.
              </p>
            </div>

            <div className="space-y-3">
              {report.cross_channel_opportunities.map((opp, idx) => (
                <div key={idx} className="p-4 bg-slate-900 border border-pink-500/40 rounded-2xl space-y-2.5 shadow-lg shadow-pink-950/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider block">
                        Reel Ganador Detectado:
                      </span>
                      <h4 className="font-bold text-slate-100 text-xs">
                        "{opp.reel_title}"
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-mono font-bold text-[10px] shrink-0">
                      -{opp.estimated_cpa_reduction_pct}% CPA proyectado
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {opp.why_it_works}
                  </p>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                    <strong className="text-slate-300">Campaña Sugerida:</strong> {opp.suggested_ad_campaign}
                  </div>

                  <button
                    onClick={() => {
                      if (onPromoteReelToAd) {
                        onPromoteReelToAd(opp.reel_title);
                      }
                      toast.success(`⚡ Creativo "${opp.reel_title}" vinculado a campaña en el Canvas!`);
                    }}
                    className="w-full py-2 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/30 transition-all hover:scale-102"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {opp.action_label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
