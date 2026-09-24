// ================================================================
// UnifiedAuditEngine.ts
// Radiografía completa del negocio: cruza contenido orgánico real
// (Instagram), Meta Ads real y mensajes/CRM real en un solo puntaje
// con 5 categorías (Crecimiento, Engagement, Contenido, Oportunidades,
// Consistencia).
//
// Regla dura de todo este motor: una categoría cuyo dato real de base
// no existe todavía (sin Reels suficientes, sin Ads conectados, sin
// mensajes cargados) devuelve `score: null`, nunca un número inventado
// para "que se vea completo". El puntaje general se recalcula
// re-ponderando solo entre las categorías que sí tienen dato real.
// ================================================================

import { IntelligencePost, UnifiedBusinessAudit, AuditCategoryScore, BioAudit } from '../../types/intelligence';
import { ExecutiveIntelligenceReport } from './ContentIntelligenceEngine';
import { AdsIntelligenceReport } from '../../types/ads';
import { CRMFunnelMetrics, CommercialOpportunity } from '../../types/crm';
import { MetaProfileInsights } from '../meta/MetaGraphService';
import { toOptional } from './metricUtils';

const CATEGORY_WEIGHTS = {
  contenido: 0.30,
  engagement: 0.20,
  crecimiento: 0.20,
  consistencia: 0.15,
  oportunidades: 0.15,
} as const;

export class UnifiedAuditEngine {
  static build(params: {
    posts: IntelligencePost[];
    organicReport: ExecutiveIntelligenceReport;
    adsReport: AdsIntelligenceReport | null;
    funnelMetrics: CRMFunnelMetrics | null;
    opportunities: CommercialOpportunity[];
    profile: MetaProfileInsights | null;
  }): UnifiedBusinessAudit {
    const { posts, organicReport, adsReport, funnelMetrics, opportunities, profile } = params;

    const categories = {
      contenido: this.scoreContenido(organicReport),
      engagement: this.scoreEngagement(organicReport),
      crecimiento: this.scoreCrecimiento(posts),
      consistencia: this.scoreConsistencia(posts),
      oportunidades: this.scoreOportunidades(adsReport),
    };

    return {
      generated_at: new Date().toISOString(),
      overall_score: this.blendOverall(categories),
      categories,
      priority_finding: this.buildPriorityFinding(categories, adsReport, opportunities),
      whats_working: this.buildWhatsWorking(organicReport, adsReport),
      whats_to_improve: this.buildWhatsToImprove(organicReport, adsReport, opportunities),
      action_plan: this.buildActionPlan(organicReport, adsReport, opportunities, funnelMetrics),
      bio_audit: this.buildBioAudit(profile),
    };
  }

  // ---- Categoría: Contenido ----
  // Reutiliza el score determinístico ya existente (alcance 20% + interés
  // 40% + intención comercial 30% + retención 10%, promediado por post).
  private static scoreContenido(report: ExecutiveIntelligenceReport): AuditCategoryScore {
    if (report.analyzed_posts_count === 0) {
      return { score: null, label: 'Contenido', detail: 'Todavía no hay Reels analizados.' };
    }
    return {
      score: Math.round(report.global_health_score),
      label: 'Contenido',
      detail: `Puntaje promedio de tus últimos ${report.analyzed_posts_count} Reels según alcance, interés y potencial comercial.`,
    };
  }

  // ---- Categoría: Engagement ----
  // % de tus Reels que superaron la mediana de tu propia cuenta (guardados,
  // comentarios, compartidos sobre alcance) — comparación contra vos mismo,
  // nunca contra un umbral absoluto inventado.
  private static scoreEngagement(report: ExecutiveIntelligenceReport): AuditCategoryScore {
    if (report.analyzed_posts_count === 0) {
      return { score: null, label: 'Engagement', detail: 'Todavía no hay Reels analizados.' };
    }
    const pct = Math.round((report.top_performers.length / report.analyzed_posts_count) * 100);
    return {
      score: pct,
      label: 'Engagement',
      detail: `${report.top_performers.length} de ${report.analyzed_posts_count} Reels superaron la mediana de interacción de tu propia cuenta.`,
    };
  }

