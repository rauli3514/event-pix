import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

// Puente entre el panel y el Apps Script de Drive del kiosco.
//
// La dirección del script y la clave del panel viven solo acá, como secrets de
// Supabase (una vez para toda la app, nadie las ve ni las carga en la pantalla):
//   DRIVE_SCRIPT_URL  URL de la aplicación web del script (termina en /exec)
//   DRIVE_ADMIN_KEY   la ADMIN_KEY de "Propiedades del script"
//   DRIVE_FOLDER      opcional: link o ID de la carpeta principal
//                     (vacío = "EventPix Kiosco" en Mi unidad)
//
// Permisos: super_admin puede todo (ver y borrar fotos del kiosco). Para
// "Enviar álbum a Drive" alcanza con poder administrar ese evento del muro.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ADMIN_ACTIONS = ['folders', 'photos', 'delete', 'deleteFolder']

const folderIdFrom = (link?: string) => {
  const v = (link || '').trim()
  const m = v.match(/folders\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/)
  if (m) return m[1]
  return /^[\w-]{10,}$/.test(v) ? v : ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const scriptUrl = Deno.env.get('DRIVE_SCRIPT_URL')
    const adminKey = Deno.env.get('DRIVE_ADMIN_KEY')
    if (!scriptUrl || !adminKey) {
      return json({ ok: false, error: 'Falta configurar Drive en Supabase (secrets DRIVE_SCRIPT_URL y DRIVE_ADMIN_KEY)' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // Quién llama (tiene que haber iniciado sesión)
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return json({ ok: false, error: 'Iniciá sesión para usar Drive' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const isSuperAdmin = profile?.role === 'super_admin'

    let payload: Record<string, unknown>
    if (ADMIN_ACTIONS.includes(action)) {
      if (!isSuperAdmin) return json({ ok: false, error: 'Solo un super admin puede ver o borrar las fotos del kiosco' }, 403)
      payload = { action, folder: body.folder, offset: body.offset, limit: body.limit, ids: body.ids }
    } else if (action === 'import') {
      if (!isSuperAdmin) {
        const eventId = body.event_id
        if (!eventId) return json({ ok: false, error: 'Falta el evento' }, 400)
        const [{ data: provider }, { data: own }] = await Promise.all([
          supabase.from('event_providers').select('event_id').eq('event_id', eventId).eq('provider_id', user.id).maybeSingle(),
          supabase.from('events').select('id').eq('id', eventId).eq('created_by', user.id).maybeSingle(),
        ])
        if (!provider && !own) return json({ ok: false, error: 'No tenés permiso sobre este evento' }, 403)
      }
      // Solo archivos del almacenamiento de esta app (el script los descarga)
      const allowed = `${supabaseUrl}/storage/v1/object/public/`
      const files = (Array.isArray(body.files) ? body.files : [])
        .filter((f: { url?: string; name?: string }) => typeof f?.url === 'string' && f.url.startsWith(allowed) && typeof f?.name === 'string')
        .slice(0, 20)
      const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, 3)
      payload = { action, folder: String(body.folder || '').slice(0, 120), files, texts, shareFolder: !!body.shareFolder }
    } else {
      return json({ ok: false, error: `Acción desconocida: ${action}` }, 400)
    }

    // text/plain: así lo espera el Apps Script (doPost lee el texto como JSON)
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, adminKey, folderId: folderIdFrom(Deno.env.get('DRIVE_FOLDER')) }),
    })
    const out = await res.json().catch(() => null)
    if (!out) return json({ ok: false, error: `Drive respondió ${res.status}` })
    return json(out)
  } catch (error) {
    console.error('drive-admin:', error)
    return json({ ok: false, error: (error as Error).message }, 500)
  }
})
