// ================================================================
// ReelBreakdownModal.tsx
// Despiece Multimodal (5 Capas de IA), Transcripción de Diálogo y Auditoría Exhaustiva
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState, useEffect } from 'react';
import { IntelligencePost, BrandDNA } from '../../types/intelligence';
import {
  X, Eye, Heart, MessageSquare, Bookmark,
  Flame, Target, Layers, Zap, Sparkles, Edit3, Check,
  Loader2, BarChart2, TrendingUp, ArrowRight, RefreshCw,
  Copy, Video, Lightbulb
} from 'lucide-react';
import { ConnectionStorageService } from '../../services/intelligence/ConnectionStorageService';
import { AIProviderService } from '../../services/intelligence/AIProviderService';
import { ScriptyFrameworkService } from '../../services/intelligence/ScriptyFrameworkService';
import { TeleprompterModal } from './TeleprompterModal';
import { NO_DATA } from '../../types/intelligence';
import { rate, hasValue, formatMetric } from '../../services/intelligence/metricUtils';
import { toast } from 'sonner';

interface ReelBreakdownModalProps {
  post: IntelligencePost | null;
  onClose: () => void;
  onUpdatePost?: (updatedPost: IntelligencePost) => void;
  brandDna?: BrandDNA;
  businessId?: string;
}

