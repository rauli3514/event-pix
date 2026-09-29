// ================================================================
// AccountMetricsEngine.ts
// Motor de métricas de cuenta estilo Socialinsider: separa los datos
// reales en 5 capas (Resumen Ejecutivo, Alcance & Reproducciones,
// Interacción Profunda, Desglose de Formatos, Hipótesis de IA basada
// en evidencia) a partir de los posts reales importados de Meta.
//
// Respeta la ley fundacional del sistema: una métrica que Meta no
// reportó nunca se convierte en 0 ni se estima. Si falta el dato de
// origen (ej. `views`/`reach` en posts traídos por business_discovery,
// que nunca los expone), la capa correspondiente lo muestra como
// NO_DATA en vez de fabricar un número.
// ================================================================

import { IntelligencePost, MetricValue, NO_DATA } from '../../types/intelligence';
import { hasValue, sumAvailable, medianAvailable, rate, toOptional, compareDesc } from './metricUtils';

export type ContentFormat = 'Reels' | 'Carruseles' | 'Imágenes' | 'Otro';

export interface PostingCadence {
  total_posts: number;
  date_range_days: number;
  avg_posts_per_day: number;
  best_day_label: string | null;
  best_day_count: number;
  best_hour_label: string | null;
  best_hour_count: number;
  total_reel_duration_seconds: number | null;
  avg_reel_duration_seconds: number | null;
}

export interface ContentPillarEntry {
  topic: string;
  count: number;
  total_engagement: MetricValue;
  pct_of_engagement: MetricValue;
}

export interface FormatBreakdownEntry {
  format: ContentFormat;
  count: number;
  pct_of_posts: number;
  total_views: MetricValue;
  pct_of_views: MetricValue;
}

export interface PeakPost {
  post: IntelligencePost;
  format_label: string;
  metric_value: number;
  median_value: number;
  pct_above_median: number;
}

export interface AccountMetricsSnapshot {
  has_data: boolean;
  posts_count: number;

  // Capa 1: Resumen Ejecutivo
  format_breakdown: FormatBreakdownEntry[];
  peak_post: PeakPost | null;

  // Capa 2: Alcance & Reproducciones
  total_views: MetricValue;
  total_reach: MetricValue;
  organic_reach_rate_pct: MetricValue;

  // Capa 3: Interacción Profunda
  total_likes: MetricValue;
  total_comments: MetricValue;
  total_saves: MetricValue;
  total_shares: MetricValue;
  engagement_rate_vs_views_pct: MetricValue;
  engagement_rate_vs_followers_pct: MetricValue;

  // Capa 5: Hipótesis de IA basada en evidencia real
  ai_hypothesis: string;

  // Capa 6: Cadencia de publicación, pilares de contenido y resumen
  posting_cadence: PostingCadence | null;
  content_pillars: ContentPillarEntry[];
  insights_headline: string;
  observations: string[];
}

function formatLabel(post: IntelligencePost): string {
  switch (post.media_type) {
    case 'REELS':
    case 'VIDEO':
      return 'Reel';
    case 'CAROUSEL_ALBUM':
      return 'Carrusel';
    case 'IMAGE':
      return 'Imagen';
    default:
      return 'Posteo';
  }
}

function bucketFor(post: IntelligencePost): ContentFormat {
  switch (post.media_type) {
    case 'REELS':
    case 'VIDEO':
      return 'Reels';
    case 'CAROUSEL_ALBUM':
      return 'Carruseles';
    case 'IMAGE':
      return 'Imágenes';
    default:
      return 'Otro';
  }
}

function emptySnapshot(): AccountMetricsSnapshot {
  return {
    has_data: false,
    posts_count: 0,
    format_breakdown: [],
    peak_post: null,
    total_views: NO_DATA,
    total_reach: NO_DATA,
    organic_reach_rate_pct: NO_DATA,
    total_likes: NO_DATA,
    total_comments: NO_DATA,
    total_saves: NO_DATA,
    total_shares: NO_DATA,
    engagement_rate_vs_views_pct: NO_DATA,
    engagement_rate_vs_followers_pct: NO_DATA,
    ai_hypothesis: 'Esperando importación de publicaciones para poder formular hipótesis basadas en evidencia real.',
    posting_cadence: null,
    content_pillars: [],
    insights_headline: 'Todavía no hay publicaciones importadas para generar un resumen de insights.',
    observations: [],
  };
}

