// ================================================================
// ScriptyFrameworkService.ts
// Biblioteca de Fórmulas y Estructuras Probadas de Video Vertical (Estilo Scripty)
// EventPix Intelligence — SaaS Platform
// ================================================================

export interface ScriptyHookFormula {
  id: string;
  name: string;
  category: 'negative' | 'secret' | 'contrast' | 'contrarian' | 'question' | 'proof';
  framework: string;
  exampleRetail: string;
  exampleDisplayDigital: string;
  whyItWorks: string;
  estimatedHookRate: string; // ej: "78% - 85%"
}

export interface ScriptyRetainStructure {
  id: string;
  name: string;
  category: 'pas' | 'three_steps' | 'show_dont_tell' | 'storytelling';
  timeframe: string;
  steps: Array<{ step: string; cue: string; timing: string }>;
  exampleDisplayDigital: string;
  retentionBenefit: string;
}

export interface ScriptyCtaFormula {
  id: string;
  name: string;
  category: 'keyword_comment' | 'save' | 'share' | 'whatsapp';
  framework: string;
  exampleDisplayDigital: string;
  conversionBenefit: string;
  manyChatKeyword?: string;
}

export class ScriptyFrameworkService {
  /**
   * Catálogo de Hooks Probados (Primeros 0 a 3 segundos)
   * Diseñados para romper el patrón de scroll (Pattern Interrupt)
   */
  static readonly HOOK_FORMULAS: ScriptyHookFormula[] = [
    {
      id: 'hook_costly_mistake',
      name: 'El Error Oculto (Aversión a la Pérdida)',
      category: 'negative',
      framework: 'Si todavía hacés [Acción común], estás perdiendo [Resultado deseado]. Hacé esto en su lugar.',
      exampleRetail: 'Si todavía repartís volantes en la puerta de tu local, estás tirando el 90% de tu presupuesto.',
      exampleDisplayDigital: 'Si todavía imprimís carteles de lona para tu negocio, estás perdiendo clientes todos los días. Mirá esto.',
      whyItWorks: 'Activa la aversión a la pérdida inmediata. El cerebro humano reacciona 2.5x más al miedo a perder que al deseo de ganar.',
      estimatedHookRate: '82% - 88%'
    },
    {
      id: 'hook_brutal_contrast',
      name: 'Transformación Antes vs Después (Prueba Visual)',
      category: 'contrast',
      framework: 'Así se veía [Situación inicial]... y mirá el cambio brutal cuando pusimos [Solución].',
      exampleRetail: 'Así pasaba de largo la gente por la vidriera... y mirá cómo frenan ahora.',
      exampleDisplayDigital: 'Así se veía la entrada de este local antes... y mirá cómo cambió la facturación al poner una pantalla vertical de alto brillo.',
      whyItWorks: 'Genera curiosidad visual instantánea sin requerir esfuerzo cognitivo. El contraste rápido frena el dedo en menos de 0.5s.',
      estimatedHookRate: '85% - 92%'
    },
    {
      id: 'hook_secret_insider',
      name: 'El Secreto de las Grandes Marcas',
      category: 'secret',
      framework: 'El truco que usan [Los comercios que más facturan] y que ningún proveedor te cuenta.',
      exampleRetail: 'El truco de los locales que más venden en tu centro comercial para no bajar precios.',
      exampleDisplayDigital: 'El truco visual que usan McDonald\'s y Zara para duplicar el ticket promedio que ahora podés poner en tu local.',
      whyItWorks: 'Apela al deseo de ventaja competitiva y revela un "secreto de la industria".',
      estimatedHookRate: '79% - 86%'
    },
    {
      id: 'hook_contrarian',
      name: 'La Opinión Contraria (Pattern Interrupt Extremo)',
      category: 'contrarian',
      framework: 'Dejá de hacer [Práctica común]. No sirve de nada si tus clientes no ven [Elemento visual].',
      exampleRetail: 'Dejá de bajar precios para competir. El problema no es tu precio, es cómo lo mostrás.',
      exampleDisplayDigital: 'Dejá de pagar publicidad en redes si cuando la gente pasa por tu local tu vidriera parece apagada.',
      whyItWorks: 'Choca frontalmente contra las creencias del usuario, obligándolo a escuchar la justificación.',
      estimatedHookRate: '81% - 87%'
    },
    {
      id: 'hook_pain_question',
      name: 'La Pregunta Chocante al Dolor',
      category: 'question',
      framework: '¿Por qué el 80% de las personas que pasan por tu puerta siguen de largo sin mirar?',
      exampleRetail: '¿Por qué tus clientes preguntan el precio en el mostrador y se van sin comprar?',
      exampleDisplayDigital: '¿Por qué tus clientes preguntan siempre lo mismo y tardan en decidir? Este cambio en el mostrador lo resuelve.',
      whyItWorks: 'Toca un dolor cotidiano que el comerciante vive todos los días a las 18hs.',
      estimatedHookRate: '76% - 83%'
    },
    {
      id: 'hook_social_proof',
      name: 'Prueba de Números y Resultados Rápidos',
      category: 'proof',
      framework: 'Instalamos esto un [Día de la semana] y para el [Día siguiente] aumentaron las ventas un [Porcentaje]%.',
      exampleRetail: 'Cambiamos la cartelería el martes y el viernes tuvimos récord de pedidos.',
      exampleDisplayDigital: 'Pusimos esta pantalla vertical en un local de indumentaria y en 48hs aumentaron 35% las consultas del catálogo.',
      whyItWorks: 'Los números específicos transmiten credibilidad inmediata y tangibilidad.',
      estimatedHookRate: '83% - 90%'
    }
  ];

