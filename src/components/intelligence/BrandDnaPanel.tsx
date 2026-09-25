import React, { useState } from 'react';
import { BrandDNA, IntelligenceBusiness } from '../../types/intelligence';
import { Brain, Sparkles, Sliders, Plus, Trash2, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface BrandDnaPanelProps {
  business: IntelligenceBusiness;
  brandDna: BrandDNA;
  onUpdateDna: (updatedDna: BrandDNA) => void;
  isOpen: boolean;
  onToggle: () => void;
  onEditFullProfile?: () => void;
}

// Panel resumido: accesos rápidos mientras trabajás en el Lienzo — tono de
// voz, filtros de marca (muletillas/palabras prohibidas) y CTAs para
// copiar. La identidad completa (misión, UVP, avatar) ya vive en
// "Perfil & Contexto IA" y no se duplica acá.
export const BrandDnaPanel: React.FC<BrandDnaPanelProps> = ({
  business,
  brandDna,
  onUpdateDna,
  isOpen,
  onToggle,
  onEditFullProfile
}) => {
  const [dnaState, setDnaState] = useState<BrandDNA>(brandDna);
  const [newPhrase, setNewPhrase] = useState('');
  const [newForbidden, setNewForbidden] = useState('');

  const handleAddCatchphrase = () => {
    if (!newPhrase.trim()) return;
    const updated = {
      ...dnaState,
      voice_and_tone: {
        ...dnaState.voice_and_tone,
        favorite_catchphrases: [...dnaState.voice_and_tone.favorite_catchphrases, newPhrase.trim()]
      }
    };
    setDnaState(updated);
    onUpdateDna(updated);
    setNewPhrase('');
  };

  const handleRemoveCatchphrase = (index: number) => {
    const updated = {
      ...dnaState,
      voice_and_tone: {
        ...dnaState.voice_and_tone,
        favorite_catchphrases: dnaState.voice_and_tone.favorite_catchphrases.filter((_, i) => i !== index)
      }
    };
    setDnaState(updated);
    onUpdateDna(updated);
  };

  const handleAddForbidden = () => {
    if (!newForbidden.trim()) return;
    const updated = {
      ...dnaState,
      voice_and_tone: {
        ...dnaState.voice_and_tone,
        forbidden_words: [...dnaState.voice_and_tone.forbidden_words, newForbidden.trim()]
      }
    };
    setDnaState(updated);
    onUpdateDna(updated);
    setNewForbidden('');
  };

  const handleRemoveForbidden = (index: number) => {
    const updated = {
      ...dnaState,
      voice_and_tone: {
        ...dnaState.voice_and_tone,
        forbidden_words: dnaState.voice_and_tone.forbidden_words.filter((_, i) => i !== index)
      }
    };
    setDnaState(updated);
    onUpdateDna(updated);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copiado al portapapeles.'));
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-0 top-24 z-40 bg-slate-900/90 border border-slate-800 border-l-0 text-violet-400 p-2.5 rounded-r-xl shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all flex items-center gap-2 group"
        title="Abrir Accesos Rápidos de Marca"
      >
        <Brain className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-semibold tracking-wide text-slate-200 hidden md:inline">Marca</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <aside className="w-64 sm:w-72 shrink-0 bg-slate-950/95 border-r border-slate-800/80 h-[calc(100vh-4rem)] flex flex-col z-30 shadow-2xl backdrop-blur-xl transition-all duration-300">
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Accesos de Marca
              <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-mono">RÁPIDO</span>
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[180px]">{business.name}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        {/* Tono Primario */}
        <div className="space-y-2">
          <label className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            Tono Primario
          </label>
          <select
            value={dnaState.voice_and_tone.primary_tone}
            onChange={(e) => {
              const updated = {
                ...dnaState,
                voice_and_tone: {
                  ...dnaState.voice_and_tone,
                  primary_tone: e.target.value as any
                }
              };
              setDnaState(updated);
              onUpdateDna(updated);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="directo">Directo y de Autoridad</option>
            <option value="educativo">Educativo y Explicativo</option>
            <option value="humoristico">Humorístico e Irónico</option>
            <option value="inspiracional">Inspiracional y Motivacional</option>
            <option value="provocador">Provocador y Disruptivo</option>
          </select>
        </div>

        {/* Filtros de Marca: muletillas + prohibidas, compacto */}
        <div className="space-y-2 pt-2 border-t border-slate-800/60">
          <label className="text-slate-300 font-semibold">Frases Habituales</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ej: Escuchá esto..."
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCatchphrase()}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleAddCatchphrase}
              className="bg-violet-600 hover:bg-violet-500 text-white p-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {dnaState.voice_and_tone.favorite_catchphrases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {dnaState.voice_and_tone.favorite_catchphrases.map((phrase, idx) => (
                <span key={idx} className="bg-slate-900/80 border border-slate-800/80 pl-2 pr-1 py-1 rounded-lg flex items-center gap-1 text-slate-300 italic">
                  "{phrase}"
                  <button onClick={() => handleRemoveCatchphrase(idx)} className="text-slate-500 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-slate-300 font-semibold">Nunca Decir</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ej: Algoritmo mágico"
              value={newForbidden}
              onChange={(e) => setNewForbidden(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddForbidden()}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleAddForbidden}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {dnaState.voice_and_tone.forbidden_words.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {dnaState.voice_and_tone.forbidden_words.map((word, idx) => (
                <span key={idx} className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px]">
                  {word}
                  <button onClick={() => handleRemoveForbidden(idx)} className="hover:text-red-300">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTAs rápidos para copiar mientras se arma contenido en el Lienzo */}
        {dnaState.offers.call_to_actions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              CTAs para Copiar
            </label>
            <div className="space-y-1.5">
              {dnaState.offers.call_to_actions.map((cta, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopy(cta)}
                  className="w-full text-left bg-slate-900 border border-slate-800 hover:border-violet-500/50 p-2.5 rounded-xl text-slate-300 italic text-[11px] flex items-center justify-between gap-2 transition-colors group"
                >
                  <span>"{cta}"</span>
                  <Copy className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {onEditFullProfile && (
          <button
            onClick={onEditFullProfile}
            className="w-full py-2 px-3 bg-slate-900 border border-slate-800 hover:border-violet-500/50 text-slate-300 hover:text-violet-300 rounded-xl font-semibold text-[11px] transition-all"
          >
            Editar Perfil Completo →
          </button>
        )}
      </div>
    </aside>
  );
};