  // ---- Categoría: Crecimiento ----
  // Compara el alcance promedio de tus Reels más recientes contra tus Reels
  // más antiguos (dentro del mismo historial ya descargado). Es una
  // tendencia intra-cuenta real, no requiere una foto histórica guardada.
  private static scoreCrecimiento(posts: IntelligencePost[]): AuditCategoryScore {
    const withReach = posts
      .map(p => ({
        time: new Date(p.published_at).getTime(),
        reach: toOptional(p.metrics?.reach) ?? toOptional(p.metrics?.views),
      }))
      .filter((p): p is { time: number; reach: number } => !isNaN(p.time) && p.reach !== undefined)
      .sort((a, b) => a.time - b.time);

    if (withReach.length < 4) {
      return { score: null, label: 'Crecimiento', detail: 'Necesitás al menos 4 Reels con alcance reportado para medir la tendencia.' };
    }

    const mid = Math.floor(withReach.length / 2);
    const older = withReach.slice(0, mid);
    const recent = withReach.slice(mid);
    const olderAvg = older.reduce((s, p) => s + p.reach, 0) / older.length;
    const recentAvg = recent.reduce((s, p) => s + p.reach, 0) / recent.length;

    if (olderAvg <= 0) {
      return { score: null, label: 'Crecimiento', detail: 'No hay suficiente alcance histórico para comparar.' };
    }

    const pctChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    const score = Math.round(Math.max(0, Math.min(100, 50 + pctChange)));

    return {
      score,
      label: 'Crecimiento',
      detail: `El alcance promedio de tus Reels más recientes ${pctChange >= 0 ? 'subió' : 'bajó'} ${Math.abs(Math.round(pctChange))}% respecto a tus publicaciones anteriores.`,
    };
  }

  // ---- Categoría: Consistencia ----
  // Regularidad real del calendario de publicación (coeficiente de
  // variación de los días entre posts) — premia postear con ritmo estable,
  // no un número fijo de veces por semana que no aplica a todos los rubros.
  private static scoreConsistencia(posts: IntelligencePost[]): AuditCategoryScore {
    const dated = posts
      .map(p => new Date(p.published_at).getTime())
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b);

    if (dated.length < 3) {
      return { score: null, label: 'Consistencia', detail: 'Necesitás al menos 3 publicaciones con fecha para medir tu regularidad de posteo.' };
    }

