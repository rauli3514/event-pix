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

export class ReelAnalyzerService {
  static async synthesizeReels(request: ReelSynthesisRequest): Promise<ReelSynthesisResult> {
    const sourceTitles = request.source_posts.map(p => `"${p.title}"`).join(' + ');
    const primaryTone = request.brand_dna.voice_and_tone.primary_tone;
    const favoriteCatchphrase = request.brand_dna.voice_and_tone.favorite_catchphrases[0] || 'Escuchá esto:';
    const mainOffer = request.brand_dna.offers.main_products[0] || 'nuestra solución';

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

  static calculateAuditReport(posts: IntelligencePost[], brandDna: BrandDNA): BusinessAuditReport {
    const handle = '@beaacamposr';
    const defaultBioAudit = {
      current_bio: `Convierto expertas en dueñas que facturan con IG\nMi app: @scripty.app\n💛 +9K clientas en LATAM y USA 🙏\n🎓 Clase en vivo: 2 de junio\n⬇️ Empecemos aquí`,
      bio_score: 85,
      strengths: [
        'Autoridad masiva: Verificación y base de clientes en LATAM y USA.',
        'Maestría en CTAs de activación: El uso de "Comenta APP" genera interacción continua.'
      ],
      weaknesses: [
        'Fuga de conversión por fecha: La mención a la fecha "2 de junio" hace que la oferta principal parezca obsoleta.'
      ],
      recommendations: [
        'Reemplazar el CTA de fecha específica por uno "evergreen" (atemporal) como "Accede al Entrenamiento VIP".'
      ]
    };

    if (posts.length === 0) {
      return {
        business_id: brandDna.business_id,
        health_score: 75,
        instagram_handle: handle,
        bio_audit: defaultBioAudit,
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
      instagram_handle: handle,
      bio_audit: defaultBioAudit,
      executive_summary: `Auditamos ${posts.length} Reels de tu cuenta. Tu perfil demuestra una salud sólida de retención (${avgRetention.toFixed(1)}%), respaldada por un tono ${brandDna.voice_and_tone.primary_tone}.`,
      strengths: [
        `Tasa de retención promedio del ${avgRetention.toFixed(1)}% en los primeros 3 segundos.`,
        `Fuerza de marca alineada con la propuesta de valor: "${brandDna.identity.unique_value_proposition.substring(0, 60)}..."`
      ],
      conversion_bottlenecks: [
        'Mención a fecha específica en Bio ("2 de junio") que desactualiza el perfil.',
        'Oportunidad de conectar Meta Business Suite para auto-responder por DM cuando comenten "APP".'
      ],
      immediate_actions: [
        {
          title: 'Implementar CTA de comentario palabra clave ("Comenta APP")',
          description: 'Añadir la llamada "Comenta APP y te la envío ya!!!" en tus próximos 3 videos.',
          priority: 'Alta',
          effort: 'Bajo'
        },
        {
          title: 'Conectar Nodos de Meta Business Suite & Canva en el Canvas',
          description: 'Arrastrá los conectores para enviar guiones a Canva y activar auto-DM.',
          priority: 'Alta',
          effort: 'Medio'
        }
      ],
      updated_at: new Date().toISOString()
    };
  }
}
