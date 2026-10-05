import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Fotos con IA del kiosco, cobradas con créditos.
//
// Cada conversión gasta 1 crédito del cliente dueño del equipo: el equipo manda su
// código y su clave secreta ({ device: { code, secret } }); si la IA falla, el
// crédito se devuelve solo. Un usuario logueado en el panel puede probar sin gastar.
//
// Proveedor: fal.ai si está el secreto FAL_KEY (modelo FAL_MODEL, por defecto
// fal-ai/nano-banana/edit, ~US$0,04 por foto; también sirven fal-ai/nano-banana-2/edit
// o fal-ai/flux-pro/kontext). Figuritas con FAL_BG_MODEL, por defecto fal-ai/birefnet.
// Sin FAL_KEY se usa Replicate (REPLICATE_API_TOKEN), como antes.
//
// La respuesta mantiene la forma de Replicate ({ prediction: { id, status, output } })
// para que el kiosco no cambie: se inicia con { imageUrl, prompt | action } y se
// consulta con { predictionId } hasta 'succeeded' o 'failed'.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reply = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Mensajes para el invitado / operador según el motivo
const CREDIT_ERRORS: Record<string, string> = {
  no_credits: 'Sin créditos de IA: cargá más desde el panel de EventPix.',
  no_account: 'Este equipo no tiene un cliente asignado para usar la IA.',
  device_auth: 'El equipo no está autorizado para la IA (actualizá la app).',
  device_not_linked: 'El equipo no está vinculado.',
}

interface Prediction { id: string; status: 'starting' | 'processing' | 'succeeded' | 'failed'; output?: string | null; error?: string }

// ─── fal.ai ─────────────────────────────────────────────────────────
const FAL_QUEUE = 'https://queue.fal.run/'

// Modelos que cada temática puede elegir (lista cerrada: nadie puede pedir uno caro)
const ALLOWED_MODELS = [
  'fal-ai/nano-banana/edit',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/flux-pro/kontext',
  'fal-ai/flux-pro/kontext/max',
]

async function falStart(key: string, imageUrl: string, prompt: string | undefined, removeBg: boolean, wanted?: string): Promise<Prediction> {
  const model = removeBg
    ? (Deno.env.get('FAL_BG_MODEL') || 'fal-ai/birefnet')
    : (wanted && ALLOWED_MODELS.includes(wanted) ? wanted : (Deno.env.get('FAL_MODEL') || 'fal-ai/nano-banana/edit'))
  // Nano Banana y GPT Image reciben una lista de fotos; Kontext y BiRefNet, una sola
  const input = removeBg ? { image_url: imageUrl }
    : /nano-banana|gpt-image/.test(model) ? { prompt, image_urls: [imageUrl], num_images: 1 }
    : { image_url: imageUrl, prompt }
  const res = await fetch(FAL_QUEUE + model, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.status_url || !json.response_url) {
    throw new Error(json.detail ? JSON.stringify(json.detail) : `fal.ai respondió ${res.status}`)
  }
  // El id lleva las direcciones de estado y resultado que da fal.ai
  return { id: `fal|${json.status_url}|${json.response_url}`, status: 'starting' }
}

async function falPoll(key: string, id: string): Promise<Prediction> {
  const [, statusUrl, responseUrl] = id.split('|')
  // Solo direcciones de fal.ai (la clave no se manda a ningún otro lado)
  if (!statusUrl?.startsWith(FAL_QUEUE) || !responseUrl?.startsWith(FAL_QUEUE)) throw new Error('Trabajo inválido')
  const headers = { Authorization: `Key ${key}` }
  const st = await fetch(statusUrl, { headers }).then(r => r.json()).catch(() => ({}))
  if (st.status === 'IN_QUEUE') return { id, status: 'starting' }
  if (st.status !== 'COMPLETED') return { id, status: 'processing' }
  const res = await fetch(responseUrl, { headers })
  const out = await res.json().catch(() => ({}))
  const url = out?.images?.[0]?.url || out?.image?.url
  if (!res.ok || !url) return { id, status: 'failed', error: out?.detail ? JSON.stringify(out.detail) : 'La IA no devolvió imagen' }
  return { id, status: 'succeeded', output: url }
}

