// ================================================================
// AccountMetricsPanel.tsx
// Panel de métricas de cuenta estilo Socialinsider: 5 capas de datos
// reales (Resumen Ejecutivo, Alcance & Reproducciones, Interacción
// Profunda, Desglose de Formatos, Hipótesis de IA basada en evidencia).
// Vive dentro de la pestaña "Métricas" (ExecutiveDecisionDashboard).
// ================================================================

import React from 'react';
import { Users, Eye, Heart, Layers, Brain, TrendingUp, Sparkles, Lightbulb, CalendarClock, Tags } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import { AccountMetricsSnapshot } from '../../services/intelligence/AccountMetricsEngine';
import { formatMetric, hasValue } from '../../services/intelligence/metricUtils';
import { MetricValue } from '../../types/intelligence';
import { ProfileSnapshot } from '../../services/intelligence/ProfileSnapshotService';

interface AccountMetricsPanelProps {
  snapshot: AccountMetricsSnapshot;
  accountHandle: string;
  followersCount: number | null;
  followerGrowthPct: number | null;
  followerHistory: ProfileSnapshot[];
}

const PILLAR_COLORS = ['#8b5cf6', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#f87171'];

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
  followerHistory,
}) => {
  if (!snapshot.has_data) return null;

  const growthChartData = followerHistory
    .filter(h => typeof h.follower_count === 'number')
    .map(h => ({
      date: new Date(`${h.snapshot_date}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
      seguidores: h.follower_count as number,
    }));

  const pillarChartData = snapshot.content_pillars
    .filter(p => hasValue(p.total_engagement))
    .slice(0, 6)
    .map(p => ({ topic: p.topic, engagement: p.total_engagement as number }));

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

      {/* RESUMEN DE INSIGHTS CLAVE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-300" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Resumen de Insights Clave
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{snapshot.insights_headline}</p>
        {snapshot.observations.length > 0 && (
          <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-3.5 space-y-1.5">
            {snapshot.observations.map((obs, i) => (
              <p key={i} className="text-[11px] text-slate-300 leading-relaxed flex items-start gap-1.5">
                <span className="text-cyan-400 shrink-0">•</span>
                <span>{obs}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* CRECIMIENTO DE SEGUIDORES */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Crecimiento de Seguidores
          </h4>
        </div>
        {growthChartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={growthChartData} margin={{ left: -20, right: 10, top: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
              <Line type="monotone" dataKey="seguidores" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[11px] text-slate-500">
            Necesitás más días de historial guardado para graficar la tendencia — se guarda una foto automática por día.
          </p>
        )}
      </div>

      {/* CADENCIA DE PUBLICACIÓN */}
      {snapshot.posting_cadence && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-sky-400" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Cadencia de Publicación
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div className="text-lg font-black font-mono text-slate-100">{snapshot.posting_cadence.avg_posts_per_day}</div>
              <div className="text-[10px] text-slate-400">Publicaciones / día</div>
            </div>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div className="text-lg font-black font-mono text-slate-100">{snapshot.posting_cadence.best_day_label || 'Sin dato'}</div>
              <div className="text-[10px] text-slate-400">Día con más publicaciones</div>
            </div>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div className="text-lg font-black font-mono text-slate-100">{snapshot.posting_cadence.best_hour_label || 'Sin dato'}</div>
              <div className="text-[10px] text-slate-400">Hora con más publicaciones</div>
            </div>
            {snapshot.posting_cadence.avg_reel_duration_seconds !== null && (
              <>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="text-lg font-black font-mono text-slate-100">
                    {Math.round(snapshot.posting_cadence.total_reel_duration_seconds!)}s
                  </div>
                  <div className="text-[10px] text-slate-400">Duración total de Reels</div>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="text-lg font-black font-mono text-slate-100">
                    {Math.round(snapshot.posting_cadence.avg_reel_duration_seconds)}s
                  </div>
                  <div className="text-[10px] text-slate-400">Duración promedio de Reels</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PILARES DE CONTENIDO POR INTERACCIÓN */}
      {pillarChartData.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-fuchsia-400" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Pilares de Contenido por Interacción
            </h4>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(120, pillarChartData.length * 34)}>
            <BarChart
              layout="vertical"
              data={pillarChartData}
              margin={{ left: 10, right: 20 }}
            >
              <XAxis type="number" stroke="#94a3b8" fontSize={10} />
              <YAxis type="category" dataKey="topic" stroke="#94a3b8" fontSize={10} width={140} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
              <Bar dataKey="engagement" radius={[0, 4, 4, 0]}>
                {pillarChartData.map((entry, i) => (
                  <Cell key={entry.topic} fill={PILLAR_COLORS[i % PILLAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

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
