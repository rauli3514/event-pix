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
import { hasValue, sumAvailable, medianAvailable, rate, toOptional } from './metricUtils';

export type ContentFormat = 'Reels' | 'Carruseles' | 'Imágenes' | 'Otro';

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
  };
}

export class AccountMetricsEngine {
  static compute(posts: IntelligencePost[], followersCount?: number | null): AccountMetricsSnapshot {
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
    };
  }
}
