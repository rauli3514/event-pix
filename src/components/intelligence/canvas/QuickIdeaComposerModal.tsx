// ================================================================
// QuickIdeaComposerModal.tsx
// Entrada rápida y simple para generar una idea de contenido: "¿Sobre
// qué quieres hablar hoy?" + sugerencias por defecto + selector de
// formato. Pensada para cuando no sabés por dónde arrancar, a
// diferencia de la tarjeta de Estrategia (más completa, con hipótesis,
// 3 variantes y experimentos).
//
// Usa siempre TODOS los Reels ya sincronizados del negocio como
// contexto automático — sin necesidad de conectarlos a mano con el
// cable del lienzo — para que la IA aprenda el tono y los temas reales
// de la cuenta en vez de tirar recomendaciones genéricas.
// ================================================================

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Copy, Check, Video, Play, FileText, RefreshCw, RotateCcw } from 'lucide-react';
import { ChatMessage, ContentFormatMode } from './AiChatCardNode';

interface QuickIdeaComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  activeMode: ContentFormatMode;
  onModeChange: (mode: ContentFormatMode) => void;
  onSend: (text: string) => Promise<void>;
  onReset: () => void;
  onOpenTeleprompter: (scriptText: string, title: string) => void;
  isGenerating: boolean;
  postsCount: number;
}

const FORMAT_PILLS: Array<{ id: ContentFormatMode; label: string; icon: any }> = [
  { id: 'reel_hablado', label: 'Reel hablado', icon: Play },
  { id: 'b_roll', label: 'B-roll', icon: Video },
  { id: 'carrusel', label: 'Carrusel', icon: FileText },
];

export const QuickIdeaComposerModal: React.FC<QuickIdeaComposerModalProps> = ({
  isOpen,
  onClose,
  messages,
  activeMode,
  onModeChange,
  onSend,
  onReset,
  onOpenTeleprompter,
  isGenerating,
  postsCount,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  if (!isOpen) return null;

  const suggestions = [
    'Dame 3 ideas de contenido para esta semana',
    'No sé qué decir hoy, dame una recomendación',
    ...(postsCount > 0 ? ['Extraé los mejores ganchos de mis Reels'] : []),
    ...(postsCount > 0 ? ['¿Qué debería grabar sabiendo lo que ya me funcionó?'] : []),
    'Escribime un guion para hoy',
  ];

  const handleSend = async (text: string) => {
    const clean = text.trim();
    if (!clean || isGenerating) return;
    setInputText('');
    await onSend(clean);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[85vh] rounded-2xl bg-slate-900 border border-pink-500/40 shadow-2xl shadow-pink-950/30 overflow-hidden flex flex-col text-slate-100">

        {/* ENCABEZADO */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Nueva Idea</h2>
              <p className="text-[11px] text-slate-400">
                {postsCount > 0 ? `Usando tus ${postsCount} Reels cargados como contexto` : 'Sin Reels cargados todavía'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                title="Empezar de nuevo"
                className="text-slate-400 hover:text-pink-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CUERPO */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-5 px-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-bold text-slate-100">¿Sobre qué quieres hablar hoy?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {postsCount > 0
                    ? `Contame tu idea y la cruzo con tus ${postsCount} Reels reales para que el guión suene a vos. O elegí una sugerencia rápida abajo.`
                    : 'Todavía no tenés Reels sincronizados, así que te voy a sugerir ideas generales para tu negocio. Sincronizá tus Reels desde el lienzo para respuestas basadas en lo que ya te funcionó.'}
                </p>
              </div>

              <div className="w-full max-w-md space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-left px-1">
                  Probá con
                </span>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-xs text-slate-200 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isAi = msg.sender === 'ai';
                return (
                  <div key={msg.id} className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} space-y-1.5`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                      {isAi ? (
                        <>
                          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white text-[8px] font-bold">
                            IA
                          </div>
                          <span>Nueva Idea</span>
                        </>
                      ) : (
                        <span>Tú</span>
                      )}
                    </div>

                    <div
                      className={`max-w-[92%] p-3 rounded-2xl leading-relaxed text-xs ${
                        isAi
                          ? 'bg-slate-950 border border-slate-800 text-slate-200'
                          : 'bg-pink-950/40 border border-pink-500/40 text-pink-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {msg.scriptData && (
                        <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-pink-500/30 space-y-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px]">
                            <span className="font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              GUION ({msg.scriptData.title || 'Adaptado'})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.scriptData!.fullScript, msg.id)}
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800"
                            >
                              {copiedId === msg.id ? (
                                <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copiado</span></>
                              ) : (
                                <><Copy className="w-3 h-3 text-pink-400" /><span>Copiar</span></>
                              )}
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
                            <p className="font-bold text-pink-300 bg-pink-950/20 p-2 rounded-lg border border-pink-500/20">
                              {msg.scriptData.hook}
                            </p>
                            <p className="text-slate-300">{msg.scriptData.body}</p>
                            <p className="text-emerald-300 font-bold bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                              {msg.scriptData.cta}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenTeleprompter(msg.scriptData!.fullScript, msg.scriptData!.title)}
                            className="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/20"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Enviar a Teleprompter / Studio
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isGenerating && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/80 border border-pink-500/30 text-pink-300 text-xs animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
                  <span>Pensando en base a tus Reels y tu estilo real...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* BARRA DE FORMATO + ENTRADA */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {FORMAT_PILLS.map((pill) => {
              const isSelected = activeMode === pill.id;
              const Icon = pill.icon;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => onModeChange(pill.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 ${
                    isSelected
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(inputText); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isGenerating}
              placeholder="Contame tu idea..."
              className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-pink-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
