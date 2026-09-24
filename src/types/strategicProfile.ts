// ================================================================
// strategicProfile.ts
// Tipos de Perfil de Negocio, Contexto para la IA y Lista de CTAs
// EventPix Intelligence — SaaS Studio
// ================================================================

export interface ProfileIdentity {
  avatar_url?: string;
  instagram_handle: string;
  niche: string;
  language: string;
  about_content: string; // "De qué hablas en tu contenido y a quién ayudas"
}

export interface AiPermanentContext {
  tone: 'cercano' | 'directo' | 'empoderado' | 'educativo' | 'humoristico' | 'provocador';
  must_do_rules: string[]; // Reglas de estilo que la IA DEBE cumplir
  forbidden_rules: string[]; // Cosas que la IA NUNCA debe hacer
  favorite_catchphrases: string[]; // Frases de cabecera favoritas
}

export interface CtaItem {
  id: string;
  keyword: string; // Ej: "APP", "PANTALLA", "WHATSAPP"
  full_phrase: string; // Ej: "Comenta APP y te la envío ya mismo 👇✨"
  action_type: 'comment_keyword' | 'dm' | 'link_in_bio' | 'whatsapp';
  is_favorite: boolean;
}

export interface UserProfileContext {
  business_id: string;
  profile: ProfileIdentity;
  ai_context: AiPermanentContext;
  cta_list: CtaItem[];
  updated_at: string;
}
