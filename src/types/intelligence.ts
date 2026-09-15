export interface IntelligenceBusiness {
  id: string;
  user_id: string;
  name: string;
  niche: string;
  target_audience?: string;
  brand_tone: string;
  instagram_handle?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConnector {
  id: string;
  provider: 'meta_business' | 'chatgpt' | 'claude' | 'canva' | 'webhook_automation' | 'display_digital';
  name: string;
  status: 'connected' | 'disconnected' | 'pending';
  account_name?: string;
  settings?: Record<string, any>;
}

export interface BioAudit {
  current_bio: string;
  bio_score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface BrandDNA {
  id?: string;
  business_id: string;
  identity: {
    mission: string;
    unique_value_proposition: string;
    target_avatar: string;
  };
  voice_and_tone: {
    primary_tone: 'directo' | 'educativo' | 'humoristico' | 'inspiracional' | 'provocador';
    secondary_tone?: string;
    favorite_catchphrases: string[];
    forbidden_words: string[];
    pacing: 'rapido' | 'moderado' | 'pausado';
  };
  offers: {
    main_products: string[];
    call_to_actions: string[];
    whatsapp_link?: string;
    landing_url?: string;
  };
  samples: Array<{
    title: string;
    transcript: string;
    is_high_performing: boolean;
  }>;
}

export interface IntelligencePost {
  id: string;
  business_id: string;
  title: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds: number;
  objective: 'engagement' | 'sales' | 'brand_awareness' | 'community';
  published_at: string;
  created_at: string;
  audio_track?: string;
  raw_transcript?: string;
  metrics?: IntelligenceMetrics;
  analysis?: IntelligenceAnalysis;
}

/**
 * Valor de una métrica que la API de Meta puede no reportar.
 * NUNCA se sustituye por 0 ni por una estimación: la ausencia de dato es un dato.
 */
export const NO_DATA = 'no_disponible' as const;
export type NoData = typeof NO_DATA;
export type MetricValue = number | NoData;

export interface IntelligenceMetrics {
  id?: string;
  post_id: string;
  views: MetricValue;
  reach: MetricValue;
  likes: MetricValue;
  comments: MetricValue;
  shares: MetricValue;
  saves: MetricValue;
  followers_gained: MetricValue;
  average_watch_time_seconds: MetricValue;
  total_watch_time_seconds: MetricValue;
  profile_visits: MetricValue;
  like_rate?: MetricValue;
  comment_rate?: MetricValue;
  share_rate?: MetricValue;
  save_rate?: MetricValue;
  retention_percentage?: MetricValue;
  /** Origen de los datos, para que la UI y los prompts puedan declararlo. */
  source?: 'meta_graph_api' | 'instagram_scrape' | 'manual';
  synced_at?: string;
}

export interface HookData {
  text: string;
  type: 'preguntas_negativas' | 'afirmacion_chocante' | 'error_comun' | 'secreto_revelado' | 'curiosidad';
  curiosity_score: number;
  clarity_score: number;
  auditory_strength: 'alta' | 'media' | 'baja';
  has_text_on_screen: boolean;
}

export interface TimeSegment {
  range: string;
  content: string;
  narrative_role: 'hook' | 'problem' | 'value' | 'cta' | 'proof';
  visual_cue?: string;
}

export interface IntelligenceAnalysis {
  id?: string;
  post_id: string;
  hook_data: HookData;
  promise: string;
  topic: string;
  audience: string;
  structure: string[];
  language_data: {
    tone: string;
    proximity: 'cercano' | 'formal' | 'desenfadado';
    technicality: 'baja' | 'media' | 'alta';
    second_person_usage: boolean;
  };
  emotions: string[];
  visual_analysis: {
    scene_change_frequency_sec?: number;
    has_captions: boolean;
    main_visual_element?: string;
  };
  cta_data: {
    detected: boolean;
    text?: string;
    type?: 'comment_keyword' | 'link_in_bio' | 'share' | 'save';
    strength: 'fuerte' | 'moderado' | 'debil';
  };
  time_segments: TimeSegment[];
  scripty_data?: {
    hook_formula: string;
    hook_score: number;
    retain_structure: string;
    retain_score: number;
    cta_formula: string;
    cta_score: number;
    alternative_hooks: string[];
    alternative_ctas: string[];
    audio_track?: string;
    has_speech?: boolean;
  };
  diagnosis: {
    what_worked: string[];
    what_failed: string[];
    hypotheses: string[];
    what_to_change: string[];
    what_to_repeat: string[];
    next_test: string;
  };
}

export interface BusinessAuditReport {
  id?: string;
  business_id: string;
  health_score: number;
  instagram_handle: string;
  bio_audit: BioAudit;
  executive_summary: string;
  strengths: string[];
  conversion_bottlenecks: string[];
  immediate_actions: Array<{
    title: string;
    description: string;
    priority: 'Alta' | 'Media' | 'Baja';
    effort: 'Bajo' | 'Medio' | 'Alto';
  }>;
  updated_at: string;
}

export type NodeType = 'reel' | 'synthesis' | 'meta_business' | 'chatgpt' | 'claude' | 'canva' | 'automation_action' | 'display_digital' | 'ai_chat';

export interface CanvasNodeData {
  label?: string;
  post?: IntelligencePost;
  type?: NodeType;
  integration?: IntegrationConnector;
  automation?: {
    trigger_keyword?: string;
    response_message?: string;
  };
  synthesisResult?: {
    hook: string;
    structure: string;
    cta: string;
    full_script: string;
    canva_template_url?: string;
    display_campaign_name?: string;
  };
}

// ================================================================
// SISTEMA DE INTELIGENCIA DE CONTENIDO Y APRENDIZAJE CONTINUO
// Benchmark Mediano, Content DNA, Hipótesis, Experimentos y Memoria
// ================================================================

export interface AccountMedianBenchmark {
  business_id: string;
  account_handle?: string;
  /** Cantidad de reels considerados en el cálculo. */
  sample_size: number;
  median_views: MetricValue;
  median_reach: MetricValue;
  median_likes: MetricValue;
  median_comments: MetricValue;
  median_shares: MetricValue;
  median_saves: MetricValue;
  median_engagement_rate: MetricValue;
  median_retention_seconds: MetricValue;
  /**
   * Cuántos reels de la muestra reportaron efectivamente cada métrica.
   * Una mediana calculada sobre 2 de 30 reels no vale lo mismo que sobre 30 de 30.
   */
  metric_sample_sizes: {
    views: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagement_rate: number;
    retention_seconds: number;
  };
  calculated_at: string;
}

export interface PerformanceRatio {
  views_ratio: MetricValue;
  reach_ratio: MetricValue;
  saves_ratio: MetricValue;
  shares_ratio: MetricValue;
  comments_ratio: MetricValue;
}

export interface ReelPerformanceClassification {
  reel_id: string;
  is_viral_reach_winner: boolean;
  is_commercial_winner: boolean;
  is_retention_winner: boolean;
  is_underperformer: boolean;
  is_solid_average: boolean;
  performance_index: PerformanceRatio;
  /**
   * 'sin_datos_suficientes' cuando Meta no reportó las métricas necesarias para clasificar.
   * No es lo mismo que 'underperformer'.
   */
  primary_category: 'viral_winner' | 'commercial_winner' | 'balanced_performer' | 'underperformer' | 'sin_datos_suficientes';
  /** Métricas que faltaron para poder clasificar con certeza. */
  missing_metrics: string[];
  evidence_explanation: string;
}

export interface ContentDnaItem {
  reel_id: string;
  caption_summary?: string;
  hook: string;
  hook_type: 'pregunta_problema' | 'afirmacion_chocante' | 'error_comun' | 'demostracion_directa' | 'curiosidad' | 'secreto_revelado' | 'antitesis';
  hook_strength: 'alta' | 'media' | 'baja';
  topic: string;
  subtopic: string;
  target_audience: string;
  pain_point: string;
  desire: string;
  promise: string;
  solution: string;
  product_or_service: string;
  cta: string;
  cta_type: 'comentario_clave' | 'dm' | 'link_en_bio' | 'whatsapp' | 'guardar' | 'ninguno';
  content_intent: 'captacion_fria' | 'nutricion_interes' | 'conversion_comercial';
  funnel_stage: 'top_of_funnel' | 'middle_of_funnel' | 'bottom_of_funnel';
  opening_seconds_description: string;
  emotional_trigger: 'alivio' | 'fomo' | 'validacion' | 'curiosidad_profesional' | 'ambicion';
  objection_handled?: string;
}

export interface EmpiricalPattern {
  pattern_id: string;
  name: string;
  category: 'hook' | 'dolor_audiencia' | 'estructura' | 'cta' | 'formato_visual';
  sample_size: number;
  win_rate_vs_median: number; // e.g. 0.8 = superó la mediana en 4 de 5 reels
  metric_impact: string; // e.g. "+85% guardados vs mediana"
  confidence: 'alta' | 'media' | 'baja';
  recommendation: 'repetir_ganador' | 'evitar_perdedor' | 'seguir_probando';
  supporting_evidence: string;
}

export interface Hypothesis {
  hypothesis_id: string;
  business_id: string;
  statement: string; // "Si atacamos el dolor de pérdida de clientes en los primeros 3 segundos..."
  evidence_basis: string; // "En 4 de 5 reels de este nicho..."
  sample_reels_count: number;
  confidence: 'alta' | 'media' | 'baja';
  metric_to_impact: 'views' | 'saves' | 'reach' | 'comments' | 'shares';
  target_benchmark_comparison: string; // "Superar mediana de 142 guardados"
  status: 'ACTIVE' | 'TESTING' | 'VALIDATED' | 'DISPROVED' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface ScriptVariant {
  variant_key: 'A' | 'B' | 'C';
  label: string; // "Variante A: Patrón Ganador Probado", "Variante B: Ángulo Alternativo", "Variante C: Apuesta Creativa"
  hook_0_3s: string;
  on_screen_text: string;
  script_body: string;
  cta_trigger: string;
  shooting_directions: string;
  b_roll_suggestions: string[];
  confidence_score: 'alta' | 'media' | 'baja';
  why_this_variant: string;
}

export interface ContentExperiment {
  experiment_id: string;
  hypothesis_id: string;
  business_id: string;
  title: string;
  variable_tested: string;
  constant_elements: string;
  chosen_variant: 'A' | 'B' | 'C';
  variants: {
    variantA: ScriptVariant;
    variantB: ScriptVariant;
    variantC: ScriptVariant;
  };
  status: 'DRAFT' | 'READY' | 'PUBLISHED' | 'COLLECTING_DATA' | 'ANALYZED' | 'LEARNED';
  published_reel_id?: string;
  published_reel_permalink?: string;
  published_at?: string;
  baseline_benchmark: Partial<AccountMedianBenchmark>;
  actual_results?: {
    views: MetricValue;
    reach: MetricValue;
    saves: MetricValue;
    shares: MetricValue;
    comments: MetricValue;
    retention_seconds?: MetricValue;
  };
  delta_vs_median?: {
    views_pct?: MetricValue;
    reach_pct?: MetricValue;
    saves_pct?: MetricValue;
    shares_pct?: MetricValue;
    comments_pct?: MetricValue;
  };
  /** Métricas que Meta no devolvió al evaluar; explican un veredicto inconcluyente. */
  missing_result_metrics?: string[];
  evaluation_verdict?: 'HIPOTESIS_VALIDADA' | 'HIPOTESIS_REFUTADA' | 'RESULTADO_INCONCLUYENTE' | 'SIN_DATOS_PARA_EVALUAR';
  learning_summary?: string;
  created_at: string;
  learned_at?: string;
}

export interface LearnedInsight {
  insight_id: string;
  business_id: string;
  experiment_id?: string;
  insight_text: string;
  evidence_count: number;
  impact_metric: string;
  recommendation_for_future_scripts: string;
  confidence: 'alta' | 'media' | 'baja';
  created_at: string;
}

