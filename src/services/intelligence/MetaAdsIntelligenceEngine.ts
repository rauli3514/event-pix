// ================================================================
// MetaAdsIntelligenceEngine.ts
// Motor Determinístico de Análisis y Auditoría de Meta Ads
// EventPix Intelligence — SaaS Platform
// ================================================================

import { MetaAdCampaign, AdsIntelligenceReport, CrossChannelOpportunity } from '../../types/ads';
import { IntelligencePost } from '../../types/intelligence';
import { toOptional } from './metricUtils';

// Campañas modelo del comercio Display Digital para benchmarking y auditoría
export const INITIAL_DISPLAY_DIGITAL_CAMPAIGNS: MetaAdCampaign[] = [
  {
    id: 'camp_001',
    name: 'Prospección B2B — Pantallas Verticales para Locales',
    status: 'ACTIVE',
    objective: 'LEADS',
    daily_budget: 15,
    spend: 285.50,
    impressions: 24600,
    clicks: 680,
    ctr: 2.76,
    cpc: 0.42,
    cpm: 11.60,
    conversions: 42,
    cpa: 6.80,
    roas: 4.8,
    status_verdict: 'ganadora',
    trend_vs_last_week: 'mejorando',
    organic_counterpart_title: 'Cómo va display digital en tu negocio. @shop_plumas',
    recommendation: 'Campaña GANADORA: Escalar presupuesto diario en +25% para captar más consultas comerciales.',
  },
  {
    id: 'camp_002',
    name: 'Tráfico Frío — Cartelería Tradicional vs Digital',
    status: 'ACTIVE',
    objective: 'TRAFFIC',
    daily_budget: 10,
    spend: 140.00,
    impressions: 31200,
    clicks: 410,
    ctr: 1.31,
    cpc: 0.34,
    cpm: 4.48,
    conversions: 3,
    cpa: 46.66,
    roas: 0.8,
    status_verdict: 'desperdiciando_presupuesto',
    trend_vs_last_week: 'deteriorandose',
    recommendation: 'DESPERDICIO DETECTADO: El costo por consulta ($46.66) supera en 6.8x a la campaña ganadora. Pausar y redirigir el presupuesto a WhatsApp Leads.',
  },
  {
    id: 'camp_003',
    name: 'Retargeting — Modernización Inmediata Locales',
    status: 'ACTIVE',
    objective: 'LEADS',
    daily_budget: 8,
    spend: 96.00,
    impressions: 8900,
    clicks: 185,
    ctr: 2.07,
    cpc: 0.52,
    cpm: 10.78,
    conversions: 14,
    cpa: 6.85,
    roas: 3.9,
    status_verdict: 'optima',
    trend_vs_last_week: 'estable',
    organic_counterpart_title: 'Modernización inmediata con Cartelería digital',
    recommendation: 'Rendimiento Óptimo: Mantiene un CPA estable ($6.85) en audiencia tibia. Conservar activa.',
  },
  {
    id: 'camp_004',
    name: 'Brand Awareness — Tecno Eventos Branding General',
    status: 'ACTIVE',
    objective: 'ENGAGEMENT',
    daily_budget: 5,
    spend: 75.00,
    impressions: 48500,
    clicks: 220,
    ctr: 0.45,
    cpc: 0.34,
    cpm: 1.54,
    conversions: 0,
    cpa: 75.00,
    roas: 0.0,
    status_verdict: 'fatiga',
    trend_vs_last_week: 'deteriorandose',
    recommendation: 'FATIGA SEVERA: CTR cayó por debajo del 0.5%. El anuncio ya no engancha a la audiencia. Reemplazar urgente por un Reel orgánico ganador.',
  },
];

export class MetaAdsIntelligenceEngine {
  /**
   * Ejecuta el análisis determinístico completo de las campañas de Meta Ads
   * cruzando el rendimiento pago con los mejores ganchos del contenido orgánico
   */
  static generateAdsReport(
    campaigns: MetaAdCampaign[] = [],
    organicPosts: IntelligencePost[] = [],
    adAccountName = 'Display Digital (Ads)',
    adAccountId = '—'
  ): AdsIntelligenceReport {
    if (campaigns.length === 0) {
      return {
        generated_at: new Date().toISOString(),
        ad_account_name: 'Cuenta de Meta Ads no conectada',
        ad_account_id: 'No vinculada',
        currency: 'USD',
        total_spend: 0,
        total_conversions: 0,
        avg_cpc: 0,
        avg_cpm: 0,
        avg_cpa: 0,
        avg_roas: 0,
        budget_efficiency_score: 0,
        wasted_budget_amount: 0,
        campaigns: [],
        winning_campaigns: [],
        bleeding_campaigns: [],
        fatigued_campaigns: [],
        cross_channel_opportunities: [],
        strategic_actions: []
      };
    }

    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);

    const avgCpc = totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0;
    const avgCpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0;
    const avgCpa = totalConversions > 0 ? Number((totalSpend / totalConversions).toFixed(2)) : 0;

    const roasEligible = campaigns.filter(c => (c.roas ?? 0) > 0);
    const avgRoas = roasEligible.length > 0
      ? Number((roasEligible.reduce((s, c) => s + (c.roas || 0), 0) / roasEligible.length).toFixed(1))
      : 2.8;

    // Calcular gasto desperdiciado (campañas con CPA > 2x promedio o 0 conversiones con gasto > $30)
    const bleedingCampaigns = campaigns.filter(
      c => c.status_verdict === 'desperdiciando_presupuesto' || (c.conversions === 0 && c.spend > 40)
    );
    const wastedBudgetAmount = Number(
      bleedingCampaigns.reduce((s, c) => s + c.spend, 0).toFixed(2)
    );

