// ================================================================
// ContentIntelligenceEngine.ts
// Motor Determinístico de Análisis Cuantitativo y Diagnóstico
// EventPix Intelligence — SaaS Platform
// ================================================================

import { IntelligencePost, BrandDNA, MetricValue, NO_DATA } from '../../types/intelligence';
import { toOptional, averageAvailable, hasValue } from './metricUtils';

export interface ContentScoreBreakdown {
  total_score: number; // 0 - 100
  reach_score: number; // 0 - 100 (Alcance bruto y exposición)
  interest_score: number; // 0 - 100 (Interés profundo: guardados, compartidos, retención)
  commercial_intent_score: number; // 0 - 100 (Potencial de conversión: visitas, CTAs, leads)
  tier: 'ganador_destacado' | 'rendimiento_solido' | 'promedio' | 'bajo_rendimiento' | 'anomalia';
  verdict: string;
  penalties: string[];
  bonuses: string[];
}

export interface PostPerformanceAnalysis {
  post: IntelligencePost;
  score: ContentScoreBreakdown;
  is_winner: boolean;
  is_loser: boolean;
  is_anomaly: boolean;
  anomaly_type?: 'viral_vacio' | 'joya_oculta' | 'fuga_retencion_temprana';
  evidence: string[];
}

export interface DetectedPattern {
  name: string;
  category: 'hook' | 'duracion' | 'formato' | 'cta' | 'tema';
  sample_size: number;
  avg_score: number;
  avg_interest_score: number;
  avg_commercial_score: number;
  performance_vs_average_pct: number;
  recommendation: 'repetir' | 'eliminar' | 'probar_mas' | 'optimizar';
  reasoning: string;
}

export interface ExecutiveIntelligenceReport {
  generated_at: string;
  account_handle: string;
  analyzed_posts_count: number;
  global_health_score: number; // 0 - 100
  account_status_summary: string;

  // Las 3 capas fundamentales
  layer_averages: {
    // MetricValue, no number: cuando Meta nunca reportó vistas para estos
    // posts (ej. cuentas consultadas por business_discovery), estas 3 tasas
    // son NO_DATA, nunca un número calculado contra un denominador fabricado.
    avg_reach: MetricValue;
    avg_interest_rate: MetricValue; // % guardados + compartidos sobre alcance
    avg_commercial_intent_rate: MetricValue; // % visitas perfil + interacciones cualificadas
    reach_vs_intent_verdict: string;
  };

  // Ganadores y Perdedores demostrados
  top_performers: PostPerformanceAnalysis[];
  bottom_performers: PostPerformanceAnalysis[];
  anomalies: PostPerformanceAnalysis[];

  // Patrones detectados con evidencia
  patterns: DetectedPattern[];

  // Recomendaciones accionables
  what_to_stop: Array<{
    action: string;
    evidence: string;
    estimated_budget_waste: string;
  }>;
  what_to_repeat: Array<{
    action: string;
    evidence: string;
    expected_gain: string;
  }>;
  next_experiments: Array<{
    hypothesis: string;
    suggested_hook: string;
    suggested_structure: string;
    suggested_cta: string;
    target_metric: string;
  }>;

  next_recommended_post: {
    hook: string;
    structure: string;
    duration_seconds: number;
    cta: string;
    commercial_goal: string;
    justification: string;
  };
}

