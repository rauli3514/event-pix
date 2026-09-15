// ================================================================
// ExperimentationService.ts
// Servicio del Bucle de Experimentos, Métricas Reales y Aprendizaje Permanente
// EventPix Intelligence — SaaS Studio
// ================================================================

import {
  AccountMedianBenchmark,
  ContentExperiment,
  Hypothesis,
  LearnedInsight,
  ScriptVariant
} from '../../types/intelligence';
import { IntelligenceStorageService } from './IntelligenceStorageService';
import { MetaMediaItem, MetaMediaInsights } from '../meta/MetaGraphService';
import { formatMetric, fromApi, hasValue, percentDelta } from './metricUtils';

export class ExperimentationService {
  /**
   * Crea un nuevo experimento a partir de una hipótesis y sus 3 variantes generadas.
   */
  public static createExperiment(
    businessId: string,
    hypothesis: Hypothesis,
    title: string,
    variants: {
      variantA: ScriptVariant;
      variantB: ScriptVariant;
      variantC: ScriptVariant;
    },
    baselineBenchmark: AccountMedianBenchmark,
    chosenVariantKey: 'A' | 'B' | 'C' = 'A'
  ): ContentExperiment {
    const experiment: ContentExperiment = {
      experiment_id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      hypothesis_id: hypothesis.hypothesis_id,
      business_id: businessId,
      title: title || `Test de ${hypothesis.statement.slice(0, 45)}...`,
      variable_tested: `Apertura y estructura de Variante ${chosenVariantKey}`,
      constant_elements: 'Tono de voz de la marca, propuesta de valor y nicho comercial',
      chosen_variant: chosenVariantKey,
      variants,
      status: 'READY',
      baseline_benchmark: {
        median_views: baselineBenchmark.median_views,
        median_reach: baselineBenchmark.median_reach,
        median_saves: baselineBenchmark.median_saves,
        median_shares: baselineBenchmark.median_shares,
        median_comments: baselineBenchmark.median_comments
      },
      created_at: new Date().toISOString()
    };

    // Guardar en persistencia
    IntelligenceStorageService.saveExperiment(businessId, experiment);
    return experiment;
  }

  /**
   * Marca el experimento como publicado y lo asocia a un Reel real de Instagram.
   */
  public static markAsPublished(
    businessId: string,
    experimentId: string,
    publishedReelId: string,
    permalink?: string
  ): ContentExperiment | null {
    const experiments = IntelligenceStorageService.getExperiments(businessId);
    const exp = experiments.find(e => e.experiment_id === experimentId);
    if (!exp) return null;

    exp.status = 'COLLECTING_DATA';
    exp.published_reel_id = publishedReelId;
    exp.published_reel_permalink = permalink;
    exp.published_at = new Date().toISOString();

    IntelligenceStorageService.saveExperiment(businessId, exp);
    return exp;
  }

