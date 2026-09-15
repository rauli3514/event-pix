// ================================================================
// metricUtils.ts
// Utilidades para operar con métricas que pueden no estar disponibles.
// EventPix Intelligence — SaaS Studio
//
// REGLA FUNDACIONAL DEL SISTEMA:
// Si Meta no reporta una métrica, el valor es NO_DATA. Nunca 0, nunca una
// estimación derivada de otra métrica. Un benchmark construido sobre datos
// inventados produce patrones inventados y aprendizajes falsos.
// ================================================================

import { MetricValue, NO_DATA, IntelligenceMetrics, IntelligencePost } from '../../types/intelligence';
import type { MetaMediaItem, MetaMediaInsights } from '../meta/MetaGraphService';

/** Type guard: true solo si la métrica tiene un valor numérico real. */
export function hasValue(v: MetricValue | undefined | null): v is number {
  return typeof v === 'number' && !isNaN(v);
}

/** Normaliza un valor posiblemente ausente de la API a MetricValue. */
export function fromApi(v: number | undefined | null): MetricValue {
  return typeof v === 'number' && !isNaN(v) ? v : NO_DATA;
}

/** Formatea una métrica para mostrar en pantalla. */
export function formatMetric(
  v: MetricValue | undefined,
  opts?: { suffix?: string; compact?: boolean; placeholder?: string }
): string {
  const placeholder = opts?.placeholder ?? 'Sin dato';
  if (!hasValue(v)) return placeholder;
  const suffix = opts?.suffix ?? '';
  if (opts?.compact && v >= 1000) {
    return `${(v / 1000).toFixed(1)}k${suffix}`;
  }
  return `${v.toLocaleString('es-AR')}${suffix}`;
}

/** Formatea una métrica para inyectar en un prompt de IA. */
export function formatForPrompt(v: MetricValue | undefined, label: string): string {
  return hasValue(v)
    ? `${label}: ${v.toLocaleString('es-AR')}`
    : `${label}: NO DISPONIBLE (Meta no reportó esta métrica)`;
}

/**
 * Divide dos métricas. Devuelve NO_DATA si cualquiera de las dos falta
 * o si el divisor es 0 — no hay ratio contra una base inexistente.
 */
export function ratio(value: MetricValue | undefined, base: MetricValue | undefined): MetricValue {
  if (!hasValue(value) || !hasValue(base) || base === 0) return NO_DATA;
  return Math.round((value / base) * 100) / 100;
}

/** Variación porcentual de `value` respecto de `base`. NO_DATA si no es computable. */
export function percentDelta(value: MetricValue | undefined, base: MetricValue | undefined): MetricValue {
  if (!hasValue(value) || !hasValue(base) || base === 0) return NO_DATA;
  return Math.round(((value - base) / base) * 100);
}

/** Tasa porcentual (ej. save_rate). NO_DATA si falta numerador o denominador. */
export function rate(part: MetricValue | undefined, total: MetricValue | undefined): MetricValue {
  if (!hasValue(part) || !hasValue(total) || total === 0) return NO_DATA;
  return Number(((part / total) * 100).toFixed(2));
}

/** Suma solo los valores disponibles e informa cuántos faltaron. */
export function sumAvailable(values: Array<MetricValue | undefined>): {
  total: MetricValue;
  available: number;
  missing: number;
} {
  const nums = values.filter(hasValue);
  return {
    total: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : NO_DATA,
    available: nums.length,
    missing: values.length - nums.length,
  };
}

