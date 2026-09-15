// ================================================================
// AiChatCardNode.tsx
// Tarjeta de Inteligencia Estratégica, Experimentos y Guiones (Card #8)
// Bucle Completo: Datos -> Content DNA -> Hipótesis -> 3 Variantes -> Publicación -> Aprendizaje
// EventPix Intelligence — SaaS Studio
// ================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Paperclip,
  X,
  Send,
  Copy,
  Check,
  Video,
  ChevronDown,
  FileText,
  MessageCircle,
  Smartphone,
  RefreshCw,
  FlaskConical,
  TrendingUp,
  BrainCircuit,
  ExternalLink,
  Play,
  Loader2
} from 'lucide-react';
import {
  IntelligencePost,
  AccountMedianBenchmark,
  Hypothesis,
  ScriptVariant,
  ContentExperiment,
  LearnedInsight,
  EmpiricalPattern
} from '../../../types/intelligence';
import { AIProviderService } from '../../../services/intelligence/AIProviderService';
import { IntelligenceStorageService } from '../../../services/intelligence/IntelligenceStorageService';
import { ExperimentationService } from '../../../services/intelligence/ExperimentationService';
import { ConnectionStorageService } from '../../../services/intelligence/ConnectionStorageService';
import { MetaGraphService } from '../../../services/meta/MetaGraphService';
import { formatMetric, hasValue } from '../../../services/intelligence/metricUtils';
import { toast } from 'sonner';

export type ContentFormatMode = 'reel_hablado' | 'b_roll' | 'carrusel' | 'tweet' | 'stories';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  scriptData?: {
    title: string;
    hook: string;
    body: string;
    cta: string;
    fullScript: string;
  };
  timestamp: string;
}

interface AiChatCardNodeProps {
  cardId?: string;
  connectedPosts: IntelligencePost[];
  messages: ChatMessage[];
  activeMode: ContentFormatMode;
  onModeChange: (mode: ContentFormatMode) => void;
  onSendMessage: (text: string, mode: ContentFormatMode) => Promise<void>;
  onDisconnectAll: () => void;
  onDisconnectSource: (postId: string) => void;
  onOpenTeleprompter: (scriptText: string, title: string) => void;
  onClose?: () => void;
  isGenerating?: boolean;
  preferredAIProvider?: 'claude' | 'gemini' | 'openai' | 'local_engine' | 'auto';
  onSelectAIProvider?: (provider: 'claude' | 'gemini' | 'openai' | 'auto') => void;
}

const FORMAT_PILLS: Array<{ id: ContentFormatMode; label: string; icon: any }> = [
  { id: 'reel_hablado', label: 'Reel hablado', icon: Play },
  { id: 'b_roll', label: 'B-roll', icon: Video },
  { id: 'carrusel', label: 'Carrusel', icon: FileText },
  { id: 'tweet', label: 'Frase/tweet', icon: MessageCircle },
  { id: 'stories', label: 'Stories', icon: Smartphone }
];

