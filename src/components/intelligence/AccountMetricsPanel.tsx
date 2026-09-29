// ================================================================
// AccountMetricsPanel.tsx
// Panel de métricas de cuenta estilo Socialinsider: 5 capas de datos
// reales (Resumen Ejecutivo, Alcance & Reproducciones, Interacción
// Profunda, Desglose de Formatos, Hipótesis de IA basada en evidencia).
// Vive dentro de la pestaña "Métricas" (ExecutiveDecisionDashboard).
// ================================================================

import React from 'react';
import { Users, Eye, Heart, Layers, Brain, TrendingUp, Sparkles } from 'lucide-react';
import { AccountMetricsSnapshot } from '../../services/intelligence/AccountMetricsEngine';
import { formatMetric } from '../../services/intelligence/metricUtils';
import { MetricValue } from '../../types/intelligence';

interface AccountMetricsPanelProps {
  snapshot: AccountMetricsSnapshot;
  accountHandle: string;
  followersCount: number | null;
  followerGrowthPct: number | null;
}

const FORMAT_COLORS: Record<string, string> = {
  Reels: 'bg-violet-500',
  Carruseles: 'bg-cyan-500',
  Imágenes: 'bg-amber-500',
  Otro: 'bg-slate-500',
};

function pct(v: MetricValue): string {
  return typeof v === 'number' ? `${v}%` : 'Sin dato';
}

export const AccountMetricsPanel: React.FC<AccountMetricsPanelProps> = ({
  snapshot,
  accountHandle,
  followersCount,
  followerGrowthPct,
}) => {
  if (!snapshot.has_data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-violet-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Métricas de Cuenta — {accountHandle}
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
          {snapshot.posts_count} publicaciones analizadas
        </span>
      </div>

      {/* CAPA 1: RESUMEN EJECUTIVO */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-pink-400" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Capa 1 · Resumen Ejecutivo
          </h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className="text-lg font-black font-mono text-slate-100">
              {followersCount !== null ? followersCount.toLocaleString('es-AR') : 'Sin dato'}
            </div>
            <div className="text-[10px] text-slate-400">Seguidores totales</div>
          </div>
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className={`text-lg font-black font-mono ${followerGrowthPct !== null && followerGrowthPct > 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
              {followerGrowthPct !== null ? `${followerGrowthPct > 0 ? '+' : ''}${followerGrowthPct}%` : 'Sin historial aún'}
            </div>
            <div className="text-[10px] text-slate-400">Crecimiento (30 días)</div>
          </div>
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className="text-lg font-black font-mono text-cyan-400">
              {pct(snapshot.engagement_rate_vs_views_pct)}
            </div>
            <div className="text-[10px] text-slate-400">Engagement / vistas</div>
          </div>
        </div>

        {snapshot.peak_post && (
          <div className="p-3.5 bg-gradient-to-r from-rose-950/40 to-slate-950/60 border border-rose-500/30 rounded-xl flex items-start gap-2.5">
            <TrendingUp className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-rose-300">Pico de actividad:</strong> tu {snapshot.peak_post.format_label.toLowerCase()} del{' '}
              {new Date(snapshot.peak_post.post.published_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} generó{' '}
              <strong className="text-slate-100">{snapshot.peak_post.metric_value.toLocaleString('es-AR')} comentarios</strong>{' '}
              ({snapshot.peak_post.pct_above_median}% sobre tu mediana).
            </p>
          </div>
        )}
      </div>

      {/* CAPA 2: ALCANCE & REPRODUCCIONES */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Capa 2 · Alcance & Reproducciones
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-base font-black font-mono text-slate-100">{formatMetric(snapshot.total_views, { compact: true })}</div>
            <div className="text-[10px] text-slate-400">Reproducciones totales</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-slate-100">{formatMetric(snapshot.total_reach, { compact: true })}</div>
            <div className="text-[10px] text-slate-400">Alcance total</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-slate-100">{pct(snapshot.organic_reach_rate_pct)}</div>
            <div className="text-[10px] text-slate-400">Alcance orgánico / seguidor</div>
          </div>
        </div>
      </div>

      {/* CAPA 3: INTERACCIÓN PROFUNDA */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Capa 3 · Interacción Profunda
          </h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-base font-black font-mono text-slate-100">{formatMetric(snapshot.total_likes, { compact: true })}</div>
            <div className="text-[10px] text-slate-400">Me Gusta</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-amber-400">{formatMetric(snapshot.total_comments, { compact: true })}</div>
            <div className="text-[10px] text-slate-400">Comentarios</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-slate-100">{formatMetric(snapshot.total_saves, { compact: true })}</div>
            <div className="text-[10px] text-slate-400">Guardados</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-slate-100">{formatMetric(snapshot.total_shares, { compact: true })}</div>
            <div className="text-[10px] text-slate-400">Compartidos</div>
          </div>
        </div>
      </div>

      {/* CAPA 4: DESGLOSE DE FORMATOS */}
      {snapshot.format_breakdown.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Capa 4 · Desglose de Formatos
            </h4>
          </div>
          <div className="space-y-2.5">
            {snapshot.format_breakdown.map(entry => (
              <div key={entry.format} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">
                    {entry.format} <span className="text-slate-500">({entry.count} · {entry.pct_of_posts}% de posts)</span>
                  </span>
                  <span className="font-mono text-slate-400">
                    {typeof entry.pct_of_views === 'number' ? `${entry.pct_of_views}% de vistas` : 'Vistas: sin dato'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${FORMAT_COLORS[entry.format] || 'bg-slate-500'} rounded-full`}
                    style={{ width: `${typeof entry.pct_of_views === 'number' ? entry.pct_of_views : entry.pct_of_posts}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CAPA 5: MOTOR DE INTELIGENCIA & ESTRATEGIA IA */}
      <div className="bg-gradient-to-br from-violet-950/40 via-slate-900 to-indigo-950/30 border border-violet-500/30 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-violet-300">
            Capa 5 · Motor de Inteligencia — Hipótesis Basada en Evidencia
          </h4>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
          <span>{snapshot.ai_hypothesis}</span>
        </p>
      </div>
    </div>
  );
};