/** Promedio sobre los valores disponibles únicamente. */
export function averageAvailable(values: Array<MetricValue | undefined>): MetricValue {
  const nums = values.filter(hasValue);
  if (nums.length === 0) return NO_DATA;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

/**
 * Mediana estadística sobre los valores disponibles.
 * Devuelve NO_DATA si ningún reel reportó la métrica, junto con el tamaño
 * de muestra real para que el consumidor pueda ponderar la confianza.
 */
export function medianAvailable(values: Array<MetricValue | undefined>): {
  median: MetricValue;
  sampleSize: number;
} {
  const nums = values.filter(hasValue).sort((a, b) => a - b);
  if (nums.length === 0) return { median: NO_DATA, sampleSize: 0 };
  const mid = Math.floor(nums.length / 2);
  const median = nums.length % 2 === 0
    ? Math.round(((nums[mid - 1] + nums[mid]) / 2) * 10) / 10
    : nums[mid];
  return { median, sampleSize: nums.length };
}

/** Compara métricas para ordenar; los ausentes van siempre al final. */
export function compareDesc(a: MetricValue | undefined, b: MetricValue | undefined): number {
  const aOk = hasValue(a);
  const bOk = hasValue(b);
  if (aOk && bOk) return b - a;
  if (aOk) return -1;
  if (bOk) return 1;
  return 0;
}

/** Devuelve true si la métrica está disponible y supera el umbral. */
export function exceeds(v: MetricValue | undefined, threshold: number): boolean {
  return hasValue(v) && v > threshold;
}

/** Devuelve true si la métrica está disponible y es menor al umbral. */
export function below(v: MetricValue | undefined, threshold: number): boolean {
  return hasValue(v) && v < threshold;
}

const TRACKED_METRICS: Array<keyof IntelligenceMetrics> = [
  'views', 'reach', 'likes', 'comments', 'shares', 'saves',
  'average_watch_time_seconds', 'profile_visits',
];

/** Lista legible de las métricas que faltan en un set, para mostrar o explicar. */
export function listMissingMetrics(metrics?: IntelligenceMetrics): string[] {
  if (!metrics) return TRACKED_METRICS.map(String);
  return TRACKED_METRICS.filter(k => !hasValue(metrics[k] as MetricValue)).map(String);
}

/** Convierte MetricValue a `number | undefined` para las APIs que hablan ese dialecto. */
export function toOptional(v: MetricValue | undefined): number | undefined {
  return hasValue(v) ? v : undefined;
}

/**
 * Adapta un IntelligencePost al formato MetaMediaItem que consumen el benchmark
 * y el motor de DNA. Las métricas ausentes viajan como `undefined`, nunca como 0:
 * convertirlas en ceros hacía que un reel sin insights contara como un reel con
 * cero vistas y arrastrara la mediana de toda la cuenta hacia abajo.
 */
export function postToMetaItem(p: IntelligencePost): MetaMediaItem & { insights: MetaMediaInsights } {
  const m = p.metrics;
  const interactions = sumAvailable([m?.likes, m?.comments, m?.saves, m?.shares]);

  return {
    id: p.id,
    media_type: 'REELS' as const,
    caption: p.raw_transcript || p.title,
    permalink: p.video_url || '',
    timestamp: p.published_at || new Date().toISOString(),
    like_count: toOptional(m?.likes),
    comments_count: toOptional(m?.comments),
    insights: {
      media_id: p.id,
      impressions: toOptional(m?.views),
      reach: toOptional(m?.reach),
      saved: toOptional(m?.saves),
      shares: toOptional(m?.shares),
      plays: toOptional(m?.views),
      ig_reels_avg_watch_time: toOptional(m?.average_watch_time_seconds),
      ig_reels_video_view_total_time: toOptional(m?.total_watch_time_seconds),
      total_interactions: toOptional(interactions.total),
      unavailable: interactions.available === 0 && !hasValue(m?.views),
    },
  };
}

/** Construye un set de métricas totalmente vacío (nada conocido todavía). */
export function emptyMetrics(postId: string): IntelligenceMetrics {
  return {
    post_id: postId,
    views: NO_DATA,
    reach: NO_DATA,
    likes: NO_DATA,
    comments: NO_DATA,
    shares: NO_DATA,
    saves: NO_DATA,
    followers_gained: NO_DATA,
    average_watch_time_seconds: NO_DATA,
    total_watch_time_seconds: NO_DATA,
    profile_visits: NO_DATA,
  };
}
