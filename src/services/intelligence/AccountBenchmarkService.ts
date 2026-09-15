// ================================================================
// AccountBenchmarkService.ts
// Servicio Estadístico de Medianas y Clasificación Multidimensional
// EventPix Intelligence — SaaS Studio
// ================================================================

import {
  AccountMedianBenchmark,
  MetricValue,
  NO_DATA,
  PerformanceRatio,
  ReelPerformanceClassification
} from '../../types/intelligence';
import { MetaMediaItem, MetaMediaInsights } from '../meta/MetaGraphService';
import { fromApi, hasValue, medianAvailable, ratio, formatMetric } from './metricUtils';

/** Benchmark vacío: ninguna métrica conocida. Se usa cuando no hay muestra. */
function emptyBenchmark(businessId: string, accountHandle?: string): AccountMedianBenchmark {
  return {
    business_id: businessId,
    account_handle: accountHandle,
    sample_size: 0,
    median_views: NO_DATA,
    median_reach: NO_DATA,
    median_likes: NO_DATA,
    median_comments: NO_DATA,
    median_shares: NO_DATA,
    median_saves: NO_DATA,
    median_engagement_rate: NO_DATA,
    median_retention_seconds: NO_DATA,
    metric_sample_sizes: {
      views: 0, reach: 0, likes: 0, comments: 0,
      shares: 0, saves: 0, engagement_rate: 0, retention_seconds: 0
    },
    calculated_at: new Date().toISOString()
  };
}

export class AccountBenchmarkService {
  /**
   * Calcula la mediana estadística pura de una lista de valores.
   * Los valores ausentes se excluyen del cálculo — no se sustituyen por 0,
   * porque un 0 inventado arrastra la mediana hacia abajo y falsea todo el benchmark.
   */
  public static calculateMedian(values: Array<MetricValue | undefined>): MetricValue {
    return medianAvailable(values).median;
  }

  /**
   * Calcula el Benchmark de Medianas exclusivo para una cuenta a partir de sus reels reales.
   * NUNCA inventa métricas: si una métrica no está reportada por Meta, se registra NO_DATA
   * y se excluye del cálculo de la mediana correspondiente.
   */
  public static calculateAccountBenchmark(
    businessId: string,
    accountHandle: string | undefined,
    reels: Array<MetaMediaItem & { insights?: MetaMediaInsights }>
  ): AccountMedianBenchmark {
    if (!reels || reels.length === 0) {
      return emptyBenchmark(businessId, accountHandle);
    }

    const viewsList: MetricValue[] = [];
    const reachList: MetricValue[] = [];
    const likesList: MetricValue[] = [];
    const commentsList: MetricValue[] = [];
    const sharesList: MetricValue[] = [];
    const savesList: MetricValue[] = [];
    const engagementRates: MetricValue[] = [];
    const retentionSecondsList: MetricValue[] = [];

    reels.forEach(r => {
      const ins = r.insights;
      // `plays` e `impressions` son las únicas fuentes válidas de reproducciones.
      // Si ninguna existe, las vistas de este reel son desconocidas.
      const views = fromApi(ins?.plays ?? ins?.impressions);
      const reach = fromApi(ins?.reach);
      const likes = fromApi(r.like_count);
      const comments = fromApi(r.comments_count);
      const saves = fromApi(ins?.saved);
      const shares = fromApi(ins?.shares);

      viewsList.push(views);
      reachList.push(reach);
      likesList.push(likes);
      commentsList.push(comments);
      sharesList.push(shares);
      savesList.push(saves);

      // El engagement rate solo se computa si conocemos TODAS sus partes y una base real.
      const rateBase = hasValue(reach) ? reach : views;
      if (hasValue(likes) && hasValue(comments) && hasValue(saves) && hasValue(shares) && hasValue(rateBase) && rateBase > 0) {
        engagementRates.push(((likes + comments + saves + shares) / rateBase) * 100);
      }

      if (hasValue(ins?.ig_reels_avg_watch_time) && ins!.ig_reels_avg_watch_time! > 0) {
        retentionSecondsList.push(ins!.ig_reels_avg_watch_time!);
      }
    });

    const views = medianAvailable(viewsList);
    const reach = medianAvailable(reachList);
    const likes = medianAvailable(likesList);
    const comments = medianAvailable(commentsList);
    const shares = medianAvailable(sharesList);
    const saves = medianAvailable(savesList);
    const engagement = medianAvailable(engagementRates);

    // Retención: solo es representativa si al menos el 40% de los reels la reportan.
    const retention = medianAvailable(retentionSecondsList);
    const retentionIsRepresentative =
      retention.sampleSize >= Math.max(2, Math.floor(reels.length * 0.4));

    return {
      business_id: businessId,
      account_handle: accountHandle,
      sample_size: reels.length,
      median_views: views.median,
      median_reach: reach.median,
      median_likes: likes.median,
      median_comments: comments.median,
      median_shares: shares.median,
      median_saves: saves.median,
      median_engagement_rate: hasValue(engagement.median)
        ? Math.round(engagement.median * 100) / 100
        : NO_DATA,
      median_retention_seconds: retentionIsRepresentative ? retention.median : NO_DATA,
      metric_sample_sizes: {
        views: views.sampleSize,
        reach: reach.sampleSize,
        likes: likes.sampleSize,
        comments: comments.sampleSize,
        shares: shares.sampleSize,
        saves: saves.sampleSize,
        engagement_rate: engagement.sampleSize,
        retention_seconds: retentionIsRepresentative ? retention.sampleSize : 0
      },
      calculated_at: new Date().toISOString()
    };
  }

