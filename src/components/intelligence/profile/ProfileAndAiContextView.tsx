// ================================================================
// ProfileAndAiContextView.tsx
// Vista limpia de Identidad de Perfil, Contexto para la IA & CTAs
// Inspirada en la interfaz editorial y amigable de Scripty / Instaceos
// EventPix Intelligence — SaaS Studio
// ================================================================

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Sparkles, 
  MessageSquare, 
  Instagram, 
  Check, 
  Plus, 
  Trash2, 
  Save, 
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Tag,
  Camera
} from 'lucide-react';
import { UserProfileContext, CtaItem } from '../../../types/strategicProfile';
import { IntelligenceStorageService } from '../../../services/intelligence/IntelligenceStorageService';
import { toast } from 'sonner';

interface ProfileAndAiContextViewProps {
  businessId: string;
  onProfileUpdated?: (updated: UserProfileContext) => void;
}

const NICHES = [
  'Coaching & Marca Personal',
  'Cartelería Digital & Pantallas para Comercios',
  'Gastronomía, Bares & Cafeterías',
  'Indumentaria, Calzado & Moda',
  'Salud, Farmacias & Estética',
  'Gimnasios, Fitness & Deporte',
  'Servicios Profesionales & B2B',
  'Tecnología & Software',
  'Otro Rubro'
];

const LANGUAGES = [
  'Español (Latinoamérica)',
  'Español (Argentina / Rioplatense)',
  'Español (España)',
  'Inglés (Global)'
];

const TONES = [
  { id: 'cercano', label: 'Cercano & Cálido', desc: 'Conversacional, empático y de confianza' },
  { id: 'directo', label: 'Directo & Dinámico', desc: 'Sin rodeos, ágil y al hueso' },
  { id: 'empoderado', label: 'Empoderado & Visionario', desc: 'Firme, inspirador y de liderazgo' },
  { id: 'educativo', label: 'Educativo & Metódico', desc: 'Enseña procesos claros paso a paso' },
  { id: 'provocador', label: 'Provocador & Confrontativo', desc: 'Rompe mitos y desafía creencias' }
];

