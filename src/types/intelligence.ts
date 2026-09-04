export interface IntelligenceBusiness {
  id: string;
  user_id: string;
  name: string;
  niche: string;
  target_audience?: string;
  brand_tone: string;
  created_at: string;
  updated_at: string;
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
    favorite_catchphrases: string[]; // Muletillas o frases habituales
    forbidden_words: string[];      // Lo que NUNCA diría la marca
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
  metrics?: IntelligenceMetrics;
  analysis?: IntelligenceAnalysis;
}

export interface IntelligenceMetrics {
  id?: string;
  post_id: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers_gained: number;
  average_watch_time_seconds: number;
  total_watch_time_seconds: number;
  profile_visits: number;
  like_rate?: number;
  comment_rate?: number;
  share_rate?: number;
  save_rate?: number;
  retention_percentage?: number;
}

export interface HookData {
  text: string;
  type: 'preguntas_negativas' | 'afirmacion_chocante' | 'error_comun' | 'secreto_revelado' | 'curiosidad';
  curiosity_score: number; // 0 - 100
  clarity_score: number;   // 0 - 100
  auditory_strength: 'alta' | 'media' | 'baja';
  has_text_on_screen: boolean;
}

export interface TimeSegment {
  range: string; // "0-3s", "3-15s", "15-45s", "45-60s"
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
  structure: string[]; // ["hook", "problem", "solution", "cta"]
  language_data: {
    tone: string;
    proximity: 'cercano' | 'formal' | 'desenfadado';
    technicality: 'baja' | 'media' | 'alta';
    second_person_usage: boolean;
  };
  emotions: string[]; // ["curiosidad", "urgencia", "deseo"]
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
  diagnosis: {
    what_worked: string[];
    what_failed: string[];
    hypotheses: string[];
    what_to_change: string[];
    what_to_repeat: string[];
    next_test: string;
  };
}

export interface IntelligencePattern {
  id?: string;
  business_id: string;
  title: string;
  pattern_type: 'hook' | 'structure' | 'duration' | 'language' | 'cta';
  description: string;
  impact_multiplier: number; // ej: 2.4 (2.4x más guardados)
  confidence_level: 'Alta' | 'Media' | 'Baja';
  sample_size: number;
  evidence_posts: string[];
}

export interface BusinessAuditReport {
  id?: string;
  business_id: string;
  health_score: number; // 0 - 100
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