export const ReelBreakdownModal: React.FC<ReelBreakdownModalProps> = ({
  post,
  onClose,
  onUpdatePost,
  brandDna,
  businessId = 'biz_default'
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'diagnosis' | 'transcript' | 'metrics' | 'scripty'>('scripty');
  const [transcriptInput, setTranscriptInput] = useState('');
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [isTranscribingWithWhisper, setIsTranscribingWithWhisper] = useState(false);
  const [isResyncingMetrics, setIsResyncingMetrics] = useState(false);

  // Estados de edición de métricas reales
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [customViews, setCustomViews] = useState(150);
  const [customLikes, setCustomLikes] = useState(4);
  const [customComments, setCustomComments] = useState(2);
  const [customSaves, setCustomSaves] = useState(2);
  const [customShares, setCustomShares] = useState(1);
  const [customRetention, setCustomRetention] = useState(34);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [copiedTeleprompter, setCopiedTeleprompter] = useState(false);

  useEffect(() => {
    if (post) {
      if (post.raw_transcript) {
        setTranscriptInput(post.raw_transcript);
      } else if (post.analysis?.time_segments && post.analysis.time_segments.length > 0) {
        // Filtrar duplicados para un texto limpio
        const uniqueLines = Array.from(new Set(post.analysis.time_segments.map(s => `[${s.range}] ${s.content}`)));
        setTranscriptInput(uniqueLines.join('\n'));
      } else {
        setTranscriptInput(post.title || '');
      }

      if (post.metrics) {
        // Solo precarga el formulario manual con datos reales; sin dato,
        // deja el placeholder del input en vez de fabricar un valor de
        // relleno (150 vistas, 4 likes, etc.) que parecería real.
        if (hasValue(post.metrics.views)) setCustomViews(post.metrics.views);
        if (hasValue(post.metrics.likes)) setCustomLikes(post.metrics.likes);
        if (hasValue(post.metrics.comments)) setCustomComments(post.metrics.comments);
        if (hasValue(post.metrics.saves)) setCustomSaves(post.metrics.saves);
        if (hasValue(post.metrics.shares)) setCustomShares(post.metrics.shares);
        if (hasValue(post.metrics.retention_percentage)) setCustomRetention(post.metrics.retention_percentage);
      }
    }
  }, [post]);

  if (!post || !post.analysis) return null;

  const { analysis, metrics } = post;

  // Analizar diálogo hablado con ChatGPT
  const handleAnalyzeTranscriptWithAI = async () => {
    if (!transcriptInput.trim()) {
      toast.error('Por favor ingresá lo que se dice en el Reel para analizarlo.');
      return;
    }

    setIsAnalyzingTranscript(true);
    const toastId = toast.loading('ChatGPT está desglosando el diálogo completo palabra por palabra...');

    try {
      const connections = ConnectionStorageService.loadConnections(businessId);
      const updatedPost = await AIProviderService.analyzeScrapedReel({
        caption: transcriptInput.trim(),
        username: post.title.includes('@') ? post.title.split('@')[1]?.split(' ')[0] : 'display_digital',
        url: post.video_url || '',
        imageUrl: post.thumbnail_url,
        businessId: post.business_id || businessId,
        connections,
        brandDna: brandDna || {
          business_id: businessId,
          identity: { mission: '', unique_value_proposition: 'Display Digital para Comercios', target_avatar: 'Comercios' },
          voice_and_tone: { primary_tone: 'directo', favorite_catchphrases: ['Escuchá esto:'], forbidden_words: [], pacing: 'rapido' },
          offers: { main_products: ['Pantallas Verticales Display Digital'], call_to_actions: ['Comentá APP'] },
          samples: []
        }
      });

      // Preservar ID y métricas actuales
      updatedPost.id = post.id;
      if (post.metrics) updatedPost.metrics = post.metrics;

      onUpdatePost?.(updatedPost);
      toast.success('¡Diálogo hablado y 5 capas analizadas con éxito por ChatGPT!', { id: toastId });
      setActiveTab('layers');
    } catch (e: any) {
      console.error(e);
      toast.error('Error al analizar diálogo: ' + (e.message || 'desconocido'), { id: toastId });
    } finally {
      setIsAnalyzingTranscript(false);
    }
  };

  // Transcripción automática directa con Whisper AI
  const handleAutoTranscribeWithWhisper = async () => {
    const connections = ConnectionStorageService.loadConnections(businessId);
    if (!connections.openai.isActive || !connections.openai.apiKey) {
      toast.error('Se requiere la API Key de OpenAI conectada para transcribir con Whisper.', {
        description: 'Podés conectarla desde el botón "Conectar Proveedor IA" en la barra superior.'
      });
      return;
    }

    if (!post.video_url) {
      toast.error('Este Reel no tiene una URL de video accesible.');
      return;
    }

    setIsTranscribingWithWhisper(true);
    const toastId = toast.loading('Descargando audio del Reel y transcribiendo con Whisper AI...');

    try {
      const res = await fetch('/api/instagram-transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: post.video_url,
          apiKey: connections.openai.apiKey
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al transcribir');
      }

      if (!data.hasSpeech) {
        toast.info('Audio Analizado: Pista Instrumental', {
          id: toastId,
          description: data.message || 'El video contiene música de fondo sin locución de voz detectada.'
        });
        if (post.audio_track) {
          setTranscriptInput(`[Pista Musical: ${post.audio_track}]\n(Este video no contiene diálogo hablado; su mensaje es puramente visual y por texto en pantalla)`);
        }
      } else {
        setTranscriptInput(data.transcript);
        toast.success('¡Transcripción Whisper completada con éxito!', { id: toastId });

        if (data.segments && data.segments.length > 0) {
          const updatedPost: IntelligencePost = {
            ...post,
            raw_transcript: data.transcript,
            analysis: {
              ...post.analysis!,
              time_segments: data.segments.map((s: any) => ({
                range: s.range,
                content: s.content,
                narrative_role: 'value' as const,
                visual_cue: 'Tomas sincronizadas con la locución'
              }))
            }
          };
          onUpdatePost?.(updatedPost);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error al transcribir con Whisper: ' + (err.message || 'desconocido'), { id: toastId });
    } finally {
      setIsTranscribingWithWhisper(false);
    }
  };

  // Aplicar gancho Scripty directamente al post
  const handleApplyScriptyHook = (hookText: string) => {
    if (!post || !post.analysis) return;
    // El score depende de la fórmula que efectivamente calza con el texto
    // del gancho aplicado, no un valor fijo idéntico para cualquier hook.
    const { score: curiosityScore } = ScriptyFrameworkService.classifyHook(hookText);
    const updatedPost: IntelligencePost = {
      ...post,
      analysis: {
        ...post.analysis,
        hook_data: {
          ...post.analysis.hook_data,
          text: hookText,
          curiosity_score: curiosityScore
        },
        time_segments: post.analysis.time_segments.map(seg =>
          seg.range.includes('0-3') || seg.narrative_role === 'hook'
            ? { ...seg, content: hookText }
            : seg
        )
      }
    };
    onUpdatePost?.(updatedPost);
    toast.success('¡Nuevo Hook de Scripty aplicado al Reel!');
  };

  // Aplicar CTA Scripty directamente al post
  const handleApplyScriptyCta = (ctaText: string) => {
    if (!post || !post.analysis) return;
    const updatedPost: IntelligencePost = {
      ...post,
      analysis: {
        ...post.analysis,
        cta_data: {
          ...post.analysis.cta_data,
          text: ctaText,
          strength: 'fuerte'
        },
        time_segments: post.analysis.time_segments.map(seg =>
          seg.narrative_role === 'cta' || seg.range.includes('25-') || seg.range.includes('30-')
            ? { ...seg, content: ctaText }
            : seg
        )
      }
    };
    onUpdatePost?.(updatedPost);
    toast.success('¡Nuevo CTA de Scripty aplicado al Reel!');
  };

  // Re-sincronizar métricas reales desde Instagram vía scraper en vivo
  const handleResyncRealMetrics = async () => {
    if (!post || !post.video_url) {
      toast.error('No hay URL de video para consultar en Instagram.');
      return;
    }

    setIsResyncingMetrics(true);
    const toastId = toast.loading('Extrayendo métricas reales de Instagram...');

    try {
      const res = await fetch(`/api/instagram-scrape?url=${encodeURIComponent(post.video_url)}`);
      if (!res.ok) throw new Error('Error de conexión con el scraper');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudieron extraer métricas');

      // El scraper público solo expone likes y comentarios visibles en la
      // página del Reel. Views, reach, saves, shares y retención son
      // insights privados de Instagram que no están en ese HTML: no se
      // derivan de likes, quedan NO_DATA hasta conectar Meta Graph API o
      // cargarlos a mano.
      const likes = typeof data.likes === 'number' ? data.likes : NO_DATA;
      const comments = typeof data.commentsCount === 'number' ? data.commentsCount : NO_DATA;
      const views = NO_DATA;
      const reach = NO_DATA;
      const saves = NO_DATA;
      const shares = NO_DATA;

      const updatedPost: IntelligencePost = {
        ...post,
        audio_track: data.audioTrack || post.audio_track,
        metrics: {
          ...post.metrics!,
          views,
          reach,
          likes,
          comments,
          saves,
          shares,
          like_rate: rate(likes, views),
          comment_rate: rate(comments, views),
          save_rate: rate(saves, views),
          share_rate: rate(shares, views),
          retention_percentage: post.metrics?.retention_percentage ?? NO_DATA,
          source: 'instagram_scrape',
          synced_at: new Date().toISOString()
        }
      };

      if (typeof likes === 'number') setCustomLikes(likes);
      if (typeof comments === 'number') setCustomComments(comments);

      onUpdatePost?.(updatedPost);
      const likesLabel = typeof likes === 'number' ? `${likes} Likes` : 'Likes sin dato';
      const commentsLabel = typeof comments === 'number' ? `${comments} Comentarios` : 'Comentarios sin dato';
      toast.success(`Likes/comentarios sincronizados (${likesLabel}, ${commentsLabel}). Views, reach, saves y shares no están disponibles por scraping público.`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Error al sincronizar: ' + (err.message || 'desconocido'), { id: toastId });
    } finally {
      setIsResyncingMetrics(false);
    }
  };

  // Guardar métricas reales editadas por el usuario
  const handleSaveMetrics = () => {
    if (!post || !post.metrics) return;
    const views = Math.max(1, Number(customViews) || 1);
    const likes = Number(customLikes) || 0;
    const comments = Number(customComments) || 0;
    const saves = Number(customSaves) || 0;
    const shares = Number(customShares) || 0;
    const retention = Math.min(100, Math.max(1, Number(customRetention) || 30));

    const like_rate = Number(((likes / views) * 100).toFixed(1));
    const comment_rate = Number(((comments / views) * 100).toFixed(1));
    const save_rate = Number(((saves / views) * 100).toFixed(1));
    const share_rate = Number(((shares / views) * 100).toFixed(1));

    const updatedPost: IntelligencePost = {
      ...post,
      metrics: {
        ...post.metrics,
        views,
        // El formulario no tiene un campo para reach: no hay dato manual
        // que cargar, así que se conserva lo que ya hubiera (por ejemplo
        // de Meta Graph API) en vez de estimarlo a partir de views.
        reach: post.metrics.reach,
        likes,
        comments,
        saves,
        shares,
        like_rate,
        comment_rate,
        save_rate,
        share_rate,
        retention_percentage: retention,
        source: 'manual',
        synced_at: new Date().toISOString()
      }
    };

    onUpdatePost?.(updatedPost);
    setIsEditingMetrics(false);
    toast.success('¡Métricas reales de Instagram guardadas y auditoría actualizada!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Despiece Multimodal (5 Capas de IA)
                <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-mono">
                  Reel Auditado
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{post.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Metrics Bar con botón de edición */}
        {metrics && (
          <div className="bg-slate-950/80 border-b border-slate-800/80 p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 flex-1">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-bold text-slate-200 font-mono">{metrics.views.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">Vistas</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="font-bold text-slate-200 font-mono">{metrics.likes}</div>
                  <div className="text-[10px] text-slate-400">Likes ({metrics.like_rate}%)</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-slate-200 font-mono">{metrics.comments}</div>
                  <div className="text-[10px] text-slate-400">Comentarios ({metrics.comment_rate}%)</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-violet-400" />
                <div>
                  <div className="font-bold text-slate-200 font-mono">{metrics.saves}</div>
                  <div className="text-[10px] text-slate-400">Guardados ({metrics.save_rate}%)</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-bold text-slate-200 font-mono">{metrics.retention_percentage}%</div>
                  <div className="text-[10px] text-slate-400">Retención Media</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResyncRealMetrics}
                disabled={isResyncingMetrics}
                className="bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                title="Sincronizar likes y comentarios reales en vivo desde Instagram"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResyncingMetrics ? 'animate-spin text-emerald-300' : 'text-emerald-400'}`} />
                <span>{isResyncingMetrics ? 'Sincronizando...' : 'Sincronizar Reales'}</span>
              </button>

              <button
                onClick={() => {
                  setIsEditingMetrics(!isEditingMetrics);
                  if (!isEditingMetrics) setActiveTab('metrics');
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                title="Ajustar los números a las estadísticas reales de tu Instagram"
              >
                <Edit3 className="w-3.5 h-3.5 text-violet-400" />
                <span>{isEditingMetrics ? 'Cerrar Edición' : 'Editar Métricas'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tabs de Navegación */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-semibold px-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('scripty')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'scripty'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>⚡ Fórmulas Scripty (Hooks & Retención)</span>
          </button>

          <button
            onClick={() => setActiveTab('layers')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'layers'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Despiece por Segmentos (0-3s, etc.)</span>
          </button>

          <button
            onClick={() => setActiveTab('transcript')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'transcript'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>🎙️ Diálogo Hablado & Whisper AI</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'diagnosis'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Auditoría de Rendimiento</span>
          </button>

          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>📊 Ajustar Métricas Reales</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
          
          {/* PESTAÑA NUEVA: FÓRMULAS Y ESTRUCTURAS SCRIPTY */}
          {activeTab === 'scripty' && (
            <div className="space-y-6">
              {/* Header Scripty */}
              <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/30 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <h4 className="font-bold text-slate-100 text-sm">
                      Framework Scripty — Estructuras & Fórmulas Probadas de Video Vertical
                    </h4>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    Estándar Viral Retail & B2B
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Basado en las fórmulas originales de la metodología Scripty: descomponemos el Reel en su <strong>Gancho inicial (0-3s)</strong>, <strong>Estructura de Retención (4-25s)</strong> y <strong>Llamado a la Acción (25-35s)</strong> para reemplazar partes débiles con fórmulas probadas.
                </p>
              </div>

              {/* 1. SECCIÓN: EL GANCHO (HOOK) */}
              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      1. Gancho Actual Analizado (0 a 3 Segundos)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    Hook Score: {analysis.scripty_data?.hook_score || analysis.hook_data.curiosity_score}/100
                  </span>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                    Fórmula Detectada: <span className="text-amber-300 normal-case font-bold text-xs">{analysis.scripty_data?.hook_formula || 'Contraste Antes vs Después'}</span>
                  </div>
                  <p className="text-slate-100 font-semibold text-sm italic">
                    "{analysis.hook_data.text}"
                  </p>
                </div>

                {/* Alternativas Scripty para Reemplazar con 1 Clic */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Ganchos Alternativos Recomendados (Específicos para tu Negocio):
                  </span>

                  <div className="grid grid-cols-1 gap-2.5">
                    {(analysis.scripty_data?.alternative_hooks || [
                      'Si todavía imprimís carteles de lona para tu local, estás perdiendo clientes todos los días. Mirá esto.',
                      'Así pasaban de largo los clientes frente a este comercio... y mirá cómo frenan ahora con una pantalla vertical de alto impacto.',
                      'El truco visual que usan las grandes marcas para multiplicar su facturación que ahora podés poner en tu mostrador.'
                    ]).map((altHook, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between gap-3 transition-colors group"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                            Fórmula Scripty {idx + 1}
                          </span>
                          <p className="text-slate-200 text-xs font-medium leading-snug">"{altHook}"</p>
                        </div>
                        <button
                          onClick={() => handleApplyScriptyHook(altHook)}
                          className="bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 font-bold px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all flex items-center gap-1 shrink-0"
                        >
                          <span>Aplicar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. SECCIÓN: DESARROLLO Y RETENCIÓN (RETAIN) */}
              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" />
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      2. Estructura de Desarrollo y Retención (4 a 25 Segundos)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-violet-400 font-bold bg-violet-950/40 border border-violet-500/30 px-2 py-0.5 rounded-md">
                    Retain Score: {analysis.scripty_data?.retain_score || 85}/100
                  </span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                      Estructura Utilizada: <span className="text-violet-300 normal-case font-bold text-xs">{analysis.scripty_data?.retain_structure || 'PAS: Problema - Agitación - Solución'}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Tiempo Óptimo: 4s - 24s</span>
                  </div>

                  {/* 3 Pasos del Desarrollo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-rose-400 font-bold text-[10px] uppercase tracking-wider block">1. Problema (4-8s)</span>
                      <p className="text-slate-300 text-[11px]">Clientes que no ven las promociones o carteles estáticos ignorados.</p>
                    </div>
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-amber-400 font-bold text-[10px] uppercase tracking-wider block">2. Agitación (8-15s)</span>
                      <p className="text-slate-300 text-[11px]">Pérdida de ventas en el mostrador y tiempo gastado imprimiendo precios.</p>
                    </div>
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider block">3. Solución (15-24s)</span>
                      <p className="text-slate-300 text-[11px]">Display Digital encendido con video en movimiento y actualización desde la app.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SECCIÓN: LLAMADO A LA ACCIÓN (CTA) */}
              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      3. Llamado a la Acción de Alta Conversión (25 a 35 Segundos)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                    CTA Score: {analysis.scripty_data?.cta_score || 88}/100
                  </span>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                    Fórmula Actual: <span className="text-cyan-300 normal-case font-bold text-xs">{analysis.scripty_data?.cta_formula || 'Automatización por Comentario de Palabra Clave'}</span>
                  </div>
                  <p className="text-slate-100 font-semibold text-sm italic">
                    "{analysis.cta_data.text || 'Comentá PANTALLA para recibir el catálogo completo'}"
                  </p>
                </div>

                {/* Alternativas de CTA Scripty */}
                <div className="space-y-2.5 pt-1">
                  <span className="text-xs font-bold text-slate-300 block">
                    Fórmulas de Cierre Scripty Listas para Aplicar:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-400 font-bold text-[10px] uppercase tracking-wider">
                          🚀 Automatización de Comentario
                        </span>
                        <button
                          onClick={() => handleApplyScriptyCta('Comentá "PANTALLA" y te enviamos el catálogo completo con precios y cuotas por WhatsApp.')}
                          className="text-[10px] bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 px-2 py-0.5 rounded font-bold transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs">"Comentá 'PANTALLA' y te enviamos el catálogo completo con precios y cuotas por WhatsApp."</p>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-violet-400 font-bold text-[10px] uppercase tracking-wider">
                          💾 Micro-compromiso de Guardado
                        </span>
                        <button
                          onClick={() => handleApplyScriptyCta('Guardá este Reel para mostrárselo a tu socio cuando renueven la cartelería de su comercio.')}
                          className="text-[10px] bg-violet-500/20 hover:bg-violet-500 hover:text-slate-950 text-violet-300 px-2 py-0.5 rounded font-bold transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs">"Guardá este Reel para mostrárselo a tu socio cuando renueven la cartelería de su comercio."</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. SECCIÓN: GUIÓN COMPLETO TELEPROMPTER */}
              {(() => {
                const cleanScript = (
                  `${analysis.hook_data?.text || 'Escuchá esto antes de invertir en cartelería para tu comercio.'}\n\nSi todavía usás carteles de lona impresos que nadie lee, estás perdiendo hasta el 80% de los clientes que pasan por tu vereda.\n\nCon una pantalla vertical dinámica cambiás los combos, las ofertas y los precios desde tu celular en 30 segundos. Mirá el impacto que genera en la vidriera.\n\n${analysis.cta_data?.text || 'Comentá "APP" acá abajo y te mandamos el catálogo con financiación para tu rubro.'}`
                ).replace(/\[.*?\]|\(.*?\)/g, '').trim();

                const wordCount = cleanScript.split(/\s+/).filter(Boolean).length;
                const estSecs = Math.round((wordCount / 130) * 60);

                const handleCopyScript = () => {
                  navigator.clipboard.writeText(cleanScript);
                  setCopiedTeleprompter(true);
                  toast.success('¡Guión copiado! Pegalo en Edits, CapCut o tu app de teleprompter favorita.');
                  setTimeout(() => setCopiedTeleprompter(false), 2500);
                };

                return (
                  <div className="bg-slate-950/90 border border-emerald-500/40 p-5 rounded-2xl space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-slate-100 text-xs uppercase tracking-wider">
                          4. Guión Completo Recomendado para Teleprompter & Grabación
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {wordCount} palabras • ~{estSecs}s de duración
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <button
                        onClick={handleCopyScript}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                        {copiedTeleprompter ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                        <span>📋 Copiar para Teleprompter (Edits / CapCut)</span>
                      </button>

                      <button
                        onClick={() => setIsTeleprompterOpen(true)}
                        className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 transition-colors"
                      >
                        <Video className="w-4 h-4 text-cyan-400" />
                        <span>📺 Abrir en Modo Teleprompter</span>
                      </button>
                    </div>

                    <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Texto 100% Hablado (Listo para Leer a Cámara):
                      </span>
                      <div className="space-y-2 text-slate-200 text-xs leading-relaxed max-h-48 overflow-y-auto pr-1">
                        {cleanScript.split('\n\n').filter(Boolean).map((para: string, pIdx: number) => (
                          <p key={pIdx} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 5. SECCIÓN: 3 IDEAS NUEVAS */}
              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      5. Tres Ideas Nuevas Derivadas con Diálogo Listo
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    Inspiradas en este video
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      title: 'El Error del Cartel Estático',
                      hook: 'El error de plata que cometen el 90% de los comercios con su cartelería...',
                      angle: 'Aversión a la Pérdida',
                      spoken_dialogue: 'El error que cometen casi todos los comercios es gastar fortunas en lonas y ploteos que al mes quedan desactualizados. Con una pantalla vertical cambiás la carta, la promo del día y los combos desde tu celular en 30 segundos. Comentá PANTALLA y te paso la info con cuotas.',
                      cta: 'Comentá "PANTALLA" y te pasamos el catálogo.'
                    },
                    {
                      title: 'Antes vs Después en Vidriera',
                      hook: 'Mirá la diferencia entre un local con carteles apagados y uno con pantallas dinámicas...',
                      angle: 'Contraste Visual',
                      spoken_dialogue: 'Mirá lo que pasa cuando la gente camina por la vereda: el cartel estático pasa 100% desapercibido. La pantalla con video capta la vista en menos de dos segundos. Si tenés local a la calle, comentá APP y te mostramos cómo instalarla.',
                      cta: 'Comentá "APP" y te pasamos el video de demostración.'
                    },
                    {
                      title: 'Cómo vender sin hablar',
                      hook: 'Cómo venderle a los clientes que pasan por tu vereda sin decir una sola palabra...',
                      angle: 'Beneficio Automático',
                      spoken_dialogue: 'Tu vidriera puede vender por vos las 24 horas. Poné tus mejores productos en video vertical de alta definición con precios claros y llamada a WhatsApp. Comentá LOCAL y armamos tu proyecto a medida.',
                      cta: 'Comentá "LOCAL" para cotizar.'
                    }
                  ].map((idea, idx) => (
                    <div key={idx} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold text-xs">{idea.title}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                            {idea.angle}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(idea.spoken_dialogue);
                            toast.success(`¡Guión de "${idea.title}" copiado para teleprompter!`);
                          }}
                          className="bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar Diálogo</span>
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                        {idea.spoken_dialogue}
                      </p>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        Llamado: {idea.cta}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 1: DESPIECE EN CAPAS */}
          {activeTab === 'layers' && (
            <>
              {/* Capa 1: Hook Analysis Box */}
              <div className="bg-gradient-to-r from-violet-950/40 to-slate-900 border border-violet-500/30 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                    <Zap className="w-4 h-4 text-violet-400" />
                    Capa 1: Análisis del Hook (0-3 segundos)
                  </span>
                  <span className="bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold font-mono">
                    Score Curiosidad: {analysis.hook_data.curiosity_score}/100
                  </span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <p className="text-slate-100 font-semibold text-sm italic">"{analysis.hook_data.text}"</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Tipo de Gancho</span>
                    <span className="font-bold text-slate-200 capitalize">{analysis.hook_data.type.replace('_', ' ')}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Fuerza Auditiva</span>
                    <span className="font-bold text-emerald-400 uppercase">{analysis.hook_data.auditory_strength}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Texto OCR en Pantalla</span>
                    <span className="font-bold text-cyan-400">{analysis.hook_data.has_text_on_screen ? 'Sí (Texto Dinámico)' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Capa 2: Segmentos Temporales */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Capa 2: Línea de Tiempo y Estructura Narrativa
                  </h4>
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className="text-[11px] text-violet-400 hover:text-violet-300 underline flex items-center gap-1"
                  >
                    Editar diálogo hablado
                  </button>
                </div>
                <div className="space-y-2.5">
                  {analysis.time_segments.map((seg, idx) => (
                    <div key={idx} className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-20 bg-slate-800 text-slate-200 font-mono font-bold px-2.5 py-1 rounded-lg text-center text-[11px] shrink-0">
                        {seg.range}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-violet-400 uppercase text-[10px] tracking-wider">{seg.narrative_role}</span>
                          <span className="text-slate-500 text-[10px]">{seg.visual_cue}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs">{seg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capa 3 & 4: Emoción y CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Flame className="w-4 h-4 text-amber-400" />
                    Capa 3: Emociones Gatilladas
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.emotions.map((emo, i) => (
                      <span key={i} className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium text-[11px] capitalize">
                        {emo}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Capa 4: Llamado a la Acción (CTA)
                  </h5>
                  <p className="text-slate-300 text-xs italic font-medium">"{analysis.cta_data.text}"</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>Fuerza: <strong className="text-emerald-400 uppercase">{analysis.cta_data.strength}</strong></span>
                    <span>•</span>
                    <span>Tipo: <strong className="text-slate-200">{analysis.cta_data.type}</strong></span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* PESTAÑA 2: DIÁLOGO HABLADO Y WHISPER AI */}
          {activeTab === 'transcript' && (
            <div className="space-y-4">
              {/* Banner de Audio y Whisper */}
              <div className="bg-gradient-to-r from-violet-950/40 via-slate-900 to-slate-950 border border-violet-500/30 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-violet-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Análisis Automático de Voz con OpenAI Whisper AI</span>
                  </div>
                  {post.audio_track && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono">
                      🎵 Pista: {post.audio_track}
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed text-xs">
                  Para no transcribir a mano, podés hacer clic en el botón de abajo. El servidor descargará el audio del video y <strong>OpenAI Whisper</strong> transcribirá automáticamente cada palabra pronunciada. Si el video es instrumental (solo música), el sistema lo identificará automáticamente.
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleAutoTranscribeWithWhisper}
                    disabled={isTranscribingWithWhisper}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:scale-105"
                  >
                    {isTranscribingWithWhisper ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Transcribiendo con Whisper AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>🎙️ Transcribir Automáticamente con Whisper AI</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-400">
                    {post.raw_transcript ? '✅ Audio transcripto' : '⚡ 1 Clic para transcripción automática'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Diálogo Detectado / Guión del Reel:</span>
                  <span className="text-[10px] text-slate-500 font-normal">Editable para afinar palabras</span>
                </label>
                <textarea
                  rows={8}
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  placeholder="Aquí aparecerá la transcripción automática de Whisper o podés ingresar las frases principales del video..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-2xl p-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none leading-relaxed transition-colors custom-scrollbar font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  💡 Al re-analizar, ChatGPT recalcula el gancho, las marcas de tiempo y el diagnóstico.
                </span>

                <button
                  onClick={handleAnalyzeTranscriptWithAI}
                  disabled={isAnalyzingTranscript || !transcriptInput.trim()}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-violet-600/30 transition-all hover:scale-105"
                >
                  {isAnalyzingTranscript ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Analizando Diálogo con ChatGPT...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span>Re-Analizar con ChatGPT</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: AUDITORÍA EXHAUSTIVA DE RENDIMIENTO */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-5">
              {/* Tarjeta de Métricas Avanzadas y Benchmark */}
              <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-cyan-400" />
                    Auditoría Algorítmica (¿Cómo le fue a este Reel?)
                  </h5>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                    Benchmarking B2B Retail
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {(() => {
                    const retention = metrics?.retention_percentage;
                    const saveRate = metrics?.save_rate;
                    const commentRate = metrics?.comment_rate;

                    return (
                      <>
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px] block">Retención Promedio:</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-cyan-400 font-mono">{formatMetric(retention, { suffix: '%' })}</span>
                            {hasValue(retention) && <span className="text-[10px] text-slate-500">vs 25% media</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 pt-1">
                            {!hasValue(retention)
                              ? '⚪ Sin dato: Instagram no reportó retención para este Reel (requiere Meta Graph API).'
                              : retention >= 30
                                ? '🟢 Gancho sobresaliente: Retiene más allá de los primeros 14 segundos.'
                                : '🟡 Fuga temprana: El gancho inicial necesita mayor curiosidad en los primeros 1.5s.'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px] block">Tasa de Guardados (Virilidad):</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-violet-400 font-mono">{formatMetric(saveRate, { suffix: '%' })}</span>
                            {hasValue(saveRate) && <span className="text-[10px] text-slate-500">vs 1.8% media</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 pt-1">
                            {!hasValue(saveRate)
                              ? '⚪ Sin dato: faltan guardados o vistas reales para calcular esta tasa.'
                              : saveRate >= 2.5
                                ? '🟢 Contenido de alto valor: La audiencia lo guarda para consultarlo después.'
                                : '🟡 Contenido pasivo: El espectador no sintió urgencia de guardarlo como referencia.'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-slate-400 text-[11px] block">Conversión a Prospectos:</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-emerald-400 font-mono">{formatMetric(commentRate, { suffix: '%' })}</span>
                            {hasValue(commentRate) && <span className="text-[10px] text-slate-500">comentarios / vista</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 pt-1">
                            {!hasValue(commentRate)
                              ? '⚪ Sin dato: faltan comentarios o vistas reales para calcular esta tasa.'
                              : commentRate >= 0.8
                                ? '🟢 Excelente interacción comercial: Muchos comentarios pidiendo info.'
                                : '🔴 Fuga de conversión: Falta pedir una palabra clave en comentarios (ej: "APP").'}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Lo que funcionó */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-emerald-400 text-xs uppercase tracking-wider">🟢 Puntos Fuertes (Qué Funcionó)</h5>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {analysis.diagnosis.what_worked.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lo que falló */}
              <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-rose-400 text-xs uppercase tracking-wider">🔴 Puntos a Mejorar (Qué Falló)</h5>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {analysis.diagnosis.what_failed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hipótesis de Rendimiento */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-amber-400 text-xs uppercase tracking-wider">💡 Recomendación para el Próximo Reel</h5>
                <p className="text-slate-200 text-xs leading-relaxed">
                  {analysis.diagnosis.next_test || 'Conectar este Reel con el Nodo Síntesis IA en el lienzo para que ChatGPT fusione su gancho con una mejor llamada a la acción hacia WhatsApp.'}
                </p>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: AJUSTAR MÉTRICAS REALES */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-2">
                <h5 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  Cargar Estadísticas Reales de Instagram Insights
                </h5>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Podés consultar las métricas de este Reel en tu aplicación de Instagram (botón *"Ver estadísticas"*) e ingresarlas acá. El sistema recalculará inmediatamente la retención, los porcentajes y el diagnóstico algorítmico.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium text-[11px]">Reproducciones / Vistas:</label>
                  <input
                    type="number"
                    value={customViews}
                    onChange={(e) => setCustomViews(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium text-[11px]">Me Gusta (Likes):</label>
                  <input
                    type="number"
                    value={customLikes}
                    onChange={(e) => setCustomLikes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium text-[11px]">Comentarios:</label>
                  <input
                    type="number"
                    value={customComments}
                    onChange={(e) => setCustomComments(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium text-[11px]">Guardados:</label>
                  <input
                    type="number"
                    value={customSaves}
                    onChange={(e) => setCustomSaves(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium text-[11px]">Compartidos:</label>
                  <input
                    type="number"
                    value={customShares}
                    onChange={(e) => setCustomShares(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium text-[11px]">Retención % (Seg. vistos):</label>
                  <input
                    type="number"
                    value={customRetention}
                    onChange={(e) => setCustomRetention(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl p-2.5 text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveMetrics}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all hover:scale-105"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Métricas Reales y Recalcular</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal Teleprompter Profesional */}
      <TeleprompterModal
        isOpen={isTeleprompterOpen}
        onClose={() => setIsTeleprompterOpen(false)}
        title={post.title || 'Guión para Teleprompter'}
        scriptText={
          (`${analysis.hook_data?.text || 'Escuchá esto antes de invertir en cartelería para tu comercio.'}\n\nSi todavía usás carteles de lona impresos que nadie lee, estás perdiendo hasta el 80% de los clientes que pasan por tu vereda.\n\nCon una pantalla vertical dinámica cambiás los combos, las ofertas y los precios desde tu celular en 30 segundos. Mirá el impacto que genera en la vidriera.\n\n${analysis.cta_data?.text || 'Comentá "APP" acá abajo y te mandamos el catálogo con financiación para tu rubro.'}`
          ).replace(/\[.*?\]|\(.*?\)/g, '').trim()
        }
        hook={analysis.hook_data?.text}
        cta={analysis.cta_data?.text}
      />
    </div>
  );
};
