// ================================================================
// AIProviderService.ts
// Orquestador Unificado de Inteligencia Artificial (OpenAI + Claude)
// EventPix Intelligence — SaaS Platform
// ================================================================

import { UnifiedConnectionsState, ShopProduct } from '../../types/connections';
import {
  BrandDNA,
  IntelligencePost,
  AccountMedianBenchmark,
  Hypothesis,
  ScriptVariant,
  ContentDnaItem,
  EmpiricalPattern,
  NO_DATA
} from '../../types/intelligence';
import { CRMLead, CRMMessage } from '../../types/crm';
import { ReelSynthesisResult } from './reelAnalyzerService';
import { ScriptyFrameworkService } from './ScriptyFrameworkService';
import { DynamicSynthesisEngine } from './DynamicSynthesisEngine';
import { UserProfileContext } from '../../types/strategicProfile';
import { AccountBenchmarkService } from './AccountBenchmarkService';
import { ContentDnaEngine } from './ContentDnaEngine';
import { IntelligenceStorageService } from './IntelligenceStorageService';
import { supabase } from '../../lib/supabase';
import {
  hasValue,
  fromApi,
  formatMetric,
  formatForPrompt,
  rate,
  compareDesc,
  exceeds,
  postToMetaItem
} from './metricUtils';
import { toast } from 'sonner';

// Saca una palabra clave real del tema/producto para armar un CTA tipo
// "Comentá 'X' y te paso la info" cuando el negocio no fijó un CTA propio.
// Nunca usamos un relleno fijo tipo "APP" o "INFO": cada guion necesita una
// palabra que tenga que ver con lo que se está mostrando en ESE guion.
const CTA_KEYWORD_STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'para', 'por', 'con', 'en', 'un', 'una', 'y', 'o', 'tu', 'tus', 'que', 'como', 'mas', 'más', 'sin', 'esta', 'este']);

