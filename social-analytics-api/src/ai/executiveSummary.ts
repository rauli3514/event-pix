import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { AnalyticsSummary, Platform } from '../types/profile.js';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    reel: 'Reels',
    video: 'videos',
    image: 'imagenes',
    carousel: 'carruseles',
  };
  return labels[type] || type;
}

/** Formato ganador segun interacciones totales por tipo de post, calculado sin IA. */
function bestFormat(analytics: AnalyticsSummary): string | null {
  const totals = new Map<string, number>();
  for (const post of analytics.top_posts) {
    totals.set(post.type, (totals.get(post.type) || 0) + post.likes + post.comments);
  }
  if (totals.size === 0) return null;
  const [type] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return typeLabel(type);
}

function buildFallbackSummary(username: string, platform: Platform, analytics: AnalyticsSummary): string {
  const format = bestFormat(analytics);
  const formatSentence = format
    ? `El formato que mejor le funciona a @${username} son los ${format}, que concentran la mayor interaccion entre sus ultimas publicaciones.`
    : `@${username} todavia no tiene publicaciones suficientes en el periodo para identificar un formato ganador.`;

  const opportunity =
    analytics.engagement_rate < 1
      ? `Su engagement rate (${analytics.engagement_rate}%) esta por debajo del promedio esperado para su tamano de audiencia: hay oportunidad de mejorar el gancho inicial y el llamado a la accion.`
      : `Con un engagement rate de ${analytics.engagement_rate}% y ${analytics.posts_per_day} publicaciones por dia, la oportunidad principal es sostener esa frecuencia y reforzar el llamado a la accion en cada publicacion.`;

  return `${formatSentence} ${opportunity}`;
}

/**
 * Genera el resumen ejecutivo de 2 oraciones usando Claude a partir de las metricas
 * ya calculadas por el Analytics Engine. Si no hay ANTHROPIC_API_KEY configurada,
 * o la llamada a la API falla, se devuelve un resumen generado localmente a partir
 * de las mismas metricas (nunca se inventan numeros que no esten en `analytics`).
 */
export async function generateExecutiveSummary(params: {
  username: string;
  platform: Platform;
  analytics: AnalyticsSummary;
}): Promise<{ text: string; source: 'anthropic' | 'fallback_local' }> {
  const { username, platform, analytics } = params;

  if (!env.anthropicApiKey) {
    return { text: buildFallbackSummary(username, platform, analytics), source: 'fallback_local' };
  }

  const topPostsBreakdown = analytics.top_posts
    .map((p) => `- Tipo: ${p.type}, likes: ${p.likes}, comentarios: ${p.comments}`)
    .join('\n');

  const prompt = `Analiza el rendimiento de @${username} en ${platform} con Engagement Rate de ${analytics.engagement_rate}%, ${analytics.total_followers} seguidores y ${analytics.posts_per_day} publicaciones por dia.

Sus publicaciones con mejor desempeno en el periodo analizado:
${topPostsBreakdown || '(sin publicaciones en el periodo)'}

Resume en 2 oraciones que formato le funciona mejor y que oportunidad de mejora tiene. No inventes metricas que no te di.`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-opus-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text.trim() : '';

    if (!text) {
      return { text: buildFallbackSummary(username, platform, analytics), source: 'fallback_local' };
    }
    return { text, source: 'anthropic' };
  } catch (err) {
    console.warn('[executiveSummary] Fallo la llamada a Anthropic, usando resumen local:', err);
    return { text: buildFallbackSummary(username, platform, analytics), source: 'fallback_local' };
  }
}
