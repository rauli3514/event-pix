import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Cabina de video: manda el video al WhatsApp del invitado.
//
// Usa la API oficial de WhatsApp (Meta Cloud API) con una plantilla aprobada,
// porque el invitado no le escribió antes al número (fuera de la ventana de 24 h
// solo se pueden mandar plantillas).
//
// Lo llama el equipo con su código y su clave secreta (como la IA): solo los
// equipos vinculados pueden mandar, con un tope de envíos por día por equipo.
//
// Secrets (supabase secrets set …):
//   WHATSAPP_TOKEN          token permanente del usuario del sistema (Meta Business)
//   WHATSAPP_PHONE_ID       ID del número de teléfono de WhatsApp Business
//   WHATSAPP_TEMPLATE       nombre de la plantilla (por defecto video_cabina)
//   WHATSAPP_TEMPLATE_LANG  idioma de la plantilla (por defecto es_AR)
//   WHATSAPP_VIDEO_HEADER   "1" si la plantilla tiene encabezado de VIDEO (manda el video, no solo el link)
//   WHATSAPP_DAILY_LIMIT    envíos por equipo cada 24 h (por defecto 500)
//   PUBLIC_SITE_URL         sitio de la página del invitado (por defecto https://app.event-pix.com.ar)
//
// Plantilla esperada (categoría "Utilidad" o "Marketing"), cuerpo con 2 variables:
//   ¡Hola! Acá está tu video de {{1}} 🎬 Miralo y bajalo acá: {{2}}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ERRORS: Record<string, string> = {
  device_auth: 'El equipo no está autorizado (actualizá la app).',
  device_not_linked: 'El equipo no está vinculado al panel.',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const token = Deno.env.get('WHATSAPP_TOKEN')
    const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
    if (!token || !phoneId) return reply({ ok: false, error: 'El envío por WhatsApp no está configurado en el servidor.' })

    const body = await req.json().catch(() => ({}))
    const device = body.device ?? {}
    const phone = String(body.phone ?? '').replace(/\D/g, '')
    const driveId = String(body.driveId ?? '')
    // WhatsApp no acepta saltos de línea ni muchos espacios seguidos en las variables
    const title = String(body.title ?? '').replace(/\s+/g, ' ').slice(0, 60).trim()
    const gallery = body.gallery ? String(body.gallery).slice(0, 40) : null
    if (!/^\d{8,15}$/.test(phone)) return reply({ ok: false, error: 'El número no es válido.' })
    if (!/^[\w-]{20,120}$/.test(driveId)) return reply({ ok: false, error: 'Falta el video.' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: check, error: checkError } = await admin.rpc('kiosk_video_send_check', {
      p_code: String(device.code ?? ''), p_secret: String(device.secret ?? ''),
    })
    if (checkError) {
      const key = Object.keys(ERRORS).find(k => checkError.message.includes(k))
      return reply({ ok: false, error: key ? ERRORS[key] : checkError.message })
    }
    const row = Array.isArray(check) ? check[0] : check
    const limit = Number(Deno.env.get('WHATSAPP_DAILY_LIMIT') || 500)
    if (row && row.sent_today >= limit) return reply({ ok: false, error: 'Se llegó al tope de envíos de hoy para este equipo.' })

    const site = (Deno.env.get('PUBLIC_SITE_URL') || 'https://app.event-pix.com.ar').replace(/\/+$/, '')
    const params = new URLSearchParams({ d: driveId, ...(title ? { t: title } : {}) })
    const link = `${site}/clip?${params.toString()}`
    const components: Record<string, unknown>[] = []
    if (Deno.env.get('WHATSAPP_VIDEO_HEADER') === '1') {
      components.push({
        type: 'header',
        parameters: [{ type: 'video', video: { link: `https://drive.usercontent.google.com/download?id=${driveId}&export=download` } }],
      })
    }
    components.push({
      type: 'body',
      parameters: [{ type: 'text', text: title || 'la fiesta' }, { type: 'text', text: link }],
    })

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: Deno.env.get('WHATSAPP_TEMPLATE') || 'video_cabina',
          language: { code: Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'es_AR' },
          components,
        },
      }),
    })
    const json = await res.json().catch(() => ({}))
    const providerId = json?.messages?.[0]?.id ?? null
    const error = res.ok ? null : (json?.error?.error_data?.details || json?.error?.message || `WhatsApp respondió ${res.status}`)

    await admin.from('video_sends').insert({
      device_id: row?.device_id ?? null, gallery, drive_id: driveId, phone,
      status: error ? 'failed' : 'sent', error, provider_id: providerId,
    })

    if (error) return reply({ ok: false, error: `WhatsApp no lo aceptó: ${error}` })
    return reply({ ok: true, id: providerId })
  } catch (e) {
    return reply({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
