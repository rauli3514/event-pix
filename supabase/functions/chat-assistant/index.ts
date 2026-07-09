import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { corsHeaders } from "../_shared/cors.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

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

    // Connect to Supabase using the user's Auth Header to respect RLS
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    )

    const commerceId = contextData?.commerce?.id;

    let systemPromptBase = "Eres el 'Asistente IA' de Display Digital by eventpix, una plataforma de cartelería digital.\n" +
    "Tu objetivo es ayudar al usuario a gestionar sus pantallas, medios, playlists, programaciones y campañas.\n\n";

    if (commerceId) {
        // Fetch Personality
        const { data: personality } = await supabase
            .from('ai_personality')
            .select('system_prompt')
            .eq('commerce_id', commerceId)
            .eq('is_active', true)
            .single();

        if (personality?.system_prompt) {
            systemPromptBase = personality.system_prompt + "\n\n";
        }

        // Fetch FAQs
        const { data: faqs } = await supabase
            .from('ai_faq')
            .select('question, answer')
            .eq('commerce_id', commerceId);
            
        if (faqs && faqs.length > 0) {
            systemPromptBase += "PREGUNTAS FRECUENTES (RESPONDE USANDO ESTA INFORMACIÓN):\n";
            faqs.forEach(faq => {
                systemPromptBase += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
            });
        }

        // Fetch Knowledge
        const { data: knowledge } = await supabase
            .from('ai_knowledge')
            .select('title, content')
            .eq('commerce_id', commerceId);

        if (knowledge && knowledge.length > 0) {
            systemPromptBase += "BASE DE CONOCIMIENTO TÉCNICO (REGLAS Y MANUALES):\n";
            knowledge.forEach(doc => {
                systemPromptBase += `--- ${doc.title} ---\n${doc.content}\n\n`;
            });
        }
    }

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
        { role: 'system', content: systemPromptBase + contextString },
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