  /**
   * Evalúa el rendimiento de un Reel individual comparándolo con la Mediana de su Cuenta.
   * Clasifica multidimensionalmente:
   *  - Ganador de Alcance Viral (muchas vistas/alcance)
   *  - Ganador de Intención Comercial (muchos guardados/compartidos, aunque tenga vistas moderadas)
   *  - Bajo rendimiento o Promedio Sólido
   */
  public static evaluateReelPerformance(
    reel: MetaMediaItem & { insights?: MetaMediaInsights },
    benchmark: AccountMedianBenchmark
  ): ReelPerformanceClassification {
    const ins = reel.insights;
    const views = fromApi(ins?.plays ?? ins?.impressions);
    const reach = fromApi(ins?.reach);
    const comments = fromApi(reel.comments_count);
    const saves = fromApi(ins?.saved);
    const shares = fromApi(ins?.shares);

    // Cada ratio es NO_DATA si falta el valor del reel o la mediana de referencia.
    const viewsRatio = ratio(views, benchmark.median_views);
    const reachRatio = ratio(reach, benchmark.median_reach);
    const savesRatio = ratio(saves, benchmark.median_saves);
    const sharesRatio = ratio(shares, benchmark.median_shares);
    const commentsRatio = ratio(comments, benchmark.median_comments);

    const performanceIndex: PerformanceRatio = {
      views_ratio: viewsRatio,
      reach_ratio: reachRatio,
      saves_ratio: savesRatio,
      shares_ratio: sharesRatio,
      comments_ratio: commentsRatio
    };

    const missingMetrics: string[] = [];
    if (!hasValue(views)) missingMetrics.push('reproducciones');
    if (!hasValue(reach)) missingMetrics.push('alcance');
    if (!hasValue(saves)) missingMetrics.push('guardados');
    if (!hasValue(shares)) missingMetrics.push('compartidos');

    // Un reel es "ganador" solo si hay evidencia numérica que lo respalde.
    // La ausencia de dato nunca cuenta como evidencia a favor ni en contra.
    const isViralReachWinner =
      (hasValue(viewsRatio) && viewsRatio >= 1.5) || (hasValue(reachRatio) && reachRatio >= 1.5);

    const isCommercialWinner =
      (hasValue(savesRatio) && savesRatio >= 1.5) || (hasValue(sharesRatio) && sharesRatio >= 1.5);

    let isRetentionWinner = false;
    if (
      hasValue(benchmark.median_retention_seconds) &&
      benchmark.median_retention_seconds > 0 &&
      hasValue(ins?.ig_reels_avg_watch_time)
    ) {
      isRetentionWinner = ins!.ig_reels_avg_watch_time! >= benchmark.median_retention_seconds * 1.3;
    }

    // Bajo rendimiento requiere evidencia de AMBAS métricas. Sin datos no hay veredicto.
    const isUnderperformer =
      hasValue(viewsRatio) && hasValue(savesRatio) && viewsRatio < 0.7 && savesRatio < 0.7;

    // Sin ningún ratio computable no se puede clasificar el reel en absoluto.
    const hasAnyEvidence = hasValue(viewsRatio) || hasValue(reachRatio) ||
      hasValue(savesRatio) || hasValue(sharesRatio);

    const isSolidAverage =
      hasAnyEvidence && !isViralReachWinner && !isCommercialWinner && !isUnderperformer;

    let primaryCategory: ReelPerformanceClassification['primary_category'];
    if (!hasAnyEvidence) {
      primaryCategory = 'sin_datos_suficientes';
    } else if (isCommercialWinner && isViralReachWinner) {
      primaryCategory = 'viral_winner';
    } else if (isCommercialWinner) {
      primaryCategory = 'commercial_winner';
    } else if (isViralReachWinner) {
      primaryCategory = 'viral_winner';
    } else if (isUnderperformer) {
      primaryCategory = 'underperformer';
    } else {
      primaryCategory = 'balanced_performer';
    }

    // Explicación basada estrictamente en evidencia numérica disponible.
    const pct = (r: MetricValue, direction: 1 | -1 = 1) =>
      hasValue(r) ? `${Math.round((direction === 1 ? r - 1 : 1 - r) * 100)}%` : 'sin dato';

    let evidenceExplanation: string;
    if (!hasAnyEvidence) {
      evidenceExplanation = `Sin datos suficientes para clasificar este Reel. Meta no reportó: ${missingMetrics.join(', ')}. Conectá la cuenta vía Instagram Graph API con permisos de insights para obtener estas métricas.`;
    } else if (isCommercialWinner && isViralReachWinner) {
      evidenceExplanation = `Reel destacado integral: superó tanto en alcance (${pct(viewsRatio)} vs mediana de vistas) como en intención comercial (${pct(savesRatio)} en guardados).`;
    } else if (isCommercialWinner) {
      const reachNote = hasValue(viewsRatio)
        ? `a pesar de tener un alcance ${viewsRatio >= 1 ? 'estable' : 'moderado'} (${viewsRatio}x de la mediana)`
        : 'con alcance no reportado por Meta';
      evidenceExplanation = `Ganador de Intención Comercial: ${reachNote}, generó un ${pct(savesRatio)} más de guardados que la mediana (${formatMetric(saves)} vs ${formatMetric(benchmark.median_saves)}). Alto valor de consulta.`;
    } else if (isViralReachWinner) {
      evidenceExplanation = `Ganador de Alcance Viral: superó la mediana de reproducciones en un +${pct(viewsRatio)} (${formatMetric(views)} vs ${formatMetric(benchmark.median_views)}). Excelente tracción de gancho inicial.`;
    } else if (isUnderperformer) {
      evidenceExplanation = `Rendimiento por debajo de la mediana (${pct(viewsRatio, -1)} menos vistas y ${pct(savesRatio, -1)} menos guardados). Indica fricción en el gancho o falta de claridad en la propuesta.`;
    } else {
      evidenceExplanation = `Rendimiento alineado con la mediana de la cuenta (${formatMetric(viewsRatio, { placeholder: 'sin dato' })}x vistas, ${formatMetric(savesRatio, { placeholder: 'sin dato' })}x guardados). Contenido base estable.`;
    }

    if (hasAnyEvidence && missingMetrics.length > 0) {
      evidenceExplanation += ` (Clasificación parcial: Meta no reportó ${missingMetrics.join(', ')}.)`;
    }

    return {
      reel_id: reel.id,
      is_viral_reach_winner: isViralReachWinner,
      is_commercial_winner: isCommercialWinner,
      is_retention_winner: isRetentionWinner,
      is_underperformer: isUnderperformer,
      is_solid_average: isSolidAverage,
      performance_index: performanceIndex,
      primary_category: primaryCategory,
      missing_metrics: missingMetrics,
      evidence_explanation: evidenceExplanation
    };
  }
}