export class ContentIntelligenceEngine {
  /**
   * Calcula el Score de Contenido (0 - 100) mediante fórmula matemática transparente.
   * NO optimiza solamente por likes o views.
   * Ponderación:
   *  - Alcance (20%)
   *  - Interés Profundo (40%: guardados 25%, compartidos 15%)
   *  - Intención Comercial (30%: visitas al perfil 15%, comentarios y CTAs 15%)
   *  - Retención de Gancho (10%: % de retención a 3s)
   */
  static calculatePostScore(
    post: IntelligencePost,
    accountAverages: {
      avgViews: number;
      avgLikes: number;
      avgComments: number;
      avgSaves: number;
      avgShares: number;
      avgProfileVisits: number;
      avgRetention: number;
    }
  ): ContentScoreBreakdown {
    // Métricas ausentes (MetricValue = 'no_disponible') se tratan como
    // "sin contribución conocida" para la fórmula, nunca como un número
    // inventado que aparente ser el dato real: por eso se normalizan acá
    // con toOptional + ?? 0 en vez de fabricar vistas, guardados, etc.
    const hasMetrics = !!post.metrics;
    const views = toOptional(post.metrics?.views) ?? 0;
    const saves = toOptional(post.metrics?.saves) ?? 0;
    const shares = toOptional(post.metrics?.shares) ?? 0;
    const profileVisits = toOptional(post.metrics?.profile_visits) ?? 0;
    const comments = toOptional(post.metrics?.comments) ?? 0;
    const likes = toOptional(post.metrics?.likes) ?? 0;
    // Sin retención reportada, se asume el baseline conservador de la
    // cuenta para no romper la fórmula con NaN; no se muestra como dato real.
    const retentionVal = toOptional(post.metrics?.retention_percentage) ?? accountAverages.avgRetention;

    const penalties: string[] = [];
    const bonuses: string[] = [];
    if (!hasMetrics) {
      penalties.push('Sin métricas sincronizadas: el score usa valores neutros hasta conectar datos reales.');
    }

    // 1. Ratio de Alcance (Base 20 pts)
    const reachFactor = accountAverages.avgViews > 0
      ? Math.min(views / accountAverages.avgViews, 3.0)
      : 1;
    let reachScore = Math.min(Math.round(reachFactor * 50), 100);

    // 2. Ratio de Interés Profundo (Base 40 pts)
    // Guardados = valor real (alguien quiere volver a verlo)
    // Compartidos = validación social (recomienda el contenido)
    const savesFactor = accountAverages.avgSaves > 0
      ? Math.min(saves / accountAverages.avgSaves, 3.0)
      : (saves > 10 ? 1.5 : 0.8);
    const sharesFactor = accountAverages.avgShares > 0
      ? Math.min(shares / accountAverages.avgShares, 3.0)
      : (shares > 5 ? 1.4 : 0.8);

    let interestScore = Math.min(
      Math.round((savesFactor * 0.65 + sharesFactor * 0.35) * 50),
      100
    );

    // 3. Intención Comercial (Base 30 pts)
    // Visitas al perfil tras ver el Reel + Comentarios (posible consulta)
    const visitsFactor = accountAverages.avgProfileVisits > 0
      ? Math.min(profileVisits / accountAverages.avgProfileVisits, 3.0)
      : (profileVisits > 5 ? 1.5 : 0.8);

    const commentsFactor = accountAverages.avgComments > 0
      ? Math.min(comments / accountAverages.avgComments, 3.0)
      : (comments > 3 ? 1.3 : 0.7);

    let commercialIntentScore = Math.min(
      Math.round((visitsFactor * 0.6 + commentsFactor * 0.4) * 50),
      100
    );

    // 4. Retención de Gancho (Base 10 pts)
    const hookScore = Math.min(Math.round((retentionVal / 40) * 100), 100);

    // Bonificaciones / Penalizaciones matemáticas
    if (views > accountAverages.avgViews * 2 && interestScore < 35) {
      penalties.push('Viralidad hueca: alto alcance pero muy baja interacción profunda.');
    }
    if (interestScore > 75 && views < accountAverages.avgViews * 0.8) {
      bonuses.push('Joya de conversión oculta: baja difusión algorítmica pero alta apreciación de valor.');
    }
    if (saves > (likes * 0.5) && likes > 5) {
      bonuses.push('Ratio de guardados extraordinario (>50% de los likes).');
    }
    if (retentionVal < 18) {
      penalties.push('Fuga de audiencia en primeros 3 segundos (hook débil o lento).');
    }

    // Fórmula transparente ponderada
    let rawTotal = (
      reachScore * 0.20 +
      interestScore * 0.40 +
      commercialIntentScore * 0.30 +
      hookScore * 0.10
    );

    // Ajuste de penalizaciones/bonificaciones (máximo +/- 15 pts)
    if (penalties.length > 0) rawTotal -= (penalties.length * 5);
    if (bonuses.length > 0) rawTotal += (bonuses.length * 5);

    const totalScore = Math.max(5, Math.min(99, Math.round(rawTotal)));

    let tier: ContentScoreBreakdown['tier'] = 'promedio';
    let verdict = 'Rendimiento estándar alineado con el promedio de la cuenta.';

    if (totalScore >= 80) {
      tier = 'ganador_destacado';
      verdict = 'Contenido GANADOR: Sobresale en interés y tracción comercial comprobada.';
    } else if (totalScore >= 65) {
      tier = 'rendimiento_solido';
      verdict = 'Rendimiento SÓLIDO: Por encima del promedio, con métricas estables.';
    } else if (totalScore <= 40) {
      tier = 'bajo_rendimiento';
      verdict = 'Bajo rendimiento: No logró retener ni generar interacción cualificada.';
    }

    if (penalties.some(p => p.includes('Viralidad hueca')) || bonuses.some(b => b.includes('Joya de conversión'))) {
      tier = 'anomalia';
    }

    return {
      total_score: totalScore,
      reach_score: reachScore,
      interest_score: interestScore,
      commercial_intent_score: commercialIntentScore,
      tier,
      verdict,
      penalties,
      bonuses,
    };
  }