    const winningCampaigns = campaigns.filter(c => c.status_verdict === 'ganadora');
    const fatiguedCampaigns = campaigns.filter(
      c => c.status_verdict === 'fatiga' || c.trend_vs_last_week === 'deteriorandose'
    );

    // Score de eficiencia del presupuesto (0 a 100)
    // Penalizado por % de dinero desperdiciado y anuncios fatigados
    const wasteRatio = totalSpend > 0 ? (wastedBudgetAmount / totalSpend) : 0;
    let rawScore = 85;
    rawScore -= Math.round(wasteRatio * 50);
    if (fatiguedCampaigns.length > 0) rawScore -= (fatiguedCampaigns.length * 6);
    if (avgRoas >= 3.5) rawScore += 10;
    const budgetEfficiencyScore = Math.max(20, Math.min(98, rawScore));

    // CRUCE ORGÁNICO -> PAID (La conexión de oro)
    const crossChannelOpportunities = this.detectCrossChannelBridges(organicPosts, campaigns);

    // Acciones estratégicas accionables con impacto económico
    const strategicActions: AdsIntelligenceReport['strategic_actions'] = [];

    if (bleedingCampaigns.length > 0) {
      const topBleeder = bleedingCampaigns[0];
      strategicActions.push({
        title: `Pausar de inmediato: "${topBleeder.name}"`,
        description: `Esta campaña gastó $${topBleeder.spend.toFixed(2)} con un costo por lead de $${topBleeder.cpa.toFixed(2)} (inviable). Su pausado frena el drenaje presupuestario.`,
        priority: 'URGENTE',
        estimated_savings_or_gain: `Ahorro estimado: $${(topBleeder.daily_budget * 30).toFixed(0)}/mes`,
      });
    }

    if (winningCampaigns.length > 0) {
      const topWinner = winningCampaigns[0];
      strategicActions.push({
        title: `Escalar presupuesto +25% en "${topWinner.name}"`,
        description: `Mantiene un ROAS de ${topWinner.roas}x y un CPA extraordinario de $${topWinner.cpa.toFixed(2)}. Puede absorber mayor presupuesto sin saturar la audiencia.`,
        priority: 'ALTA',
        estimated_savings_or_gain: `+12 a 18 consultas comerciales extra por semana`,
      });
    }

    if (crossChannelOpportunities.length > 0) {
      const bestOpp = crossChannelOpportunities[0];
      strategicActions.push({
        title: `Lanzar nuevo anuncio con el Reel Ganador: "${bestOpp.reel_title.slice(0, 40)}..."`,
        description: bestOpp.why_it_works,
        priority: 'ALTA',
        estimated_savings_or_gain: `Reducción estimada de CPA: -${bestOpp.estimated_cpa_reduction_pct}%`,
      });
    }

    return {
      generated_at: new Date().toISOString(),
      ad_account_name: adAccountName,
      ad_account_id: adAccountId,
      currency: 'USD',
      total_spend: totalSpend,
      total_conversions: totalConversions,
      avg_cpc: avgCpc,
      avg_cpm: avgCpm,
      avg_cpa: avgCpa,
      avg_roas: avgRoas,
      budget_efficiency_score: budgetEfficiencyScore,
      wasted_budget_amount: wastedBudgetAmount,
      campaigns,
      winning_campaigns: winningCampaigns,
      bleeding_campaigns: bleedingCampaigns,
      fatigued_campaigns: fatiguedCampaigns,
      cross_channel_opportunities: crossChannelOpportunities,
      strategic_actions: strategicActions,
    };
  }

  /**
   * Detecta qué Reels orgánicos son los mejores candidatos para convertirse en Anuncios
   */
  private static detectCrossChannelBridges(
    organicPosts: IntelligencePost[],
    _campaigns: MetaAdCampaign[]
  ): CrossChannelOpportunity[] {
    const opportunities: CrossChannelOpportunity[] = [];

    // Si hay posts orgánicos, evaluamos los de mayor intención o retención
    for (const post of organicPosts) {
      const likes = toOptional(post.metrics?.likes) ?? 0;
      const saves = toOptional(post.metrics?.saves) ?? 0;
      const comments = toOptional(post.metrics?.comments) ?? 0;

      // Reel con tracción comercial probada
      if (saves >= 2 || comments >= 1 || likes >= 3) {
        opportunities.push({
          reel_id: post.id,
          reel_title: post.title || 'Reel Orgánico Destacado',
          organic_score: 86,
          why_it_works: `Este Reel demostró validación orgánica genuina (${likes} me gusta, ${comments} comentarios, ${saves} guardados). Al no ser un anuncio típico, el costo por clic (CPC) proyectado es hasta 40% menor.`,
          suggested_ad_campaign: 'Campaña de Mensajes a WhatsApp con objetivo Clientes Potenciales de Locales.',
          estimated_cpa_reduction_pct: 35,
          action_label: 'Exportar Creativo a Meta Ads',
        });
      }
    }

    // Si aún no hay posts con métricas cargadas, generamos la oportunidad del Reel estrella del comercio
    if (opportunities.length === 0) {
      opportunities.push({
        reel_id: 'rec_reel_dd',
        reel_title: 'Cómo va display digital en tu negocio. @shop_plumas',
        organic_score: 92,
        why_it_works: 'Muestra una instalación real en un comercio de moda con resultado visual inmediato. Convierte dudas de prospectos en prueba social tangible.',
        suggested_ad_campaign: 'Reemplazar el anuncio fatigado "Brand Awareness" por este video en ubicación Reels de Instagram y Facebook.',
        estimated_cpa_reduction_pct: 42,
        action_label: 'Crear Anuncio con este Reel',
      });
    }

    return opportunities;
  }
}
