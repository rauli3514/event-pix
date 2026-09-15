import { IntelligencePost, BrandDNA, BusinessAuditReport } from '../../types/intelligence';
import { ContentIntelligenceEngine } from './ContentIntelligenceEngine';
import { DynamicSynthesisEngine } from './DynamicSynthesisEngine';

export interface ReelSynthesisRequest {
  business_id: string;
  source_posts: IntelligencePost[];
  brand_dna: BrandDNA;
  target_objective?: string;
}

export interface ReelSynthesisIdea {
  title: string;
  hook: string;
  angle: string;
  spoken_dialogue: string;
  cta: string;
}

export interface ReelSynthesisResult {
  title: string;
  hook: string;
  structure_breakdown: string[];
  cta: string;
  full_script: string;
  teleprompter_clean_script: string;
  alternative_hooks: Array<{ type: string; text: string }>;
  new_reel_ideas?: ReelSynthesisIdea[];
  why_it_works: string;
  expected_impact: string;
}

export class ReelAnalyzerService {
  static async synthesizeReels(request: ReelSynthesisRequest): Promise<ReelSynthesisResult> {
    return DynamicSynthesisEngine.synthesize(request.source_posts, request.brand_dna);
  }

  static calculateAuditReport(
    posts: IntelligencePost[],
    brandDna: BrandDNA,
    handle = '@display_digital'
  ): BusinessAuditReport {
    const report = ContentIntelligenceEngine.generateExecutiveReport(posts, brandDna, handle);

    const bioAudit = {
      current_bio: `Display Digital & Cartelería Inteligente para Comercios\n🚀 Modernizá la atención en tu local con pantallas dinámicas\n📲 Proyectos a medida en todo el país\n⬇️ Cotizá tu pantalla aquí`,
      bio_score: 88,
      strengths: [
        'Propuesta de valor clara orientada a comercios y locales comerciales.',
        'Mención de cobertura nacional y contacto directo de cotización.'
      ],
      weaknesses: [
        'Se recomienda incorporar un enlace directo hacia WhatsApp o catálogo de pantallas en la biografía.'
      ],
      recommendations: [
        'Agregar llamado directo: "Escribinos por WhatsApp para armar tu proyecto llave en mano".'
      ]
    };

    return {
      business_id: brandDna.business_id,
      health_score: report.global_health_score,
      instagram_handle: handle,
      bio_audit: bioAudit,
      executive_summary: report.account_status_summary,
      strengths: report.what_to_repeat.map(r => r.action),
      conversion_bottlenecks: report.what_to_stop.map(s => s.action),
      immediate_actions: report.next_experiments.map(exp => ({
        title: exp.hypothesis.slice(0, 65) + '...',
        description: `Probar gancho: "${exp.suggested_hook}" (Objetivo: ${exp.target_metric})`,
        priority: 'Alta' as const,
        effort: 'Bajo' as const
      })),
      updated_at: new Date().toISOString()
    };
  }
}

