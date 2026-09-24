import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { GenerateSpokenScriptRequest, SpokenReelScript } from '../../src/types/spokenReel.js';

const SYSTEM_PROMPT = `Sos un Copywriter Senior especializado en Direct Response para Reels hablados de Instagram/TikTok.
Escribís guiones bajo el framework Scripty: Hook -> Retain -> Sell.

REGLAS INQUEBRANTABLES:
1. El gancho verbal (0-3s) debe ser una pregunta disruptiva o una afirmación contraintuitiva. Nunca uses cliches como "¿Sabías que...?" o "Hoy te voy a contar...".
2. El problema/agitación debe conectar con un dolor REAL y especifico del avatar de cliente dado, no generico.
3. La solucion/demostracion debe presentar la oferta de forma organica (como consejo/demo), nunca como publicidad clasica.
4. El CTA final debe ser un comando especifico y accionable (ej: "Escribi la palabra X en comentarios").
5. Nunca inventes estadisticas o datos que no te dieron.
6. Respondé UNICAMENTE con un JSON valido (sin markdown, sin texto antes o despues) con esta forma exacta:
{
  "hooks": ["gancho verbal alternativa 1", "alternativa 2", "alternativa 3"],
  "visual_hook": "que debe hacer el presentador ante camara en el gancho",
  "problem_agitation": "guion del problema/agitacion (3-15s)",
  "solution_demo": "guion de la solucion/demostracion (15-45s)",
  "cta": "llamado a la accion final",
  "on_screen_text": ["texto en pantalla 1", "texto en pantalla 2"],
  "b_roll_suggestions": ["toma de apoyo 1", "toma de apoyo 2"],
  "estimated_seconds": 42,
  "word_count": 130
}`;

function buildUserPrompt(req: GenerateSpokenScriptRequest): string {
  const { topic, brandDna } = req;

  const topicLine = topic.source === 'brand_dna'
    ? 'Generá un guion nuevo a partir del Brand DNA del negocio (sin un Reel de referencia puntual).'
    : `Tema ganador detectado (${topic.source === 'competitor_reel' ? 'reel de un competidor' : 'reel propio'}${
        topic.engagement_rate != null ? `, engagement rate ${topic.engagement_rate}%` : ''
      }): "${topic.caption || 'sin descripcion'}".`;

  return `${topicLine}

BRAND DNA DEL NEGOCIO:
- Mision: ${brandDna.identity.mission}
- Propuesta de valor unica: ${brandDna.identity.unique_value_proposition}
- Avatar de cliente objetivo: ${brandDna.identity.target_avatar}
- Tono de voz: ${brandDna.voice_and_tone.primary_tone}${brandDna.voice_and_tone.secondary_tone ? ` / ${brandDna.voice_and_tone.secondary_tone}` : ''}
- Frases favoritas: ${brandDna.voice_and_tone.favorite_catchphrases.join('; ') || 'ninguna registrada'}
- Palabras prohibidas: ${brandDna.voice_and_tone.forbidden_words.join(', ') || 'ninguna'}
- Producto/oferta principal: ${brandDna.offers.main_products[0] || 'no especificado'}
- CTAs que ya usa el negocio: ${brandDna.offers.call_to_actions.join('; ') || 'ninguno registrado'}

Escribí el guion hablado completo siguiendo exactamente el formato JSON pedido.`;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

interface RawScriptShape {
  hooks?: unknown;
  visual_hook?: unknown;
  problem_agitation?: unknown;
  solution_demo?: unknown;
  cta?: unknown;
  on_screen_text?: unknown;
  b_roll_suggestions?: unknown;
  estimated_seconds?: unknown;
  word_count?: unknown;
}

function validateScript(parsed: unknown): SpokenReelScript {
  const p = (parsed || {}) as RawScriptShape;

  if (
    !Array.isArray(p.hooks) || p.hooks.length === 0 ||
    typeof p.visual_hook !== 'string' ||
    typeof p.problem_agitation !== 'string' ||
    typeof p.solution_demo !== 'string' ||
    typeof p.cta !== 'string'
  ) {
    throw new Error('La respuesta del modelo no tiene la forma esperada del guion.');
  }

  return {
    hooks: (p.hooks as unknown[]).slice(0, 3).map(String),
    visual_hook: p.visual_hook,
    problem_agitation: p.problem_agitation,
    solution_demo: p.solution_demo,
    cta: p.cta,
    on_screen_text: Array.isArray(p.on_screen_text) ? p.on_screen_text.map(String) : [],
    b_roll_suggestions: Array.isArray(p.b_roll_suggestions) ? p.b_roll_suggestions.map(String) : [],
    estimated_seconds: typeof p.estimated_seconds === 'number' ? p.estimated_seconds : 45,
    word_count: typeof p.word_count === 'number' ? p.word_count : 0,
  };
}

async function generateWithClaude(req: GenerateSpokenScriptRequest, apiKey: string): Promise<SpokenReelScript> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(req) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '';
  return validateScript(JSON.parse(extractJson(raw)));
}

async function generateWithOpenAI(req: GenerateSpokenScriptRequest, apiKey: string): Promise<SpokenReelScript> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(req) },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '';
  return validateScript(JSON.parse(extractJson(raw)));
}

/**
 * Motor 2 (Spoken Content Engine): genera un guion hablado Hook-Retain-Sell
 * a partir del Brand DNA del negocio y un tema ganador (propio o de un
 * competidor). Modelo "bring your own key" (igual que /api/claude-messages y
 * /api/gemini-generate): usa la clave que el negocio conectó desde "Conectar
 * APIs"; si no conectó ninguna, cae a ANTHROPIC_API_KEY/OPENAI_API_KEY de la
 * plataforma como fallback opcional para poder probar la función igual.
 */
export async function generateSpokenReelScript(
  req: GenerateSpokenScriptRequest
): Promise<{ script: SpokenReelScript; provider: 'claude' | 'openai' }> {
  const wantsOpenAI = req.provider === 'openai';
  const businessKey = req.apiKey?.trim();

  if (businessKey) {
    return wantsOpenAI
      ? { script: await generateWithOpenAI(req, businessKey), provider: 'openai' }
      : { script: await generateWithClaude(req, businessKey), provider: 'claude' };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return { script: await generateWithClaude(req, process.env.ANTHROPIC_API_KEY), provider: 'claude' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { script: await generateWithOpenAI(req, process.env.OPENAI_API_KEY), provider: 'openai' };
  }

  throw new Error(
    'Conectá tu clave de Claude u OpenAI desde "Conectar APIs" para generar guiones con IA.'
  );
}