  /**
   * Evalúa el experimento comparando las métricas del Reel publicado contra la mediana de referencia.
   * Extrae conclusiones empíricas y alimenta la memoria permanente del negocio.
   */
  public static evaluateExperimentResults(
    businessId: string,
    experimentId: string,
    reel: MetaMediaItem & { insights?: MetaMediaInsights },
    benchmark: AccountMedianBenchmark
  ): { experiment: ContentExperiment; insight: LearnedInsight | null } | null {
    const experiments = IntelligenceStorageService.getExperiments(businessId);
    const exp = experiments.find(e => e.experiment_id === experimentId);
    if (!exp) return null;

    const ins = reel.insights;
    // Solo métricas efectivamente reportadas por Meta. Sin estimaciones ni ceros de relleno.
    const views = fromApi(ins?.plays ?? ins?.impressions);
    const reach = fromApi(ins?.reach);
    const saves = fromApi(ins?.saved);
    const shares = fromApi(ins?.shares);
    const comments = fromApi(reel.comments_count);
    const retentionSeconds = fromApi(ins?.ig_reels_avg_watch_time);

    // La base de comparación es la mediana capturada al crear el experimento.
    const baseViews = exp.baseline_benchmark.median_views ?? benchmark.median_views;
    const baseReach = exp.baseline_benchmark.median_reach ?? benchmark.median_reach;
    const baseSaves = exp.baseline_benchmark.median_saves ?? benchmark.median_saves;
    const baseShares = exp.baseline_benchmark.median_shares ?? benchmark.median_shares;
    const baseComments = exp.baseline_benchmark.median_comments ?? benchmark.median_comments;

    const viewsPct = percentDelta(views, baseViews);
    const reachPct = percentDelta(reach, baseReach);
    const savesPct = percentDelta(saves, baseSaves);
    const sharesPct = percentDelta(shares, baseShares);
    const commentsPct = percentDelta(comments, baseComments);

    exp.actual_results = { views, reach, saves, shares, comments, retention_seconds: retentionSeconds };
    exp.delta_vs_median = {
      views_pct: viewsPct,
      reach_pct: reachPct,
      saves_pct: savesPct,
      shares_pct: sharesPct,
      comments_pct: commentsPct
    };

    // Registrar qué faltó para poder explicar un veredicto inconcluyente.
    const missing: string[] = [];
    if (!hasValue(views)) missing.push(hasValue(baseViews) ? 'reproducciones del Reel' : 'mediana de reproducciones');
    if (!hasValue(saves)) missing.push(hasValue(baseSaves) ? 'guardados del Reel' : 'mediana de guardados');
    exp.missing_result_metrics = missing;

    let verdict: ContentExperiment['evaluation_verdict'];
    let learningSummary: string;

    // Sin al menos una de las dos métricas decisorias no hay veredicto posible.
    // Antes, la ausencia de datos se traducía en ceros y producía una "refutación"
    // falsa que quedaba grabada como aprendizaje del negocio.
    if (!hasValue(savesPct) && !hasValue(viewsPct)) {
      verdict = 'SIN_DATOS_PARA_EVALUAR';
      learningSummary = `No se puede evaluar este experimento: Meta no reportó ${missing.join(' ni ')}. El experimento queda abierto a la espera de métricas reales; no se registró ningún aprendizaje.`;

      exp.evaluation_verdict = verdict;
      exp.learning_summary = learningSummary;
      // Sigue recolectando datos: NO pasa a 'LEARNED' ni genera insight.
      exp.status = 'COLLECTING_DATA';
      IntelligenceStorageService.saveExperiment(businessId, exp);
      return { experiment: exp, insight: null };
    }

    const savesWin = hasValue(savesPct) && savesPct >= 20;
    const viewsWin = hasValue(viewsPct) && viewsPct >= 25;
    const savesLoss = hasValue(savesPct) && savesPct <= -20;
    const viewsLoss = hasValue(viewsPct) && viewsPct <= -20;

    if (savesWin || viewsWin) {
      verdict = 'HIPOTESIS_VALIDADA';
      const metricHighlight = savesWin
        ? `+${savesPct}% en guardados (${formatMetric(saves)} vs ${formatMetric(baseSaves)} de mediana)`
        : `+${viewsPct}% en reproducciones (${formatMetric(views)} vs ${formatMetric(baseViews)} de mediana)`;
      learningSummary = `Hipótesis confirmada con datos reales: La ${exp.variable_tested} superó la mediana de la cuenta en un ${metricHighlight}. Demuestra que la audiencia responde favorablemente a esta formulación.`;
    } else if (savesLoss && viewsLoss) {
      verdict = 'HIPOTESIS_REFUTADA';
      learningSummary = `Hipótesis refutada: El rendimiento cayó ${Math.abs(viewsPct as number)}% en vistas y ${Math.abs(savesPct as number)}% en guardados respecto a la mediana histórica. Esta variable debe ajustarse o evitarse en los próximos guiones.`;
    } else {
      verdict = 'RESULTADO_INCONCLUYENTE';
      const parts: string[] = [];
      if (hasValue(viewsPct)) parts.push(`${viewsPct >= 0 ? '+' : ''}${viewsPct}% vistas`);
      if (hasValue(savesPct)) parts.push(`${savesPct >= 0 ? '+' : ''}${savesPct}% guardados`);
      learningSummary = `Resultado neutro: Las métricas se mantuvieron alineadas a la mediana histórica (${parts.join(', ')}). Se requiere mayor contraste en el gancho de los siguientes contenidos.`;
    }

    // Si el veredicto se apoyó en una sola métrica, queda dicho en el aprendizaje.
    if (missing.length > 0) {
      learningSummary += ` Nota: veredicto basado en evidencia parcial — Meta no reportó ${missing.join(' ni ')}.`;
    }

    exp.evaluation_verdict = verdict;
    exp.learning_summary = learningSummary;
    exp.status = 'LEARNED';
    exp.learned_at = new Date().toISOString();

    IntelligenceStorageService.saveExperiment(businessId, exp);

    const impactMetric = savesWin
      ? `+${savesPct}% Guardados`
      : hasValue(viewsPct)
        ? `${viewsPct >= 0 ? '+' : ''}${viewsPct}% Vistas`
        : `${(savesPct as number) >= 0 ? '+' : ''}${savesPct}% Guardados`;

    // La confianza baja cuando el veredicto se apoyó en evidencia incompleta.
    const confidence: LearnedInsight['confidence'] =
      verdict === 'HIPOTESIS_VALIDADA' && missing.length === 0 ? 'media' : 'baja';

    const insight: LearnedInsight = {
      insight_id: `ins_${Date.now()}`,
      business_id: businessId,
      experiment_id: exp.experiment_id,
      insight_text: learningSummary,
      evidence_count: 1,
      impact_metric: impactMetric,
      recommendation_for_future_scripts: verdict === 'HIPOTESIS_VALIDADA'
        ? `Replicar la estructura de gancho y dolor probada en el experimento "${exp.title}".`
        : `Evitar repetir el enfoque del experimento "${exp.title}" sin un gancho visual más inmediato.`,
      confidence,
      created_at: new Date().toISOString()
    };

    IntelligenceStorageService.saveLearnedInsight(businessId, insight);

    return { experiment: exp, insight };
  }
}