  /**
   * Genera el diagnóstico exhaustivo e informe de inteligencia para el negocio
   */
  static generateExecutiveReport(
    posts: IntelligencePost[],
    brandDna: BrandDNA,
    accountHandle = '@tu_negocio'
  ): ExecutiveIntelligenceReport {
    if (posts.length === 0) {
      return this.generateEmptyReport(accountHandle, brandDna);
    }

    // 1. Cálculos de promedios de la cuenta
    // averageAvailable divide solo entre los posts que efectivamente
    // reportaron cada métrica (no entre el total), y nunca trata
    // 'no_disponible' como 0: promediar con ceros fabricados hundía el
    // promedio de toda la cuenta cada vez que faltaba un insight.
    const toNum = (v: number | 'no_disponible' | undefined) => toOptional(v);
    const avgViewsAvail = averageAvailable(posts.map(p => toNum(p.metrics?.views)));
    const avgLikesAvail = averageAvailable(posts.map(p => toNum(p.metrics?.likes)));
    const avgCommentsAvail = averageAvailable(posts.map(p => toNum(p.metrics?.comments)));
    const avgSavesAvail = averageAvailable(posts.map(p => toNum(p.metrics?.saves)));
    const avgSharesAvail = averageAvailable(posts.map(p => toNum(p.metrics?.shares)));
    const avgVisitsAvail = averageAvailable(posts.map(p => toNum(p.metrics?.profile_visits)));
    const avgRetentionAvail = averageAvailable(posts.map(p => toNum(p.metrics?.retention_percentage)));

    const accountAverages = {
      avgViews: (hasValue(avgViewsAvail) ? Math.round(avgViewsAvail) : 0) || 1,
      avgLikes: (hasValue(avgLikesAvail) ? Math.round(avgLikesAvail) : 0) || 1,
      avgComments: (hasValue(avgCommentsAvail) ? Math.round(avgCommentsAvail) : 0) || 1,
      avgSaves: (hasValue(avgSavesAvail) ? Math.round(avgSavesAvail) : 0) || 1,
      avgShares: (hasValue(avgSharesAvail) ? Math.round(avgSharesAvail) : 0) || 1,
      avgProfileVisits: (hasValue(avgVisitsAvail) ? Math.round(avgVisitsAvail) : 0) || 1,
      avgRetention: hasValue(avgRetentionAvail) ? Number(avgRetentionAvail.toFixed(1)) : 25,
    };

    // Sumas reales (para las tasas de capa más abajo), tratando lo
    // ausente como 0 solo a efectos de sumar, nunca de promediar.
    const sumViews = posts.reduce((s, p) => s + (toNum(p.metrics?.views) ?? 0), 0);
    const sumSaves = posts.reduce((s, p) => s + (toNum(p.metrics?.saves) ?? 0), 0);
    const sumShares = posts.reduce((s, p) => s + (toNum(p.metrics?.shares) ?? 0), 0);
    const sumVisits = posts.reduce((s, p) => s + (toNum(p.metrics?.profile_visits) ?? 0), 0);
    const sumComments = posts.reduce((s, p) => s + (toNum(p.metrics?.comments) ?? 0), 0);

    // 2. Evaluar cada post
    const analyzedPosts: PostPerformanceAnalysis[] = posts.map(post => {
      const score = this.calculatePostScore(post, accountAverages);
      const is_winner = score.total_score >= 70;
      const is_loser = score.total_score <= 45;
      const is_anomaly = score.tier === 'anomalia';

      let anomaly_type: PostPerformanceAnalysis['anomaly_type'] = undefined;
      if (score.penalties.some(p => p.includes('Viralidad hueca'))) {
        anomaly_type = 'viral_vacio';
      } else if (score.bonuses.some(b => b.includes('Joya de conversión'))) {
        anomaly_type = 'joya_oculta';
      } else if (score.penalties.some(p => p.includes('Fuga de audiencia'))) {
        anomaly_type = 'fuga_retencion_temprana';
      }

      const evidence: string[] = [];
      const evViews = toOptional(post.metrics?.views);
      const evSaves = toOptional(post.metrics?.saves);
      const evComments = toOptional(post.metrics?.comments);
      if (hasValue(evViews)) {
        if (evViews > accountAverages.avgViews * 1.3) {
          evidence.push(`Alcance ${Math.round((evViews / accountAverages.avgViews - 1) * 100)}% superior al promedio`);
        } else if (evViews < accountAverages.avgViews * 0.7) {
          evidence.push(`Alcance ${Math.round((1 - evViews / accountAverages.avgViews) * 100)}% por debajo de la media`);
        }
      }
      if (hasValue(evSaves) && evSaves > accountAverages.avgSaves * 1.4) {
        evidence.push(`Tasa de guardado ${(evSaves / (accountAverages.avgSaves || 1)).toFixed(1)}x sobre la media`);
      }
      if (hasValue(evComments) && evComments > accountAverages.avgComments * 1.5) {
        evidence.push(`Alta generación de conversación (${evComments} comentarios)`);
      }

      return {
        post,
        score,
        is_winner,
        is_loser,
        is_anomaly,
        anomaly_type,
        evidence,
      };
    });

    // Ordenar de mayor a menor score
    analyzedPosts.sort((a, b) => b.score.total_score - a.score.total_score);

    const top_performers = analyzedPosts.filter(p => p.is_winner).slice(0, 3);
    const bottom_performers = analyzedPosts.filter(p => p.is_loser).slice(0, 3);
    const anomalies = analyzedPosts.filter(p => p.is_anomaly).slice(0, 3);

    // 3. Detección de patrones sistemáticos
    const patterns = this.detectPatterns(analyzedPosts);

    // 4. Promedios de capas (Alcance vs Interés vs Intención)
    // Estas 3 tasas dividen por vistas: si NINGÚN post reportó vistas (ej.
    // cuentas consultadas por business_discovery, que nunca las expone),
    // dividir por el "1" de seguridad de accountAverages producía tasas
    // absurdas (cientos de miles por ciento) a partir de datos reales de
    // otras métricas. Sin vistas reales, las 3 son NO_DATA.
    const viewsAvailable = hasValue(avgViewsAvail);
    const avg_reach: MetricValue = viewsAvailable ? Math.round(avgViewsAvail) : NO_DATA;
    const avgInterestRate: MetricValue = viewsAvailable
      ? Number(((sumSaves + sumShares) / Math.max(sumViews, 1) * 100).toFixed(2))
      : NO_DATA;
    const avgCommercialRate: MetricValue = viewsAvailable
      ? Number(((sumVisits + sumComments) / Math.max(sumViews, 1) * 100).toFixed(2))
      : NO_DATA;

    let reachVsIntentVerdict = 'Equilibrio moderado entre difusión e interés.';
    if (!viewsAvailable) {
      reachVsIntentVerdict = 'Meta no reportó vistas ni alcance para estas publicaciones (posible cuenta consultada por business_discovery, que no expone esas métricas): no se puede calcular el índice de alcance vs. intención. Conectá tu propia cuenta de Meta para obtenerlas.';
    } else if (hasValue(avgInterestRate) && avgInterestRate > 4.0) {
      reachVsIntentVerdict = 'Audiencia altamente interesada: los contenidos se guardan y comparten por encima del benchmark promedio (4%).';
    } else if (hasValue(avgCommercialRate) && avgCommercialRate < 1.0) {
      reachVsIntentVerdict = 'Fuga de intención comercial: los videos se reproducen pero pocos espectadores visitan el perfil o consultan.';
    }

    // Health score global (promedio de los scores ponderados)
    const avgScoreTotal = Math.round(
      analyzedPosts.reduce((s, p) => s + p.score.total_score, 0) / Math.max(analyzedPosts.length, 1)
    );

    // 5. Generar recomendaciones fundamentadas en evidencia
    const what_to_stop: ExecutiveIntelligenceReport['what_to_stop'] = [];
    const what_to_repeat: ExecutiveIntelligenceReport['what_to_repeat'] = [];

    // Si hay perdedores o anomalías
    if (bottom_performers.length > 0) {
      const p = bottom_performers[0];
      what_to_stop.push({
        action: `Dejar de usar aperturas lentas o genéricas como en "${p.post.title.slice(0, 45)}..."`,
        evidence: `Este contenido obtuvo un score de solo ${p.score.total_score}/100 y perdió retención antes del segundo 3.`,
        estimated_budget_waste: 'Reduce el alcance orgánico de los siguientes 3 posts por penalización algorítmica.',
      });
    }

    const lowSavesPosts = posts.filter(p => {
      const s = toOptional(p.metrics?.saves);
      return hasValue(s) && s <= 2;
    });
    if (lowSavesPosts.length > 1) {
      what_to_stop.push({
        action: 'Evitar publicaciones puramente expositivas sin elementos de valor accionable o lista de pasos.',
        evidence: `${lowSavesPosts.length} publicaciones no superaron los 2 guardados, indicando bajo valor percibido a largo plazo.`,
        estimated_budget_waste: 'Alto tiempo de producción para retención casi nula.',
      });
    }

    // Qué repetir
    if (top_performers.length > 0) {
      const best = top_performers[0];
      const bestSaves = toOptional(best.post.metrics?.saves);
      const bestShares = toOptional(best.post.metrics?.shares);
      const savesLabel = hasValue(bestSaves) ? `${bestSaves} guardados` : 'guardados sin dato';
      const sharesLabel = hasValue(bestShares) ? `${bestShares} compartidos` : 'compartidos sin dato';
      what_to_repeat.push({
        action: `Replicar la estructura de gancho visual directo de "${best.post.title.slice(0, 45)}..."`,
        evidence: `Logró un score de ${best.score.total_score}/100 y concentró el mayor interés de la cuenta con ${savesLabel} y ${sharesLabel}.`,
        expected_gain: 'Consistencia en el percentil superior del algoritmo y mayor flujo de prospectos.',
      });
    }

    what_to_repeat.push({
      action: 'Incluir una demostración concreta del producto o servicio en los primeros 5 segundos.',
      evidence: 'Los contenidos con demostración tangible suelen mostrar mayor retención que los videos con solo texto estático.',
      expected_gain: 'Mayor tiempo de visualización promedio.',
    });

    // 6. Próximos experimentos concretos — genéricos y basados en el Brand DNA
    // real del negocio, nunca en el rubro con el que se armó la plataforma
    // (cartelería/pantallas digitales).
    const primaryOffer = brandDna.offers.main_products[0]?.trim();
    const primaryCta = brandDna.offers.call_to_actions[0]?.trim();
    const next_experiments: ExecutiveIntelligenceReport['next_experiments'] = [
      {
        hypothesis: 'Si mostrás un resultado real y concreto para el cliente en el primer segundo, el interés comercial debería aumentar.',
        suggested_hook: primaryOffer
          ? `¿Qué pasa cuando alguien prueba ${primaryOffer}? Mirá el resultado real:`
          : '¿Qué pasa cuando un cliente prueba lo que ofrecés? Mirá el resultado real:',
        suggested_structure: '0-3s: Gancho con resultado real -> 3-15s: Contexto del cliente -> 15-30s: Beneficio -> 30-45s: CTA directo.',
        suggested_cta: primaryCta || 'Comentá o escribinos para conocer más.',
        target_metric: 'Comentarios por palabra clave y visitas al perfil.',
      },
      {
        hypothesis: 'Un Reel comparativo (antes/después, o el error más común vs. tu solución) suele generar una alta tasa de guardados.',
        suggested_hook: 'El error que comete la mayoría antes de encontrar una solución como la tuya:',
        suggested_structure: 'Problema -> Contraste con tu solución -> Resultado -> Oferta.',
        suggested_cta: 'Guardá este video si te pasó lo mismo.',
        target_metric: 'Tasa de guardado > 5%.',
      }
    ];

    // 7. Próximo post recomendado, basado en el Brand DNA real del negocio y
    // en el gancho del post ganador (si hay uno con análisis de IA hecho).
    const bestHook = top_performers[0]?.post.analysis?.hook_data?.text;
    const hookIntro = bestHook
      ? `Repetí el estilo del gancho que ya te funcionó: "${bestHook.slice(0, 80)}"`
      : (brandDna.identity?.unique_value_proposition?.trim()
        ? `Mostrá en los primeros 3 segundos por qué ${brandDna.identity.unique_value_proposition.trim()}`
        : 'Mostrá en los primeros 3 segundos el problema real que resolvés');
    const next_recommended_post = {
      hook: primaryOffer ? `${hookIntro}, conectándolo con ${primaryOffer}.` : `${hookIntro}.`,
      structure: 'Gancho (0-3s) -> Problema del cliente (3-12s) -> Cómo lo resolvés (12-28s) -> Llamado a la acción (28-40s)',
      duration_seconds: 35,
      cta: primaryCta || 'Escribinos por WhatsApp o comentá para recibir más información.',
      commercial_goal: 'Generar conversaciones directas por DM o WhatsApp con clientes interesados.',
      justification: `Diseñado a partir del análisis de tus ${posts.length} publicaciones reales: combina el patrón de gancho con mejor retención detectado con la oferta principal de tu negocio.`,
    };

    return {
      generated_at: new Date().toISOString(),
      account_handle: accountHandle,
      analyzed_posts_count: posts.length,
      global_health_score: avgScoreTotal,
      account_status_summary: `Se auditaron ${posts.length} publicaciones de @${accountHandle.replace('@', '')}. La cuenta tiene una salud general de ${avgScoreTotal}/100. Se detectaron ${top_performers.length} contenidos ganadores que traccionan la mayor parte del interés, junto con oportunidades claras para eliminar formatos que consumen tiempo sin generar consultas comerciales.`,
      layer_averages: {
        avg_reach,
        avg_interest_rate: avgInterestRate,
        avg_commercial_intent_rate: avgCommercialRate,
        reach_vs_intent_verdict: reachVsIntentVerdict,
      },
      top_performers,
      bottom_performers,
      anomalies,
      patterns,
      what_to_stop,
      what_to_repeat,
      next_experiments,
      next_recommended_post,
    };
  }