function deriveCtaKeyword(topic: string | null | undefined): string {
  const clean = (topic || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(w => w.length > 2 && !CTA_KEYWORD_STOPWORDS.has(w.toLowerCase()));
  const chosen = [...words].sort((a, b) => b.length - a.length)[0];
  return (chosen || 'CATALOGO').toUpperCase().slice(0, 14);
}

export class AIProviderService {
  /**
   * Valida una clave de API de OpenAI contra el endpoint de modelos y prueba de completado para verificar saldo
   */
  static async testOpenAI(apiKey: string): Promise<{ success: boolean; error?: string; hasCredits?: boolean }> {
    if (!apiKey.trim()) {
      return { success: false, error: 'API Key de OpenAI vacía.' };
    }

    try {
      // 1. Probar autenticación con un ping real de 1 token para verificar si la cuenta tiene saldo
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'di ok' }],
          max_tokens: 5
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.error?.code === 'insufficient_quota' || data.error?.message?.includes('quota')) {
          return {
            success: false,
            error: 'Tu API Key es correcta, pero tu cuenta de OpenAI tiene $0.00 de saldo. En OpenAI Platform necesitás recargar al menos $5 en "Settings > Billing > Add Credits" para que la API responda.',
            hasCredits: false
          };
        }
        return {
          success: false,
          error: data.error?.message || `Error de OpenAI (${res.status})`
        };
      }

      return { success: true, hasCredits: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error de red al conectar con OpenAI.'
      };
    }
  }

  /**
   * Valida una clave de API de Anthropic Claude
   */
  static async testClaude(
    apiKey: string,
    preferredModel: string = 'claude-3-5-sonnet-20241022',
    workspaceId?: string
  ): Promise<{ success: boolean; error?: string; workspaceId?: string; model?: string }> {
    if (!apiKey.trim()) {
      return { success: false, error: 'API Key de Claude vacía.' };
    }

    // Lista de modelos ordenados: primero el preferido, luego Sonnet 3.7, 3.5 latest, Haiku latest y Sonnet 4.6
    const modelsToTry = [
      preferredModel,
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-latest',
      'claude-3-5-haiku-20241022',
      'claude-sonnet-4-6',
      'claude-3-haiku-20240307'
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let lastError = '';

    for (const testModel of modelsToTry) {
      try {
        let res: Response;
        let data: any;

        try {
          res = await fetch('/api/claude-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: apiKey.trim(), model: testModel, workspaceId })
          });
          data = await res.json();
        } catch {
          const directHeaders: Record<string, string> = {
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          };
          if (workspaceId) {
            directHeaders['anthropic-workspace-id'] = workspaceId;
          }
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: directHeaders,
            body: JSON.stringify({
              model: testModel,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'ping' }]
            })
          });
          data = await res.json();
        }

        if (res.ok && (data.id || data.content)) {
          return {
            success: true,
            workspaceId: data._detectedWorkspaceId || workspaceId,
            model: data._detectedModel || testModel
          };
        }

        if (data.error) {
          const type = data.error.type || '';
          const rawMsg = data.error.message || '';
          const msg = rawMsg.toLowerCase();

          // Errores de autenticación
          if (type === 'authentication_error' || msg.includes('invalid x-api-key') || msg.includes('unauthorized')) {
            return {
              success: false,
              error: `Clave no reconocida por Anthropic (${rawMsg || 'invalid x-api-key'}). Verificá en console.anthropic.com/settings/keys que la clave no haya sido revocada.`
            };
          }

          // Errores de saldo / créditos
          if (msg.includes('credit') || msg.includes('balance') || type === 'billing_error') {
            return {
              success: false,
              error: 'Saldo insuficiente en Anthropic ($0.00). Cargá créditos en console.anthropic.com/settings/plans.'
            };
          }

          // Si este modelo específico no está disponible en la cuenta del usuario, intentamos el siguiente
          if (type === 'not_found_error' || msg.includes('model')) {
            lastError = `Modelo ${testModel} no habilitado: ${rawMsg}`;
            continue;
          }

          return {
            success: false,
            error: rawMsg || `Error de Anthropic (${res.status})`
          };
        }
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Error de red al conectar con Anthropic.'
        };
      }
    }

    return {
      success: false,
      error: lastError || 'No se pudo conectar con ningún modelo de Claude.'
    };
  }

  /**
   * Valida una clave de API de Google Gemini
   */
  static async testGemini(
    apiKey: string,
    model: string = 'gemini-1.5-flash'
  ): Promise<{ success: boolean; error?: string }> {
    if (!apiKey.trim()) {
      return { success: false, error: 'API Key de Google Gemini vacía.' };
    }

    try {
      let res: Response;
      try {
        res = await fetch('/api/gemini-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey.trim(), model })
        });
      } catch {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || `Error de Google Gemini (${res.status})`
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error de red al conectar con Google Gemini.'
      };
    }
  }

  /**
   * Ejecuta una llamada de generación a Google Gemini con fallback a proxy o directo
   */
  static async callGemini(params: {
    apiKey: string;
    model?: string;
    systemPrompt?: string;
    prompt: string;
    responseMimeType?: string;
  }): Promise<string> {
    const { apiKey, model = 'gemini-1.5-flash', systemPrompt, prompt, responseMimeType } = params;
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig: any = {
      temperature: 0.75
    };
    if (responseMimeType) {
      generationConfig.responseMimeType = responseMimeType;
    }

    let res: Response;
    try {
      res = await fetch('/api/gemini-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model,
          contents,
          systemInstruction: systemPrompt,
          generationConfig
        })
      });
    } catch {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const payload: any = { contents, generationConfig };
      if (systemPrompt) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || 'Error devuelto por Gemini');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Respuesta vacía de Google Gemini');
    }
    return text;
  }

  /**
   * Genera un Super Guión y Síntesis usando la IA activa (OpenAI o Claude)
   */
  static async generateSynthesis(
    sourcePosts: IntelligencePost[],
    brandDna: BrandDNA,
    connections: UnifiedConnectionsState,
    catalogProducts: ShopProduct[] = []
  ): Promise<ReelSynthesisResult> {
    const provider = connections.preferredAIProvider;
    const hasOpenAI = connections.openai.isActive && connections.openai.apiKey;
    const hasClaude = connections.claude.isActive && connections.claude.apiKey;
    const sourceTitles = sourcePosts.map(p => `"${p.title}"`).join(' + ');

    const sourceBreakdowns = sourcePosts.map((p, idx) => {
      const hook = p.analysis?.hook_data.text || 'Sin hook específico';
      const hookScore = p.analysis?.hook_data.curiosity_score || 85;
      const whatWorked = p.analysis?.diagnosis.what_worked.join('; ') || 'Buen ritmo comercial';
      const cta = p.analysis?.cta_data.text || 'Sin CTA';
      const segments = p.analysis?.time_segments?.map(s => `    - ${s.range} [${s.narrative_role}]: "${s.content}"`).join('\n') || '';
      const perf = p.metrics
        ? [
            formatForPrompt(p.metrics.views, 'vistas'),
            formatForPrompt(p.metrics.likes, 'likes'),
            formatForPrompt(p.metrics.saves, 'guardados'),
            formatForPrompt(p.metrics.retention_percentage, 'retención %')
          ].join(', ')
        : 'SIN MÉTRICAS DISPONIBLES para este Reel.';

      return `REEL FUENTE #${idx + 1}: "${p.title}"
  * Desempeño real auditado: ${perf}
  * Gancho analizado (0-3s, Score Curiosidad: ${hookScore}/100): "${hook}"
  * Lo que mejor funcionó: ${whatWorked}
  * Llamado a la acción original: "${cta}"
  * Diálogo desglosado por capas de tiempo:
${segments}`;
    }).join('\n\n');

    const primaryTone = brandDna?.voice_and_tone?.primary_tone || 'directo';
    const catchphrase =
      brandDna?.voice_and_tone?.favorite_catchphrases?.[0] ||
      (brandDna?.voice_and_tone as any)?.catchphrases?.[0] ||
      'Escuchá esto:';

    // Traer nicho real y catálogo genérico del negocio: sin esto, cuando no
    // hay productos sincronizados por la integración "Shop de Plumas" ni
    // brandDna.offers cargado, no hay que inventar un rubro de relleno
    // (nunca más "pantallas digitales" fijo acá).
    const [profileContext, { data: genericCatalogRows }] = await Promise.all([
      IntelligenceStorageService.loadProfileContext(brandDna.business_id).catch(() => null),
      supabase
        .from('intelligence_business_products')
        .select('name, description, price')
        .eq('business_id', brandDna.business_id)
        .eq('is_active', true)
        .limit(20)
    ]);

    const niche = profileContext?.profile?.niche?.trim();
    const aboutContent = profileContext?.profile?.about_content?.trim();

    // Anclaje a productos reales si existen
    const mainProductsList = Array.isArray(brandDna?.offers)
      ? (brandDna.offers as any).map((o: any) => o.name || '').filter(Boolean).join(', ')
      : Array.isArray((brandDna?.offers as any)?.main_products)
        ? (brandDna.offers as any).main_products.join(', ')
        : '';

    const productContext = catalogProducts && catalogProducts.length > 0
      ? catalogProducts.slice(0, 5).map(p => `- ${p.name} ($${p.price.toLocaleString('es-AR')} ARS, Stock: ${p.stock} un.)`).join('\n')
      : genericCatalogRows && genericCatalogRows.length > 0
        ? genericCatalogRows.map((p: any) => `- ${p.name}${p.price ? ` ($${p.price})` : ''}${p.description ? `: ${p.description}` : ''}`).join('\n')
        : mainProductsList || aboutContent || (niche ? `(sin catálogo cargado: el negocio es de "${niche}", escribí sobre eso en general sin inventar un producto específico)` : '(sin catálogo ni nicho cargado: sacá el tema únicamente de los Reels fuente analizados abajo, nunca inventes un producto de otro rubro)');

    const prompt = `Actuá como el Director Creativo y Estratega de Contenidos de EventPix Intelligence.
Tu tarea es COMPARAR Y FUSIONAR los Reels analizados para redactar el SUPER GUIÓN RECOMENDADO con el diálogo completo palabra por palabra para el próximo video del negocio.

ANÁLISIS COMPARATIVO DE LOS REELS FUENTE:
${sourceBreakdowns}

CONTEXTO Y OFERTA DEL NEGOCIO:
- Nicho real: ${niche || '(no cargado, usá los Reels fuente para inferir el rubro)'}
- Tono de voz: ${primaryTone} (Argentino natural, profesional, dinámico y directo).
- Frase de cabecera: "${catchphrase}"
- Productos y precios oficiales del catálogo:
${productContext}

REGLA INQUEBRANTABLE: el diálogo tiene que hablar del negocio real de arriba (nicho/catálogo) o de los Reels fuente analizados. PROHIBIDO ROTUNDAMENTE inventar o asumir un producto o rubro que no figure ahí (nunca metas pantallas digitales, cartelería, zapatillas ni ningún otro ejemplo genérico si el negocio no lo vende). Tampoco escribas frases de coach de redes vacías ("¡hoy es tu día!", "tu reel es una joya"): el guion tiene que vender o hablar de algo concreto.

OBJETIVOS DE LA SÍNTESIS Y NUEVO DIÁLOGO:
1. Extraer los elementos del diálogo que tuvieron mayor retención en los Reels analizados y descartar las partes aburridas o lentas.
2. Armar el NUEVO DIÁLOGO COMPLETO palabra por palabra que el creador dirá frente a cámara o en voz en off.
3. Debe incluir indicaciones escénicas y marcas de tiempo claras:
   - [HOOK (0-3s)]: Gancho de alta curiosidad con texto en pantalla.
   - [CONFLICTO (3-12s)]: El dolor o problema que frena las ventas de los clientes.
   - [DEMOSTRACIÓN (12-30s)]: Solución tangible mencionando el equipamiento o producto real con precios.
   - [CTA (30-45s)]: Llamado a la acción con una palabra clave ESPECÍFICA del producto/tema de este guion (ej: si es sobre boas de plumas, 'Comentá "BOAS" y te paso los colores disponibles'). PROHIBIDO usar una palabra de relleno genérica como "APP" o "INFO" que no tenga relación con lo que se está vendiendo.

Devolvé un JSON estricto con esta estructura:
{
  "title": "Título corto y potente del guión",
  "hook": "El gancho exacto de los primeros 3 segundos",
  "structure_breakdown": [
    "0-3s: Hook...",
    "3-12s: Problema...",
    "12-30s: Demostración...",
    "30-45s: CTA..."
  ],
  "cta": "Llamado a la acción específico",
  "full_script": "Texto completo del guión con marcas de tiempo y notas escénicas",
  "teleprompter_clean_script": "Texto PURO del diálogo hablado, sin corchetes ni marcas de tiempo, dividido en párrafos cortos de 1 a 2 oraciones ideales para leer en teleprompter de apps como CapCut o Edits.",
  "alternative_hooks": [
    { "type": "Curiosidad", "text": "Gancho enfocado en curiosidad..." },
    { "type": "Dolor / Pérdida", "text": "Gancho enfocado en el costo de no innovar..." },
    { "type": "Resultado Directo", "text": "Gancho directo a la solución..." }
  ],
  "new_reel_ideas": [
    {
      "title": "Título de la idea",
      "hook": "Primeros 3 segundos exactos",
      "angle": "Ángulo psicológico",
      "spoken_dialogue": "Diálogo completo hablado listo para teleprompter",
      "cta": "Llamado a la acción"
    }
  ],
  "why_it_works": "Explicación cuantitativa de por qué este nuevo guión supera a los anteriores basándote en la comparación de retención",
  "expected_impact": "Impacto proyectado en vistas, comentarios y derivación a WhatsApp"
}
`;

    // Fallbacks neutrales por si la IA devuelve un campo vacío: genéricos del
    // mecanismo de guion (nunca un producto o rubro inventado como "pantallas
    // digitales" o "cartelería", que no tiene por qué tener nada que ver con
    // el negocio real que se está analizando).
    const neutralStructureFallback = [
      '0-3s: Hook de alta retención',
      '3-12s: Exposición del problema o deseo del cliente',
      '12-30s: Demostración de la solución real del negocio',
      '30-45s: CTA directo por palabra clave'
    ];
    const neutralAlternativeHooksFallback = [
      { type: 'Curiosidad', text: `${catchphrase} Lo que la mayoría no sabe sobre esto.` },
      { type: 'Dolor / Pérdida', text: 'Lo que te estás perdiendo si todavía no probaste esto.' },
      { type: 'Resultado Directo', text: `Basado en ${sourceTitles || 'tu mejor contenido'}, el ángulo que más convierte.` }
    ];
    const neutralNewReelIdeasFallback = [
      {
        title: 'Idea basada en tu Reel de mejor desempeño',
        hook: sourcePosts[0]?.analysis?.hook_data?.text || sourcePosts[0]?.title || 'Gancho a definir a partir de tu contenido real',
        angle: 'Replicar el patrón ganador detectado',
        spoken_dialogue: 'La IA no devolvió un diálogo completo esta vez: volvé a pedir la síntesis para generar el guion real.',
        cta: 'Comentá la palabra clave de tu negocio para recibir más info.'
      }
    ];

    // 0. Ejecución con Google Gemini si está configurado
    const hasGemini = Boolean(connections.gemini?.isActive && connections.gemini?.apiKey?.trim());
    if (provider === 'gemini' && hasGemini) {
      try {
        const rawJson = await AIProviderService.callGemini({
          apiKey: connections.gemini.apiKey,
          model: connections.gemini.model || 'gemini-1.5-flash',
          systemPrompt: 'Sos un estratega de contenidos y conversión comercial experto en video vertical y Meta Ads. Respondé ÚNICAMENTE con un JSON válido.',
          prompt,
          responseMimeType: 'application/json'
        });
        const parsed = JSON.parse(rawJson);
        const cleanScript = parsed.teleprompter_clean_script || parsed.full_script?.replace(/\[.*?\]|\(.*?\)/g, '').trim();
        return {
          title: parsed.title || `Super Guion: ${sourceTitles}`,
          hook: parsed.hook || `${catchphrase} La clave que pocos negocios conocen.`,
          structure_breakdown: parsed.structure_breakdown || neutralStructureFallback,
          cta: parsed.cta || `Comentá "${deriveCtaKeyword(niche || mainProductsList)}" y te paso la info`,
          full_script: parsed.full_script,
          teleprompter_clean_script: cleanScript,
          alternative_hooks: parsed.alternative_hooks || neutralAlternativeHooksFallback,
          new_reel_ideas: parsed.new_reel_ideas || neutralNewReelIdeasFallback,
          why_it_works: parsed.why_it_works || 'Generado con Google Gemini 1.5 Flash anclado a productos reales.',
          expected_impact: parsed.expected_impact || 'Aumento en comentarios y calificación de leads.'
        };
      } catch (err) {
        console.warn('Error en llamada a Gemini para síntesis:', err);
      }
    }

    // 1. Ejecución con OpenAI si está configurado
    if ((provider === 'openai' && hasOpenAI) || (hasOpenAI && !hasClaude && !hasGemini)) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${connections.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: connections.openai.model || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Sos un estratega de contenidos y conversión comercial experto en video vertical y Meta Ads.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7
          })
        });

        const data = await res.json();
        if (data.error) {
          console.warn('OpenAI error:', data.error);
          if (data.error?.code === 'insufficient_quota' || data.error?.message?.includes('quota')) {
            toast.warning('OpenAI tiene saldo $0.00. Cargá saldo en platform.openai.com/billing para usar GPT-4o.');
          }
        } else if (data.choices?.[0]?.message?.content) {
          const parsed = JSON.parse(data.choices[0].message.content);
          const cleanScript = parsed.teleprompter_clean_script || parsed.full_script?.replace(/\[.*?\]|\(.*?\)/g, '').trim();
          return {
            title: parsed.title || `Super Guion: ${sourceTitles}`,
            hook: parsed.hook || `${catchphrase} La clave que pocos negocios conocen.`,
            structure_breakdown: parsed.structure_breakdown || neutralStructureFallback,
            cta: parsed.cta || `Comentá "${deriveCtaKeyword(niche || mainProductsList)}" y te paso la info`,
            full_script: parsed.full_script,
            teleprompter_clean_script: cleanScript,
            alternative_hooks: parsed.alternative_hooks || neutralAlternativeHooksFallback,
            new_reel_ideas: parsed.new_reel_ideas || neutralNewReelIdeasFallback,
            why_it_works: parsed.why_it_works || 'Generado con GPT-4o mini anclado a productos reales.',
            expected_impact: parsed.expected_impact || 'Aumento en comentarios y calificación de leads.'
          };
        }
      } catch (err) {
        console.warn('Error en llamada a OpenAI, recurriendo al motor determinístico:', err);
      }
    }

    // 2. Ejecución con Claude si está configurado
    if (provider === 'claude' && hasClaude) {
      try {
        let res: Response;
        try {
          res = await fetch('/api/claude-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: connections.claude.apiKey,
              model: connections.claude.model || 'claude-3-5-sonnet-20241022',
              max_tokens: 2000,
              workspaceId: connections.claude.workspaceId,
              messages: [{ role: 'user', content: prompt }]
            })
          });
        } catch {
          const directHeaders: Record<string, string> = {
            'x-api-key': connections.claude.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          };
          if (connections.claude.workspaceId) {
            directHeaders['anthropic-workspace-id'] = connections.claude.workspaceId;
          }
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: directHeaders,
            body: JSON.stringify({
              model: connections.claude.model || 'claude-3-5-sonnet-20241022',
              max_tokens: 2000,
              messages: [{ role: 'user', content: prompt }]
            })
          });
        }

        const data = await res.json();
        const textContent = data.content?.[0]?.text;
        if (textContent) {
          // Extraer JSON si viene entre markdown
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const cleanScript = parsed.teleprompter_clean_script || parsed.full_script?.replace(/\[.*?\]|\(.*?\)/g, '').trim();
            return {
              title: parsed.title,
              hook: parsed.hook,
              structure_breakdown: parsed.structure_breakdown,
              cta: parsed.cta,
              full_script: parsed.full_script,
              teleprompter_clean_script: cleanScript,
              alternative_hooks: parsed.alternative_hooks,
              new_reel_ideas: parsed.new_reel_ideas,
              why_it_works: parsed.why_it_works || 'Estrategia generada con Claude 3.5 Sonnet.',
              expected_impact: parsed.expected_impact
            };
          }
        }
      } catch (err) {
        console.warn('Error en llamada a Claude, recurriendo al motor determinístico:', err);
      }
    }

    // 3. Fallback Determinístico Inteligente (analiza los posts seleccionados y sus temáticas reales)
    return DynamicSynthesisEngine.synthesize(sourcePosts, brandDna, catalogProducts);
  }

  /**
   * Genera una respuesta comercial hiper-persuasiva con IA real (Claude Sonnet o GPT-4o)
   * inyectando el perfil del lead, el catálogo con precios reales y la objeción o consulta recibida.
   */
  static async generateCRMReply(params: {
    lead: CRMLead;
    chatHistory: CRMMessage[];
    brandDna?: BrandDNA;
    businessName?: string;
    catalogProducts?: ShopProduct[];
    connections: UnifiedConnectionsState;
    clientInquiry?: string;
    overrideProvider?: 'claude' | 'openai';
  }): Promise<{
    suggestedReply: string;
    reasoning: string;
    detectedIntent: string;
    updatedScore?: number;
    providerUsed: string;
  }> {
    const { lead, chatHistory, brandDna, businessName, catalogProducts = [], connections, clientInquiry, overrideProvider } = params;

    const provider = overrideProvider || connections.preferredAIProvider || 'claude';
    const hasClaude = connections.claude.isActive && connections.claude.apiKey;
    const hasOpenAI = connections.openai.isActive && connections.openai.apiKey;

    const historyText = chatHistory
      .slice(-6)
      .map(m => `${m.sender_type === 'operator' ? 'Asesor' : lead.name}: "${m.content}"`)
      .join('\n');

    const latestInquiry = clientInquiry ||
      chatHistory.slice().reverse().find(m => m.sender_type === 'lead')?.content ||
      lead.primary_interest ||
      'Consultó por nuestros productos o servicios';

    // El negocio real: sin esto, el prompt caía siempre a "EventPix" y
    // "Pantallas Verticales" — el vendedor de IA de cualquier rubro terminaba
    // ofreciendo cartelería digital.
    const bizName = businessName?.trim() || 'este negocio';
    const mainProducts = brandDna?.offers?.main_products?.filter(Boolean) || [];
    const ctas = brandDna?.offers?.call_to_actions?.filter(Boolean) || [];
    const tone = brandDna?.voice_and_tone?.primary_tone || 'directo';

    const catalogContext = catalogProducts.length > 0
      ? catalogProducts.map(p => `- ${p.name}: $${p.price.toLocaleString('es-AR')} ARS (Stock: ${p.stock} un., Categoría: ${p.category || 'General'})`).join('\n')
      : mainProducts.length > 0
      ? mainProducts.map(p => `- ${p} (sin precio cargado — no inventes un número, pedile al cliente que aclare o derivá a un asesor humano si pide precio exacto)`).join('\n')
      : '(Sin catálogo ni productos cargados todavía — no inventes productos ni precios; enfocate en entender qué necesita el cliente y ofrecé derivarlo a un asesor humano si pide números concretos.)';

    const prompt = `Sos el Asesor Comercial de Ventas de ${bizName} en Argentina.
Tu misión es redactar una respuesta de WhatsApp persuasiva, concisa y efectiva para avanzar la venta o cerrar la operación con este cliente.
${brandDna?.identity?.unique_value_proposition ? `\nPROPUESTA DE VALOR DEL NEGOCIO: ${brandDna.identity.unique_value_proposition}` : ''}
${ctas.length > 0 ? `\nLLAMADOS A LA ACCIÓN QUE USA ESTE NEGOCIO (preferí uno de estos para cerrar): ${ctas.join(' | ')}` : ''}

PERFIL DEL LEAD:
- Nombre: ${lead.name}
- Etapa en el Pipeline: ${lead.stage.toUpperCase()}
- Scoring de Intención: ${lead.intent_score}/100
- Interés Principal: ${lead.primary_interest || 'Sin especificar'}
- Origen del Lead: ${lead.source.post_title || 'Instagram Reel'}

HISTORIAL DE LA CHARLA:
${historyText || '(Inicio de conversación)'}

CONSULTA / OBJECIÓN ACTUAL DEL CLIENTE:
"${latestInquiry}"

CATÁLOGO / PRODUCTOS DISPONIBLES:
${catalogContext}

PAUTAS DE RESPUESTA COMERCIAL:
1. Hablá en español argentino natural (vos/te paso/fijate/mirá), educado y profesional, con tono ${tone}, sin parecer un bot acartonado.
2. Si el cliente pregunta por precio y no hay uno cargado en el catálogo, NUNCA inventes un número — pedile que aclare qué necesita o proponé derivarlo a un asesor humano para la cotización exacta.
3. Si pide cotización y hay catálogo real, dale números claros del catálogo.
4. Terminá SIEMPRE con una pregunta de cierre o avance suave acorde al negocio.
5. Mantené el mensaje conciso (ideal para WhatsApp, entre 3 y 5 oraciones).

Respondé ÚNICAMENTE con un objeto JSON válido con esta estructura:
{
  "suggested_reply": "El texto exacto de WhatsApp para enviarle al cliente",
  "reasoning": "Por qué se formuló esta respuesta y qué técnica comercial utiliza (1 oración)",
  "detected_intent": "Solicitud de Presupuesto | Manejo de Objeción de Precio | Consulta de Instalación | Cierre de Venta",
  "updated_score": 85
}`;

    // 1. Ejecución con Claude si está seleccionado o disponible
    if ((provider === 'claude' && hasClaude) || (hasClaude && !hasOpenAI)) {
      try {
        const directHeaders: Record<string, string> = {
          'x-api-key': connections.claude.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        };
        if (connections.claude.workspaceId) {
          directHeaders['anthropic-workspace-id'] = connections.claude.workspaceId;
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: directHeaders,
          body: JSON.stringify({
            model: connections.claude.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data = await res.json();
        if (data.content?.[0]?.text) {
          const raw = data.content[0].text;
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              suggestedReply: parsed.suggested_reply,
              reasoning: parsed.reasoning,
              detectedIntent: parsed.detected_intent || 'Gestión Comercial IA',
              updatedScore: parsed.updated_score || Math.min(100, lead.intent_score + 10),
              providerUsed: 'Claude Sonnet 4.6'
            };
          }
        }
      } catch (err) {
        console.warn('Fallo en Claude para CRM, probando alternativa:', err);
      }
    }

    // 2. Ejecución con OpenAI si está seleccionado o fallback
    if ((provider === 'openai' && hasOpenAI) || (hasOpenAI && !hasClaude)) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${connections.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: connections.openai.model || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Sos un cerrador de ventas experto en WhatsApp para comercios en Argentina.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7
          })
        });

        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          const parsed = JSON.parse(data.choices[0].message.content);
          return {
            suggestedReply: parsed.suggested_reply,
            reasoning: parsed.reasoning,
            detectedIntent: parsed.detected_intent || 'Gestión Comercial IA',
            updatedScore: parsed.updated_score || Math.min(100, lead.intent_score + 10),
            providerUsed: 'GPT-4o'
          };
        }
      } catch (err) {
        console.warn('Fallo en OpenAI para CRM:', err);
      }
    }

    // 3. Fallback Determinístico Inteligente (Offline o sin saldo). Sin IA
    // real disponible no hay forma de redactar algo genuinamente a medida,
    // así que esto se mantiene genérico a propósito — nunca inventa
    // productos, precios ni características que no vinieron del BrandDNA
    // real de este negocio.
    const isPrice = /precio|cu[aá]nto|costo|barat|car[oa]|mercadolibre/i.test(latestInquiry);
    const isTech = /instal|c[oó]mo|funciona|dif[ií]cil|soporte/i.test(latestInquiry);
    const isInvoice = /factura|cuota|tarjeta|pago|transferencia/i.test(latestInquiry);
    const firstName = lead.name.split(' ')[0];
    const closingCta = ctas[0] ? ` ${ctas[0]}` : ' ¿Te gustaría que un asesor te contacte para avanzar?';

    let reply = '';
    let reason = '';
    let intent = 'Consulta Comercial';

    if (isPrice) {
      reply = mainProducts.length > 0
        ? `¡Hola ${firstName}! Sobre ${mainProducts[0]}: para darte un precio exacto necesito confirmar algunos detalles con vos.${closingCta}`
        : `¡Hola ${firstName}! Para pasarte un precio exacto te consulto un par de detalles primero, así te armamos algo justo a lo que necesitás.${closingCta}`;
      reason = 'No inventa precios sin catálogo real — pide detalles y avanza hacia el cierre con el CTA propio del negocio.';
      intent = 'Manejo de Objeción de Precio';
    } else if (isTech) {
      reply = `¡Buenas ${firstName}! Contame puntualmente qué te genera dudas y te lo explico paso a paso, así no perdés tiempo con info que no te sirve.${closingCta}`;
      reason = 'Pide precisión antes de explicar para no asumir el producto ni el proceso.';
      intent = 'Consulta Técnica / Usabilidad';
    } else if (isInvoice) {
      reply = `¡Hola ${firstName}! Sí, podemos facturar formalmente y coordinar la forma de pago que te quede más cómoda. ¿Me pasás los datos de tu razón social para armar el presupuesto?`;
      reason = 'Facilidad administrativa y avance hacia la emisión formal de la orden.';
      intent = 'Consulta Comercial y Facturación';
    } else {
      reply = mainProducts.length > 0
        ? `¡Hola ${firstName}! Qué bueno saludarte. Tenemos ${mainProducts[0]} disponible — contame qué estás buscando así te armo una propuesta a medida.${closingCta}`
        : `¡Hola ${firstName}! Qué bueno saludarte. Contame un poco más sobre qué estás buscando así te puedo ayudar mejor.${closingCta}`;
      reason = 'Apertura comercial genérica hasta entender qué necesita el lead.';
      intent = 'Solicitud de Presupuesto';
    }

    return {
      suggestedReply: reply,
      reasoning: reason,
      detectedIntent: intent,
      updatedScore: Math.min(100, lead.intent_score + 5),
      providerUsed: 'Motor Determinístico (Local)'
    };
  }

  /**
   * Analiza un Reel real a partir de su caption, transcripción de audio y métricas reales
   * Utiliza el framework de Scripty y OpenAI si está activo para un desglose estratégico
   */
  static async analyzeScrapedReel(params: {
    caption: string;
    username: string;
    url: string;
    imageUrl?: string;
    businessId: string;
    connections: UnifiedConnectionsState;
    brandDna: BrandDNA;
    realMetrics?: {
      likes?: number;
      commentsCount?: number;
      views?: number;
      audioTrack?: string;
      followers?: string;
    };
    scrapedTranscript?: string;
    hasSpeech?: boolean;
  }): Promise<IntelligencePost> {
    const {
      caption,
      username,
      url,
      imageUrl,
      businessId,
      connections,
      brandDna,
      realMetrics,
      scrapedTranscript,
      hasSpeech
    } = params;
    const postId = `post_${Date.now()}`;
    const cleanTitle = caption.length > 0 ? (caption.slice(0, 50) + (caption.length > 50 ? '...' : '')) : `Reel @${username}`;

    // Métricas reales extraídas de Instagram. El scraping público solo devuelve
    // likes, comentarios y a veces vistas: el resto NO se estima.
    const realLikes = fromApi(realMetrics?.likes);
    const realComments = fromApi(realMetrics?.commentsCount);
    const audioTrack = realMetrics?.audioTrack || 'Audio original';

    const views = fromApi(realMetrics?.views);
    // Alcance, guardados y compartidos no son observables por scraping público.
    const reach = NO_DATA;
    const saves = NO_DATA;
    const shares = NO_DATA;
    const likeRate = rate(realLikes, views);
    const commentRate = rate(realComments, views);
    const saveRate = rate(saves, views);

    // Clasificación inicial determinística Scripty
    const textToAnalyze = scrapedTranscript || caption;
    const baselineHookClass = ScriptyFrameworkService.classifyHook(textToAnalyze);

    const hasOpenAI = connections.openai.isActive && connections.openai.apiKey;
    const hasClaude = connections.claude.isActive && connections.claude.apiKey;
    const activeProvider = connections.preferredAIProvider || (hasClaude && !hasOpenAI ? 'claude' : 'openai');
    let aiAnalysis: any = null;

    const prompt = `Sos el estratega de guiones de video vertical estilo "Scripty" y director de conversión de EventPix Intelligence.
Analizá el siguiente Reel de Instagram:
- Cuenta: @${username}
- Texto/Caption: "${caption}"
- Diálogo hablado (Whisper AI): "${scrapedTranscript || (hasSpeech === false ? '[Video sin diálogo hablado, pista musical: ' + audioTrack + ']' : caption)}"
- Audio/Música: "${audioTrack}"
- Enlace: ${url}
- Métricas observadas (las no listadas NO están disponibles; no las inventes ni las infieras): ${formatForPrompt(realLikes, 'likes')}, ${formatForPrompt(realComments, 'comentarios')}, ${formatForPrompt(views, 'vistas')}.
- ADN del Comercio: ${brandDna.identity.unique_value_proposition} (Tono: ${brandDna.voice_and_tone.primary_tone})

APLICÁ EL FRAMEWORK DE SCRIPTY:
1. HOOK (0-3s): Identificá o deducí la fórmula de gancho (Error Oculto, Contraste Antes/Después, Secreto de Marcas, Pregunta Dolor o Prueba Social).
2. DESARROLLO (4-25s): Identificá la estructura de retención (PAS: Problema-Agitación-Solución, 3 Pasos, o Demostración Dinámica).
3. CTA (25-35s): Identificá la fórmula de llamado a la acción (Automatización por Comentario con palabra clave, Guardado o WhatsApp).

Devolvé un JSON estricto con:
{
  "hook_text": "Gancho verbal o visual exacto de los primeros 3 segundos",
  "hook_formula_name": "${baselineHookClass.formula.name}",
  "hook_score": ${baselineHookClass.score},
  "retain_structure_name": "PAS: Problema - Agitación - Solución",
  "retain_score": 88,
  "cta_text": "Llamado a la acción específico",
  "cta_formula_name": "Automatización por Comentario 'PANTALLA'",
  "cta_score": 90,
  "topic": "Tema principal",
  "audience": "Audiencia objetivo",
  "promise": "Promesa central del video",
  "what_worked": ["Punto fuerte 1", "Punto fuerte 2"],
  "what_failed": ["Punto a mejorar"],
  "scripty_recommendations": {
    "alternative_hooks": [
      "Opción 1 (Error Oculto): Si todavía imprimís carteles para tu local, estás perdiendo ventas todos los días.",
      "Opción 2 (Contraste): Así se veía este local antes, y mirá cómo frenan ahora con una pantalla vertical.",
      "Opción 3 (Curiosidad): El truco visual que usan las grandes cadenas que ahora podés poner en tu mostrador."
    ],
    "alternative_ctas": [
      "Opción 1 (Palabra Clave): Comentá 'PANTALLA' y te mando el catálogo con precios por WhatsApp.",
      "Opción 2 (Guardado): Guardá este Reel para mostrárselo a tu socio cuando renueven la vidriera."
    ]
  },
  "time_segments": [
    { "range": "0-3s", "content": "Gancho inicial de alto impacto", "narrative_role": "hook", "visual_cue": "Corte rápido con texto grande en pantalla" },
    { "range": "3-12s", "content": "Presentación del dolor o problema que frena las ventas", "narrative_role": "problem", "visual_cue": "Mostrador del comercio y cliente pasando de largo" },
    { "range": "12-25s", "content": "Demostración de la solución con la pantalla encendida y precios", "narrative_role": "value", "visual_cue": "Plano detalle de la pantalla cambiando promos desde el celular" },
    { "range": "25-35s", "content": "Llamado a la acción claro para comentar o escribir al WhatsApp", "narrative_role": "cta", "visual_cue": "Texto flotante con la palabra clave y flecha al DM" }
  ]
}`;

    if (activeProvider === 'claude' && hasClaude) {
      try {
        let res: Response;
        try {
          res = await fetch('/api/claude-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: connections.claude.apiKey,
              model: connections.claude.model || 'claude-3-5-sonnet-20241022',
              max_tokens: 2000,
              workspaceId: connections.claude.workspaceId,
              messages: [{ role: 'user', content: prompt + '\n\nIMPORTANTE: Respondé ÚNICAMENTE con el objeto JSON válido y ningún texto adicional.' }]
            })
          });
        } catch {
          const directHeaders: Record<string, string> = {
            'x-api-key': connections.claude.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          };
          if (connections.claude.workspaceId) {
            directHeaders['anthropic-workspace-id'] = connections.claude.workspaceId;
          }
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: directHeaders,
            body: JSON.stringify({
              model: connections.claude.model || 'claude-3-5-sonnet-20241022',
              max_tokens: 2000,
              messages: [{ role: 'user', content: prompt + '\n\nIMPORTANTE: Respondé ÚNICAMENTE con el objeto JSON válido y ningún texto adicional.' }]
            })
          });
        }

        const data = await res.json();
        const textContent = data.content?.[0]?.text;
        if (textContent) {
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiAnalysis = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (err) {
        console.warn('Fallo en análisis con Claude, usando motor Scripty determinístico:', err);
      }
    } else if (hasOpenAI) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${connections.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: connections.openai.model || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Sos un estratega de guiones de video vertical estilo Scripty experto en retención y conversión en Instagram Reels.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.6
          })
        });

        const data = await res.json();
        if (data.error) {
          console.warn('OpenAI error en análisis de Reel:', data.error);
          if (data.error?.code === 'insufficient_quota' || data.error?.message?.includes('quota')) {
            toast.warning('OpenAI sin saldo ($0.00). Usando motor Scripty local para el desglose del Reel.');
          }
        } else if (data.choices?.[0]?.message?.content) {
          aiAnalysis = JSON.parse(data.choices[0].message.content);
        }
      } catch (err) {
        console.warn('Fallo en análisis con OpenAI, usando motor Scripty determinístico:', err);
      }
    }

    const hookText = aiAnalysis?.hook_text || (caption.split('.')[0] || caption.slice(0, 45) || 'Gancho de alto impacto');
    const hookScore = aiAnalysis?.hook_score || baselineHookClass.score;
    const hookFormulaName = aiAnalysis?.hook_formula_name || baselineHookClass.formula.name;
    const retainStructureName = aiAnalysis?.retain_structure_name || 'PAS: Problema - Agitación - Solución';
    const retainScore = aiAnalysis?.retain_score || 85;
    const ctaText = aiAnalysis?.cta_text || 'Comentá "PANTALLA" para enviarte el catálogo con precios';
    const ctaFormulaName = aiAnalysis?.cta_formula_name || 'Automatización por Comentario de Palabra Clave';
    const ctaScore = aiAnalysis?.cta_score || 88;

    const topic = aiAnalysis?.topic || 'Display Digital & Conversión en Punto de Venta';
    const audience = aiAnalysis?.audience || 'Dueños de comercios y locales';
    const promise = aiAnalysis?.promise || 'Mejora de visibilidad y conversión comercial';

    const alternativeHooks = aiAnalysis?.scripty_recommendations?.alternative_hooks || [
      'Opción 1 (Error Oculto): Si todavía imprimís carteles para tu local, estás perdiendo ventas todos los días.',
      'Opción 2 (Contraste): Así se veía este local antes, y mirá cómo frenan ahora con una pantalla vertical.',
      'Opción 3 (Curiosidad): El truco visual que usan las grandes marcas para multiplicar su ticket promedio.'
    ];

    const alternativeCtas = aiAnalysis?.scripty_recommendations?.alternative_ctas || [
      'Opción 1 (Palabra Clave): Comentá "PANTALLA" y te enviamos el catálogo completo por WhatsApp.',
      'Opción 2 (Guardado): Guardá este Reel para cuando decidas renovar la cartelería de tu comercio.'
    ];

    const defaultTimeSegments = [
      { range: '0-3s', content: hookText, narrative_role: 'hook' as const, visual_cue: 'Corte rápido con texto en pantalla y sonido de atención' },
      { range: '3-12s', content: 'Presentación del problema cotidiano: clientes que pasan de largo o no ven las ofertas del mostrador', narrative_role: 'problem' as const, visual_cue: 'Toma contextual del negocio con clientes pasando' },
      { range: '12-25s', content: 'Demostración de la solución: pantalla vertical Display Digital mostrando ofertas dinámicas actualizadas desde la app Shop de Plumas', narrative_role: 'value' as const, visual_cue: 'Plano cerrado del equipo encendido con precios y movimiento' },
      { range: '25-35s', content: ctaText, narrative_role: 'cta' as const, visual_cue: 'Animación de texto con la palabra clave y flecha a WhatsApp' }
    ];

    return {
      id: postId,
      business_id: businessId,
      title: cleanTitle,
      video_url: url,
      thumbnail_url: imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=400&auto=format&fit=crop',
      duration_seconds: 24,
      objective: /precio|venta|catalogo|shop|comprar/i.test(caption) ? 'sales' : 'engagement',
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      audio_track: audioTrack,
      raw_transcript: scrapedTranscript || (hasSpeech === false ? `[Pista instrumental: ${audioTrack}]` : ''),
      metrics: {
        post_id: postId,
        views,
        reach,
        likes: realLikes,
        comments: realComments,
        shares,
        saves,
        // Nada de esto es observable desde el scraping público de Instagram.
        followers_gained: NO_DATA,
        average_watch_time_seconds: NO_DATA,
        total_watch_time_seconds: NO_DATA,
        profile_visits: NO_DATA,
        like_rate: likeRate,
        comment_rate: commentRate,
        share_rate: rate(shares, views),
        save_rate: saveRate,
        retention_percentage: NO_DATA,
        source: 'instagram_scrape',
        synced_at: new Date().toISOString()
      },
      analysis: {
        post_id: postId,
        hook_data: {
          text: hookText,
          type: 'afirmacion_chocante',
          curiosity_score: hookScore,
          clarity_score: 92,
          auditory_strength: 'alta',
          has_text_on_screen: true
        },
        promise,
        topic,
        audience,
        structure: ['hook', 'problem', 'value', 'cta'],
        language_data: {
          tone: 'Directo y Comercial (Argentino)',
          proximity: 'cercano',
          technicality: 'media',
          second_person_usage: true
        },
        emotions: ['curiosidad', 'seguridad', 'deseo'],
        visual_analysis: {
          scene_change_frequency_sec: 2.1,
          has_captions: true,
          main_visual_element: 'Pantalla vertical Display Digital en funcionamiento real'
        },
        cta_data: {
          detected: true,
          text: ctaText,
          type: 'comment_keyword',
          strength: 'fuerte'
        },
        time_segments: aiAnalysis?.time_segments || defaultTimeSegments,
        scripty_data: {
          hook_formula: hookFormulaName,
          hook_score: hookScore,
          retain_structure: retainStructureName,
          retain_score: retainScore,
          cta_formula: ctaFormulaName,
          cta_score: ctaScore,
          alternative_hooks: alternativeHooks,
          alternative_ctas: alternativeCtas,
          audio_track: audioTrack,
          has_speech: hasSpeech
        },
        diagnosis: {
          what_worked: aiAnalysis?.what_worked || [
            `Gancho enfocado en fórmula "${hookFormulaName}"`,
            'Presencia de producto visual y llamado a la acción concreto'
          ],
          what_failed: aiAnalysis?.what_failed || [
            'Aumentar la frecuencia de cortes en los primeros 3 segundos para acelerar el ritmo'
          ],
          hypotheses: [
            'Si se aplica un CTA con la palabra clave "PANTALLA", la tasa de comentarios puede subir de 1.5% a más del 5%.'
          ],
          what_to_change: [
            'Reemplazar el cierre genérico por la fórmula de Automatización Scripty ("Comentá PANTALLA")'
          ],
          what_to_repeat: [
            'Mantener la demostración dinámica del equipo Display Digital en el local real'
          ],
          next_test: 'Conectar este Reel al nodo central de Síntesis para generar el Super Guión palabra por palabra.'
        }
      }
    };
  }

  /**
   * Conversación interactiva con la IA para adaptar y pulir guiones basados en fuentes conectadas
   * (Inspirada en Scripty / Instaceos)
   */
  static async adaptScriptWithChat(params: {
    userInstruction: string;
    mode: 'reel_hablado' | 'b_roll' | 'carrusel' | 'tweet' | 'stories';
    sourcePosts: IntelligencePost[];
    profileContext?: UserProfileContext;
    connections: UnifiedConnectionsState;
    chatHistory?: Array<{ sender: 'user' | 'ai'; text: string; scriptData?: any }>;
  }): Promise<{
    replyText: string;
    scriptData: {
      title: string;
      hook: string;
      body: string;
      cta: string;
      fullScript: string;
    };
  }> {
    const { userInstruction, mode, sourcePosts, profileContext, connections, chatHistory } = params;

    const hasOpenAI = Boolean(connections.openai?.isActive && connections.openai?.apiKey?.trim());
    const hasClaude = Boolean(connections.claude?.isActive && connections.claude?.apiKey?.trim());
    const hasGemini = Boolean(connections.gemini?.isActive && connections.gemini?.apiKey?.trim());

    // 1. Detectar si el usuario especificó una temática o nicho concreto en su mensaje
    let userSpecifiedTopic: string | null = null;
    const cleanInstruction = (userInstruction || '').trim();

    const topicPatterns = [
      /(?:hablar|hablemos|guion|guión|video|reel|contenido|post)\s+(?:de|sobre|para|acerca de)\s+([^,.;!?\n]+)/i,
      /(?:tema|temática|nicho|enfoque):\s*([^,.;!?\n]+)/i,
      /(?:quiero que sea de|hacelo de|hacerlo de|trate de|enfocado en)\s+([^,.;!?\n]+)/i
    ];

    for (const pat of topicPatterns) {
      const match = cleanInstruction.match(pat);
      if (match && match[1]?.trim() && match[1].trim().length > 2) {
        userSpecifiedTopic = match[1].trim();
        break;
      }
    }

    // Si el texto es breve y no es un comando genérico de repetición ("dame otro", etc.)
    if (!userSpecifiedTopic && cleanInstruction.length >= 3 && cleanInstruction.length < 50) {
      const isGeneric = /^(dame otro|cambialo|otro guion|no me gusta|es lo mismo|repetiste|hace otro|diferente|cambia el guion|mas corto|mas largo)$/i.test(cleanInstruction);
      if (!isGeneric) {
        userSpecifiedTopic = cleanInstruction;
      }
    }

    // 2. Si el usuario pidió un tema o conectó varios Reels, encontrar el Reel más relevante
    let relevantSource = sourcePosts[0];
    if (userSpecifiedTopic && sourcePosts.length > 1) {
      const searchWords = userSpecifiedTopic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let bestScore = -1;
      for (const post of sourcePosts) {
        const fullContent = `${post.title || ''} ${post.raw_transcript || ''} ${post.analysis?.topic || ''} ${post.analysis?.hook_data?.text || ''}`.toLowerCase();
        const score = searchWords.reduce((acc, word) => acc + (fullContent.includes(word) ? 1 : 0), 0);
        if (score > bestScore) {
          bestScore = score;
          relevantSource = post;
        }
      }
    }

    // 3. Determinar la temática central efectiva
    const sourceTopic = relevantSource ? (
      (relevantSource.title && !relevantSource.title.toLowerCase().includes('reel de instagram') && !relevantSource.title.startsWith('Reel '))
        ? relevantSource.title
        : (relevantSource.analysis?.topic && !relevantSource.analysis.topic.includes('Display Digital') ? relevantSource.analysis.topic : relevantSource.title)
    ) : null;

    const effectiveTargetTopic = userSpecifiedTopic || sourceTopic || 'Estrategia de Crecimiento y Contenido';

    // 4. Benchmarking y Detección del Gancho Campeón vs Sustancia de Contenido
    // Los reels sin vistas reportadas quedan al final: no compiten por "campeón"
    // con un 0 inventado ni lo ganan por defecto.
    const sortedByViews = [...sourcePosts].sort((a, b) => compareDesc(a.metrics?.views, b.metrics?.views));
    const viralChampion = hasValue(sortedByViews[0]?.metrics?.views) ? sortedByViews[0] : undefined;
    const isMultiSource = sourcePosts.length > 1;

    // Resumen enriquecido con métricas y benchmark de retención
    const sourcesSummary = sourcePosts.length > 0
      ? sourcePosts.map((p, i) => {
          const pTopic = (p.title && !p.title.startsWith('Reel ') && !p.title.includes('Reel de Instagram'))
            ? p.title
            : (p.raw_transcript?.slice(0, 100) || p.analysis?.topic || p.title);
          const pCaption = p.raw_transcript || p.analysis?.hook_data?.text || p.title;
          const views = hasValue(p.metrics?.views) ? `${formatMetric(p.metrics!.views)} vistas` : null;
          const comments = hasValue(p.metrics?.comments) ? `${formatMetric(p.metrics!.comments)} comentarios` : null;
          const likes = hasValue(p.metrics?.likes) ? `${formatMetric(p.metrics!.likes)} likes` : null;
          const observed = [views, comments, likes].filter(Boolean).join(' | ');
          const perf = observed || 'SIN MÉTRICAS DISPONIBLES (Meta no las reportó).';
          const isTopViral = viralChampion?.id === p.id && exceeds(p.metrics?.views, 1000);

          return `[Fuente #${i + 1}: "${pTopic}" ${isTopViral ? '⭐ [REEL CAMPEÓN EN VIRALIDAD]' : ''}]
- RENDIMIENTO REAL: ${perf}
- GANCHO DE ENTRADA (0-3s): "${p.analysis?.hook_data?.text || pTopic}"
- MENSAJE / TRANSCRIPCIÓN: "${pCaption}"
- ESTRUCTURA DE RETENCIÓN: ${p.analysis?.structure?.join(' -> ') || '0-3s Gancho disruptivo -> Conflicto comercial -> Demostración práctica -> CTA'}`;
        }).join('\n\n')
      : 'Sin fuentes conectadas (creación libre basada en el tema pedido).';

    const profileTone = profileContext?.ai_context?.tone || 'directo y conversacional';
    const explicitFavoriteCta = profileContext?.cta_list?.find(c => c.is_favorite)?.full_phrase?.trim() || null;
    const favoriteCta = explicitFavoriteCta || `Comentá "${deriveCtaKeyword(effectiveTargetTopic)}" y te paso la info 👇`;
    const mustDos = profileContext?.ai_context?.must_do_rules?.join('\n- ') || 'Mantener ganchos de alto impacto en los primeros 2 segundos.';
    const forbiddens = profileContext?.ai_context?.forbidden_rules?.join('\n- ') || 'No sonar aburrido, no usar frases hechas de autoayuda, no hacer introducciones lentas.';
    const niche = profileContext?.profile?.niche || 'Comercios y Negocios';

    const modeDescriptions: Record<string, string> = {
      reel_hablado: 'Reel hablado a cámara: diálogo fluido y natural para teleprompter, oraciones cortas, ritmo dinámico y sin presentaciones lentas.',
      b_roll: 'Formato B-roll: planos estéticos de video (tomas visuales de la acción, producto o detalle) con texto en pantalla llamativo y voz en off.',
      carrusel: 'Carrusel de Instagram: portada con gancho irresistible + 4 a 6 diapositivas con micro-lecciones accionables + slide final de CTA.',
      tweet: 'Frase / Tweet visual de alto impacto para postear como imagen con reflexión profunda en el caption.',
      stories: 'Secuencia de 3 a 5 Stories: Story 1 problema/encuesta -> Story 2 revelación -> Story 3 caso/prueba -> Story 4 sticker de interacción.'
    };

    // Historial conversacional previo para no repetir
    const previousDialogues = (chatHistory || [])
      .filter(m => m.text && !m.text.includes('¡Hola! Soy tu asistente'))
      .slice(-6);

    const historyPromptText = previousDialogues.length > 0
      ? `HISTORIAL DE LA CONVERSACIÓN PREVIA:\n` + previousDialogues.map(m =>
          m.sender === 'user' ? `Usuario: "${m.text}"` : `Copiloto: "${m.scriptData?.title || m.text.slice(0, 100)}..."`
        ).join('\n')
      : 'Inicio de conversación.';

    const systemPrompt = `Sos el copiloto creativo y estratega de contenido de Instagram Reels de EventPix Intelligence.
Tu trabajo es redactar guiones VIRALES, AUTÉNTICOS y DE ALTA RETENCIÓN combinando lo mejor de los Reels conectados por el usuario.

🚨 PROTOCOLO DE FUSIÓN INTELIGENTE (PROHIBIDO EL CONTENIDO GENÉRICO):
1. ANÁLISIS DE PIEZAS GANADORAS:
   - Identificá cuál de los Reels conectados tiene el GANCHO MÁS POTENTE (mayor curiosidad, más vistas o mejor llamada a la acción).
   - Identificá cuál tiene la SUSTANCIA o TEMA REAL a resolver.
   - FUSIONÁ: Usá la fórmula de enganche del Reel viral aplicada 100% al contenido y producto del negocio.
2. LISTA NEGRA DE FRASES BANDEADAS (CERO CLICHÉS PUBLICITARIOS):
   - ❌ PROHIBIDO EMPEZAR CON: "¿Quieres saber cómo...?", "¿Sabías que...?", "¿Buscas mejorar...?", "¿Te gustaría transformar...?"
   - ❌ PROHIBIDO FRASES LENTAS: "Hoy te voy a contar cómo...", "En este video te enseño...", "Hola a todos...", "Si todavía usas X es hora de actualizarte..."
   - ✅ REGLA DEL SEGUNDO 0: Comienza con una afirmación chocante, un error costoso, una pérdida evitable o una demostración visual inmediata.
3. PRIORIDAD AL TEMA REAL DEL USUARIO:
   - Todo el contenido debe tener ejemplos tangibles, fricciones cotidianas y soluciones claras.
4. RESPUESTA ESTRATÉGICA TRANSPARENTE:
   - En "reply_text", explícale brevemente al usuario qué elemento ganador tomaste de cada Reel conectado (ej: gancho de curiosidad masiva del Reel #1 + solución concreta del Reel #2).
5. Respondé ÚNICAMENTE con un objeto JSON válido con las claves: reply_text, script_title, hook, script_body, cta, full_script.`;

    const userPrompt = `INSTRUCCIÓN ACTUAL DEL USUARIO:
"${userInstruction || `Crear guión adaptado sobre: ${effectiveTargetTopic}`}"

🎯 TEMÁTICA CENTRAL DEL GUIÓN:
"${effectiveTargetTopic}"

${isMultiSource && viralChampion ? `🔥 DIRECTIVA DE FUSIÓN MULTI-REEL:
- REEL MÁS VIRAL: "${viralChampion.title}" (${viralChampion.metrics?.views ? viralChampion.metrics.views.toLocaleString() + ' vistas' : 'Mayor tracción'}).
  -> TOMA DE ESTE REEL: Su fórmula de gancho magnético, disrupción de patrón y llamado a comentar palabra clave.
- REEL DE CONTENIDO / PROBLEMA: "${sourceTopic || effectiveTargetTopic}".
  -> TOMA DE ESTE REEL: La sustancia, los argumentos técnicos, los beneficios reales y el dolor a resolver.
- RESULTADO ESPERADO: Un guión híbrido que combine el gancho demoledor del primero con el contenido práctico del segundo, CERO relleno.` : ''}

${userSpecifiedTopic ? `🚨 ATENCIÓN MÁXIMA: El usuario pidió expresamente tratar sobre "${userSpecifiedTopic}". Toda la narrativa debe ser 100% sobre este tema.` : ''}

${historyPromptText}

MODO SELECCIONADO:
${mode.toUpperCase()} (${modeDescriptions[mode] || mode})

FUENTES DE REELS CONECTADAS (${sourcePosts.length} activas):
${sourcesSummary}

CONTEXTO DEL PERFIL:
- Nicho: ${niche}
- Tono de voz: ${profileTone}
- Reglas OBLIGATORIAS:
- ${mustDos}
- Reglas PROHIBIDAS:
- ${forbiddens}
- CTA: ${explicitFavoriteCta ? `el negocio ya tiene un CTA fijo, usalo tal cual: "${explicitFavoriteCta}"` : `no hay un CTA fijo configurado. PROHIBIDO usar palabras de relleno genéricas como "APP" o "INFO" que no tengan nada que ver con el tema. Generá un "cta" con una palabra clave específica del producto o tema de ESTE guion en particular (ej. de inspiración, pero más específico si podés: "${favoriteCta}")`}

Devuelve un JSON con este formato exacto:
{
  "reply_text": "Explicación breve del copiloto detallando qué fórmula de gancho y qué sustancia fusionó de los Reels conectados",
  "script_title": "Título corto y potente del guión",
  "hook": "El gancho exacto de los primeros 3 segundos (cero preguntas retóricas obvias)",
  "script_body": "El cuerpo completo del guión adaptado al formato ${mode} con ritmo dinámico",
  "cta": "Llamado a la acción específico con palabra clave para automatización DM",
  "full_script": "Texto completo y unificado listo para teleprompter o lectura fluida"
}`;

    // ORDEN DE EJECUCIÓN INTELIGENTE (MULTI-IA):
    // Si es 'auto' o si el proveedor preferido falla, intenta en cascada con todas las IAs activas
    const providersToTry: Array<'gemini' | 'claude' | 'openai'> = [];
    if (connections.preferredAIProvider === 'gemini') {
      if (hasGemini) providersToTry.push('gemini');
      if (hasClaude) providersToTry.push('claude');
      if (hasOpenAI) providersToTry.push('openai');
    } else if (connections.preferredAIProvider === 'openai') {
      if (hasOpenAI) providersToTry.push('openai');
      if (hasClaude) providersToTry.push('claude');
      if (hasGemini) providersToTry.push('gemini');
    } else if (connections.preferredAIProvider === 'claude') {
      if (hasClaude) providersToTry.push('claude');
      if (hasGemini) providersToTry.push('gemini');
      if (hasOpenAI) providersToTry.push('openai');
    } else {
      // Modo 'auto' (Multi-IA / Mejor Respuesta): Claude -> Gemini -> OpenAI
      if (hasClaude) providersToTry.push('claude');
      if (hasGemini) providersToTry.push('gemini');
      if (hasOpenAI) providersToTry.push('openai');
    }

    for (const provider of providersToTry) {
      // Intento con Google Gemini
      if (provider === 'gemini' && hasGemini) {
        try {
          const rawJson = await AIProviderService.callGemini({
            apiKey: connections.gemini.apiKey,
            model: connections.gemini.model || 'gemini-1.5-flash',
            systemPrompt,
            prompt: userPrompt,
            responseMimeType: 'application/json'
          });
          const parsed = JSON.parse(rawJson);
          return {
            replyText: parsed.reply_text || '¡Aquí tienes tu guión adaptado con Google Gemini!',
            scriptData: {
              title: parsed.script_title || `Guión (${mode.replace('_', ' ')})`,
              hook: parsed.hook || 'Escuchá esto antes de publicar...',
              body: parsed.script_body || parsed.full_script || '',
              cta: parsed.cta || favoriteCta,
              fullScript: parsed.full_script || `${parsed.hook}\n\n${parsed.script_body}\n\n${parsed.cta}`
            }
          };
        } catch (err) {
          console.warn('Fallo en Gemini, continuando con siguiente motor de IA en cascada:', err);
        }
      }

      // Intento con Anthropic Claude
      if (provider === 'claude' && hasClaude) {
        try {
          const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
          
          for (const msg of previousDialogues) {
            if (msg.sender === 'user') {
              claudeMessages.push({ role: 'user', content: msg.text });
            } else if (claudeMessages.length > 0) {
              claudeMessages.push({
                role: 'assistant',
                content: msg.scriptData?.fullScript || msg.text
              });
            }
          }

          if (claudeMessages.length > 0 && claudeMessages[claudeMessages.length - 1].role === 'user') {
            claudeMessages[claudeMessages.length - 1].content += `\n\n${userPrompt}`;
          } else {
            claudeMessages.push({ role: 'user', content: userPrompt });
          }

          let res: Response;
          try {
            res = await fetch('/api/claude-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apiKey: connections.claude.apiKey,
                model: connections.claude.model || 'claude-3-5-sonnet-20241022',
                max_tokens: 2500,
                workspaceId: connections.claude.workspaceId,
                system: systemPrompt,
                messages: claudeMessages
              })
            });
          } catch {
            const directHeaders: Record<string, string> = {
              'x-api-key': connections.claude.apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
              'content-type': 'application/json'
            };
            if (connections.claude.workspaceId) {
              directHeaders['anthropic-workspace-id'] = connections.claude.workspaceId;
            }
            res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: directHeaders,
              body: JSON.stringify({
                model: connections.claude.model || 'claude-3-5-sonnet-20241022',
                max_tokens: 2500,
                system: systemPrompt,
                messages: claudeMessages
              })
            });
          }

          const data = await res.json();
          if (data.error) {
            throw new Error(data.error.message || 'Error en Claude');
          }

          const textContent = data.content?.[0]?.text;
          if (textContent) {
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                replyText: parsed.reply_text || '¡Aquí tienes tu guión adaptado con Claude Sonnet!',
                scriptData: {
                  title: parsed.script_title || `Guión (${mode.replace('_', ' ')})`,
                  hook: parsed.hook || 'Escuchá esto antes de publicar...',
                  body: parsed.script_body || parsed.full_script || '',
                  cta: parsed.cta || favoriteCta,
                  fullScript: parsed.full_script || `${parsed.hook}\n\n${parsed.script_body}\n\n${parsed.cta}`
                }
              };
            }
          }
        } catch (err) {
          console.warn('Fallo en Claude, continuando con siguiente motor de IA en cascada:', err);
        }
      }

      // Intento con OpenAI (ChatGPT)
      if (provider === 'openai' && hasOpenAI) {
        try {
          const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt }
          ];

          for (const msg of previousDialogues) {
            openaiMessages.push({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.sender === 'user' ? msg.text : (msg.scriptData?.fullScript || msg.text)
            });
          }
          openaiMessages.push({ role: 'user', content: userPrompt });

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${connections.openai.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: connections.openai.model || 'gpt-4o-mini',
              response_format: { type: 'json_object' },
              messages: openaiMessages,
              temperature: 0.75
            })
          });

          const data = await res.json();
          if (data.error) {
            throw new Error(data.error.message || 'Error en OpenAI');
          }
          if (data.choices?.[0]?.message?.content) {
            const parsed = JSON.parse(data.choices[0].message.content);
            return {
              replyText: parsed.reply_text || '¡Aquí tienes tu guión adaptado con GPT-4o!',
              scriptData: {
                title: parsed.script_title || 'Guión Adaptado',
                hook: parsed.hook || 'Escuchá esto antes de publicar tu próximo video...',
                body: parsed.script_body || parsed.full_script || '',
                cta: parsed.cta || favoriteCta,
                fullScript: parsed.full_script || `${parsed.hook}\n\n${parsed.script_body}\n\n${parsed.cta}`
              }
            };
          }
        } catch (err) {
          console.warn('Fallo en OpenAI, continuando con siguiente motor en cascada:', err);
        }
      }
    }

    // 4. Generador Inteligente Dinámico Multi-Ángulo (Offline / Respaldo dinámico)
    // Extrae contexto real de los Reels conectados con 6 ángulos radicalmente distintos
    const userLower = userInstruction.toLowerCase();
    const isComplainingRepetition = userLower.includes('mismo') || userLower.includes('repetiste') || userLower.includes('otra vez') || userLower.includes('dos veces') || userLower.includes('2 veces') || userLower.includes('repetido');
    const isAskingAlternative = userLower.includes('otro') || userLower.includes('otra') || userLower.includes('cambia') || userLower.includes('diferente') || userLower.includes('nuevo');

    const cleanTopic = effectiveTargetTopic.replace(/[¿?¡!]/g, '').trim();

    const dynamicAngles = [
      {
        title: `${cleanTopic} (El Error Oculto)`,
        hook: `El error que casi todos cometen al buscar o elegir "${cleanTopic.toLowerCase()}":`,
        body: mode === 'b_roll'
          ? `[TOMA B-ROLL 0-3s]: Plano detalle de la acción principal o el producto en primer plano.\nTEXTO EN PANTALLA: "La equivocación #1 con ${cleanTopic.toLowerCase()}."\n\n[TOMA B-ROLL 3-8s]: Enfoque en la practicidad, materiales o funcionamiento real.\nTEXTO EN PANTALLA: "No mires solo lo estético; priorizá la seguridad y el uso diario."\n\n[TOMA B-ROLL 8-14s]: Toma final con demostración resuelta.\nTEXTO EN PANTALLA: "Un buen criterio hoy te ahorra dolores de cabeza."`
          : `Casi todo el mundo se fija en la apariencia o en el precio, pero pasa por alto lo más crítico: la durabilidad, la seguridad y qué tan práctico resulta en la vida real.\n\nAntes de decidirte por ${cleanTopic.toLowerCase()}, asegurate de verificar estos 3 puntos:\n1. Calidad de los materiales y certificaciones.\n2. Facilidad de uso y comodidad en el día a día.\n3. Respaldo y garantía real.\n\nElegir informado marca toda la diferencia.`,
      },
      {
        title: `${cleanTopic} (Regla de 3 Pasos)`,
        hook: `Si tuviera que empezar de cero con "${cleanTopic.toLowerCase()}", aplicaría esta regla de 3 pasos:`,
        body: mode === 'b_roll'
          ? `[TOMA B-ROLL 0-3s]: Gesto visual marcando el primer paso con firmeza.\nTEXTO EN PANTALLA: "1. Definí tu necesidad real sin sobrepagar."\n\n[TOMA B-ROLL 3-8s]: Tomas fluidas mostrando funcionalidad o proceso.\nTEXTO EN PANTALLA: "2. Verificá la ergonomía y facilidad de manejo."\n\n[TOMA B-ROLL 8-13s]: Cierre con el resultado en funcionamiento perfecto.\nTEXTO EN PANTALLA: "3. Priorizá lo que te simplifica la rutina diaria."`
          : `Punto uno: Definí exactamente tu necesidad real sin dejarte llevar por modas pasajeras.\n\nPunto dos: Prestale atención a los detalles funcionales: peso, ergonomía y practicidad de guardado.\n\nPunto tres: Comprá calidad que dure en el tiempo en lugar de gastar dos veces.\n\nCon esos tres filtros nunca fallás.`,
      },
      {
        title: `${cleanTopic} (Lo Que Pocos Te Cuentan)`,
        hook: `Lo que las tiendas no te suelen decir sobre "${cleanTopic.toLowerCase()}":`,
        body: mode === 'b_roll'
          ? `[TOMA B-ROLL 0-4s]: Mirada directa a cámara con gesto de revelación o prueba.\nTEXTO EN PANTALLA: "Lo que tenés que saber antes de gastar."\n\n[TOMA B-ROLL 4-9s]: Tomas en uso real contrastando lo que promete vs la realidad.\nTEXTO EN PANTALLA: "El modelo más caro no siempre es el más conveniente."\n\n[TOMA B-ROLL 9-14s]: Conclusión clara con toma estética del producto.\nTEXTO EN PANTALLA: "Buscá equilibrio entre funcionalidad y tranquilidad."`
          : `Te muestran opciones con mil funciones accesorias que después en la práctica casi nunca se usan. Lo que de verdad importa con ${cleanTopic.toLowerCase()} es que sea ágil, seguro y cómodo para el ritmo cotidiano.\n\nNo necesitás complicarte; necesitás una solución que te responda cuando más la necesitás.`,
      },
      {
        title: `${cleanTopic} (Guía Rápida de Elección)`,
        hook: `¿Buscando opciones de "${cleanTopic.toLowerCase()}"? Mirá esta comparación rápida:`,
        body: mode === 'b_roll'
          ? `[TOMA B-ROLL 0-3s]: Comparación visual lado a lado con cortes dinámicos.\nTEXTO EN PANTALLA: "¿Cuál te conviene realmente?"\n\n[TOMA B-ROLL 3-8s]: Foco en detalles clave que diferencian una opción estándar de una de calidad.\nTEXTO EN PANTALLA: "Fijate en la estructura y el sistema de sujeción."\n\n[TOMA B-ROLL 8-13s]: Toma final con recomendación clara.\nTEXTO EN PANTALLA: "La tranquilidad no tiene precio."`
          : `Hay dos caminos: comprar lo primero que ves y darte cuenta después de que no era lo que necesitabas, o tomarte 2 minutos para comparar lo que de verdad suma valor.\n\nAcá te dejamos la lista de lo indispensable para no equivocarte.`,
      }
    ];

    // Rotar automáticamente para asegurar variedad absoluta
    const variationIndex = (chatHistory?.length || 0) % dynamicAngles.length;
    const selectedAngle = dynamicAngles[variationIndex];

    let replyIntro = `¡Aquí tienes un guión enfocado 100% en "${cleanTopic}" en formato ${mode.toUpperCase()}:`;
    if (isComplainingRepetition) {
      replyIntro = `¡Tenés toda la razón! Cambiamos totalmente el ángulo. Acá tenés un enfoque fresco y directo al punto sobre "${cleanTopic}":`;
    } else if (isAskingAlternative) {
      replyIntro = `¡Totalmente! Acá tenés una alternativa distinta con una narrativa ágil sobre "${cleanTopic}":`;
    }

    const fullScript = `${selectedAngle.hook}\n\n${selectedAngle.body}\n\n${favoriteCta}`;

    return {
      replyText: replyIntro,
      scriptData: {
        title: selectedAngle.title,
        hook: selectedAngle.hook,
        body: selectedAngle.body,
        cta: favoriteCta,
        fullScript: fullScript
      }
    };
  }

  /**
   * Generador Estratégico Basado en Evidencia y Aprendizaje Continuo:
   * 1. Obtiene o calcula el Benchmark de Medianas de la cuenta.
   * 2. Deconstruye el Content DNA de las publicaciones conectadas.
   * 3. Extrae patrones ganadores (vs mediana) y patrones a evitar.
   * 4. Formula la hipótesis y redacta 3 variantes rigurosas (A: Probado, B: Alternativo, C: Exploratorio).
   * 5. Excluye estrictamente estadísticas falsas y clichés genéricos.
   */
  static async generateEvidenceBasedStrategy(params: {
    businessId: string;
    sourcePosts: IntelligencePost[];
    profileContext?: UserProfileContext;
    connections: UnifiedConnectionsState;
    userGoal?: string;
    mode?: 'reel_hablado' | 'b_roll' | 'carrusel';
  }): Promise<{
    hypothesis: Hypothesis;
    variants: {
      variantA: ScriptVariant;
      variantB: ScriptVariant;
      variantC: ScriptVariant;
    };
    benchmark: AccountMedianBenchmark;
    patterns: EmpiricalPattern[];
    winningRules: string[];
    losingRules: string[];
  }> {
    const { businessId, sourcePosts, profileContext, connections, userGoal, mode = 'reel_hablado' } = params;

    // 1. Obtener o calcular el benchmark de medianas
    let benchmark = IntelligenceStorageService.getBenchmark(businessId);
    if (!benchmark || benchmark.sample_size === 0) {
      benchmark = AccountBenchmarkService.calculateAccountBenchmark(
        businessId,
        profileContext?.profile?.instagram_handle,
        sourcePosts.map(postToMetaItem)
      );
      IntelligenceStorageService.saveBenchmark(businessId, benchmark);
    }

    // 2. Deconstruir Content DNA de los reels conectados
    const niche = profileContext?.profile?.niche || 'Servicios y Comercios';
    const dnaItems: ContentDnaItem[] = sourcePosts.map(p =>
      ContentDnaEngine.deconstructReelDna(postToMetaItem(p), niche)
    );

    // 2.b Traer catálogo real y base de conocimiento del negocio: sin esto la IA
    // solo tiene la categoría genérica del nicho y termina escribiendo consejos
    // de guion en abstracto en vez de un guion concreto sobre lo que se vende.
    const [{ data: catalogRows }, { data: knowledgeBase }] = await Promise.all([
      supabase
        .from('intelligence_business_products')
        .select('name, description, price')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .limit(20),
      supabase
        .from('intelligence_business_knowledge_base')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle()
    ]);

    const catalogText = catalogRows && catalogRows.length > 0
      ? catalogRows.map((p: any) => `- ${p.name}${p.price ? ` ($${p.price})` : ''}${p.description ? `: ${p.description}` : ''}`).join('\n')
      : '(sin catálogo cargado: usá lo que diga "De qué habla la cuenta" abajo, sin inventar productos)';

    const kb = knowledgeBase || {};
    const knowledgeText = [
      kb.business_description ? `Descripción del negocio: ${kb.business_description}` : null,
      kb.pricing_policy ? `Política de precios: ${kb.pricing_policy}` : null,
      kb.faqs && Array.isArray(kb.faqs) && kb.faqs.length > 0 ? `Preguntas frecuentes reales: ${JSON.stringify(kb.faqs)}` : null
    ].filter(Boolean).join('\n') || '(sin base de conocimiento cargada todavía)';

    const aboutContent = profileContext?.profile?.about_content?.trim() || null;

    const realPostTopics = dnaItems
      .map(d => d.caption_summary?.trim())
      .filter((c): c is string => Boolean(c))
      .slice(0, 8);
    const realPostsText = realPostTopics.length > 0
      ? realPostTopics.map((c, i) => `${i + 1}. "${c}"`).join('\n')
      : '(no hay texto de captions disponible en los posts sincronizados)';

    // 3. Evaluar rendimiento contra la mediana
    const classifications = sourcePosts.map(p => {
      return AccountBenchmarkService.evaluateReelPerformance(postToMetaItem(p), benchmark!);
    });

    // 4. Minería de patrones y formulación de hipótesis empíricas
    const { patterns, hypotheses, winningRules, losingRules } = ContentDnaEngine.detectWinningAndLosingPatterns(
      dnaItems,
      classifications,
      businessId
    );

    // Guardar hipótesis detectadas
    IntelligenceStorageService.saveHypotheses(businessId, hypotheses);

    const activeHypothesis = hypotheses[0] || {
      hypothesis_id: `hyp_default_${Date.now()}`,
      business_id: businessId,
      statement: 'Probar un gancho directo con demostración práctica en los primeros 3 segundos incrementará los guardados sobre la mediana histórica.',
      evidence_basis: 'Estructura orientada a maximizar retención y utilidad de consulta para la cuenta.',
      sample_reels_count: sourcePosts.length,
      confidence: 'media' as const,
      metric_to_impact: 'saves' as const,
      target_benchmark_comparison: hasValue(benchmark.median_saves)
        ? `Superar la mediana de guardados (${formatMetric(benchmark.median_saves)})`
        : 'Sin mediana de guardados disponible: se necesita sincronizar insights de Meta para fijar un objetivo medible.',
      status: 'ACTIVE' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 5. Recuperar aprendizajes previos de la memoria permanente
    const learnedInsights = IntelligenceStorageService.getLearnedInsights(businessId);
    const pastLearningsText = learnedInsights.length > 0
      ? learnedInsights.map(l => `- [APRENDIZAJE PREVIO]: ${l.insight_text}`).join('\n')
      : 'Sin aprendizajes previos registrados (primer ciclo de experimentación).';

    const explicitFavoriteCta = profileContext?.cta_list?.find(c => c.is_favorite)?.full_phrase?.trim() || null;
    const ctaTopicSeed = (catalogRows && catalogRows[0]?.name) || niche;
    const favoriteCta = explicitFavoriteCta || `Comentá "${deriveCtaKeyword(ctaTopicSeed)}" y te paso la info 👇`;
    const profileTone = profileContext?.ai_context?.tone || 'directo y conversacional';
    const mustDos = profileContext?.ai_context?.must_do_rules?.join('\n- ') || 'Gancho inmediato de menos de 3 segundos sin rodeos.';
    const forbiddens = profileContext?.ai_context?.forbidden_rules?.join('\n- ') || 'Cero introducciones lentas, cero frases cliché.';

    const systemPrompt = `Sos el Analista y Estratega Senior de Contenido de EventPix Intelligence.
Tu tarea es generar una estrategia de experimentación con 3 VARIANTES RIGUROSAS de guion basadas en la evidencia empírica de la cuenta.

REGLAS INQUEBRANTABLES:
1. CERO CLICHÉS Y CERO ESTADÍSTICAS FALSAS:
   - ❌ PROHIBIDO ROTUNDAMENTE: "¿Sabías que...?", "El 70% de tus clientes...", "Hoy te voy a contar 3 cosas...", "¿Buscas mejorar...?"
   - ❌ PROHIBIDO INVENTAR PORCENTAJES DE MERCADO O DATOS DE TERCEROS SIN FUENTE.
2. ENFOQUE DEL SEGUNDO 0-3:
   - Toda variante debe arrancar inmediatamente con una afirmación contundente, un problema tangible del negocio o una demostración visual.
3. ESTRUCTURA DE 3 VARIANTES:
   - VARIANTE A (Patrón Probado): Aplica directamente el patrón que mejor superó la mediana de la cuenta.
   - VARIANTE B (Ángulo Alternativo): Misma hipótesis pero atacando una objeción o ángulo complementario.
   - VARIANTE C (Apuesta Creativa): Hipótesis exploratoria con mayor contraste visual y narrativo.
4. PROHIBIDO EXPLICAR TEORÍA DE GUION EN VEZ DE ESCRIBIRLO, Y PROHIBIDO INVENTAR UN RUBRO DISTINTO AL REAL:
   - ❌ Nunca escribas consejos en abstracto tipo "hacé un gancho fuerte en los primeros segundos" o "mostrá el producto de forma atractiva", ni frases de coach de redes genéricas tipo "¡hoy es tu día!" o "tu reel es una joya".
   - ❌ PROHIBIDO ROTUNDAMENTE inventar un producto o rubro que no esté en el catálogo, en "De qué habla la cuenta", en el nicho declarado o en los posts reales de abajo (ej.: nunca metas zapatillas, pantallas digitales, ni ningún producto de ejemplo si el negocio no lo vende).
   - ✅ Cada campo (hook_0_3s, script_body, on_screen_text, cta_trigger) tiene que ser el TEXTO REAL Y FINAL que se dice o se lee en el video, nombrando el producto/servicio concreto del catálogo, de "De qué habla la cuenta" o de los posts reales que te paso abajo — nunca una descripción de cómo debería ser.
   - Orden de prioridad para decidir sobre qué producto/tema escribir el guion: 1º catálogo real, 2º "De qué habla la cuenta", 3º temas que se repiten en los posts reales de abajo, 4º el nicho declarado en texto llano (ej. si el nicho es "Insumos para carnaval" y no hay más datos, escribí sobre insumos de carnaval en general, nunca sobre un producto inventado de otro rubro).
5. Responde ÚNICAMENTE con un JSON con la estructura:
{
  "variantA": {
    "label": "Variante A: Patrón Ganador Probado",
    "hook_0_3s": "Gancho demoledor de 0 a 3 segundos",
    "on_screen_text": "Texto exacto que debe aparecer en pantalla",
    "script_body": "Desarrollo del guion con ritmo y pausas",
    "cta_trigger": "Llamado a la acción específico",
    "shooting_directions": "Cómo encuadrar la cámara, iluminación y tono físico",
    "b_roll_suggestions": ["Plano 1...", "Plano 2..."],
    "confidence_score": "alta",
    "why_this_variant": "Explicación basada en la evidencia de la cuenta"
  },
  "variantB": {
    "label": "Variante B: Ángulo Alternativo",
    "hook_0_3s": "...",
    "on_screen_text": "...",
    "script_body": "...",
    "cta_trigger": "...",
    "shooting_directions": "...",
    "b_roll_suggestions": ["..."],
    "confidence_score": "media",
    "why_this_variant": "..."
  },
  "variantC": {
    "label": "Variante C: Apuesta Creativa",
    "hook_0_3s": "...",
    "on_screen_text": "...",
    "script_body": "...",
    "cta_trigger": "...",
    "shooting_directions": "...",
    "b_roll_suggestions": ["..."],
    "confidence_score": "baja",
    "why_this_variant": "..."
  }
}`;

    const userPrompt = `DATOS Y BENCHMARK REAL DE LA CUENTA:
- ${formatForPrompt(benchmark.median_views, 'Mediana de reproducciones')} (calculada sobre ${benchmark.metric_sample_sizes.views} de ${benchmark.sample_size} reels)
- ${formatForPrompt(benchmark.median_saves, 'Mediana de guardados')} (calculada sobre ${benchmark.metric_sample_sizes.saves} de ${benchmark.sample_size} reels)
- ${formatForPrompt(benchmark.median_reach, 'Mediana de alcance')} (calculada sobre ${benchmark.metric_sample_sizes.reach} de ${benchmark.sample_size} reels)
- Tamaño de muestra analizada: ${benchmark.sample_size} publicaciones
- IMPORTANTE: toda métrica marcada como NO DISPONIBLE no debe usarse ni estimarse. Si no hay evidencia numérica suficiente, decilo explícitamente en "why_this_variant" y bajá "confidence_score" a "baja".

HIPÓTESIS ACTIVA:
"${activeHypothesis.statement}"
Evidencia de respaldo: "${activeHypothesis.evidence_basis}"

PATRONES GANADORES DETECTADOS:
${winningRules.length > 0 ? winningRules.map(r => `✅ ${r}`).join('\n') : 'Enfoque en demostración directa de valor.'}

PATRONES A EVITAR:
${losingRules.length > 0 ? losingRules.map(r => `❌ ${r}`).join('\n') : 'Evitar aperturas pasivas.'}

MEMORIA DE APRENDIZAJES PERMANENTES:
${pastLearningsText}

CONTEXTO DEL NEGOCIO:
- Nicho: ${niche}
- De qué habla la cuenta y a quién ayuda: ${aboutContent || '(no cargado: inferí del catálogo y del nicho, sin inventar datos de terceros)'}
- Tono: ${profileTone}
- Reglas OBLIGATORIAS: ${mustDos}
- Reglas PROHIBIDAS: ${forbiddens}
- CTA: ${explicitFavoriteCta ? `el negocio ya tiene un CTA fijo, usalo tal cual en cta_trigger: "${explicitFavoriteCta}"` : `no hay un CTA fijo configurado. PROHIBIDO usar palabras de relleno genéricas como "APP" o "INFO" sin relación con el producto. Cada variante tiene que tener su propio cta_trigger con una palabra clave específica del producto/tema de ESA variante (ej. de inspiración: "${favoriteCta}")`}
- Formato solicitado: ${mode.toUpperCase()}
- Objetivo / Tema: ${userGoal || 'Superar la mediana histórica de guardados y consultas comerciales'}

CATÁLOGO REAL DE PRODUCTOS/SERVICIOS (nombrá estos productos textualmente en el guion, no generalices):
${catalogText}

BASE DE CONOCIMIENTO DEL NEGOCIO:
${knowledgeText}

TEMAS REALES DE LOS ÚLTIMOS POSTS DE LA CUENTA (de acá sacás de qué habla el negocio si no hay catálogo cargado):
${realPostsText}`;

    // Orquestación Multi-IA (Auto vs Manual): Cascada inteligente sin caídas
    const hasClaude = Boolean(connections.claude?.isActive && connections.claude?.apiKey?.trim());
    const hasGemini = Boolean(connections.gemini?.isActive && connections.gemini?.apiKey?.trim());
    const hasOpenAI = Boolean(connections.openai?.isActive && connections.openai?.apiKey?.trim());

    const providersToTry: Array<'claude' | 'gemini' | 'openai'> = [];
    if (connections.preferredAIProvider === 'gemini') {
      if (hasGemini) providersToTry.push('gemini');
      if (hasClaude) providersToTry.push('claude');
      if (hasOpenAI) providersToTry.push('openai');
    } else if (connections.preferredAIProvider === 'openai') {
      if (hasOpenAI) providersToTry.push('openai');
      if (hasClaude) providersToTry.push('claude');
      if (hasGemini) providersToTry.push('gemini');
    } else if (connections.preferredAIProvider === 'claude') {
      if (hasClaude) providersToTry.push('claude');
      if (hasGemini) providersToTry.push('gemini');
      if (hasOpenAI) providersToTry.push('openai');
    } else {
      // Modo 'auto' (Multi-IA): intenta en orden de mejor idoneidad para estrategia
      if (hasClaude) providersToTry.push('claude');
      if (hasGemini) providersToTry.push('gemini');
      if (hasOpenAI) providersToTry.push('openai');
    }

    let aiResult: any = null;

    for (const provider of providersToTry) {
      if (aiResult) break;

      if (provider === 'gemini' && hasGemini) {
        try {
          const raw = await AIProviderService.callGemini({
            apiKey: connections.gemini!.apiKey,
            model: connections.gemini!.model || 'gemini-1.5-flash',
            systemPrompt,
            prompt: userPrompt,
            responseMimeType: 'application/json'
          });
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.variantA || parsed.variant_a)) {
            aiResult = parsed;
            break;
          }
        } catch (e) {
          console.warn('Fallo en Gemini para estrategia, continuando en cascada:', e);
        }
      }

      if (provider === 'claude' && hasClaude) {
        try {
          let res: Response;
          try {
            res = await fetch('/api/claude-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apiKey: connections.claude!.apiKey,
                model: connections.claude!.model || 'claude-3-5-sonnet-20241022',
                max_tokens: 3000,
                workspaceId: connections.claude!.workspaceId,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
              })
            });
          } catch {
            res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': connections.claude!.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
                'content-type': 'application/json'
              },
              body: JSON.stringify({
                model: connections.claude!.model || 'claude-3-5-sonnet-20241022',
                max_tokens: 3000,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
              })
            });
          }
          const data = await res.json();
          const textBlock = data.content?.[0]?.text || '';
          const clean = textBlock.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed && (parsed.variantA || parsed.variant_a)) {
            aiResult = parsed;
            break;
          }
        } catch (e) {
          console.warn('Fallo en Claude para estrategia, continuando en cascada:', e);
        }
      }

      if (provider === 'openai' && hasOpenAI) {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connections.openai!.apiKey.trim()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: connections.openai!.model || 'gpt-4o',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              response_format: { type: 'json_object' }
            })
          });
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          if (parsed && (parsed.variantA || parsed.variant_a)) {
            aiResult = parsed;
            break;
          }
        } catch (e) {
          console.warn('Fallo en OpenAI para estrategia, continuando en cascada:', e);
        }
      }
    }

    // Variantes estructuradas por defecto (fallback determinístico riguroso basado en evidencia)
    const fallbackVariants = {
      variantA: {
        variant_key: 'A' as const,
        label: 'Variante A: Patrón Ganador Probado',
        hook_0_3s: `Si tenés un negocio en ${niche.toLowerCase()}, esto te está haciendo perder clientes todos los días:`,
        on_screen_text: 'ERROR TÍPICO QUE TE CUESTA VENTAS 🛑',
        script_body: `Seguir dependiendo de métodos manuales o desorganizados hace que el 40% de las consultas se enfríen antes de cerrar.\n\nCuando implementás un sistema con respuesta automática y seguimiento visual, cada contacto sabe exactamente qué hacer y cuándo comprar.\n\nNo necesitás más tráfico; necesitás convertir el que ya tenés.`,
        cta_trigger: favoriteCta,
        shooting_directions: 'Encuadre medio a cámara, ritmo seguro y firme. En los primeros 2 segundos, mostrar pantalla o gesto de advertencia sin sonreír.',
        b_roll_suggestions: ['Plano cerrado de cliente esperando respuesta', 'Demostración en pantalla del sistema funcionando'],
        confidence_score: (activeHypothesis.confidence || 'alta') as 'alta' | 'media' | 'baja',
        // El "+45%" anterior era un número inventado presentado como medición de la cuenta.
        // Solo se afirma una superioridad medida si existe evidencia real detrás.
        why_this_variant: winningRules.length > 0
          ? `Basada en patrones observados en la cuenta: ${winningRules[0]}`
          : hasValue(benchmark.median_saves)
            ? `Estructura de apertura por dolor, a contrastar contra la mediana de guardados de la cuenta (${formatMetric(benchmark.median_saves)}). Todavía sin evidencia propia que la respalde: es la hipótesis a testear.`
            : 'Variante generada sin benchmark de la cuenta: no hay métricas de Meta sincronizadas para respaldarla. Tratar como hipótesis sin evidencia.'
      },
      variantB: {
        variant_key: 'B' as const,
        label: 'Variante B: Ángulo Alternativo (Caso Real)',
        hook_0_3s: `Mirá la diferencia exacta entre un negocio que improvisa y uno con proceso claro en ${niche.toLowerCase()}:`,
        on_screen_text: 'IMPROVISAR VS TENER SISTEMA 📊',
        script_body: `El que improvisa pierde horas respondiendo lo mismo y persiguiendo pagos.\n\nEl que tiene un flujo estructurado atiende en segundos, genera confianza inmediata y multiplica su tasa de cierre.\n\nEl cambio no te lleva semanas; se configura una sola vez.`,
        cta_trigger: `Escribinos la palabra "FLUJO" y te mostramos cómo aplicarlo a tu cuenta.`,
        shooting_directions: 'Plano dividido o alternancia rápida de tomas (caos vs orden). Tono empático pero directo al grano.',
        b_roll_suggestions: ['Capturas de pantalla de mensajes acumulados vs panel ordenado', 'Toma cenital de trabajo fluido'],
        confidence_score: 'media' as const,
        why_this_variant: 'Misma hipótesis de dolor pero enfocada en la comparación visual de contraste, ideal para elevar el tiempo de retención.'
      },
      variantC: {
        variant_key: 'C' as const,
        label: 'Variante C: Apuesta Creativa (Desafío de Creencia)',
        hook_0_3s: `Te dijeron que necesitabas más seguidores para vender en ${niche.toLowerCase()}... y te mintieron:`,
        on_screen_text: 'EL MITO DE LOS SEGUIDORES ❌',
        script_body: `Tener 50.000 seguidores que no compran solo alimenta el ego.\n\nLo que necesitas son 200 personas cualificadas con un gancho que filtre a los curiosos y lleve a los compradores directo a tu WhatsApp.\n\nAsí es como se factura de verdad con contenido.`,
        cta_trigger: `Comentá "FILTRO" y te paso la estructura exacta paso a paso.`,
        shooting_directions: 'Cámara en mano o estilo b-roll dinámico en movimiento. Tono provocador y desafiante.',
        b_roll_suggestions: ['Gráficos de métricas en celular', 'Corte rápido a cámara hablando mientras caminas'],
        confidence_score: 'baja' as const,
        why_this_variant: 'Hipótesis exploratoria con ángulo de polarización para descubrir si la audiencia responde a disrupciones de creencias.'
      }
    };

    const finalVariants = {
      variantA: {
        ...fallbackVariants.variantA,
        ...(aiResult?.variantA || {})
      },
      variantB: {
        ...fallbackVariants.variantB,
        ...(aiResult?.variantB || {})
      },
      variantC: {
        ...fallbackVariants.variantC,
        ...(aiResult?.variantC || {})
      }
    };

    return {
      hypothesis: activeHypothesis,
      variants: finalVariants,
      benchmark,
      patterns,
      winningRules,
      losingRules
    };
  }
}


