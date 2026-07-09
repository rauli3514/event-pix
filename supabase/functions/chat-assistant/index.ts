import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, contextData } = await req.json()

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no está configurada en los secrets de Supabase.")
    }

    const SYSTEM_PROMPT = "Eres el 'Asistente IA' de Display Digital by eventpix, una plataforma de cartelería digital.\n" +
    "Tu objetivo es ayudar al usuario a gestionar sus pantallas, medios, playlists, programaciones y campañas.\n\n" +
    "CONOCIMIENTO DE LA PLATAFORMA:\n" +
    "- Playlists: Colecciones de medios (imágenes/videos) que se reproducen en secuencia.\n" +
    "- Campañas: Layouts avanzados que pueden contener múltiples zonas (ej. zona principal y un ticker de texto).\n" +
    "- Horarios (Schedules): Programaciones semanales que asignan contenido a horas y días específicos.\n" +
    "- Dispositivos (Pantallas): TVs o tablets conectadas mediante la app 'TvPlayer'. Pueden agruparse.\n\n" +
    "REGLAS DE INTERACCIÓN:\n" +
    "1. Eres proactivo, amable, y conciso. Hablas español de Argentina (tuteo/voseo amigable).\n" +
    "2. Tienes acceso al contexto del comercio actual (se te proveerá en cada mensaje).\n" +
    "3. NO inventes IDs o datos que no estén en el contexto.\n" +
    "4. Cuando el usuario te pida CREAR algo (ej. una playlist, una promo, una campaña), usa las 'Tools/Functions' para proponer la acción estructurada. No respondas que no puedes hacerlo.\n" +
    "5. Si el usuario pide generar un texto publicitario, hazlo directamente en tu respuesta con formato Markdown.\n";

    const TOOLS = [
      {
          type: "function",
          function: {
              name: "create_playlist",
              description: "Propone crear una nueva playlist de medios.",
              parameters: {
                  type: "object",
                  properties: {
                      name: { type: "string", description: "Nombre de la playlist" },
                      description: { type: "string", description: "Descripción opcional" }
                  },
                  required: ["name"]
              }
          }
      },
      {
          type: "function",
          function: {
              name: "create_campaign",
              description: "Propone crear una nueva campaña (layout avanzado).",
              parameters: {
                  type: "object",
                  properties: {
                      name: { type: "string", description: "Nombre de la campaña" },
                      description: { type: "string", description: "Descripción opcional" }
                  },
                  required: ["name"]
              }
          }
      }
    ];

    const contextString = "\nCONTEXTO ACTUAL:\n" +
        "Comercio activo: " + (contextData?.commerce?.name || 'Desconocido') + "\n" +
        "Pantallas registradas: " + (contextData?.devices?.length || 0) + "\n" +
        "Playlists existentes: " + (contextData?.playlists?.map((p:any) => p.name).join(', ') || 'Ninguna') + "\n" +
        "Campañas existentes: " + (contextData?.campaigns?.map((c:any) => c.name).join(', ') || 'Ninguna') + "\n";

    const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT + contextString },
        ...messages.filter((m:any) => m.role !== 'system').map((m:any) => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: apiMessages,
        tools: TOOLS,
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
        console.error("OpenAI Error:", data);
        throw new Error(data.error?.message || "Error al conectar con OpenAI");
    }

    const choice = data.choices[0];
    const message = choice.message;

    let action = undefined;

    if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        if (toolCall.type === 'function') {
            const args = JSON.parse(toolCall.function.arguments);
            
            if (toolCall.function.name === 'create_playlist') {
                action = {
                    type: 'CREATE_PLAYLIST',
                    payload: args,
                    description: "Crear playlist: \"" + args.name + "\""
                };
            } else if (toolCall.function.name === 'create_campaign') {
                action = {
                    type: 'CREATE_CAMPAIGN',
                    payload: args,
                    description: "Crear campaña: \"" + args.name + "\""
                };
            }
        }
    }

    const resultMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: message.content || "Ya preparé la acción. ¿Deseás confirmarla?",
      action,
      timestamp: new Date()
    };

    return new Response(
      JSON.stringify(resultMessage),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    )
  }
})