  /**
   * Estructuras de Desarrollo de Retención (3 a 25 segundos)
   */
  static readonly RETAIN_STRUCTURES: ScriptyRetainStructure[] = [
    {
      id: 'retain_pas',
      name: 'PAS: Problema - Agitación - Solución',
      category: 'pas',
      timeframe: '4s a 25s',
      steps: [
        { step: '1. Problema', cue: 'Mostrar la fricción: cartel viejo o cliente esperando', timing: '4-8s' },
        { step: '2. Agitación', cue: 'Explicar el costo: tiempo perdido, ofertas invisibles', timing: '8-15s' },
        { step: '3. Solución', cue: 'Mostrar la pantalla encendida con video dinámico', timing: '15-24s' }
      ],
      exampleDisplayDigital: 'El comerciante pasa horas cambiando precios a mano o con carteles que nadie lee. Con Display Digital, abrís la app Shop de Plumas desde tu celular, cambiás la promo y en 2 segundos se actualiza en la pantalla vertical frente al cliente.',
      retentionBenefit: 'Mantiene al espectador involucrado emocionalmente al resolver su dolor paso a paso.'
    },
    {
      id: 'retain_three_steps',
      name: 'El Sistema de 3 Pasos (Simple & Accionable)',
      category: 'three_steps',
      timeframe: '4s a 22s',
      steps: [
        { step: 'Paso 1', cue: 'La colocación / instalación rápida (enchufar y listo)', timing: '4-9s' },
        { step: 'Paso 2', cue: 'La carga de contenidos desde el teléfono celular', timing: '9-16s' },
        { step: 'Paso 3', cue: 'El cliente mirando y comprando frente al mostrador', timing: '16-22s' }
      ],
      exampleDisplayDigital: 'Paso 1: La colocás en tu mostrador o vidriera. Paso 2: Conectás tu catálogo de productos y promos desde tu celular. Paso 3: La pantalla vende las 24 horas sola sin que tengas que gastar en impresiones.',
      retentionBenefit: 'La numeración reduce la fricción mental y hace que el cerebro anticipe el final del video.'
    },
    {
      id: 'retain_show_dont_tell',
      name: 'Demostración Dinámica (Show, Don\'t Tell)',
      category: 'show_dont_tell',
      timeframe: '4s a 20s',
      steps: [
        { step: 'Corte Rápido 1', cue: 'Plano detalle del brillo y nitidez de la pantalla', timing: '4-7s' },
        { step: 'Corte Rápido 2', cue: 'Demostración de cambio de precio en vivo desde el celular', timing: '7-12s' },
        { step: 'Corte Rápido 3', cue: 'Reacción de un cliente mirando la promo', timing: '12-18s' }
      ],
      exampleDisplayDigital: 'Cortes rápidos cada 1.8 segundos mostrando cómo la pantalla capta las miradas en el local y lo fácil que es actualizar ofertas en segundos.',
      retentionBenefit: 'Ritmo acelerado que evita el abandono temprano y maximiza el promedio de tiempo de visualización.'
    }
  ];

