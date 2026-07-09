import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { AIAgentService, saveOpenAIKey } from '@/services/AIAgentService';
import { AIActionCard } from './AIActionCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIAssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const SUGGESTIONS = [
    "¿Cómo conecto un TV Box?",
    "Creame una promoción para hamburguesa.",
    "Creame una playlist llamada Promos Invierno"
];

export function AIAssistantPanel({ isOpen, onClose }: AIAssistantPanelProps) {
    const { messages, isLoading, sendMessage, executeAction, cancelAction } = useAIAssistant();
    const [input, setInput] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isConfigured, setIsConfigured] = useState(AIAgentService.isConfigured());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        sendMessage(input);
        setInput('');
    };

    const handleSaveKey = () => {
        if (!apiKeyInput.trim()) return;
        saveOpenAIKey(apiKeyInput.trim());
        setIsConfigured(AIAgentService.isConfigured());
    };

    return (
        <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                        <Bot className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 leading-tight">Asistente IA</h3>
                        <p className="text-[10px] text-indigo-600 font-medium tracking-wide uppercase">Display Digital</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 scroll-smooth">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                            <div className={`
                                p-3 rounded-2xl text-[14px] leading-relaxed
                                ${msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                                }
                            `}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm prose-slate max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>
                            
                            {/* Render Action Card if present */}
                            {msg.action && (
                                <div className="mt-2">
                                    <AIActionCard 
                                        action={msg.action} 
                                        onExecute={executeAction} 
                                        onCancel={cancelAction} 
                                    />
                                </div>
                            )}
                        </div>
                        
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shrink-0 mr-2 order-1 mt-auto">
                                <Bot className="w-4 h-4 text-indigo-600" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shrink-0 mr-2">
                            <Bot className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm p-4 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                {messages.length === 1 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {SUGGESTIONS.map(s => (
                            <button 
                                key={s} 
                                onClick={() => sendMessage(s)}
                                className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-100 transition-colors text-left"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                
                {!isConfigured && (
                    <div className="mb-3 text-xs bg-amber-50 text-amber-700 border border-amber-200 p-3 rounded-lg flex flex-col gap-2">
                        <div className="flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>Para usar la IA, ingresa tu API Key de OpenAI:</span>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="password" 
                                placeholder="sk-..." 
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                className="flex-1 bg-white border border-amber-300 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                            />
                            <button 
                                onClick={handleSaveKey}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe tu mensaje o pedido..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-1 w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                </form>
                <div className="text-center mt-2 text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Asistente impulsado por IA. Puede cometer errores.
                </div>
            </div>
        </div>
    );
}