/** Calcula frecuencia y horarios reales de publicación a partir de `published_at`. */
function computePostingCadence(posts: IntelligencePost[]): PostingCadence | null {
  const dates = posts
    .map(p => ({ post: p, date: new Date(p.published_at) }))
    .filter(({ date }) => !isNaN(date.getTime()));
  if (dates.length === 0) return null;

  dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = dates[0].date;
  const last = dates[dates.length - 1].date;
  const date_range_days = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
  const avg_posts_per_day = Math.round((dates.length / date_range_days) * 100) / 100;

  const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const { date } of dates) {
    dayCounts[date.getDay()]++;
    hourCounts[date.getHours()]++;
  }
  let bestDayIdx = 0, bestDayCount = 0;
  dayCounts.forEach((c, i) => { if (c > bestDayCount) { bestDayCount = c; bestDayIdx = i; } });
  let bestHourIdx = 0, bestHourCount = 0;
  hourCounts.forEach((c, i) => { if (c > bestHourCount) { bestHourCount = c; bestHourIdx = i; } });

  const hourLabel = (h: number) => {
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${period}`;
  };

  const reelDurations = dates
    .map(({ post }) => post.duration_seconds)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const total_reel_duration_seconds = reelDurations.length > 0 ? reelDurations.reduce((a, b) => a + b, 0) : null;
  const avg_reel_duration_seconds = reelDurations.length > 0
    ? Math.round((total_reel_duration_seconds! / reelDurations.length) * 10) / 10
    : null;

  return {
    total_posts: dates.length,
    date_range_days,
    avg_posts_per_day,
    best_day_label: bestDayCount > 0 ? DAY_LABELS[bestDayIdx] : null,
    best_day_count: bestDayCount,
    best_hour_label: bestHourCount > 0 ? hourLabel(bestHourIdx) : null,
    best_hour_count: bestHourCount,
    total_reel_duration_seconds,
    avg_reel_duration_seconds,
  };
}

/** Agrupa por tema real detectado por la IA (`analysis.topic`) y suma la interacción de cada grupo. */
function computeContentPillars(posts: IntelligencePost[]): ContentPillarEntry[] {
  const groups = new Map<string, IntelligencePost[]>();
  for (const p of posts) {
    const topic = p.analysis?.topic?.trim() || 'Sin clasificar';
    const list = groups.get(topic) ?? [];
    list.push(p);
    groups.set(topic, list);
  }
  if (groups.size === 0) return [];

  const rows = Array.from(groups.entries()).map(([topic, list]) => {
    const engagement = sumAvailable(list.flatMap(p => [p.metrics?.likes, p.metrics?.comments, p.metrics?.saves, p.metrics?.shares]));
    return { topic, count: list.length, total_engagement: engagement.total };
  });

  const grandTotal = sumAvailable(rows.map(r => r.total_engagement)).total;

  return rows
    .map(r => ({
      topic: r.topic,
      count: r.count,
      total_engagement: r.total_engagement,
      pct_of_engagement: (hasValue(r.total_engagement) && hasValue(grandTotal) && grandTotal > 0)
        ? Math.round((r.total_engagement / grandTotal) * 100)
        : NO_DATA,
    }))
    .sort((a, b) => compareDesc(a.total_engagement, b.total_engagement));
}

/** Párrafo de resumen + observaciones, redactados a partir de números reales (sin IA externa). */
function buildInsightsSummary(params: {
  accountHandle: string;
  cadence: PostingCadence | null;
  pillars: ContentPillarEntry[];
  snapshot: Pick<AccountMetricsSnapshot, 'total_views' | 'total_reach' | 'total_comments' | 'engagement_rate_vs_views_pct' | 'organic_reach_rate_pct'>;
  followerGrowthPct: number | null;
}): { headline: string; observations: string[] } {
  const { accountHandle, cadence, pillars, snapshot, followerGrowthPct } = params;

  if (!cadence) {
    return {
      headline: 'Todavía no hay publicaciones importadas para generar un resumen de insights.',
      observations: [],
    };
  }

  const rangeLabel = cadence.date_range_days > 1
    ? `En los últimos ${cadence.date_range_days} días`
    : 'En el último día con actividad';

  const topPillar = pillars.find(p => hasValue(p.total_engagement) && p.topic !== 'Sin clasificar');

  const headlineParts: string[] = [
    `${rangeLabel}, ${accountHandle} publicó ${cadence.total_posts} contenido${cadence.total_posts === 1 ? '' : 's'} (promedio de ${cadence.avg_posts_per_day} por día).`,
  ];
  if (hasValue(snapshot.total_views)) {
    headlineParts.push(`Sumó ${snapshot.total_views.toLocaleString('es-AR')} reproducciones${hasValue(snapshot.total_reach) ? ` y ${snapshot.total_reach.toLocaleString('es-AR')} de alcance` : ''}.`);
  }
  if (topPillar) {
    headlineParts.push(`"${topPillar.topic}" fue el tema con mayor interacción, con el ${formatMetricSafe(topPillar.pct_of_engagement)} del engagement total.`);
  }

  const observations: string[] = [];
  observations.push(
    cadence.best_day_label
      ? `${cadence.best_day_label} es tu día con más publicaciones (${cadence.best_day_count})${cadence.best_hour_label ? `, y ${cadence.best_hour_label} tu horario más frecuente` : ''}.`
      : 'Todavía no hay suficientes publicaciones para identificar un día u horario preferido.'
  );
  observations.push(
    followerGrowthPct !== null
      ? `Creciste un ${followerGrowthPct > 0 ? '+' : ''}${followerGrowthPct}% en seguidores en los últimos 30 días.`
      : 'Todavía no hay suficiente historial de seguidores guardado para medir el crecimiento — se empieza a acumular desde hoy.'
  );
  if (topPillar) {
    observations.push(`El contenido sobre "${topPillar.topic}" (${topPillar.count} publicaciones) concentra la mayor parte de tu interacción: repetirlo es tu apuesta más segura.`);
  } else if (pillars.length > 0) {
    observations.push('Tus publicaciones todavía no tienen un tema clasificado por la IA — sincronizá y analizá tus Reels para ver el desglose por pilar de contenido.');
  }
  if (cadence.avg_reel_duration_seconds !== null) {
    observations.push(`Tus Reels duran en promedio ${Math.round(cadence.avg_reel_duration_seconds)} segundos.`);
  }

  return { headline: headlineParts.join(' '), observations };
}

function formatMetricSafe(v: MetricValue): string {
  return hasValue(v) ? `${v}%` : 'un porcentaje sin dato';
}

export class AccountMetricsEngine {
  static compute(
    posts: IntelligencePost[],
    followersCount?: number | null,
    accountHandle?: string,
    followerGrowthPct?: number | null
  ): AccountMetricsSnapshot {
    const safePosts = Array.isArray(posts) ? posts : [];
    if (safePosts.length === 0) return emptySnapshot();

    // ---- Capa 4 (insumo de Capa 1): desglose de formatos ----
    const buckets: Record<ContentFormat, IntelligencePost[]> = {
      Reels: [], Carruseles: [], Imágenes: [], Otro: [],
    };
    for (const p of safePosts) buckets[bucketFor(p)].push(p);

    const totalViewsAll = sumAvailable(safePosts.map(p => p.metrics?.views));
    const format_breakdown: FormatBreakdownEntry[] = (['Reels', 'Carruseles', 'Imágenes', 'Otro'] as ContentFormat[])
      .map(format => {
        const list = buckets[format];
        if (list.length === 0) return null;
        const viewsSum = sumAvailable(list.map(p => p.metrics?.views));
        const pct_of_views = (hasValue(viewsSum.total) && hasValue(totalViewsAll.total) && totalViewsAll.total > 0)
          ? Math.round((viewsSum.total / totalViewsAll.total) * 100)
          : NO_DATA;
        return {
          format,
          count: list.length,
          pct_of_posts: Math.round((list.length / safePosts.length) * 100),
          total_views: viewsSum.total,
          pct_of_views,
        };
      })
      .filter((x): x is FormatBreakdownEntry => x !== null)
      .sort((a, b) => b.count - a.count);

    // ---- Capa 3: interacción profunda ----
    const total_likes = sumAvailable(safePosts.map(p => p.metrics?.likes)).total;
    const total_comments = sumAvailable(safePosts.map(p => p.metrics?.comments)).total;
    const total_saves = sumAvailable(safePosts.map(p => p.metrics?.saves)).total;
    const total_shares = sumAvailable(safePosts.map(p => p.metrics?.shares)).total;
    const totalInteractions = sumAvailable([total_likes, total_comments, total_saves, total_shares]).total;

    // ---- Capa 2: alcance & reproducciones ----
    const total_views = totalViewsAll.total;
    const total_reach = sumAvailable(safePosts.map(p => p.metrics?.reach)).total;
    const avgReachPerPost = safePosts.length > 0 && hasValue(total_reach)
      ? total_reach / safePosts.length
      : NO_DATA;
    const organic_reach_rate_pct = (hasValue(avgReachPerPost) && followersCount && followersCount > 0)
      ? Math.round((avgReachPerPost / followersCount) * 1000) / 10
      : NO_DATA;

    const engagement_rate_vs_views_pct = rate(totalInteractions, total_views);
    const engagement_rate_vs_followers_pct = (hasValue(totalInteractions) && followersCount && followersCount > 0)
      ? Math.round((totalInteractions / followersCount) * 1000) / 10
      : NO_DATA;

    // ---- Capa 1 (pico de actividad) / Capa 5 (evidencia) ----
    const { median: medianComments, sampleSize } = medianAvailable(safePosts.map(p => p.metrics?.comments));
    let peak_post: PeakPost | null = null;
    if (hasValue(medianComments) && medianComments > 0 && sampleSize >= 3) {
      let best: IntelligencePost | null = null;
      let bestVal = -Infinity;
      for (const p of safePosts) {
        const c = toOptional(p.metrics?.comments);
        if (c !== undefined && c > bestVal) { bestVal = c; best = p; }
      }
      if (best) {
        const pct = Math.round(((bestVal - medianComments) / medianComments) * 100);
        if (pct >= 30) {
          peak_post = {
            post: best,
            format_label: formatLabel(best),
            metric_value: bestVal,
            median_value: medianComments,
            pct_above_median: pct,
          };
        }
      }
    }

    let ai_hypothesis: string;
    if (peak_post) {
      const dateStr = new Date(peak_post.post.published_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
      ai_hypothesis = `Tu ${peak_post.format_label} del ${dateStr} generó un pico de ${peak_post.metric_value.toLocaleString('es-AR')} comentarios (${peak_post.pct_above_median}% superior a tu mediana de ${Math.round(peak_post.median_value).toLocaleString('es-AR')}). La conversación directa en los comentarios es tu mayor palanca de engagement: repetí el mismo gancho o la misma pregunta que la generó en tu próximo contenido.`;
    } else {
      const topFormat = format_breakdown.find(f => hasValue(f.pct_of_views) && f.pct_of_views >= 60);
      if (topFormat) {
        ai_hypothesis = `${topFormat.format} concentra el ${topFormat.pct_of_views}% de tus vistas con solo el ${topFormat.pct_of_posts}% de tus publicaciones: es tu formato de mayor palanca de alcance. Priorizalo en tu próxima tanda de contenido.`;
      } else if (sampleSize < 3) {
        ai_hypothesis = 'Con pocas publicaciones sincronizadas todavía no hay evidencia estadísticamente significativa. Sincronizá más Reels reales para que el motor pueda identificar patrones.';
      } else {
        ai_hypothesis = 'Por ahora no se detecta una anomalía clara en los datos disponibles: el rendimiento entre publicaciones es relativamente parejo.';
      }
    }

    // ---- Capa 6: cadencia de publicación, pilares de contenido y resumen ----
    const posting_cadence = computePostingCadence(safePosts);
    const content_pillars = computeContentPillars(safePosts);
    const { headline: insights_headline, observations } = buildInsightsSummary({
      accountHandle: accountHandle || '@tu_negocio',
      cadence: posting_cadence,
      pillars: content_pillars,
      snapshot: { total_views, total_reach, total_comments, engagement_rate_vs_views_pct, organic_reach_rate_pct },
      followerGrowthPct: followerGrowthPct ?? null,
    });

    return {
      has_data: true,
      posts_count: safePosts.length,
      format_breakdown,
      peak_post,
      total_views,
      total_reach,
      organic_reach_rate_pct,
      total_likes,
      total_comments,
      total_saves,
      total_shares,
      engagement_rate_vs_views_pct,
      engagement_rate_vs_followers_pct,
      ai_hypothesis,
      posting_cadence,
      content_pillars,
      insights_headline,
      observations,
    };
  }
}