  /**
   * Llamados a la Acción (CTA) de Alta Conversión (Últimos 5 a 10 segundos)
   */
  static readonly CTA_FORMULAS: ScriptyCtaFormula[] = [
    {
      id: 'cta_keyword_comment',
      name: 'Automatización por Palabra Clave (ManyChat / WhatsApp Trigger)',
      category: 'keyword_comment',
      framework: 'Comentá la palabra "[PALABRA]" y te mando por privado el catálogo completo con precios y medidas.',
      exampleDisplayDigital: 'Comentá la palabra "PANTALLA" y te enviamos por privado el catálogo completo con precios y cuotas para tu local.',
      conversionBenefit: 'Dispara el algoritmo de Instagram por volumen de comentarios y abre conversación directa en DM/WhatsApp.',
      manyChatKeyword: 'PANTALLA'
    },
    {
      id: 'cta_save_bookmark',
      name: 'Micro-compromiso de Guardado (Save Rate Booster)',
      category: 'save',
      framework: 'Guardá este video para mostrárselo a tu socio cuando renueven la vidriera.',
      exampleDisplayDigital: 'Guardá este Reel para cuando decidas renovar la cartelería de tu comercio este mes.',
      conversionBenefit: 'El guardado es la métrica con mayor peso algorítmico en Instagram para entrar a la pestaña Explorar.',
    },
    {
      id: 'cta_whatsapp_direct',
      name: 'Derivación Directa a WhatsApp Comercial',
      category: 'whatsapp',
      framework: 'Tocá el enlace de nuestro perfil y te armamos un presupuesto a medida para tu local en el día.',
      exampleDisplayDigital: 'Hacé clic en el enlace de nuestra biografía y te enviamos una cotización personalizada según el tamaño de tu negocio.',
      conversionBenefit: 'Tráfico de alta intención directo al equipo de ventas de WhatsApp.',
    }
  ];

  /**
   * Obtiene un gancho por ID o el primero por defecto
   */
  static getHookById(id: string): ScriptyHookFormula {
    return this.HOOK_FORMULAS.find(h => h.id === id) || this.HOOK_FORMULAS[0];
  }

  /**
   * Obtiene una estructura de retención por ID
   */
  static getRetainStructureById(id: string): ScriptyRetainStructure {
    return this.RETAIN_STRUCTURES.find(r => r.id === id) || this.RETAIN_STRUCTURES[0];
  }

  /**
   * Obtiene un CTA por ID
   */
  static getCtaById(id: string): ScriptyCtaFormula {
    return this.CTA_FORMULAS.find(c => c.id === id) || this.CTA_FORMULAS[0];
  }

  /**
   * Analiza un texto de gancho y determina a qué fórmula Scripty pertenece
   */
  static classifyHook(hookText: string): { formula: ScriptyHookFormula; score: number } {
    const text = hookText.toLowerCase();

    if (/no hac|dejá|error|perdiendo|cuesta|tirando|basta/i.test(text)) {
      return { formula: this.HOOK_FORMULAS[0], score: 92 }; // Error Negativo
    }
    if (/así se veía|antes|después|cambio|mirá cómo/i.test(text)) {
      return { formula: this.HOOK_FORMULAS[1], score: 94 }; // Contraste
    }
    if (/secreto|truco|nadie te cuenta|oculto|marcas/i.test(text)) {
      return { formula: this.HOOK_FORMULAS[2], score: 88 }; // Secreto
    }
    if (/por qué|sabías|cuánto|cómo hacés/i.test(text) || text.includes('?')) {
      return { formula: this.HOOK_FORMULAS[4], score: 85 }; // Pregunta dolor
    }
    if (/\d+%|\$\d+|récord|horas|días/i.test(text)) {
      return { formula: this.HOOK_FORMULAS[5], score: 89 }; // Números y prueba
    }

    return { formula: this.HOOK_FORMULAS[3], score: 80 }; // Contrarián por descarte
  }
}
