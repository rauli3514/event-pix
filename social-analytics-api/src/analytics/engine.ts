import { AnalyticsSummary, PostMetric, RawProfileData } from '../types/profile.js';

const DEFAULT_PERIOD_DAYS = 30;
const TOP_POSTS_LIMIT = 5;

function interactions(post: PostMetric): number {
  return post.likes + post.comments;
}

/**
 * Motor de analitica: replica las formulas base de un reporte estilo Socialinsider
 * a partir de los datos ya normalizados de un proveedor (Meta/Apify/mock).
 *
 * - total_followers: seguidores actuales del perfil.
 * - total_posts_periodo: cantidad de publicaciones dentro de la ventana de dias pedida.
 * - posts_per_day: total_posts_periodo / period_days.
 * - engagement_rate: (promedio de interacciones por post / total_followers) * 100.
 * - top_posts: los posts del periodo ordenados por interaccion (likes + comentarios) desc.
 *
 * Si ningun post cae dentro del periodo (cuenta con baja frecuencia de publicacion,
 * o los ultimos posts disponibles son mas viejos que la ventana), se usa el set
 * completo de posts obtenidos para no devolver un reporte vacio silenciosamente
 * distinto de "no hay datos": el campo `period_days` siempre refleja la ventana pedida.
 */
export function computeAnalytics(
  raw: RawProfileData,
  periodDays: number = DEFAULT_PERIOD_DAYS
): AnalyticsSummary {
  const safePeriodDays = periodDays > 0 ? periodDays : DEFAULT_PERIOD_DAYS;
  const cutoff = Date.now() - safePeriodDays * 86400000;

  const postsInPeriod = raw.posts.filter((p) => new Date(p.published_at).getTime() >= cutoff);
  const consideredPosts = postsInPeriod.length > 0 ? postsInPeriod : raw.posts;

  const totalPosts = consideredPosts.length;
  const postsPerDay = Number((totalPosts / safePeriodDays).toFixed(2));

  const totalInteractions = consideredPosts.reduce((sum, p) => sum + interactions(p), 0);
  const avgInteractionsPerPost = totalPosts > 0 ? totalInteractions / totalPosts : 0;

  const engagementRate =
    raw.follower_count > 0
      ? Number(((avgInteractionsPerPost / raw.follower_count) * 100).toFixed(2))
      : 0;

  const topPosts = [...consideredPosts]
    .sort((a, b) => interactions(b) - interactions(a))
    .slice(0, TOP_POSTS_LIMIT);

  return {
    total_followers: raw.follower_count,
    total_posts_periodo: totalPosts,
    period_days: safePeriodDays,
    posts_per_day: postsPerDay,
    avg_interactions_per_post: Number(avgInteractionsPerPost.toFixed(2)),
    engagement_rate: engagementRate,
    top_posts: topPosts,
  };
}
