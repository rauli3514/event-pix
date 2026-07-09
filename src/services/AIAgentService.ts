import { supabase } from '@/lib/supabase';

export type AIAction = {
    type: 'CREATE_PLAYLIST' | 'CREATE_CAMPAIGN' | 'ASSIGN_CONTENT' | 'CREATE_SCHEDULE';
    payload: any;
    description: string;
};

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    action?: AIAction;
    timestamp: Date;
};

export class AIAgentService {
    static async processMessage(
        messages: ChatMessage[],
        contextData: any
    ): Promise<ChatMessage> {
        
        const { data, error } = await supabase.functions.invoke('chat-assistant', {
            body: { messages, contextData }
        });

        if (error) {
            console.error("Supabase Edge Function Error:", error);
            throw new Error(error.message || "Error al conectar con la IA de Supabase");
        }

        if (!data) {
            throw new Error("No se recibió respuesta del Asistente IA.");
        }

        if (data.error) {
            throw new Error(data.error);
        }

        // Formato esperado de Edge Function: { id, role, content, action, timestamp }
        return {
            id: data.id || Date.now().toString(),
            role: data.role || 'assistant',
            content: data.content || '',
            action: data.action,
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
        };
    }
}