    const gapsDays: number[] = [];
    for (let i = 1; i < dated.length; i++) {
      gapsDays.push((dated[i] - dated[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const meanGap = gapsDays.reduce((s, g) => s + g, 0) / gapsDays.length;
    const variance = gapsDays.reduce((s, g) => s + Math.pow(g - meanGap, 2), 0) / gapsDays.length;
    const coeffVariation = meanGap > 0 ? Math.sqrt(variance) / meanGap : 0;

    const score = Math.round(Math.max(0, Math.min(100, 100 - (coeffVariation / 1.5) * 100)));
    const regularity = coeffVariation < 0.4 ? 'buena' : coeffVariation < 0.8 ? 'variable' : 'muy irregular';

    return {
      score,
      label: 'Consistencia',
      detail: `Publicás en promedio cada ${Math.round(meanGap)} días, con regularidad ${regularity}.`,
    };
  }

  // ---- Categoría: Oportunidades ----
  // Eficiencia real del presupuesto pago (Meta Ads). Sin cuenta publicitaria
  // conectada no hay forma honesta de medir esto, así que queda en null en
  // vez de estimarlo con datos orgánicos que no lo representan.
  private static scoreOportunidades(adsReport: AdsIntelligenceReport | null): AuditCategoryScore {
    if (!adsReport || adsReport.campaigns.length === 0) {
      return { score: null, label: 'Oportunidades', detail: 'Conectá tu cuenta de Meta Ads para medir la eficiencia de tu presupuesto pago.' };
    }
    return {
      score: adsReport.budget_efficiency_score,
      label: 'Oportunidades',
      detail: `$${adsReport.wasted_budget_amount.toFixed(2)} en riesgo de desperdicio sobre $${adsReport.total_spend.toFixed(2)} invertidos en Ads.`,
    };
  }

  private static blendOverall(categories: UnifiedBusinessAudit['categories']): number | null {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const key of Object.keys(CATEGORY_WEIGHTS) as Array<keyof typeof CATEGORY_WEIGHTS>) {
      const cat = categories[key];
      if (cat.score === null) continue;
      weightedSum += cat.score * CATEGORY_WEIGHTS[key];
      totalWeight += CATEGORY_WEIGHTS[key];
    }
    if (totalWeight === 0) return null;
    return Math.round(weightedSum / totalWeight);
  }

  private static buildPriorityFinding(
    categories: UnifiedBusinessAudit['categories'],
    adsReport: AdsIntelligenceReport | null,
    opportunities: CommercialOpportunity[]
  ): string {
    if (adsReport && adsReport.bleeding_campaigns.length > 0) {
      const c = adsReport.bleeding_campaigns[0];
      return `Estás desperdiciando presupuesto en "${c.name}": $${c.spend.toFixed(2)} gastados con un costo por conversión de $${c.cpa.toFixed(2)}.`;
    }
    const highSeverity = opportunities.find(o => o.severity === 'high');
    if (highSeverity) return highSeverity.description;

    if (categories.crecimiento.score !== null && categories.crecimiento.score < 40) {
      return `Tu alcance viene en baja. ${categories.crecimiento.detail}`;
    }
    if (categories.contenido.score !== null) {
      return `Tu contenido promedia ${categories.contenido.score}/100. ${categories.contenido.detail}`;
    }
    return 'Todavía no hay suficiente dato real (Reels, anuncios o mensajes) para identificar un hallazgo prioritario. Conectá tus canales reales para empezar.';
  }

  private static buildWhatsWorking(
    organicReport: ExecutiveIntelligenceReport,
    adsReport: AdsIntelligenceReport | null
  ): string[] {
    const items = organicReport.what_to_repeat.map(r => r.action);
    if (adsReport) {
      for (const c of adsReport.winning_campaigns) {
        items.push(`Campaña "${c.name}" rinde con ${c.roas ? `ROAS ${c.roas}x y ` : ''}CPA de $${c.cpa.toFixed(2)}.`);
      }
    }
    return items.slice(0, 6);
  }

  private static buildWhatsToImprove(
    organicReport: ExecutiveIntelligenceReport,
    adsReport: AdsIntelligenceReport | null,
    opportunities: CommercialOpportunity[]
  ): string[] {
    const items = organicReport.what_to_stop.map(s => s.action);
    if (adsReport) {
      for (const c of adsReport.bleeding_campaigns) {
        items.push(`Pausar o rehacer "${c.name}": costo por conversión de $${c.cpa.toFixed(2)}.`);
      }
    }
    for (const o of opportunities.filter(o => o.severity === 'high').slice(0, 2)) {
      items.push(o.description);
    }
    return items.slice(0, 6);
  }

  private static buildActionPlan(
    organicReport: ExecutiveIntelligenceReport,
    adsReport: AdsIntelligenceReport | null,
    opportunities: CommercialOpportunity[],
    funnelMetrics: CRMFunnelMetrics | null
  ): UnifiedBusinessAudit['action_plan'] {
    const plan: UnifiedBusinessAudit['action_plan'] = [];

    if (adsReport) {
      for (const a of adsReport.strategic_actions) {
        plan.push({ title: a.title, description: a.description, priority: a.priority });
      }
    }

    for (const exp of organicReport.next_experiments.slice(0, 2)) {
      plan.push({
        title: `Probar: ${exp.hypothesis.slice(0, 60)}`,
        description: `Gancho sugerido: "${exp.suggested_hook}". Objetivo: ${exp.target_metric}.`,
        priority: 'MEDIA',
      });
    }

    // El puente clave entre CRM y estrategia de contenido: qué Reel generó
    // más leads reales atribuidos, para orientar el próximo contenido.
    const contentOpp = opportunities.find(o => o.type === 'content_converting');
    if (contentOpp) {
      plan.push({ title: contentOpp.title, description: contentOpp.description, priority: 'ALTA' });
    }

    if (funnelMetrics?.avg_response_time_minutes !== null && funnelMetrics && funnelMetrics.avg_response_time_minutes > 60) {
      plan.push({
        title: 'Bajar el tiempo de respuesta a tus clientes',
        description: `Hoy tardás en promedio ${Math.round(funnelMetrics.avg_response_time_minutes)} minutos en responder. Una automatización por palabra clave puede bajar ese tiempo a segundos.`,
        priority: 'ALTA',
      });
    }

    return plan.slice(0, 6);
  }

  // ---- Auditoría de Bio ----
  // Rubro de puntos transparente sobre la biografía REAL traída por Graph
  // API (nunca un texto ni un score fijo por negocio, como antes).
  private static buildBioAudit(profile: MetaProfileInsights | null): BioAudit {
    if (!profile || !profile.biography) {
      return {
        current_bio: '',
        bio_score: 0,
        strengths: [],
        weaknesses: ['Todavía no se pudo leer la biografía real de tu Instagram. Conectá tu cuenta en "Conectar APIs" para auditarla.'],
        recommendations: [],
      };
    }

    const bio = profile.biography;
    const lower = bio.toLowerCase();
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    let score = 40; // base: tiene biografía cargada

    if (bio.length >= 60) {
      score += 15;
      strengths.push('La biografía tiene una longitud adecuada para comunicar tu propuesta de valor.');
    } else {
      weaknesses.push('La biografía es muy corta: falta espacio para contar qué hacés y a quién ayudás.');
    }

    if (/(whatsapp|escrib|contact|dm|mensaje|consulta)/i.test(lower)) {
      score += 20;
      strengths.push('Incluye un llamado a la acción de contacto (WhatsApp/DM/consulta).');
    } else {
      weaknesses.push('No se detectó un llamado a la acción claro para que te escriban.');
      recommendations.push('Agregá un CTA directo, ej: "Escribinos por WhatsApp para cotizar".');
    }

    if (profile.website) {
      score += 15;
      strengths.push('Tiene un link en la biografía.');
    } else {
      weaknesses.push('No hay ningún link en la biografía (catálogo, WhatsApp o linktree).');
      recommendations.push('Sumá un link directo a tu catálogo o WhatsApp Business.');
    }

    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(bio)) {
      score += 10;
      strengths.push('Usa emojis para organizar visualmente la información.');
    } else {
      recommendations.push('Los emojis ayudan a separar visualmente cada línea de la bio.');
    }

    return {
      current_bio: bio,
      bio_score: Math.min(100, score),
      strengths,
      weaknesses,
      recommendations,
    };
  }
}
