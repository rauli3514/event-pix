// ================================================================
// ContentDnaEngine.ts
// Motor de Deconstrucción de Content DNA, Detección de Patrones e Hipótesis
// EventPix Intelligence — SaaS Studio
// ================================================================

import {
  ContentDnaItem,
  EmpiricalPattern,
  Hypothesis,
  ReelPerformanceClassification
} from '../../types/intelligence';
import { MetaMediaItem, MetaMediaInsights } from '../meta/MetaGraphService';
import { toOptional } from './metricUtils';

export class ContentDnaEngine {
  /**
   * Deconstruye un Reel en sus componentes fundamentales de Content DNA.
   * Analiza el gancho, el dolor, la promesa, la estructura narrativa y el CTA.
   */
  public static deconstructReelDna(
    reel: MetaMediaItem & { insights?: MetaMediaInsights },
    nicheContext?: string
  ): ContentDnaItem {
    const caption = reel.caption || '';
    const cleanCaption = caption.replace(/#[a-zA-Z0-9_]+/g, '').trim();
    const lines = cleanCaption.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || 'Demostración de producto o servicio en video';

    // Inferencia de Tipo de Gancho
    let hookType: ContentDnaItem['hook_type'] = 'demostracion_directa';
    const lowerFirst = firstLine.toLowerCase();

    if (lowerFirst.includes('?') || lowerFirst.startsWith('cómo') || lowerFirst.startsWith('por qué') || lowerFirst.includes('te pasa que')) {
      hookType = 'pregunta_problema';
    } else if (lowerFirst.includes('error') || lowerFirst.includes('no hagas') || lowerFirst.includes('deja de') || lowerFirst.includes('peor')) {
      hookType = 'error_comun';
    } else if (lowerFirst.includes('secreto') || lowerFirst.includes('nadie te dice') || lowerFirst.includes('lo que no sabías') || lowerFirst.includes('truco')) {
      hookType = 'secreto_revelado';
    } else if (lowerFirst.includes('nunca') || lowerFirst.includes('imposible') || lowerFirst.includes('el fin de') || lowerFirst.includes('cambió todo')) {
      hookType = 'afirmacion_chocante';
    } else if (lowerFirst.includes('mira esto') || lowerFirst.includes('así funciona') || lowerFirst.includes('resultado')) {
      hookType = 'demostracion_directa';
    } else {
      hookType = 'curiosidad';
    }

    // Inferencia de CTA
    let cta = 'Consulta en comentarios o mensaje directo';
    let ctaType: ContentDnaItem['cta_type'] = 'ninguno';

    const lastLine = lines.length > 1 ? lines[lines.length - 1].toLowerCase() : lowerFirst;
    if (lastLine.includes('comenta') || lastLine.includes('comentá') || lastLine.includes('palabra')) {
      cta = lines[lines.length - 1];
      ctaType = 'comentario_clave';
    } else if (lastLine.includes('dm') || lastLine.includes('mensaje') || lastLine.includes('escribinos') || lastLine.includes('escríbeme')) {
      cta = lines[lines.length - 1];
      ctaType = 'dm';
    } else if (lastLine.includes('link') || lastLine.includes('bio') || lastLine.includes('enlace')) {
      cta = lines[lines.length - 1];
      ctaType = 'link_en_bio';
    } else if (lastLine.includes('guardá') || lastLine.includes('guarda') || lastLine.includes('compartí') || lastLine.includes('comparte')) {
      cta = lines[lines.length - 1];
      ctaType = 'guardar';
    } else if (lastLine.includes('whatsapp') || lastLine.includes('wsp') || lastLine.includes('número')) {
      cta = lines[lines.length - 1];
      ctaType = 'whatsapp';
    }

    // Intención del contenido & etapa del embudo
    let contentIntent: ContentDnaItem['content_intent'] = 'nutricion_interes';
    let funnelStage: ContentDnaItem['funnel_stage'] = 'middle_of_funnel';

    if (ctaType === 'comentario_clave' || ctaType === 'dm' || ctaType === 'whatsapp') {
      contentIntent = 'conversion_comercial';
      funnelStage = 'bottom_of_funnel';
    } else if (hookType === 'afirmacion_chocante' || hookType === 'error_comun') {
      contentIntent = 'captacion_fria';
      funnelStage = 'top_of_funnel';
    }

    // Disparador emocional
    let emotionalTrigger: ContentDnaItem['emotional_trigger'] = 'validacion';
    if (hookType === 'error_comun' || hookType === 'pregunta_problema') {
      emotionalTrigger = 'alivio';
    } else if (hookType === 'secreto_revelado' || hookType === 'afirmacion_chocante') {
      emotionalTrigger = 'curiosidad_profesional';
    } else if (contentIntent === 'conversion_comercial') {
      emotionalTrigger = 'ambicion';
    }

    return {
      reel_id: reel.id,
      caption_summary: cleanCaption.slice(0, 160) + (cleanCaption.length > 160 ? '...' : ''),
      hook: firstLine,
      hook_type: hookType,
      hook_strength: firstLine.length > 10 && firstLine.length < 80 ? 'alta' : 'media',
      topic: nicheContext || 'Negocio / Solución',
      subtopic: lines[1] || 'Operación y resultados prácticos',
      target_audience: nicheContext ? `Clientes y dueños de negocio interesados en ${nicheContext}` : 'Público objetivo del negocio',
      pain_point: hookType === 'error_comun' ? 'Pérdida de tiempo o recursos con métodos tradicionales' : 'Falta de una solución ágil y profesional',
      desire: 'Obtener resultados rápidos y comprobados sin complicaciones',
      promise: 'Demostración de cómo se logra el resultado paso a paso',
      solution: 'Solución directa ofrecida en el reel',
      product_or_service: nicheContext || 'Servicio / Producto comercial',
      cta: cta,
      cta_type: ctaType,
      content_intent: contentIntent,
      funnel_stage: funnelStage,
      opening_seconds_description: `0-3 segundos: Hook directo ("${firstLine.slice(0, 50)}") con soporte visual inmediato`,
      emotional_trigger: emotionalTrigger
    };
  }

  /**
   * Detecta patrones empíricos ganadores y perdedores cruzando Content DNA con el rendimiento real.
   * Genera hipótesis basadas 100% en evidencia observada.
   */
  public static detectWinningAndLosingPatterns(
    dnaItems: ContentDnaItem[],
    classifications: ReelPerformanceClassification[],
    businessId: string
  ): {
    patterns: EmpiricalPattern[];
    hypotheses: Hypothesis[];
    winningRules: string[];
    losingRules: string[];
  } {
    const classMap = new Map(classifications.map(c => [c.reel_id, c]));

    // Agrupación por tipo de gancho
    const hookGroups: Record<string, {
      total: number; winners: number; commercialWinners: number;
      totalSavesRatio: number; savesRatioSamples: number;
      totalViewsRatio: number; viewsRatioSamples: number;
    }> = {};

    dnaItems.forEach(item => {
      const cls = classMap.get(item.reel_id);
      if (!cls) return;

      if (!hookGroups[item.hook_type]) {
        hookGroups[item.hook_type] = {
          total: 0, winners: 0, commercialWinners: 0,
          totalSavesRatio: 0, savesRatioSamples: 0,
          totalViewsRatio: 0, viewsRatioSamples: 0
        };
      }
      const g = hookGroups[item.hook_type];
      g.total += 1;
      if (cls.is_viral_reach_winner || cls.is_commercial_winner) g.winners += 1;
      if (cls.is_commercial_winner) g.commercialWinners += 1;
      // saves_ratio/views_ratio son MetricValue: `+=` sobre 'no_disponible'
      // concatenaba en vez de sumar. Se excluyen del promedio (no se
      // cuentan como 0) en vez de fabricar un ratio para el reel.
      const savesRatio = toOptional(cls.performance_index.saves_ratio);
      if (savesRatio !== undefined) {
        g.totalSavesRatio += savesRatio;
        g.savesRatioSamples += 1;
      }
      const viewsRatio = toOptional(cls.performance_index.views_ratio);
      if (viewsRatio !== undefined) {
        g.totalViewsRatio += viewsRatio;
        g.viewsRatioSamples += 1;
      }
    });

    const patterns: EmpiricalPattern[] = [];
    const hypotheses: Hypothesis[] = [];
    const winningRules: string[] = [];
    const losingRules: string[] = [];

    // Formateo de tipos de gancho a nombres amigables
    const hookNames: Record<string, string> = {
      demostracion_directa: 'Demostración Directa / Caso Real',
      pregunta_problema: 'Pregunta sobre Dolor Concreto',
      error_comun: 'Señalamiento de Error Común',
      secreto_revelado: 'Revelación de Proceso Interno',
      afirmacion_chocante: 'Afirmación Contundente / Desafío',
      curiosidad: 'Apertura de Curiosidad'
    };

    Object.entries(hookGroups).forEach(([hookType, stats]) => {
      if (stats.total === 0) return;
      const winRate = stats.winners / stats.total;
      const avgSavesRatio = stats.savesRatioSamples > 0
        ? Math.round((stats.totalSavesRatio / stats.savesRatioSamples) * 100) / 100
        : 1;
      const avgViewsRatio = stats.viewsRatioSamples > 0
        ? Math.round((stats.totalViewsRatio / stats.viewsRatioSamples) * 100) / 100
        : 1;

      // Nivel de confianza empírico según tamaño de muestra
      let confidence: 'alta' | 'media' | 'baja' = 'baja';
      if (stats.total >= 6) {
        confidence = 'alta';
      } else if (stats.total >= 3) {
        confidence = 'media';
      }

      const friendlyName = hookNames[hookType] || hookType;

      if (winRate >= 0.6 && stats.total >= 2) {
        // Patrón Ganador
        const isCommercial = stats.commercialWinners >= stats.total * 0.5;
        const impactText = isCommercial
          ? `+${Math.round((avgSavesRatio - 1) * 100)}% guardados vs mediana de la cuenta`
          : `+${Math.round((avgViewsRatio - 1) * 100)}% reproducciones vs mediana de la cuenta`;

        patterns.push({
          pattern_id: `pat_win_${hookType}`,
          name: `Gancho: ${friendlyName}`,
          category: 'hook',
          sample_size: stats.total,
          win_rate_vs_median: Math.round(winRate * 100) / 100,
          metric_impact: impactText,
          confidence,
          recommendation: 'repetir_ganador',
          supporting_evidence: `En ${stats.winners} de ${stats.total} reels con este formato, el contenido superó la mediana (${impactText}).`
        });

        winningRules.push(`Los ganchos con formato "${friendlyName}" demostraron la mayor retención y respuesta (${impactText}, muestra: ${stats.total} reels).`);

        // Generar Hipótesis Estratégica
        hypotheses.push({
          hypothesis_id: `hyp_${hookType}_${Date.now()}`,
          business_id: businessId,
          statement: `Al utilizar una apertura de "${friendlyName}" focalizada en el dolor operativo de los primeros 3 segundos, se aumentará la tasa de guardados y consultas comerciales.`,
          evidence_basis: `Observado en ${stats.winners} de ${stats.total} reels analizados con un desempeño de ${avgSavesRatio}x sobre la mediana histórica.`,
          sample_reels_count: stats.total,
          confidence,
          metric_to_impact: isCommercial ? 'saves' : 'views',
          target_benchmark_comparison: `Superar la mediana histórica de ${isCommercial ? 'guardados' : 'vistas'} de la cuenta en al menos +35%`,
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } else if (winRate < 0.35 && stats.total >= 2) {
        // Patrón a Evitar
        patterns.push({
          pattern_id: `pat_loss_${hookType}`,
          name: `Gancho a Evitar: ${friendlyName}`,
          category: 'hook',
          sample_size: stats.total,
          win_rate_vs_median: Math.round(winRate * 100) / 100,
          metric_impact: `${Math.round((1 - avgViewsRatio) * 100)}% por debajo de la mediana`,
          confidence,
          recommendation: 'evitar_perdedor',
          supporting_evidence: `En ${stats.total - stats.winners} de ${stats.total} reels, este tipo de apertura no logró retener a la audiencia y quedó bajo la mediana.`
        });

        losingRules.push(`Evitar aperturas con formato "${friendlyName}" sin contexto práctico: consistentemente quedaron por debajo de la mediana.`);
      }
    });

    // Si la muestra es pequeña (< 2 por grupo), asegurar al menos una hipótesis de arranque basada en la mejor publicación
    if (hypotheses.length === 0 && classifications.length > 0) {
      const topReelCls = [...classifications].sort((a, b) =>
        (toOptional(b.performance_index.saves_ratio) ?? 0) - (toOptional(a.performance_index.saves_ratio) ?? 0)
      )[0];
      const topDna = dnaItems.find(d => d.reel_id === topReelCls.reel_id);

      hypotheses.push({
        hypothesis_id: `hyp_baseline_${Date.now()}`,
        business_id: businessId,
        statement: `Modelar la estructura del contenido con mayor interacción (${topDna?.hook_type ? hookNames[topDna.hook_type] : 'Demostración Directa'}), combinando gancho visual con llamado a la acción concreto.`,
        evidence_basis: `El reel de mejor desempeño de la cuenta logró ${topReelCls.performance_index.saves_ratio}x la mediana de guardados.`,
        sample_reels_count: classifications.length,
        confidence: classifications.length >= 5 ? 'media' : 'baja',
        metric_to_impact: 'saves',
        target_benchmark_comparison: 'Superar la mediana de guardados de la cuenta',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return {
      patterns,
      hypotheses,
      winningRules,
      losingRules
    };
  }
}
