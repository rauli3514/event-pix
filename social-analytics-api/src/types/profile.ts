export type Platform = 'instagram' | 'tiktok';

export type PostType = 'reel' | 'video' | 'image' | 'carousel';

/** Una publicacion normalizada, sin importar de que plataforma/proveedor vino. */
export interface PostMetric {
  id: string;
  type: PostType;
  caption?: string;
  /** ISO 8601 */
  published_at: string;
  likes: number;
  comments: number;
  url?: string;
  thumbnail_url?: string;
}

/** Lo que devuelve un proveedor de datos (Meta/Apify/mock), ya normalizado. */
export interface RawProfileData {
  platform: Platform;
  username: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  /** Los ultimos N posts publicos disponibles, mas reciente primero. */
  posts: PostMetric[];
  fetched_at: string;
  /** Nombre del proveedor que efectivamente resolvio los datos (meta | apify | mock). */
  source: string;
}

/** Metricas calculadas por el Analytics Engine, formulas estilo Socialinsider. */
export interface AnalyticsSummary {
  total_followers: number;
  total_posts_periodo: number;
  period_days: number;
  posts_per_day: number;
  avg_interactions_per_post: number;
  /** Porcentaje (ej. 3.42 = 3.42%). */
  engagement_rate: number;
  top_posts: PostMetric[];
}

export interface ProfileReport {
  id: string;
  platform: Platform;
  username: string;
  provider: string;
  raw: RawProfileData;
  analytics: AnalyticsSummary;
  executive_summary: string;
  executive_summary_source: 'anthropic' | 'fallback_local';
  created_at: string;
}

export interface AnalyzeProfileRequest {
  username: string;
  platform: Platform;
  /** Ventana de dias para calcular las metricas del periodo. Default: 30. */
  period_days?: number;
}
