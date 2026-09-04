import { IntelligencePost, BrandDNA, BusinessAuditReport } from '../../types/intelligence';

export interface ReelSynthesisRequest {
  business_id: string;
  source_posts: IntelligencePost[];
  brand_dna: BrandDNA;
  target_objective?: string;
}

export interface ReelSynthesisResult {
  title: string;
  hook: string;
  structure_breakdown: string[];
  cta: string;
  full_script: string;
  why_it_works: string;
  expected_impact: string;
}

/**
 * Servicio de IA para el análisis profundo de Reels y síntesis en Canvas
 */
export class ReelAnalyzerService {
  /**
   * Realiza la síntesis de 2 o más Reels conectados en el Canvas
   */
  static async synthesizeReels(request: ReelSynthesisRequest): Promise<ReelSynthesisResult> {
    // Simulación de respuesta IA (Claude 3.5 Sonnet / GPT-4o) utilizando el ADN de Marca
    const sourceTitles = request.source_posts.map(p => `"${p.title}"`).join(' + ');
    const primaryTone = request.brand_dna.voice_and_tone.primary_tone;
    const favoriteCatchphrase = request.brand_dna.voice_and_tone.favorite_catchphrases[0] || 'Escuchá esto:';
    const mainOffer = request.brand_dna.offers.main_products[0] || 'nuestra solución';

    // Construcción del guion híbrido perfecto
    const hook = `${favoriteCatchphrase} La razón por la que los comercios más exitosos están usando automatización con IA en sus Reels.`;
    
    const fullScript = `[HOOK (0-3s)]
(Corte rápido + Texto gigante en amarillo en pantalla)
"${hook}"

[PROBLEMA / CONFLICTO (3-12s)]
Si estás publicando videos estáticos o esperando que el algoritmo te regale alcance sin una estructura probada, estás perdiendo el 80% de tus prospectos. La mayoría comete el error de hablar solo de sus productos.

[VALOR & DEMOSTRACIÓN PRÁCTICA (12-32s)]
Acá está la clave: 
1. Enganchá con una pregunta chocante en los primeros 1.5 segundos.
2. Demostrá el resultado visualmente antes del segundo 10.
3. Usá subtítulos dinámicos en cada cambio de palabra.

[LLAMADO A LA ACCIÓN (32-45s)]
Si querés que la IA desglose tus Reels y te arme el plan exacto para ${mainOffer}, comentá la palabra "INTELLIGENCE" acá abajo y te mando el acceso inmediato.`;

    return {
      title: `Super Guion Fusionado: ${sourceTitles}`,
      hook,
      structure_breakdown: [
        '0-3s: Hook de Alta Curiosidad + Texto Flotante OCR',
        '3-12s: Exposición del Freno de Conversión del Mercado',
        '12-32s: Demostración Visual de los 3 Patrones Ganadores',
        '32-45s: CTA de Comentario por Palabra Clave ("INTELLIGENCE")'
      ],
      cta: 'Comentá "INTELLIGENCE" y te envío el despiece completo.',
      full_script: fullScript,
      why_it_works: `Combina la retención del gancho del primer Reel (${request.source_posts[0]?.metrics?.retention_percentage || 32}% de retención) con la demostración práctica del segundo Reel, adaptado al tono ${primaryTone} del negocio.`,
      expected_impact: 'Se estima un incremento de 2.2x en tasa de guardados y 3.1x en comentarios por palabra clave.'
    };
  }

  /**
   * Genera o actualiza el informe de auditoría de negocio a partir de las métricas acumuladas
   */
  static calculateAuditReport(posts: IntelligencePost[], brandDna: BrandDNA): BusinessAuditReport {
    if (posts.length === 0) {
      return {
        business_id: brandDna.business_id,
        health_score: 75,
        executive_summary: 'Sincronizá o analizá al menos 2 Reels para calcular el velocímetro de salud de tu comercio.',
        strengths: ['Negocio registrado correctamente.'],
        conversion_bottlenecks: ['Faltan datos de métricas para auditar.'],
        immediate_actions: [],
        updated_at: new Date().toISOString()
      };
    }

    const avgRetention = posts.reduce((acc, p) => acc + (p.metrics?.retention_percentage || 0), 0) / posts.length;
    const avgSaveRate = posts.reduce((acc, p) => acc + (p.metrics?.save_rate || 0), 0) / posts.length;

    let score = 70;
    if (avgRetention > 25) score += 10;
    if (avgSaveRate > 3) score += 10;

    return {
      business_id: brandDna.business_id,
      health_score: Math.min(Math.round(score), 98),
      executive_summary: `Auditamos ${posts.length} Reels de tu cuenta. Tu perfil demuestra una salud sólida de retención (${avgRetention.toFixed(1)}%), respaldada por un tono ${brandDna.voice_and_tone.primary_tone}.`,
      strengths: [
        `Tasa de retención promedio del ${avgRetention.toFixed(1)}% en los primeros 3 segundos.`,
        `Fuerza de marca alineada con la propuesta de valor: "${brandDna.identity.unique_value_proposition.substring(0, 60)}..."`
      ],
      conversion_bottlenecks: [
        'Caída de audiencia en la transición entre el conflicto y el valor.',
        'Oportunidad de reforzar el CTA con palabras clave en lugar de redirección a la bio.'
      ],
      immediate_actions: [
        {
          title: 'Implementar CTA de comentario palabra clave',
          description: 'Añadir la llamada "Comentá REEL" en tus próximos 3 videos.',
          priority: 'Alta',
          effort: 'Bajo'
        },
        {
          title: 'Conectar 2 Reels en el Canvas para generar tu próximo script',
          description: 'Arrastrá los nodos en el canvas y sintetizá un super guion optimizado.',
          priority: 'Alta',
          effort: 'Medio'
        }
      ],
      updated_at: new Date().toISOString()
    };
  }
}
