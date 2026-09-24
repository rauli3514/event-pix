import { BrandDNA } from './intelligence';

/** El tema ganador que dispara la generación del guion (Motor 1 -> Motor 2). */
export interface WinningTopicInput {
  source: 'competitor_reel' | 'own_reel' | 'brand_dna';
  caption?: string;
  engagement_rate?: number;
  reel_url?: string;
}

export interface SpokenReelScript {
  /** 3 alternativas de gancho verbal (0-3s) para testear. */
  hooks: string[];
  /** Qué debe hacer el presentador ante cámara en el gancho visual. */
  visual_hook: string;
  /** Problema/agitación (3-15s): conecta con el dolor real del cliente. */
  problem_agitation: string;
  /** Solución/demostración (15-45s), presentada de forma orgánica. */
  solution_demo: string;
  /** Llamado a la acción final (~5s), comando específico. */
  cta: string;
  /** Subtítulos/texto en pantalla a destacar. */
  on_screen_text: string[];
  /** Tomas de apoyo (b-roll) sugeridas para intercalar. */
  b_roll_suggestions: string[];
  estimated_seconds: number;
  word_count: number;
}

export interface GenerateSpokenScriptRequest {
  businessId: string;
  topic: WinningTopicInput;
  brandDna: BrandDNA;
}

export interface GenerateSpokenScriptResponse {
  success: true;
  script: SpokenReelScript;
  provider: 'claude' | 'openai';
}