  /**
   * Solo reporta un patrón cuando hay publicaciones reales que lo respalden,
   * con estadísticas calculadas sobre esos posts (nunca números de ejemplo
   * fijos). Un patrón sin muestra real simplemente no aparece: es preferible
   * una pestaña "Patrones Demostrados" vacía a una con hipótesis inventadas
   * disfrazadas de evidencia.
   */
  private static detectPatterns(analyzedPosts: PostPerformanceAnalysis[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    if (analyzedPosts.length === 0) return patterns;

    const overallAvgScore = analyzedPosts.reduce((s, a) => s + a.score.total_score, 0) / analyzedPosts.length;

    const summarize = (subset: PostPerformanceAnalysis[]) => {
      const avg_score = Math.round(subset.reduce((s, a) => s + a.score.total_score, 0) / subset.length);
      const avg_interest_score = Math.round(subset.reduce((s, a) => s + a.score.interest_score, 0) / subset.length);
      const avg_commercial_score = Math.round(subset.reduce((s, a) => s + a.score.commercial_intent_score, 0) / subset.length);
      const performance_vs_average_pct = Math.round(((avg_score - overallAvgScore) / Math.max(overallAvgScore, 1)) * 100);
      return { avg_score, avg_interest_score, avg_commercial_score, performance_vs_average_pct };
    };

    // Patrón 1: Formato corto (< 30s). `duration_seconds` es 0 cuando Meta no
    // la reportó (posts importados por Graph API), así que se excluye ese caso.
    const shortPosts = analyzedPosts.filter(a => a.post.duration_seconds > 0 && a.post.duration_seconds <= 30);
    if (shortPosts.length > 0) {
      const stats = summarize(shortPosts);
      patterns.push({
        name: 'Formato Corto (< 30s)',
        category: 'duracion',
        sample_size: shortPosts.length,
        ...stats,
        recommendation: stats.performance_vs_average_pct >= 0 ? 'repetir' : 'optimizar',
        reasoning: `Tus ${shortPosts.length} publicaciones de menos de 30s tienen un score promedio ${Math.abs(stats.performance_vs_average_pct)}% ${stats.performance_vs_average_pct >= 0 ? 'mayor' : 'menor'} que el resto de la cuenta.`,
      });
    }

    // Patrón 2: CTA por palabra clave en comentarios
    const keywordCtaPosts = analyzedPosts.filter(a =>
      a.post.analysis?.cta_data?.type === 'comment_keyword' ||
      (a.post.title && a.post.title.toLowerCase().includes('coment'))
    );
    if (keywordCtaPosts.length > 0) {
      const stats = summarize(keywordCtaPosts);
      patterns.push({
        name: 'Llamado a la Acción por Palabra Clave ("Comentá X")',
        category: 'cta',
        sample_size: keywordCtaPosts.length,
        ...stats,
        recommendation: stats.performance_vs_average_pct >= 0 ? 'repetir' : 'optimizar',
        reasoning: `Tus ${keywordCtaPosts.length} publicaciones con este tipo de CTA tienen un score promedio ${Math.abs(stats.performance_vs_average_pct)}% ${stats.performance_vs_average_pct >= 0 ? 'mayor' : 'menor'} que el resto de la cuenta.`,
      });
    }

    // Patrón 3: Gancho de advertencia / error común (requiere que el post
    // tenga análisis de IA hecho: `hook_data.type` no viene de Meta).
    const warningHookPosts = analyzedPosts.filter(a =>
      a.post.analysis?.hook_data?.type === 'preguntas_negativas' || a.post.analysis?.hook_data?.type === 'error_comun'
    );
    if (warningHookPosts.length > 0) {
      const stats = summarize(warningHookPosts);
      patterns.push({
        name: 'Gancho de Advertencia / Error Común',
        category: 'hook',
        sample_size: warningHookPosts.length,
        ...stats,
        recommendation: stats.performance_vs_average_pct >= 0 ? 'repetir' : 'optimizar',
        reasoning: `Tus ${warningHookPosts.length} publicaciones con este tipo de gancho tienen un score promedio ${Math.abs(stats.performance_vs_average_pct)}% ${stats.performance_vs_average_pct >= 0 ? 'mayor' : 'menor'} que el resto de la cuenta.`,
      });
    }

    return patterns;
  }

  private static generateEmptyReport(
    accountHandle: string,
    brandDna: BrandDNA
  ): ExecutiveIntelligenceReport {
    return {
      generated_at: new Date().toISOString(),
      account_handle: accountHandle,
      analyzed_posts_count: 0,
      global_health_score: 0,
      account_status_summary: 'Esperando importación de publicaciones. Sincronizá tus Reels reales de Instagram o agregalos al Lienzo para activar el motor de inteligencia basado en evidencia real.',
      layer_averages: {
        avg_reach: NO_DATA,
        avg_interest_rate: NO_DATA,
        avg_commercial_intent_rate: NO_DATA,
        reach_vs_intent_verdict: 'Esperando datos de publicaciones para calcular el índice de alcance vs intención.',
      },
      top_performers: [],
      bottom_performers: [],
      anomalies: [],
      patterns: [],
      what_to_stop: [],
      what_to_repeat: [],
      next_experiments: [],
      next_recommended_post: {
        hook: `Conocé ${brandDna.offers.main_products[0] || 'tu producto o servicio principal'}.`,
        structure: 'Gancho -> Problema -> Solución -> CTA',
        duration_seconds: 30,
        cta: 'Escribinos para más info.',
        commercial_goal: 'Presentación de marca.',
        justification: 'Sin publicaciones aún: esto es una plantilla genérica, no una recomendación basada en evidencia. Importá tus Reels reales para un guión basado en datos.',
      },
    };
  }
}
