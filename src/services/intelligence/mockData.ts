import { IntelligenceBusiness, BrandDNA, IntelligencePost, BusinessAuditReport, IntegrationConnector } from '../../types/intelligence';

export const INITIAL_BUSINESS: IntelligenceBusiness = {
  id: 'biz_001',
  user_id: 'user_default',
  name: 'EventPix & Marketing Pro',
  niche: 'Agencia de Marketing & Soluciones Audiovisuales para Eventos',
  target_audience: 'Dueños de locales, organizadores de eventos y creadores B2B en LATAM',
  brand_tone: 'directo',
  instagram_handle: '@beaacamposr',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const INITIAL_CONNECTORS: IntegrationConnector[] = [
  {
    id: 'conn_meta',
    provider: 'meta_business',
    name: 'Meta Business Suite (Instagram & Facebook)',
    status: 'connected',
    account_name: '@beaacamposr (8830 seg.)'
  },
  {
    id: 'conn_chatgpt',
    provider: 'chatgpt',
    name: 'ChatGPT User Memory & Preference',
    status: 'connected',
    account_name: 'Custom GPT Active'
  },
  {
    id: 'conn_claude',
    provider: 'claude',
    name: 'Claude 3.5 Sonnet Strategy Engine',
    status: 'connected',
    account_name: 'Anthropic Agent Ready'
  },
  {
    id: 'conn_canva',
    provider: 'canva',
    name: 'Canva Design Connector',
    status: 'connected',
    account_name: 'EventPix Brand Kit'
  },
  {
    id: 'conn_auto',
    provider: 'webhook_automation',
    name: 'Auto-Responder DM ("Comenta APP")',
    status: 'connected',
    account_name: 'Trigger Active'
  }
];

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
      'Comenta "APP" y te la envío ya!!! ⬇️',
      'Comentá "REEL" y te envío el despiece completo.',
      'Hacé clic en el link de la bio para acceder al entrenamiento.'
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
        text: 'Comenta "APP" y te la envío ya!!! ⬇️',
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
          content: 'Comenta "APP" y te la envío ya!!! ⬇️',
          narrative_role: 'cta',
          visual_cue: 'Banner rosa con texto gigante'
        }
      ],
      diagnosis: {
        what_worked: [
          'Autoridad masiva: Verificación y prueba social explícita.',
          'Maestría en CTAs de activación: El uso de "Comenta APP" genera volúmenes masivos de comentarios, disparando el alcance.'
        ],
        what_failed: [
          'Fuga de conversión por fecha: La mención a una fecha específica en la bio hace que la oferta parezca obsoleta para visitantes posteriores.'
        ],
        hypotheses: [
          'Reemplazar el CTA de fecha específica por uno "evergreen" (atemporal) como "Accede al Entrenamiento VIP".'
        ],
        what_to_change: [
          'Actualizar el link en la bio para que dirija a una landing que siempre tenga la próxima clase disponible.'
        ],
        what_to_repeat: [
          'Mantener la estrategia de sticker rosa "Comenta APP y te la envío ya!!!".'
        ],
        next_test: 'Probar respuesta automática por DM integrada con Meta Business Suite.'
      }
    }
  }
];

export const INITIAL_AUDIT_REPORT: BusinessAuditReport = {
  business_id: 'biz_001',
  health_score: 88,
  instagram_handle: '@beaacamposr',
  bio_audit: {
    current_bio: `Convierto expertas en dueñas que facturan con IG\nMi app: @scripty.app\n💛 +9K clientas en LATAM y USA 🙏\n🎓 Clase en vivo: 2 de junio\n⬇️ Empecemos aquí`,
    bio_score: 85,
    strengths: [
      'Autoridad masiva: Verificación y base de clientes en LATAM y USA.',
      'Maestría en CTAs de activación: El uso de "Comenta APP" genera interacción continua.',
      'Sinergia de marca: Conexión directa con la app propia creando un bucle de atracción.'
    ],
    weaknesses: [
      'Fuga de conversión por fecha: La mención a la fecha "2 de junio" hace que la oferta principal parezca obsoleta para cualquier visitante posterior a esa fecha.'
    ],
    recommendations: [
      'Reemplazar el CTA de fecha específica por uno "evergreen" (atemporal) como "Clase Gratuita Semanal" o "Accede al Entrenamiento VIP".',
      'Actualizar el link en bio para que dirija a una landing que siempre tenga la versión grabada disponible.'
    ]
  },
  executive_summary: 'El perfil de @beaacamposr es fuerte en autoridad y conversión, con una propuesta de valor nítida y un alto nivel de interacción. Sin embargo, la bio requiere optimización para evitar la fuga de conversión por fechas obsoletas.',
  strengths: [
    'Autoridad masiva y prueba social explícita (+9k clientes).',
    'Maestría en CTAs de activación por comentario ("Comenta APP").',
    'Demanda explícita visible en comentarios validando la oferta.'
  ],
  conversion_bottlenecks: [
    'Mención a fecha específica ("2 de junio") que desactualiza el perfil.',
    'Oportunidad de automatizar la entrega por DM usando Meta Business Suite.'
  ],
  immediate_actions: [
    {
      title: 'Actualizar Bio a formato Evergreen (Atemporal)',
      description: 'Reemplazar "Clase en vivo: 2 de junio" por "Acceso al Entrenamiento VIP".',
      priority: 'Alta',
      effort: 'Bajo'
    },
    {
      title: 'Activar Conector de Meta Business Suite (Auto-DM)',
      description: 'Conectar el activador de "Comenta APP" para enviar el enlace automáticamente por mensaje directo.',
      priority: 'Alta',
      effort: 'Medio'
    },
    {
      title: 'Exportar Guion Fusionado a Canva',
      description: 'Generar la carátula y el sticker rosa de llamado a la acción directamente en Canva.',
      priority: 'Media',
      effort: 'Bajo'
    }
  ],
  updated_at: new Date().toISOString()
};