// ─── Replicate (anterior) ───────────────────────────────────────────
async function replicateStart(token: string, imageUrl: string, prompt: string | undefined, removeBg: boolean): Promise<Prediction> {
  let version = "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b"
  let input: Record<string, unknown> = {
    main_face_image: imageUrl, prompt, num_steps: 20, start_step: 4, guidance_scale: 5, true_cfg: 1.0, ip_adapter_scale: 1.2,
  }
  if (removeBg) {
    version = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
    input = { image: imageUrl }
  }
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, input }),
  })
  const p = await res.json()
  if (!res.ok) throw new Error(p.detail || 'Falla en IA')
  return { id: `rep|${p.id}`, status: 'starting' }
}

async function replicatePoll(token: string, id: string): Promise<Prediction> {
  const repId = id.startsWith('rep|') ? id.slice(4) : id
  const p = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(repId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
  const output = Array.isArray(p.output) ? p.output[0] : p.output
  if (p.status === 'succeeded') return { id, status: 'succeeded', output }
  if (p.status === 'failed' || p.status === 'canceled') return { id, status: 'failed', error: p.error || 'La IA falló' }
  return { id, status: p.status === 'starting' ? 'starting' : 'processing' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const FAL_KEY = Deno.env.get('FAL_KEY')
  const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')

  try {
    const body = await req.json()
    const { imageUrl, prompt, predictionId, action, device, model } = body

    // ─── Consultar un trabajo ───
    if (predictionId) {
      const id = String(predictionId)
      let prediction: Prediction
      if (id.startsWith('fal|')) {
        if (!FAL_KEY) throw new Error('Falta FAL_KEY')
        prediction = await falPoll(FAL_KEY, id)
      } else {
        if (!REPLICATE_API_TOKEN) throw new Error('Falta REPLICATE_API_TOKEN')
        prediction = await replicatePoll(REPLICATE_API_TOKEN, id)
      }
      // Falló: se devuelve el crédito (una sola vez)
      if (prediction.status === 'failed') await admin.rpc('kiosk_ai_refund', { p_job: id })
      return reply({ success: true, prediction })
    }

    if (!imageUrl) throw new Error('Falta la foto')
    if (!FAL_KEY && !REPLICATE_API_TOKEN) throw new Error('La IA no está configurada (falta FAL_KEY)')

    // ─── Quién paga ───
    let ledgerId: string | null = null
    let credits: number | null = null
    if (device?.code) {
      const { data, error } = await admin.rpc('kiosk_ai_charge', { p_code: String(device.code), p_secret: String(device.secret || '') })
      if (error) {
        const code = Object.keys(CREDIT_ERRORS).find(k => error.message.includes(k)) || 'credit_error'
        return reply({ success: false, code, error: CREDIT_ERRORS[code] || error.message })
      }
      const row = Array.isArray(data) ? data[0] : data
      ledgerId = row?.ledger_id ?? null
      credits = row?.credits ?? null
    } else {
      // Sin equipo: solo para probar desde el panel con sesión iniciada (no gasta créditos)
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      const { data: user } = token ? await admin.auth.getUser(token) : { data: { user: null } }
      if (!user?.user) return reply({ success: false, code: 'device_required', error: 'La IA se usa desde un equipo vinculado' })
    }

    // ─── Iniciar ───
    const removeBg = action === 'remove_bg'
    let prediction: Prediction
    try {
      prediction = FAL_KEY
        ? await falStart(FAL_KEY, imageUrl, prompt, removeBg, typeof model === 'string' ? model : undefined)
        : await replicateStart(REPLICATE_API_TOKEN!, imageUrl, prompt, removeBg)
    } catch (e) {
      if (ledgerId) await admin.rpc('kiosk_ai_refund', { p_ledger: ledgerId })
      throw e
    }
    if (ledgerId) await admin.rpc('kiosk_ai_set_job', { p_ledger: ledgerId, p_job: prediction.id })

    return reply({ success: true, prediction, credits })
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
})
