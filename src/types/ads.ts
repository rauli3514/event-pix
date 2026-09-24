// ================================================================
// ads.ts
// Tipos de datos para Meta Ads Intelligence
// EventPix Intelligence — SaaS Platform
// ================================================================

export interface MetaAdCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: 'LEADS' | 'SALES' | 'TRAFFIC' | 'ENGAGEMENT';
  daily_budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // Click-through-rate %
  cpc: number; // Cost-per-click en USD o moneda local
  cpm: number; // Cost-per-1000 impressions
  conversions: number; // Consultas de WhatsApp, leads o ventas
  cpa: number; // Cost-per-acquisition
  roas?: number; // Return on ad spend
  status_verdict: 'ganadora' | 'desperdiciando_presupuesto' | 'fatiga' | 'optima' | 'en_aprendizaje';
  trend_vs_last_week: 'mejorando' | 'estable' | 'deteriorandose';
  organic_counterpart_id?: string;
  organic_counterpart_title?: string;
  recommendation: string;
}

export interface CrossChannelOpportunity {
  reel_id: string;
  reel_title: string;
  organic_score: number;
  why_it_works: string;
  suggested_ad_campaign: string;
  estimated_cpa_reduction_pct: number;
  action_label: string;
}

export interface AdsIntelligenceReport {
  generated_at: string;
  ad_account_name: string;
  ad_account_id: string;
  currency: string;
  total_spend: number;
  total_conversions: number;
  avg_cpc: number;
  avg_cpm: number;
  avg_cpa: number;
  avg_roas: number;
  budget_efficiency_score: number; // 0 - 100
  wasted_budget_amount: number; // Gasto en anuncios con CPA alto o cero conversión
  campaigns: MetaAdCampaign[];
  winning_campaigns: MetaAdCampaign[];
  bleeding_campaigns: MetaAdCampaign[];
  fatigued_campaigns: MetaAdCampaign[];
  cross_channel_opportunities: CrossChannelOpportunity[];
  strategic_actions: Array<{
    title: string;
    description: string;
    priority: 'URGENTE' | 'ALTA' | 'MEDIA';
    estimated_savings_or_gain: string;
  }>;
}
