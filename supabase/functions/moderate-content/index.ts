import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

// Moderación automática con IA de lo que suben los invitados.
//
// El celular del invitado solo manda el ID de su foto/mensaje: el contenido,
// el evento y el nivel de moderación se leen acá desde la base, así nadie
// puede aprobar algo mandando datos falsos. La clave de OpenAI vive solo en
// los secrets de Supabase (OPENAI_API_KEY), nunca en la app.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Solo se moderan envíos recientes: evita que alguien gaste crédito de OpenAI
// llamando una y otra vez con IDs viejos.
const MAX_AGE_MS = 15 * 60 * 1000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SYSTEM_PROMPT = "You are a Content Moderator for a public family event. Censor ANY content that is inappropriate for children or grandparents. Output ONLY valid JSON: { \"safe\": boolean, \"reason\": string }."

const CRITERIA: Record<string, string> = {
  low: "ALLOW: People having fun, drinking (moderately), funny faces, beachwear. BLOCK: Explicit nudity, sexual acts, heavy gore, hate symbols.",
  medium: "STANDARD MODE. BLOCK: Nudity, Drugs, Violence, Hate Symbols, Middle Fingers, Highly Sexualized poses. ALLOW: Alcohol in moderation, innocent kissing.",
  high: "STRICT MODE. BLOCK: 1. Alcohol (bottles/glasses). 2. Drugs/Smoking. 3. Partial nudity/Cleavage/Swimwear (unless beach). 4. Intimate/Sexual poses. 5. Rude gestures (middle finger). 6. Suggestive expressions.",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function moderateText(apiKey: string, text: string) {
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  const result = data.results?.[0]
  if (!result) throw new Error('Respuesta de moderación vacía')
  const flagged = Object.keys(result.categories || {}).filter((k) => result.categories[k])
  return { safe: !result.flagged, reason: result.flagged ? `Flagged: ${flagged.join(', ')}` : 'Safe text' }
}

async function moderateImage(apiKey: string, imageUrl: string, level: string) {
  const criteria = CRITERIA[level] || CRITERIA.medium
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `CRITERIA: ${criteria}. If unsure, REJECT. If prohibited items present, "safe": false.` },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI ${res.status}`)
  }
  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content || ''
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1) return { safe: false, reason: 'Invalid JSON Format' }
  try {
    const analysis = JSON.parse(content.substring(start, end + 1))
    return { safe: analysis.safe === true, reason: analysis.reason || 'No reason given' }
  } catch {
    return { safe: false, reason: 'JSON Parse Error' }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { submission_id } = await req.json().catch(() => ({}))
    if (typeof submission_id !== 'string' || !UUID_RE.test(submission_id)) {
      return json({ error: 'submission_id inválido' }, 400)
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      return json({ error: 'Falta OPENAI_API_KEY en los secrets de Supabase' }, 500)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('id, event_id, type, content, caption, status, created_at')
      .eq('id', submission_id)
      .maybeSingle()

    if (subError) throw subError
    if (!submission) return json({ error: 'No existe' }, 404)
    if (submission.status !== 'pending') return json({ skipped: 'already_moderated', status: submission.status })
    if (Date.now() - new Date(submission.created_at).getTime() > MAX_AGE_MS) {
      return json({ skipped: 'too_old' })
    }
    if (submission.type !== 'photo' && submission.type !== 'message') {
      return json({ skipped: 'manual_review' })
    }

    const { data: settings } = await supabase
      .from('event_settings')
      .select('ai_moderation_enabled, ai_moderation_level')
      .eq('event_id', submission.event_id)
      .maybeSingle()

    if (!settings?.ai_moderation_enabled) return json({ skipped: 'ai_disabled' })

    const level = settings.ai_moderation_level || 'medium'
    let result = submission.type === 'message'
      ? await moderateText(OPENAI_API_KEY, submission.content)
      : await moderateImage(OPENAI_API_KEY, submission.content, level)

    // La dedicatoria también sale en pantalla: se revisa aparte
    if (result.safe && submission.caption) {
      result = await moderateText(OPENAI_API_KEY, submission.caption)
    }

    // Si la IA no la aprueba queda 'pending' para que la revise una persona.
    if (result.safe) {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ status: 'approved', moderated_at: new Date().toISOString() })
        .eq('id', submission.id)
        .eq('status', 'pending')
      if (updateError) throw updateError
    }

    return json({ approved: result.safe, reason: result.reason })
  } catch (error) {
    console.error('moderate-content:', error)
    return json({ error: (error as Error).message }, 500)
  }
})
