import { useState, useCallback } from 'react';
import { useCommerces, useDisplayDevices, useDisplayCampaigns } from '@/hooks/use-display-hub';
import { useParams } from 'react-router-dom';
import { AIAgentService, ChatMessage, AIAction } from '@/services/AIAgentService';
import { supabase } from '@/lib/supabase';

export function useAIAssistant() {
    const { commerceId } = useParams();
    const { data: commerces } = useCommerces();
    const { data: devices } = useDisplayDevices(commerceId);
    const { data: allCampaigns } = useDisplayCampaigns(commerceId);
    
    const playlists = allCampaigns?.filter(c => (c as any).type === 'playlist') || [];
    const campaigns = allCampaigns?.filter(c => (c as any).type === 'campaign') || [];

    const commerce = commerces?.find(c => c.id === commerceId);

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: '¡Hola! Soy tu Asistente IA de Display Digital. Puedo ayudarte a resolver dudas, redactar promociones o incluso crear contenidos directamente. ¿En qué te ayudo hoy?',
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    const contextData = {
        commerce,
        devices,
        playlists,
        campaigns
    };

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const aiResponse = await AIAgentService.processMessage([...messages, userMsg], contextData);
            setMessages(prev => [...prev, aiResponse]);
        } catch (error: any) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Lo siento, hubo un error al conectarme con la IA. Asegúrate de tener la API Key configurada.',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, contextData]);

    const executeAction = useCallback(async (action: AIAction) => {
        setIsLoading(true);
        try {
            if (action.type === 'CREATE_PLAYLIST') {
                const { name, description } = action.payload;
                const { error } = await supabase.from('display_campaigns').insert({
                    commerce_id: commerceId,
                    name,
                    description: description || 'Playlist creada por IA',
                    type: 'playlist'
                });
                if (error) throw error;
                
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "¡Listo! La playlist **" + name + "** fue creada exitosamente.",
                    timestamp: new Date()
                }]);
            } else if (action.type === 'CREATE_CAMPAIGN') {
                const { name, description } = action.payload;
                const { error } = await supabase.from('display_campaigns').insert({
                    commerce_id: commerceId,
                    name,
                    description: description || 'Campaña creada por IA',
                    type: 'campaign'
                });
                if (error) throw error;
                
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "¡Listo! La campaña **" + name + "** fue creada exitosamente.",
                    timestamp: new Date()
                }]);
            }
        } catch (error: any) {
            console.error("Action error:", error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "Hubo un error al ejecutar la acción: " + error.message,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [commerceId]);

    const cancelAction = useCallback((action: AIAction) => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: "Se canceló la acción de crear " + (action.type === 'CREATE_PLAYLIST' ? 'la playlist' : 'la campaña') + ". ¿En qué más te puedo ayudar?",
            timestamp: new Date()
        }]);
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        executeAction,
        cancelAction
    };
}