export const ProfileAndAiContextView: React.FC<ProfileAndAiContextViewProps> = ({
  businessId,
  onProfileUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai_context' | 'ctas' | 'instagram'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState<UserProfileContext | null>(null);

  // Estados locales para nuevos items
  const [newMustDo, setNewMustDo] = useState('');
  const [newForbidden, setNewForbidden] = useState('');
  const [newCatchphrase, setNewCatchphrase] = useState('');
  
  // Modal / form nuevo CTA
  const [isAddingCta, setIsAddingCta] = useState(false);
  const [newCtaKeyword, setNewCtaKeyword] = useState('');
  const [newCtaPhrase, setNewCtaPhrase] = useState('');
  const [newCtaType, setNewCtaType] = useState<CtaItem['action_type']>('comment_keyword');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const data = await IntelligenceStorageService.loadProfileContext(businessId);
      if (isMounted) {
        setContext(data);
        setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [businessId]);

  const handleSave = async () => {
    if (!context) return;
    setSaving(true);
    try {
      await IntelligenceStorageService.saveProfileContext(businessId, context);
      toast.success('¡Configuración de perfil y contexto IA guardada exitosamente!');
      if (onProfileUpdated) {
        onProfileUpdated(context);
      }
    } catch {
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !context) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ENCABEZADO DE SUB-PESTAÑAS (ESTILO SCRIPTY / INSTACEOS) */}
        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Perfil
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_context')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'ai_context'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Contexto para la IA
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ctas')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'ctas'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Lista de CTAs ({context.cta_list.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('instagram')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'instagram'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Vincular Instagram
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition-all hover:border-pink-500/50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-pink-400" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* SUB-PESTAÑA 1: IDENTIDAD DEL PERFIL */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 font-serif tracking-tight">
                Identidad del perfil
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Foto de Instagram y descripción del contenido que publica este perfil.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start pt-2">
              {/* Avatar con Aro de Instagram */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-center">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 shadow-xl shadow-pink-600/10 mb-3">
                  <div className="p-0.5 bg-slate-950 rounded-full">
                    <img
                      src={context.profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
                      alt="Avatar"
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover"
                    />
                  </div>
                </div>

                <span className="text-sm font-bold text-slate-200">@{context.profile.instagram_handle}</span>
                <span className="text-[11px] text-pink-400 font-medium mb-3">{context.profile.niche}</span>

                <button
                  type="button"
                  onClick={() => {
                    const newUrl = prompt('Ingresá la URL de tu foto de perfil:', context.profile.avatar_url);
                    if (newUrl) {
                      setContext({
                        ...context,
                        profile: { ...context.profile, avatar_url: newUrl }
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-pink-400" />
                  Cambiar foto
                </button>
              </div>

              {/* Formulario de Campos */}
              <div className="md:col-span-8 space-y-4">
                
                {/* Usuario de Instagram */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                    Instagram
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs">
                    <span className="text-slate-500 font-mono pr-1">@</span>
                    <input
                      type="text"
                      value={context.profile.instagram_handle}
                      onChange={(e) => setContext({
                        ...context,
                        profile: { ...context.profile, instagram_handle: e.target.value.replace('@', '') }
                      })}
                      className="bg-transparent text-slate-100 flex-1 outline-none font-mono"
                      placeholder="tu_usuario"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    El usuario de Instagram se utiliza para auditar métricas reales de Reels y competidores.
                  </p>
                </div>

                {/* Nicho que abordas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Nicho que abordás
                  </label>
                  <select
                    value={context.profile.niche}
                    onChange={(e) => setContext({
                      ...context,
                      profile: { ...context.profile, niche: e.target.value }
                    })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500/60"
                  >
                    {NICHES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Idioma */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Idioma de tu contenido
                  </label>
                  <select
                    value={context.profile.language}
                    onChange={(e) => setContext({
                      ...context,
                      profile: { ...context.profile, language: e.target.value }
                    })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500/60"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    La IA generará tu contenido en este idioma. Respetará la jerga local y modismos.
                  </p>
                </div>

                {/* De qué hablas en tu contenido */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    De qué hablás en tu contenido y a quién ayudás
                  </label>
                  <textarea
                    rows={4}
                    value={context.profile.about_content}
                    onChange={(e) => setContext({
                      ...context,
                      profile: { ...context.profile, about_content: e.target.value }
                    })}
                    placeholder="Describe tu propuesta, a quién le hablas y el beneficio tangible que brindas..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-100 outline-none focus:border-pink-500/60 leading-relaxed custom-scrollbar"
                  />
                  <p className="text-[10px] text-slate-500">
                    Esta descripción es la base de la Memoria Permanente. La IA la utiliza en cada guión para no desviar tu mensaje.
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-PESTAÑA 2: CONTEXTO PARA LA IA (MEMORIA PERMANENTE) */}
        {/* ========================================================================= */}
        {activeTab === 'ai_context' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 font-serif tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" />
                Contexto para la IA
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Definí tu personalidad, tono de voz y las reglas estrictas que la IA debe respetar en cada guión.
              </p>
            </div>

            {/* Selector de Tono de Voz */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Tono de voz principal
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {TONES.map((t) => {
                  const isSelected = context.ai_context.tone === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setContext({
                        ...context,
                        ai_context: { ...context.ai_context, tone: t.id as any }
                      })}
                      className={`p-3 rounded-xl border cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'bg-pink-950/30 border-pink-500/60 text-pink-200 shadow-sm'
                          : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-100">{t.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-pink-400 stroke-[3]" />}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{t.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reglas que la IA DEBE cumplir */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Lo que la IA DEBE hacer siempre (Reglas de estilo)
              </label>
              <div className="space-y-2">
                {context.ai_context.must_do_rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200">
                    <span className="leading-snug">{rule}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = context.ai_context.must_do_rules.filter((_, i) => i !== idx);
                        setContext({
                          ...context,
                          ai_context: { ...context.ai_context, must_do_rules: next }
                        });
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMustDo}
                    onChange={(e) => setNewMustDo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newMustDo.trim()) {
                        e.preventDefault();
                        setContext({
                          ...context,
                          ai_context: {
                            ...context.ai_context,
                            must_do_rules: [...context.ai_context.must_do_rules, newMustDo.trim()]
                          }
                        });
                        setNewMustDo('');
                      }
                    }}
                    placeholder="Ej: Mantener los primeros 3 segundos con gancho de alto impacto..."
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMustDo.trim()) return;
                      setContext({
                        ...context,
                        ai_context: {
                          ...context.ai_context,
                          must_do_rules: [...context.ai_context.must_do_rules, newMustDo.trim()]
                        }
                      });
                      setNewMustDo('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Reglas que la IA NUNCA debe hacer */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                Lo que la IA NUNCA debe hacer (Palabras y estilos prohibidos)
              </label>
              <div className="space-y-2">
                {context.ai_context.forbidden_rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200">
                    <span className="leading-snug">{rule}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = context.ai_context.forbidden_rules.filter((_, i) => i !== idx);
                        setContext({
                          ...context,
                          ai_context: { ...context.ai_context, forbidden_rules: next }
                        });
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newForbidden}
                    onChange={(e) => setNewForbidden(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newForbidden.trim()) {
                        e.preventDefault();
                        setContext({
                          ...context,
                          ai_context: {
                            ...context.ai_context,
                            forbidden_rules: [...context.ai_context.forbidden_rules, newForbidden.trim()]
                          }
                        });
                        setNewForbidden('');
                      }
                    }}
                    placeholder="Ej: No sonar como locutor de publicidad ni usar la palabra 'oferta barata'..."
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-rose-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newForbidden.trim()) return;
                      setContext({
                        ...context,
                        ai_context: {
                          ...context.ai_context,
                          forbidden_rules: [...context.ai_context.forbidden_rules, newForbidden.trim()]
                        }
                      });
                      setNewForbidden('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Frases de Cabecera Favoritas */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Frases de cabecera favoritas (Muletillas o eslóganes)
              </label>
              <div className="space-y-2">
                {context.ai_context.favorite_catchphrases.map((phrase, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200">
                    <span className="font-serif italic text-pink-300">"{phrase}"</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = context.ai_context.favorite_catchphrases.filter((_, i) => i !== idx);
                        setContext({
                          ...context,
                          ai_context: { ...context.ai_context, favorite_catchphrases: next }
                        });
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatchphrase}
                    onChange={(e) => setNewCatchphrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCatchphrase.trim()) {
                        e.preventDefault();
                        setContext({
                          ...context,
                          ai_context: {
                            ...context.ai_context,
                            favorite_catchphrases: [...context.ai_context.favorite_catchphrases, newCatchphrase.trim()]
                          }
                        });
                        setNewCatchphrase('');
                      }
                    }}
                    placeholder="Ej: El dinero que no se mueve, no crece..."
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCatchphrase.trim()) return;
                      setContext({
                        ...context,
                        ai_context: {
                          ...context.ai_context,
                          favorite_catchphrases: [...context.ai_context.favorite_catchphrases, newCatchphrase.trim()]
                        }
                      });
                      setNewCatchphrase('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-violet-400 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-PESTAÑA 3: LISTA DE CTAS (CALLS TO ACTION) */}
        {/* ========================================================================= */}
        {activeTab === 'ctas' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-100 font-serif tracking-tight flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-pink-400" />
                  Lista de CTAs (Llamados a la Acción)
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Guardá las palabras clave y frases con las que querés cerrar tus Reels y automatizaciones.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingCta(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-md shadow-pink-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo CTA
              </button>
            </div>

            {/* Formulario para agregar nuevo CTA */}
            {isAddingCta && (
              <div className="p-4 rounded-xl bg-slate-950 border border-pink-500/40 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-300">Crear nuevo Llamado a la Acción</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCta(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Palabra Clave (Trigger)</label>
                    <input
                      type="text"
                      value={newCtaKeyword}
                      onChange={(e) => setNewCtaKeyword(e.target.value.toUpperCase())}
                      placeholder="Ej: APP, PRECIO"
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs font-mono font-bold text-pink-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Acción</label>
                    <select
                      value={newCtaType}
                      onChange={(e) => setNewCtaType(e.target.value as any)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 outline-none"
                    >
                      <option value="comment_keyword">Comentar palabra clave</option>
                      <option value="whatsapp">Derivar a WhatsApp</option>
                      <option value="link_in_bio">Enlace en bio</option>
                      <option value="dm">Mensaje directo (DM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Acción</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCtaKeyword.trim() || !newCtaPhrase.trim()) {
                          toast.error('Completá la palabra clave y la frase');
                          return;
                        }
                        const newItem: CtaItem = {
                          id: 'cta_' + Date.now(),
                          keyword: newCtaKeyword.trim(),
                          full_phrase: newCtaPhrase.trim(),
                          action_type: newCtaType,
                          is_favorite: true
                        };
                        setContext({
                          ...context,
                          cta_list: [newItem, ...context.cta_list]
                        });
                        setNewCtaKeyword('');
                        setNewCtaPhrase('');
                        setIsAddingCta(false);
                      }}
                      className="w-full mt-0.5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-sm"
                    >
                      Guardar CTA
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Frase Completa Hablada / Escrita</label>
                  <input
                    type="text"
                    value={newCtaPhrase}
                    onChange={(e) => setNewCtaPhrase(e.target.value)}
                    placeholder='Ej: Comentá "APP" y te la envío ya mismo al privado!! 👇'
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Listado de CTAs activos */}
            <div className="space-y-3">
              {context.cta_list.map((cta) => (
                <div
                  key={cta.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-all flex items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs font-mono font-bold">
                        {cta.keyword}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                        {cta.action_type === 'comment_keyword' ? 'Comentar' : cta.action_type === 'whatsapp' ? 'WhatsApp' : 'Enlace'}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-200 font-medium leading-snug">
                      "{cta.full_phrase}"
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = context.cta_list.filter(c => c.id !== cta.id);
                      setContext({
                        ...context,
                        cta_list: next
                      });
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1.5 transition-colors shrink-0 rounded-lg hover:bg-slate-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-PESTAÑA 4: VINCULAR INSTAGRAM */}
        {/* ========================================================================= */}
        {activeTab === 'instagram' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 font-serif tracking-tight flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-400" />
                Vincular cuenta de Instagram
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Conectá tu cuenta oficial con Meta Graph API para sincronizar Reels reales, vistas y guardados.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <Instagram className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-100 block">@{context.profile.instagram_handle}</span>
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Vinculado con EventPix Intelligence
                  </span>
                </div>
              </div>

              <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                Meta Graph API v19.0
              </span>
            </div>

            <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 text-xs text-slate-300 space-y-1.5">
              <div className="font-bold text-violet-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Inteligencia Artificial Centralizada
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Toda la generación de ideas y guiones utiliza los modelos de OpenAI y Claude provistos por EventPix.
                No necesitás pagar ni configurar claves de API de ChatGPT.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