export const AiChatCardNode: React.FC<AiChatCardNodeProps> = ({
  cardId = 'Card #8',
  connectedPosts,
  messages,
  activeMode,
  onModeChange,
  onSendMessage,
  onDisconnectAll,
  onDisconnectSource,
  onOpenTeleprompter,
  onClose,
  isGenerating = false,
  preferredAIProvider = 'claude',
  onSelectAIProvider
}) => {
  // Pestañas principales de la tarjeta
  const [activeTab, setActiveTab] = useState<'strategy' | 'experiments' | 'chat'>('strategy');

  // Estado de estrategia e hipótesis
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [variants, setVariants] = useState<{
    variantA: ScriptVariant;
    variantB: ScriptVariant;
    variantC: ScriptVariant;
  } | null>(null);
  const [selectedVariantKey, setSelectedVariantKey] = useState<'A' | 'B' | 'C'>('A');
  const [benchmark, setBenchmark] = useState<AccountMedianBenchmark | null>(null);
  const [, setPatterns] = useState<EmpiricalPattern[]>([]);
  const [, setWinningRules] = useState<string[]>([]);

  // Estado de experimentos y bucle de aprendizaje
  const [experiments, setExperiments] = useState<ContentExperiment[]>([]);
  const [learnedInsights, setLearnedInsights] = useState<LearnedInsight[]>([]);
  const [publishingExpId, setPublishingExpId] = useState<string | null>(null);
  const [selectedPublishReelId, setSelectedPublishReelId] = useState<string>('');
  const [evaluatingExpId, setEvaluatingExpId] = useState<string | null>(null);

  // Estado del chat interactivo
  const [inputText, setInputText] = useState('');
  const [isSourcesMenuOpen, setIsSourcesMenuOpen] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const businessId = IntelligenceStorageService.getActiveBusinessId() || 'tecno_eventos_arg';

  // Cargar benchmark, hipótesis y experimentos previos al montar
  useEffect(() => {
    const loadedBench = IntelligenceStorageService.getBenchmark(businessId);
    if (loadedBench) setBenchmark(loadedBench);

    const loadedHyp = IntelligenceStorageService.getHypotheses(businessId);
    if (loadedHyp.length > 0) setHypothesis(loadedHyp[0]);

    const loadedExp = IntelligenceStorageService.getExperiments(businessId);
    setExperiments(loadedExp);

    const loadedInsights = IntelligenceStorageService.getLearnedInsights(businessId);
    setLearnedInsights(loadedInsights);
  }, [businessId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, activeTab]);

  // Generar Estrategia con Fuentes Conectadas
  const handleGenerateStrategy = async () => {
    setIsGeneratingStrategy(true);
    try {
      // Obtener contexto de conexiones y perfil
      const connections = ConnectionStorageService.loadConnections(businessId);
      // `loadProfileContext` es async: sin await se pasaba una Promise a la IA
      // y el nicho, el tono y los CTAs del negocio nunca llegaban al prompt.
      const profileContext = (await IntelligenceStorageService.loadProfileContext(businessId)) || undefined;

      const result = await AIProviderService.generateEvidenceBasedStrategy({
        businessId,
        sourcePosts: connectedPosts,
        profileContext,
        connections,
        mode: activeMode === 'carrusel' ? 'carrusel' : activeMode === 'b_roll' ? 'b_roll' : 'reel_hablado'
      });

      setHypothesis(result.hypothesis);
      setVariants(result.variants);
      setBenchmark(result.benchmark);
      setPatterns(result.patterns);
      setWinningRules(result.winningRules);

      toast.success('¡Estrategia y 3 variantes generadas basadas en datos reales!');
    } catch (err: any) {
      toast.error('Error al generar estrategia: ' + (err.message || 'Verificá tu conexión'));
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  // Convertir variante seleccionada en experimento activo
  const handleCreateExperiment = () => {
    if (!hypothesis || !variants || !benchmark) {
      toast.error('Genera una estrategia primero para crear el experimento.');
      return;
    }

    const activeVar = variants[`variant${selectedVariantKey}`];
    const exp = ExperimentationService.createExperiment(
      businessId,
      hypothesis,
      activeVar.label,
      variants,
      benchmark,
      selectedVariantKey
    );

    setExperiments(prev => [exp, ...prev]);
    setActiveTab('experiments');
    toast.success(`Experimento creado: "${exp.title}". ¡Listo para publicar y medir!`);
  };

  // Marcar experimento como publicado
  const handleConfirmPublish = (expId: string) => {
    // Sin un Reel real asociado el experimento no se puede medir después.
    // Antes se generaba un ID simulado que hacía imposible cerrar el bucle.
    if (!selectedPublishReelId.trim()) {
      toast.error('Seleccioná el Reel real de Instagram con el que publicaste este experimento.');
      return;
    }

    const published = ExperimentationService.markAsPublished(
      businessId,
      expId,
      selectedPublishReelId.trim()
    );

    if (published) {
      setExperiments(IntelligenceStorageService.getExperiments(businessId));
      setPublishingExpId(null);
      toast.success('¡Experimento marcado como PUBLICADO! El sistema comparará métricas con la mediana.');
    }
  };

  // Evaluar experimento contra la mediana, exclusivamente con datos reales de Meta.
  // No hay ruta simulada: un veredicto fabricado se escribe en la memoria permanente
  // del negocio y contamina todos los guiones futuros.
  const handleEvaluateExperiment = async (exp: ContentExperiment) => {
    if (!benchmark) {
      toast.error('No hay benchmark de la cuenta todavía. Sincronizá tus Reels desde Meta primero.');
      return;
    }

    if (!exp.published_reel_id) {
      toast.error('Este experimento no tiene un Reel publicado asociado. Marcalo como publicado indicando el Reel real.');
      return;
    }

    if (!MetaGraphService.isConfigured()) {
      toast.error('Conectá la cuenta de Instagram vía Meta Graph API para poder medir el resultado real.');
      return;
    }

    setEvaluatingExpId(exp.experiment_id);
    const toastId = toast.loading('Consultando métricas reales del Reel en Meta...');

    try {
      const reels = await MetaGraphService.getReelsWithInsights(50);
      const publishedReel = reels.find(r => r.id === exp.published_reel_id);

      if (!publishedReel) {
        toast.error(
          'No se encontró ese Reel en la cuenta conectada. Verificá que el ID corresponda a un Reel publicado.',
          { id: toastId }
        );
        return;
      }

      const evalResult = ExperimentationService.evaluateExperimentResults(
        businessId,
        exp.experiment_id,
        publishedReel,
        benchmark
      );

      if (!evalResult) {
        toast.error('No se pudo evaluar el experimento.', { id: toastId });
        return;
      }

      setExperiments(IntelligenceStorageService.getExperiments(businessId));
      setLearnedInsights(IntelligenceStorageService.getLearnedInsights(businessId));

      if (evalResult.experiment.evaluation_verdict === 'SIN_DATOS_PARA_EVALUAR') {
        const missing = evalResult.experiment.missing_result_metrics?.join(', ') || 'las métricas necesarias';
        toast.warning(
          `Meta no reportó ${missing} para este Reel. El experimento queda sin evaluar y no se registró ningún aprendizaje.`,
          { id: toastId, duration: 8000 }
        );
      } else {
        toast.success('Métricas reales sincronizadas y aprendizaje registrado.', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Error consultando Meta: ' + (err?.message || 'desconocido'), { id: toastId });
    } finally {
      setEvaluatingExpId(null);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const textToSend = inputText.trim();
    setInputText('');
    await onSendMessage(textToSend, activeMode);
  };

  const handleCopy = (fullScript: string, idKey: string) => {
    navigator.clipboard.writeText(fullScript);
    setCopiedScriptId(idKey);
    toast.success('¡Guion copiado al portapapeles!');
    setTimeout(() => setCopiedScriptId(null), 2500);
  };

  const currentProviderLabel = preferredAIProvider === 'gemini'
    ? 'Gemini 1.5'
    : preferredAIProvider === 'claude'
    ? 'Claude Sonnet'
    : preferredAIProvider === 'openai'
    ? 'GPT-4o'
    : '⚡ Multi-IA (Auto)';

  const currentProviderColor = preferredAIProvider === 'gemini'
    ? 'text-sky-400 bg-sky-500/15 border-sky-500/30'
    : preferredAIProvider === 'claude'
    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    : preferredAIProvider === 'openai'
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/30';

  const currentVariant = variants ? variants[`variant${selectedVariantKey}`] : null;

  return (
    <div className="w-[390px] sm:w-[500px] rounded-2xl bg-slate-900 border border-pink-500/40 shadow-2xl shadow-pink-950/20 overflow-hidden flex flex-col max-h-[670px] text-slate-100">

      {/* 1. ENCABEZADO SUPERIOR */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0">
            <BrainCircuit className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-100 block truncate">
              Inteligencia Estratégica • {cardId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Selector de Motor IA */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAiMenuOpen(!isAiMenuOpen)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all hover:scale-105 ${currentProviderColor}`}
              title="Cambiar motor IA"
            >
              <span>{currentProviderLabel}</span>
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isAiMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAiMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl z-50 p-1.5 space-y-1 text-left">
                <button
                  type="button"
                  onClick={() => { onSelectAIProvider?.('auto'); setIsAiMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] ${preferredAIProvider === 'auto' || !preferredAIProvider ? 'bg-fuchsia-500/20 text-fuchsia-300 font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
                    ⚡ Multi-IA (Auto)
                  </span>
                  {(preferredAIProvider === 'auto' || !preferredAIProvider) && <Check className="w-3 h-3 text-fuchsia-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => { onSelectAIProvider?.('claude'); setIsAiMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] ${preferredAIProvider === 'claude' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Anthropic Claude
                  </span>
                  {preferredAIProvider === 'claude' && <Check className="w-3 h-3 text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => { onSelectAIProvider?.('gemini'); setIsAiMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] ${preferredAIProvider === 'gemini' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Google Gemini
                  </span>
                  {preferredAIProvider === 'gemini' && <Check className="w-3 h-3 text-sky-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => { onSelectAIProvider?.('openai'); setIsAiMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] ${preferredAIProvider === 'openai' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    OpenAI GPT-4o
                  </span>
                  {preferredAIProvider === 'openai' && <Check className="w-3 h-3 text-emerald-400" />}
                </button>
              </div>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. BARRA DE FUENTES CONECTADAS */}
      <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSourcesMenuOpen(!isSourcesMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/70 hover:bg-slate-800 text-[10px] font-medium text-pink-300 border border-pink-500/25"
          >
            <Paperclip className="w-3 h-3 text-pink-400" />
            <span>{connectedPosts.length} fuentes activas</span>
            <ChevronDown className={`w-2.5 h-2.5 text-slate-400 ${isSourcesMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSourcesMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-slate-950 border border-slate-800 shadow-xl z-50 p-2 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Reels conectados para análisis:
              </span>
              {connectedPosts.length === 0 ? (
                <p className="text-[11px] text-slate-500 px-1 italic">
                  Conectá Reels tirando una línea desde sus tarjetas en el lienzo.
                </p>
              ) : (
                connectedPosts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
                  >
                    <span className="truncate max-w-[170px]">{p.title}</span>
                    <button
                      type="button"
                      onClick={() => onDisconnectSource(p.id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {connectedPosts.length > 0 && (
          <button
            type="button"
            onClick={onDisconnectAll}
            className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
          >
            Desconectar todos
          </button>
        )}
      </div>

      {/* 3. NAVEGACIÓN POR PESTAÑAS (ESTRATEGIA | EXPERIMENTOS | COPILOTO) */}
      <div className="flex border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('strategy')}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'strategy'
              ? 'border-pink-500 text-pink-300 bg-pink-500/10 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Estrategia & Variantes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('experiments')}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'experiments'
              ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FlaskConical className="w-3 h-3" />
          <span>Experimentos ({experiments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'chat'
              ? 'border-sky-500 text-sky-300 bg-sky-500/10 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageCircle className="w-3 h-3" />
          <span>Copiloto</span>
        </button>
      </div>

      {/* 4. CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs custom-scrollbar bg-[#080C14]">

        {/* ============================================================ */}
        {/* PESTAÑA 1: ESTRATEGIA Y 3 VARIANTES (PRE-PUBLICACIÓN) */}
        {/* ============================================================ */}
        {activeTab === 'strategy' && (
          <div className="space-y-3">
            {/* Si no hay estrategia generada aún */}
            {!variants && !isGeneratingStrategy && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">Generar Estrategia Basada en Evidencia</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    Analiza las {connectedPosts.length} fuentes conectadas, calcula la mediana de la cuenta y formula 3 variantes probadas sin clichés.
                  </p>
                </div>

                {benchmark && (
                  <div className="grid grid-cols-2 gap-2 text-left bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px]">
                    <div>
                      <span className="text-slate-500 block">Mediana Reproducciones:</span>
                      <span className="font-mono font-bold text-slate-200">{formatMetric(benchmark.median_views)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Mediana Guardados:</span>
                      <span className="font-mono font-bold text-emerald-400">{formatMetric(benchmark.median_saves)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGenerateStrategy}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generar Estrategia y 3 Variantes</span>
                </button>
              </div>
            )}

            {/* Spinner de Generación Estratégica */}
            {isGeneratingStrategy && (
              <div className="p-6 rounded-xl bg-slate-900/80 border border-pink-500/30 text-center space-y-3 animate-pulse">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-pink-400" />
                <div>
                  <h4 className="font-bold text-pink-300 text-xs">Analizando Métricas Reales...</h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Calculando medianas estadísticas, deconstruyendo Content DNA y formulando 3 variantes...
                  </p>
                </div>
              </div>
            )}

            {/* Estrategia generada con Hipótesis y 3 Variantes */}
            {variants && hypothesis && !isGeneratingStrategy && (
              <div className="space-y-3">
                {/* Caja de Hipótesis y Evidencia */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      Hipótesis Activa
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      hypothesis.confidence === 'alta'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : hypothesis.confidence === 'media'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      Confianza: {hypothesis.confidence}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-slate-100 leading-snug">
                    {hypothesis.statement}
                  </p>

                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800/80 text-[10px] text-slate-300 space-y-1">
                    <p><strong className="text-pink-300">📊 Por qué:</strong> {hypothesis.evidence_basis}</p>
                    <p><strong className="text-emerald-300">🎯 Métrica a impactar:</strong> {hypothesis.target_benchmark_comparison}</p>
                  </div>
                </div>

                {/* Selector de Variantes (Tabs A, B, C) */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedVariantKey('A')}
                    className={`py-1.5 px-2 rounded-lg transition-all ${
                      selectedVariantKey === 'A'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Var A (Probada)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariantKey('B')}
                    className={`py-1.5 px-2 rounded-lg transition-all ${
                      selectedVariantKey === 'B'
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Var B (Alternativa)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariantKey('C')}
                    className={`py-1.5 px-2 rounded-lg transition-all ${
                      selectedVariantKey === 'C'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Var C (Creativa)
                  </button>
                </div>

                {/* Detalle de la Variante Activa */}
                {currentVariant && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-pink-500/30 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px]">
                      <span className="font-bold text-pink-300">{currentVariant.label}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`${currentVariant.hook_0_3s}\n\n${currentVariant.script_body}\n\n${currentVariant.cta_trigger}`, selectedVariantKey)}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800"
                      >
                        {copiedScriptId === selectedVariantKey ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-pink-400" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Gancho 0-3s */}
                    <div className="p-2 rounded-lg bg-pink-950/25 border border-pink-500/30">
                      <span className="text-[9px] font-bold text-pink-400 uppercase tracking-wider block mb-0.5">
                        ⏱️ Gancho (0-3 Segundos):
                      </span>
                      <p className="font-bold text-pink-200 text-[11px] leading-snug">
                        {currentVariant.hook_0_3s}
                      </p>
                    </div>

                    {/* Texto en Pantalla */}
                    <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-500/30">
                      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                        📱 Texto en Pantalla (On-screen):
                      </span>
                      <p className="font-mono text-[11px] text-amber-200">
                        {currentVariant.on_screen_text}
                      </p>
                    </div>

                    {/* Desarrollo del Guion */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        📝 Guion Completo:
                      </span>
                      <p className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        {currentVariant.script_body}
                      </p>
                    </div>

                    {/* CTA con disparador */}
                    <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">
                        📣 Llamado a la Acción (CTA):
                      </span>
                      <p className="font-bold text-emerald-200 text-[11px]">
                        {currentVariant.cta_trigger}
                      </p>
                    </div>

                    {/* Instrucciones de Grabación */}
                    <div className="p-2 rounded-lg bg-slate-900 text-[10px] text-slate-300 space-y-1">
                      <span className="font-bold text-slate-400 block">🎬 Cómo Grabarlo:</span>
                      <p>{currentVariant.shooting_directions}</p>
                    </div>

                    {/* Por qué esta variante */}
                    <p className="text-[10px] italic text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-800/60">
                      💡 {currentVariant.why_this_variant}
                    </p>

                    {/* Botones de Acción */}
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateExperiment}
                        className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Crear Experimento</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenTeleprompter(
                          `${currentVariant.hook_0_3s}\n\n${currentVariant.script_body}\n\n${currentVariant.cta_trigger}`,
                          currentVariant.label
                        )}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Teleprompter</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 2: EXPERIMENTOS Y APRENDIZAJE (POST-PUBLICACIÓN) */}
        {/* ============================================================ */}
        {activeTab === 'experiments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                Bucle de Aprendizaje Real
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('strategy')}
                className="text-[10px] text-pink-400 hover:underline"
              >
                + Nuevo Experimento
              </button>
            </div>

            {experiments.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <p className="text-slate-400 text-xs">No hay experimentos registrados todavía.</p>
                <p className="text-[11px] text-slate-500">
                  Genera una estrategia en la primera pestaña y presiona "Crear Experimento" para comenzar el ciclo.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('strategy')}
                  className="mt-2 py-1.5 px-3 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs"
                >
                  Ir a Estrategia
                </button>
              </div>
            ) : (
              experiments.map((exp) => {
                const isPublished = exp.status === 'PUBLISHED' || exp.status === 'COLLECTING_DATA' || exp.status === 'LEARNED';
                const isLearned = exp.status === 'LEARNED';

                return (
                  <div
                    key={exp.experiment_id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[200px]">
                        {exp.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isLearned
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isPublished
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {exp.status === 'READY' ? 'Listo p/ Grabar' : exp.status === 'COLLECTING_DATA' ? 'En Medición' : 'Aprendizaje Extraído'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      <strong>Variable testeada:</strong> {exp.variable_tested}
                    </p>

                    {/* Métricas y Comparativa contra la Mediana */}
                    {isLearned && exp.delta_vs_median && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-500 block">Guardados vs Mediana:</span>
                            <span className={`font-mono font-bold text-xs ${
                              !hasValue(exp.delta_vs_median.saves_pct)
                                ? 'text-slate-500'
                                : exp.delta_vs_median.saves_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {hasValue(exp.delta_vs_median.saves_pct) && exp.delta_vs_median.saves_pct >= 0 ? '+' : ''}
                              {formatMetric(exp.delta_vs_median.saves_pct, { suffix: '%' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Vistas vs Mediana:</span>
                            <span className={`font-mono font-bold text-xs ${
                              !hasValue(exp.delta_vs_median.views_pct)
                                ? 'text-slate-500'
                                : exp.delta_vs_median.views_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {hasValue(exp.delta_vs_median.views_pct) && exp.delta_vs_median.views_pct >= 0 ? '+' : ''}
                              {formatMetric(exp.delta_vs_median.views_pct, { suffix: '%' })}
                            </span>
                          </div>
                        </div>

                        {/* Aprendizaje extraído */}
                        {exp.learning_summary && (
                          <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/30 text-[10px] text-emerald-200">
                            <strong>🧠 Aprendizaje Incorporado:</strong> {exp.learning_summary}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Acciones del Experimento */}
                    {!isPublished && (
                      <div className="space-y-2">
                        {publishingExpId === exp.experiment_id ? (
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-sky-500/40 space-y-2">
                            <span className="text-[10px] text-slate-300 font-bold block">
                              Vincular Reel Publicado para Medición:
                            </span>
                            <select
                              value={selectedPublishReelId}
                              onChange={(e) => setSelectedPublishReelId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[10px] text-slate-200"
                            >
                              <option value="">Seleccionar de tus Reels recientes...</option>
                              {connectedPosts.map(p => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmPublish(exp.experiment_id)}
                                className="flex-1 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px]"
                              >
                                Confirmar Publicación
                              </button>
                              <button
                                type="button"
                                onClick={() => setPublishingExpId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[10px]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPublishingExpId(exp.experiment_id)}
                            className="w-full py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Marcar como Publicado en Instagram</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Botón para evaluar si ya está publicado pero no evaluado */}
                    {isPublished && !isLearned && (
                      <button
                        type="button"
                        onClick={() => handleEvaluateExperiment(exp)}
                        disabled={evaluatingExpId === exp.experiment_id}
                        className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {evaluatingExpId === exp.experiment_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5" />
                        )}
                        <span>{evaluatingExpId === exp.experiment_id ? 'Sincronizando con Meta...' : 'Sincronizar Métricas & Evaluar vs Mediana'}</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* Memoria de Aprendizajes Acumulados */}
            {learnedInsights.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 block">
                  🧠 Memoria Permanente del Negocio:
                </span>
                {learnedInsights.slice(0, 3).map(ins => (
                  <p key={ins.insight_id} className="text-[10px] text-slate-300 leading-snug">
                    • {ins.insight_text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 3: COPILOTO CHAT (CONVERSACIONAL EXISTENTE) */}
        {/* ============================================================ */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} space-y-1.5`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    {isAi ? (
                      <>
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white text-[8px] font-bold">
                          IA
                        </div>
                        <span>Copiloto ({currentProviderLabel})</span>
                      </>
                    ) : (
                      <>
                        <span>Tú</span>
                        <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-white text-[8px]">
                          U
                        </div>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[92%] p-3 rounded-2xl leading-relaxed text-xs ${
                      isAi
                        ? 'bg-slate-900 border border-slate-800 text-slate-200'
                        : 'bg-pink-950/40 border border-pink-500/40 text-pink-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {msg.scriptData && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-pink-500/30 space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px]">
                          <span className="font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            GUION ({msg.scriptData.title || 'Adaptado'})
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopy(msg.scriptData!.fullScript, msg.id)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800"
                          >
                            {copiedScriptId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-pink-400" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
                          <p className="font-bold text-pink-300 bg-pink-950/20 p-2 rounded-lg border border-pink-500/20">
                            {msg.scriptData.hook}
                          </p>
                          <p className="text-slate-300">
                            {msg.scriptData.body}
                          </p>
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
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-900/80 border border-pink-500/30 text-pink-300 text-xs animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
                <span>Procesando guion con tus fuentes conectadas y memoria de estilo...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

      </div>

      {/* 5. SELECTOR DE FORMATO & BARRA DE ENTRADA (Siempre visible para interacción fluida) */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2.5">
        
        {/* Pastillas de Formato */}
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

        {/* Input conversacional */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isGenerating || isGeneratingStrategy}
            placeholder={activeTab === 'chat' ? 'Ajustar guion, cambiar gancho o pedir alternativa...' : 'Escribí un objetivo o instrucción para la IA...'}
            className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating || isGeneratingStrategy}
            className="w-8 h-8 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
};
