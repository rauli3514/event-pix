import { IntelligenceBusiness, BrandDNA, IntelligencePost, BusinessAuditReport } from '../../types/intelligence';

export const INITIAL_BUSINESS: IntelligenceBusiness = {
  id: 'biz_001',
  user_id: 'user_default',
  name: 'EventPix & Marketing Pro',
  niche: 'Agencia de Marketing & Soluciones Audiovisuales para Eventos',
  target_audience: 'Dueños de locales, organizadores de eventos y creadores B2B en LATAM',
  brand_tone: 'directo',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const INITIAL_BRAND_DNA: BrandDNA = {
  business_id: 'biz_001',
  identity: {
    mission: 'Descubrir la ciencia detrás del contenido viral y transformarla en ventas constantes para negocios.',
    unique_value_proposition: 'No te decimos qué publicar; descubrimos qué funciona en tu rubro, por qué funciona y cómo repetirlo.',
    target_avatar: 'Emprendedor o Marketer B2B que busca escalar en Instagram Reels sin gastar horas adivinando guiones.'
  },
  voice_and_tone: {
    primary_tone: 'directo',
    secondary_tone: 'educativo',
    favorite_catchphrases: [
      'Escuchá esto antes de grabar tu próximo Reel...',
      'Acá está el truco que nadie te cuenta:',
      'No hagas esto si querés vender:'
    ],
    forbidden_words: [
      'Algoritmo mágico',
      'Hacerse rico de la noche a la mañana',
      'Truco fácil'
    ],
    pacing: 'rapido'
  },
  offers: {
    main_products: [
      'EventPix Display Hub (Plataforma TV)',
      'EventPix Intelligence SaaS',
      'Auditoría Estratégica de Reels'
    ],
    call_to_actions: [
      'Comentá "REEL" y te envío el despiece completo.',
      'Hacé clic en el link de la bio para probar EventPix Intelligence.',
      'Guardá este Reel para aplicarlo en tu próximo guion.'
    ],
    whatsapp_link: 'https://wa.me/5491100000000',
    landing_url: 'https://app.event-pix.com.ar'
  },
  samples: [
    {
      title: '3 cosas que hacen los negocios que venden más que vos',
      transcript: 'Si querés que tu perfil convierta, tenés que dejar de publicar fotos estáticas. Los negocios que más venden en Instagram usan 3 estructuras de Reels muy claras...',
      is_high_performing: true
    }
  ]
};

export const INITIAL_POSTS: IntelligencePost[] = [
  {
    id: 'post_001',
    business_id: 'biz_001',
    title: '3 cosas que hacen los negocios que venden más que vos',
    video_url: 'https://www.instagram.com/p/DXuu2tWAlmp/',
    thumbnail_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=400&auto=format&fit=crop',
    duration_seconds: 45,
    objective: 'engagement',
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
    metrics: {
      post_id: 'post_001',
      views: 14500,
      reach: 12200,
      likes: 890,
      comments: 142,
      shares: 310,
      saves: 520,
      followers_gained: 48,
      average_watch_time_seconds: 14.5,
      total_watch_time_seconds: 210250,
      profile_visits: 230,
      like_rate: 6.14,
      comment_rate: 0.98,
      share_rate: 2.14,
      save_rate: 3.58,
      retention_percentage: 32.2
    },
    analysis: {
      post_id: 'post_001',
      hook_data: {
        text: '3 cosas que hacen los negocios que venden más que vos',
        type: 'afirmacion_chocante',
        curiosity_score: 92,
        clarity_score: 88,
        auditory_strength: 'alta',
        has_text_on_screen: true
      },
      promise: 'Revelar los 3 patrones de Reels que diferencian a los comercios líderes.',
      topic: 'Estrategia de Reels B2B',
      audience: 'Emprendedores y marcas en Instagram',
      structure: ['hook', 'problem', 'value', 'cta'],
      language_data: {
        tone: 'Directo y de alta autoridad',
        proximity: 'cercano',
        technicality: 'media',
        second_person_usage: true
      },
      emotions: ['curiosidad', 'deseo_de_superacion'],
      visual_analysis: {
        scene_change_frequency_sec: 2.5,
        has_captions: true,
        main_visual_element: 'Cortes rápidos con texto dinámico amarillo y blanco'
      },
      cta_data: {
        detected: true,
        text: 'Comentá "REEL" para enviarte la plantilla',
        type: 'comment_keyword',
        strength: 'fuerte'
      },
      time_segments: [
        {
          range: '0-3s',
          content: '3 cosas que hacen los negocios que venden más que vos',
          narrative_role: 'hook',
          visual_cue: 'Primer plano + texto amarillo gigante en pantalla'
        },
        {
          range: '3-15s',
          content: 'La mayoría de cuentas cometen el error de hablar solo de sus características sin tocar el problema real...',
          narrative_role: 'problem',
          visual_cue: 'Cambio de plano B-roll de persona escribiendo'
        },
        {
          range: '15-35s',
          content: 'Primero: Usan el gancho de contradicción. Segundo: Demuestran prueba social en los primeros 10 segundos...',
          narrative_role: 'value',
          visual_cue: 'Esquema gráfico animado'
        },
        {
          range: '35-45s',
          content: 'Si querés la guía completa de despiece, comentá la palabra REEL acá abajo.',
          narrative_role: 'cta',
          visual_cue: 'Flecha hacia la zona de comentarios'
        }
      ],
      diagnosis: {
        what_worked: [
          'El gancho de comparación ("venden más que vos") generó una altísima tasa de retención inicial (85% a los 3s).',
          'El CTA de palabra clave en comentarios disparó la tasa de guardados y comentarios.'
        ],
        what_failed: [
          'Ligera caída de audiencia entre los segundos 20 y 25 por una explicación demasiado extensa.'
        ],
        hypotheses: [
          'Ganchos basados en comparación o pérdida ("lo que estás haciendo mal") tienen 2.4x más guardados en tu audiencia.'
        ],
        what_to_change: [
          'Acortar el segmento de valor de 20s a 12s para mantener el ritmo alto.'
        ],
        what_to_repeat: [
          'Mantener el texto flotante OCR en los primeros 1.5s.',
          'Usar el CTA de comentario por palabra clave ("REEL").'
        ],
        next_test: 'Probar un gancho de error común: "El error de $0 que te está costando el 50% de tus ventas en Instagram"'
      }
    }
  },
  {
    id: 'post_002',
    business_id: 'biz_001',
    title: 'Cómo automatizar tu análisis de contenido con IA',
    video_url: 'https://www.youtube.com/watch?v=b9QO1v72cxQ',
    thumbnail_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=400&auto=format&fit=crop',
    duration_seconds: 60,
    objective: 'sales',
    published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
    metrics: {
      post_id: 'post_002',
      views: 9800,
      reach: 8400,
      likes: 620,
      comments: 98,
      shares: 215,
      saves: 430,
      followers_gained: 32,
      average_watch_time_seconds: 18.2,
      total_watch_time_seconds: 178360,
      profile_visits: 180,
      like_rate: 6.32,
      comment_rate: 1.00,
      share_rate: 2.19,
      save_rate: 4.38,
      retention_percentage: 30.3
    },
    analysis: {
      post_id: 'post_002',
      hook_data: {
        text: 'Dejá de adivinar qué publicar en Instagram: te enseño a usar IA',
        type: 'secreto_revelado',
        curiosity_score: 88,
        clarity_score: 94,
        auditory_strength: 'alta',
        has_text_on_screen: true
      },
      promise: 'Demostrar un flujo automático para analizar y replicar patrones virales.',
      topic: 'Automatización & IA',
      audience: 'Marketers y creadores de contenido',
      structure: ['hook', 'value', 'proof', 'cta'],
      language_data: {
        tone: 'Práctico y estructurado',
        proximity: 'cercano',
        technicality: 'baja',
        second_person_usage: true
      },
      emotions: ['alivio', 'eficiencia'],
      visual_analysis: {
        scene_change_frequency_sec: 3.0,
        has_captions: true,
        main_visual_element: 'Captura de pantalla de flujo n8n + canvas interactivo'
      },
      cta_data: {
        detected: true,
        text: 'Hacé clic en el enlace de la bio para ver el tutorial gratis',
        type: 'link_in_bio',
        strength: 'moderado'
      },
      time_segments: [
        {
          range: '0-3s',
          content: 'Dejá de adivinar qué publicar en Instagram...',
          narrative_role: 'hook',
          visual_cue: 'Demostración visual directa en pantalla'
        },
        {
          range: '3-20s',
          content: 'Conectamos el scraper de Reels con nuestro modelo de IA...',
          narrative_role: 'value',
          visual_cue: 'Recorrido por las piezas del flujo'
        },
        {
          range: '20-45s',
          content: 'Acá podés ver cómo desglosa el gancho, la retención y la propuesta...',
          narrative_role: 'proof',
          visual_cue: 'Muestra del reporte final'
        },
        {
          range: '45-60s',
          content: 'Probá el sistema en EventPix Intelligence.',
          narrative_role: 'cta',
          visual_cue: 'Botón animado de ingreso'
        }
      ],
      diagnosis: {
        what_worked: [
          'La demostración práctica en los primeros 5 segundos validó la promesa inmediatamente.',
          'Alta tasa de guardados (4.38%) por tratarse de un recurso tutorial práctico.'
        ],
        what_failed: [
          'El CTA final fue un poco tibio comparado con el CTA de palabra clave en comentarios.'
        ],
        hypotheses: [
          'Los tutoriales visuales estilo "Screen share + Explicación" convierten 1.8x más a guardados.'
        ],
        what_to_change: [
          'Cambiar el CTA final a palabra clave en comentarios en lugar de enviar a la bio.'
        ],
        what_to_repeat: [
          'Formato tutorial visual con captura del software en vivo.'
        ],
        next_test: 'Probar la combinación del Hook del Post 1 con la Demostración del Post 2.'
      }
    }
  }
];

export const INITIAL_AUDIT_REPORT: BusinessAuditReport = {
  business_id: 'biz_001',
  health_score: 88,
  executive_summary: 'El perfil de EventPix & Marketing Pro muestra una autoridad y tasa de interacción sobresalientes (88/100). El gancho inicial en Reels B2B es sumamente efectivo en retener a la audiencia en los primeros 3 segundos. Sin embargo, existe margen para optimizar los llamados a la acción y la conversión directa.',
  strengths: [
    'Propuesta de valor ultra-clara en el gancho de los Reels (Retención a los 3s superior al 82%).',
    'Excelente tasa de guardados (promedio de 3.98%), lo que indica contenido percibido como altamente valioso.',
    'Uso consistente de subtítulos dinámicos OCR y ritmo visual optimizado.'
  ],
  conversion_bottlenecks: [
    'Ligera caída de espectadores entre los segundos 15 y 25 por explicaciones conceptuales sin apoyo de B-roll.',
    'El CTA del 40% de los videos envía al enlace de la bio en lugar de pedir una palabra clave en comentarios, reduciendo el engagement del algoritmo.'
  ],
  immediate_actions: [
    {
      title: 'Implementar CTAs de palabra clave en el 100% de los Reels',
      description: 'Reemplazar "ir al link de la bio" por "Comentá REEL y te lo envío por MD". Esto multiplica x3 los comentarios y dispara el alcance.',
      priority: 'Alta',
      effort: 'Bajo'
    },
    {
      title: 'Fusionar el Hook del Reel #1 con la Demostración Visual del Reel #2',
      description: 'Utilizar el gancho de comparación "3 cosas que hacen los comercios que venden más" seguido de una demostración visual rápida del software.',
      priority: 'Alta',
      effort: 'Medio'
    },
    {
      title: 'Ajustar muletillas en el Entrenador de Voz (Panel Izquierdo)',
      description: 'Añadir la muletilla "Escuchá esto antes de grabar..." para consolidar la marca personal en la apertura.',
      priority: 'Media',
      effort: 'Bajo'
    }
  ],
  updated_at: new Date().toISOString()
};
