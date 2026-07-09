import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export const saveOpenAIKey = (key: string) => {
    localStorage.setItem('OPENAI_RAW_KEY', key);
    openaiClient = null; // force reload
};

export const getOpenAIClient = () => {
    if (openaiClient) return openaiClient;
    
    const b64Key = import.meta.env.VITE_OPENAI_KEY_B64;
    const rawKey = localStorage.getItem('OPENAI_RAW_KEY');
    
    let apiKey = rawKey || '';
    if (!apiKey && b64Key) {
        try {
            apiKey = atob(b64Key);
        } catch (e) {
            console.error("Failed to decode VITE_OPENAI_KEY_B64");
        }
    }

    if (!apiKey) {
        console.error("OpenAI key not configured");
        return null;
    }
    
    try {
        openaiClient = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true 
        });
        return openaiClient;
    } catch (e) {
        console.error("Failed to initialize OpenAI client", e);
        return null;
    }
};

export type AIAction = {
    type: 'CREATE_PLAYLIST' | 'CREATE_CAMPAIGN' | 'ASSIGN_CONTENT' | 'CREATE_SCHEDULE';
    payload: any;
    description: string;
};

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    action?: AIAction; // If the assistant proposed an action
    timestamp: Date;
};

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
        type: "function" as const,
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
        type: "function" as const,
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

export class AIAgentService {
    static async processMessage(
        messages: ChatMessage[],
        contextData: any
    ): Promise<ChatMessage> {
        const client = getOpenAIClient();
        if (!client) throw new Error("OpenAI no está configurado.");

        // Build context string
        const contextString = "\nCONTEXTO ACTUAL:\n" +
            "Comercio activo: " + (contextData.commerce?.name || 'Desconocido') + "\n" +
            "Pantallas registradas: " + (contextData.devices?.length || 0) + "\n" +
            "Playlists existentes: " + (contextData.playlists?.map((p:any) => p.name).join(', ') || 'Ninguna') + "\n" +
            "Campañas existentes: " + (contextData.campaigns?.map((c:any) => c.name).join(', ') || 'Ninguna') + "\n";

        const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT + contextString },
            ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as any, content: m.content }))
        ];

        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: apiMessages,
            tools: TOOLS,
            temperature: 0.7,
        });

        const choice = response.choices[0];
        const message = choice.message;

        let action: AIAction | undefined = undefined;

        // If the AI decided to call a function (tool)
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0] as OpenAI.Chat.ChatCompletionMessageToolCall;
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

        return {
            id: Date.now().toString(),
            role: 'assistant',
            content: message.content || "Ya preparé la acción. ¿Deseás confirmarla?",
            action,
            timestamp: new Date()
        };
    }
}
