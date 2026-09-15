// ================================================================
// HooksResourceDrawer.tsx
// Banco de Ganchos Probados & Recursos de Retención (0-3s)
// Conexión directa con la tarjeta "Chat con IA" en el Lienzo
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState } from 'react';
import {
  Zap,
  Copy,
  Check,
  Send,
  Sparkles,
  X,
  Flame,
  ArrowRight,
  Filter,
  Eye,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { ScriptyFrameworkService, ScriptyHookFormula } from '../../../services/intelligence/ScriptyFrameworkService';
import { toast } from 'sonner';

interface HooksResourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyHookToChat?: (hookText: string) => void;
  businessNiche?: string;
  businessName?: string;
}

export const HooksResourceDrawer: React.FC<HooksResourceDrawerProps> = ({
  isOpen,
  onClose,
  onApplyHookToChat,
  businessNiche = 'Comercios y Negocios',
  businessName = 'Display Digital'
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const formulas = ScriptyFrameworkService.HOOK_FORMULAS;

  const categories = [
    { id: 'all', label: '🔥 Todos los Ganchos' },
    { id: 'negative', label: '⚠️ Aversión a la Pérdida' },
    { id: 'contrast', label: '👀 Antes vs Después' },
    { id: 'secret', label: '🤫 Secretos / Grandes Marcas' },
    { id: 'contrarian', label: '💥 Opinión Contraria' },
    { id: 'question', label: '❓ Pregunta al Dolor' },
    { id: 'proof', label: '📈 Prueba de Resultados' },
  ];

  const filteredFormulas = selectedCategory === 'all'
    ? formulas
    : formulas.filter(f => f.category === selectedCategory);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('¡Gancho copiado al portapapeles!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUseInChat = (hookText: string) => {
    if (onApplyHookToChat) {
      onApplyHookToChat(`Usá este gancho para el guión: "${hookText}"`);
      toast.success('¡Gancho enviado al Chat con IA!');
    } else {
      handleCopy(hookText, 'quick');
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-96 sm:w-[420px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      
      {/* 1. Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Ganchos Más Calientes (Hooks)
            </h3>
            <p className="text-[11px] text-slate-400">
              Fórmulas probadas para los primeros 3 segundos de tus Reels
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Filtro de Categorías */}
      <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 3. Lista de Ganchos */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
        {filteredFormulas.map((formula) => {
          const isCopied = copiedId === formula.id;
          const displayExample = formula.exampleDisplayDigital || formula.exampleRetail;

          return (
            <div
              key={formula.id}
              className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-pink-500/40 transition-all space-y-2.5 group"
            >
              {/* Header del Hook */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200 group-hover:text-pink-300 transition-colors">
                  {formula.name}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/30 text-pink-400 font-mono text-[10px] font-bold">
                  {formula.estimatedHookRate}
                </span>
              </div>

              {/* Fórmula Estructurada */}
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 font-mono">
                <span className="text-pink-400 font-bold block text-[10px] mb-0.5">Fórmula:</span>
                "{formula.framework}"
              </div>

              {/* Ejemplo Adaptado en Vivo */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Ejemplo adaptado a {businessName}:
                </span>
                <p className="text-xs text-slate-200 italic leading-relaxed bg-pink-950/20 border border-pink-500/20 p-2.5 rounded-xl">
                  "{displayExample}"
                </p>
              </div>

              {/* Por qué funciona */}
              <p className="text-[11px] text-slate-400 leading-snug">
                💡 <span className="text-slate-300">{formula.whyItWorks}</span>
              </p>

              {/* Botones de Acción */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopy(displayExample, formula.id)}
                  className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? '¡Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUseInChat(displayExample)}
                  className="py-1.5 px-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Usar en Chat IA</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Footer con Tip de Conversión */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60 text-center text-[11px] text-slate-400">
        <span>✨ Conectá un Reel al <strong>Chat con IA</strong> y hacé clic en "Usar en Chat IA" para ensamblar el guión automáticamente.</span>
      </div>

    </div>
  );
};
