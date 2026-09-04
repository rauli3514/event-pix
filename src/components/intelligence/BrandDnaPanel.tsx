import React, { useState } from 'react';
import { BrandDNA, IntelligenceBusiness } from '../../types/intelligence';
import { Brain, Sparkles, Sliders, Volume2, Target, CheckCircle2, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface BrandDnaPanelProps {
  business: IntelligenceBusiness;
  brandDna: BrandDNA;
  onUpdateDna: (updatedDna: BrandDNA) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const BrandDnaPanel: React.FC<BrandDnaPanelProps> = ({
  business,
  brandDna,
  onUpdateDna,
  isOpen,
  onToggle
}) => {
  const [dnaState, setDnaState] = useState<BrandDNA>(brandDna);
  const [newPhrase, setNewPhrase] = useState('');
  const [newForbidden, setNewForbidden] = useState('');
  const [activeTab, setActiveTab] = useState<'voice' | 'identity' | 'offers'>('voice');

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

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-0 top-24 z-40 bg-slate-900/90 border border-slate-800 border-l-0 text-violet-400 p-2.5 rounded-r-xl shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all flex items-center gap-2 group"
        title="Abrir Entrenador de Voz & ADN de Marca"
      >
        <Brain className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-semibold tracking-wide text-slate-200 hidden md:inline">ADN Marca</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <aside className="w-80 lg:w-96 bg-slate-950/95 border-r border-slate-800/80 h-[calc(100vh-4rem)] flex flex-col z-30 shadow-2xl backdrop-blur-xl transition-all duration-300">
      {/* Header Panel */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Entrenador de IA
              <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-mono">ADN</span>
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{business.name}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 p-1.5 bg-slate-900/80 border-b border-slate-800/60 text-xs font-medium">
        <button
          onClick={() => setActiveTab('voice')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'voice' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          Voz y Tono
        </button>
        <button
          onClick={() => setActiveTab('identity')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'identity' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          Identidad
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'offers' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Ofertas
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        {activeTab === 'voice' && (
          <>
            {/* Tono Primario */}
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-violet-400" />
                Tono Primario de Comunicación
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
                <option value="directo">Directo y de Autoridad (Recomendado B2B)</option>
                <option value="educativo">Educativo y Explicativo</option>
                <option value="humoristico">Humorístico e Irónico</option>
                <option value="inspiracional">Inspiracional y Motivacional</option>
                <option value="provocador">Provocador y Disruptivo</option>
              </select>
            </div>

            {/* Muletillas & Frases Frecuentes */}
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Muletillas & Frases Habituales</span>
                <span className="text-[10px] text-slate-500">{dnaState.voice_and_tone.favorite_catchphrases.length} agregadas</span>
              </label>
              <p className="text-[11px] text-slate-400">
                La IA incluirá estas frases en las aperturas para imitar tu voz real.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ej: Escuchá esto antes de..."
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
              <div className="space-y-1.5 pt-1">
                {dnaState.voice_and_tone.favorite_catchphrases.map((phrase, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900/80 border border-slate-800/80 px-2.5 py-1.5 rounded-lg">
                    <span className="text-slate-300 italic">"{phrase}"</span>
                    <button onClick={() => handleRemoveCatchphrase(idx)} className="text-slate-500 hover:text-red-400 p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Palabras Prohibidas */}
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Filtro de Marca (Lo que NUNCA dirías)</span>
              </label>
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
            </div>
          </>
        )}

        {activeTab === 'identity' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Misión del Negocio</label>
              <textarea
                rows={2}
                value={dnaState.identity.mission}
                onChange={(e) => {
                  const updated = {
                    ...dnaState,
                    identity: { ...dnaState.identity, mission: e.target.value }
                  };
                  setDnaState(updated);
                  onUpdateDna(updated);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Propuesta Única de Valor (UVP)</label>
              <textarea
                rows={3}
                value={dnaState.identity.unique_value_proposition}
                onChange={(e) => {
                  const updated = {
                    ...dnaState,
                    identity: { ...dnaState.identity, unique_value_proposition: e.target.value }
                  };
                  setDnaState(updated);
                  onUpdateDna(updated);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Cliente Ideal / Avatar</label>
              <textarea
                rows={3}
                value={dnaState.identity.target_avatar}
                onChange={(e) => {
                  const updated = {
                    ...dnaState,
                    identity: { ...dnaState.identity, target_avatar: e.target.value }
                  };
                  setDnaState(updated);
                  onUpdateDna(updated);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
        )}

        {activeTab === 'offers' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold">Productos o Servicios Principales</label>
              {dnaState.offers.main_products.map((prod, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-300 flex items-center justify-between">
                  <span>• {prod}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold">Llamados a la Acción (CTAs) de Cierre</label>
              {dnaState.offers.call_to_actions.map((cta, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-slate-300 italic text-[11px]">
                  "{cta}"
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 text-center">
        <span className="text-[11px] text-emerald-400 flex items-center justify-center gap-1.5 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          IA Entrenada con el ADN de {business.name}
        </span>
      </div>
    </aside>
  );
};
