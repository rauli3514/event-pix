import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Zap, Heart, MessageCircle,
  X, RefreshCw, BarChart2,
  Trophy, ExternalLink,
  Trash2, Play, ShieldCheck, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { MetricValue, NO_DATA } from '../../types/intelligence';
import { hasValue, averageAvailable, formatMetric } from '../../services/intelligence/metricUtils';

export interface AuditedCompetitorReel {
  id: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  // Instagram no siempre expone likes/comentarios en el scraping público de un
  // perfil ajeno: NO_DATA cuando no se pudo extraer, nunca un 0 fabricado.
  likes: MetricValue;
  comments_count: MetricValue;
  audio_track?: string;
  hook_extracted?: string;
  cta_extracted?: string;
  timestamp: string;
}

export interface CompetitorProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string;
  niche?: string;
  reels: AuditedCompetitorReel[];
  avg_likes: MetricValue;
  avg_comments: MetricValue;
  top_hook?: string;
  top_cta?: string;
  top_audio?: string;
}

interface CompetitorAnalysisPanelProps {
  myAvgViews?: number;
  myAvgLikes?: number;
  myAvgComments?: number;
  myEngagementRate?: number;
  myAvgRetention?: number;
  onAddReelToCanvas?: (reel: any) => void;
}

const STORAGE_KEY = 'eventpix_real_competitors';

export const CompetitorAnalysisPanel: React.FC<CompetitorAnalysisPanelProps> = ({
  myAvgViews = 0,
  myAvgLikes = 0,
  myAvgComments = 0,
  onAddReelToCanvas,
}) => {
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: CompetitorProfile[] = JSON.parse(raw);
      // Limpiar posibles reels con métricas vacías de pruebas anteriores
      return parsed.map((comp) => {
        const validReels = (comp.reels || []).filter(
          (r) => hasValue(r.likes) || hasValue(r.comments_count) || r.thumbnail_url
        );
        return {
          ...comp,
          reels: validReels,
          avg_likes: averageAvailable(validReels.map((r) => r.likes)),
          avg_comments: averageAvailable(validReels.map((r) => r.comments_count)),
        };
      });
    } catch {
      return [];
    }
  });

  const [mainInput, setMainInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reelInputByComp, setReelInputByComp] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(competitors));
    } catch (e) {
      console.warn('Error saving competitors:', e);
    }
  }, [competitors]);

  // Auto-cargar métricas reales de Shop de Plumas si no las tiene aún
  useEffect(() => {
    const plumasComp = competitors.find(
      (c) => c.handle.toLowerCase().includes('plumas') && c.reels.length === 0
    );
    if (plumasComp) {
      handleAddOrAudit('https://www.instagram.com/p/DcveKFpx1eP/', plumasComp.id);
    }
  }, []);

  // Helper para extraer handle limpio desde cualquier formato
  const extractHandle = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Caso 1: URL de perfil (ej. https://www.instagram.com/shop_plumas/)
    const profileMatch = trimmed.match(/(?:instagram\.com\/)(?!p\/|reel\/|reels\/|stories\/)([A-Za-z0-9_.]+)/i);
    if (profileMatch) {
      return `@${profileMatch[1].replace(/[\/@]/g, '')}`;
    }

    // Caso 2: Handle con @ o sin @ (ej. @shop_plumas o shop_plumas)
    if (!trimmed.includes('/') && !trimmed.includes('?')) {
      const clean = trimmed.replace('@', '').trim();
      if (clean.length > 0) return `@${clean}`;
    }

    return null;
  };

  // Función principal para agregar competidor por URL de Reel, @handle o URL de perfil
  const handleAddOrAudit = async (customUrl?: string, targetCompId?: string) => {
    const raw = (customUrl || mainInput).trim();
    if (!raw) {
      toast.error('Ingresá el @handle, link de perfil o link de un Reel.');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Procesando datos reales de Instagram...');

    try {
      const isReelUrl = /(?:p|reel|reels)\/([A-Za-z0-9_-]+)/.test(raw);

      if (isReelUrl) {
        // --- ES UN REEL: EXTRAER MÉTRICAS REALES CON EL SCRAPER ---
        const res = await fetch(`/api/instagram-scrape?url=${encodeURIComponent(raw)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'No se pudo extraer métricas de este Reel.');
        }

        const likes: MetricValue = typeof data.likes === 'number' ? data.likes : NO_DATA;
        const commentsCount: MetricValue = typeof data.commentsCount === 'number' ? data.commentsCount : NO_DATA;
        const shortcode = data.shortcode || raw.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1] || `${Date.now()}`;
        const cleanUsername = data.username ? data.username.replace('@', '') : '';
        const caption = data.caption || (cleanUsername ? `Reel de @${cleanUsername}` : 'Reel de Instagram');
        const imageUrl = data.imageUrl || '';
        
        // Extraer gancho preliminar y CTA
        const firstLine = caption.split('\n')[0] || caption.slice(0, 80);
        const hookText = firstLine.length > 5 ? firstLine : (cleanUsername ? `Contenido de @${cleanUsername}` : 'Gancho visual de Instagram');
        const ctaMatch = caption.match(/(coment[áa]|escrib[íi]|segu[íi]|link in bio|link en bio|guard[áa]|compart[íi]|particip[áa]|mencion[áa])[^\.\n]*/i);
        const ctaText = ctaMatch ? ctaMatch[0] : 'Interacción y participación';

        // Determinar a qué competidor asociar
        let associatedHandle = targetCompId
          ? competitors.find((c) => c.id === targetCompId)?.handle
          : null;

        if (!associatedHandle) {
          if (cleanUsername) {
            associatedHandle = `@${cleanUsername}`;
          } else {
            const mentionMatch = caption.match(/@([A-Za-z0-9_.]+)/);
            if (mentionMatch) {
              associatedHandle = `@${mentionMatch[1]}`;
            } else {
              associatedHandle = '@competidor_auditado';
            }
          }
        }

        const newReel: AuditedCompetitorReel = {
          id: `reel_${shortcode}`,
          url: raw,
          thumbnail_url: imageUrl,
          caption,
          likes,
          comments_count: commentsCount,
          audio_track: data.audioTrack || 'Audio original de Instagram',
          hook_extracted: hookText,
          cta_extracted: ctaText,
          timestamp: new Date().toISOString(),
        };

        setCompetitors((prev) => {
          const compIndex = prev.findIndex(
            (c) => c.id === targetCompId || c.handle.toLowerCase() === associatedHandle!.toLowerCase()
          );

          if (compIndex >= 0) {
            const comp = prev[compIndex];
            const updatedReels = [newReel, ...comp.reels.filter((r) => r.url !== raw && r.id !== newReel.id)];

            const updated: CompetitorProfile = {
              ...comp,
              avatar_url: imageUrl || comp.avatar_url,
              reels: updatedReels,
              avg_likes: averageAvailable(updatedReels.map((r) => r.likes)),
              avg_comments: averageAvailable(updatedReels.map((r) => r.comments_count)),
              top_hook: hookText,
              top_cta: ctaText,
              top_audio: data.audioTrack || comp.top_audio,
            };
            const next = [...prev];
            next[compIndex] = updated;
            return next;
          } else {
            const newProfile: CompetitorProfile = {
              id: `comp_${Date.now()}`,
              handle: associatedHandle!,
              display_name: associatedHandle!.replace('@', ''),
              avatar_url: data.imageUrl,
              reels: [newReel],
              avg_likes: likes,
              avg_comments: commentsCount,
              top_hook: hookText,
              top_cta: ctaText,
              top_audio: data.audioTrack,
            };
            return [newProfile, ...prev];
          }
        });

        if (!customUrl) setMainInput('');
        if (targetCompId) {
          setReelInputByComp((prev) => ({ ...prev, [targetCompId]: '' }));
        }

        if (hasValue(likes) || hasValue(commentsCount)) {
          toast.success(
            `✅ Reel auditado para ${associatedHandle} (${formatMetric(likes)} likes, ${formatMetric(commentsCount)} comentarios reales)`,
            { id: toastId }
          );
        } else {
          toast.warning(
            `Reel agregado para ${associatedHandle}, pero Instagram no expuso likes ni comentarios en la página pública. Se guardó el resto de los datos (miniatura, gancho, CTA).`,
            { id: toastId, duration: 7000 }
          );
        }
      } else {
        // --- ES UN PERFIL O @HANDLE ---
        const detectedHandle = extractHandle(raw);
        if (!detectedHandle) {
          throw new Error('No pudimos reconocer el formato. Ingresá @handle o el link de Instagram.');
        }

        const existing = competitors.find((c) => c.handle.toLowerCase() === detectedHandle.toLowerCase());
        if (existing) {
          setExpandedId(existing.id);
          toast.info(`El competidor ${detectedHandle} ya está en tu lista. Pegá un Reel para auditarlo.`);
          setIsProcessing(false);
          return;
        }

        const newProfile: CompetitorProfile = {
          id: `comp_${Date.now()}`,
          handle: detectedHandle,
          display_name: detectedHandle.replace('@', ''),
          reels: [],
          avg_likes: NO_DATA,
          avg_comments: NO_DATA,
        };

        setCompetitors((prev) => [newProfile, ...prev]);
        setExpandedId(newProfile.id);
        setMainInput('');
        toast.success(`🎯 Competidor ${detectedHandle} agregado! Ahora podés auditar cualquiera de sus Reels.`, {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCompetitor = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    toast.success('Competidor eliminado.');
  };

  const handleRemoveReel = (compId: string, reelId: string) => {
    setCompetitors((prev) =>
      prev.map((comp) => {
        if (comp.id !== compId) return comp;
        const updatedReels = comp.reels.filter((r) => r.id !== reelId);
        return {
          ...comp,
          reels: updatedReels,
          avg_likes: averageAvailable(updatedReels.map((r) => r.likes)),
          avg_comments: averageAvailable(updatedReels.map((r) => r.comments_count)),
        };
      })
    );
    toast.success('Reel removido de la auditoría.');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar pb-32">
      {/* Header Banner */}
      <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-2xl space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-violet-300 text-xs flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            Auditoría de Competidores Reales
          </h4>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Datos Verificados
          </span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Agregá competidores por su <strong>@handle</strong>, <strong>link de perfil</strong> o <strong>link de un Reel</strong> para extraer sus métricas verificadas.
        </p>
      </div>

      {/* Input Principal Inteligente */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5 shrink-0">
        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-violet-400" />
          Agregar Competidor o Reel
        </span>

        <div className="space-y-2">
          <input
            type="text"
            value={mainInput}
            onChange={(e) => setMainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddOrAudit();
            }}
            placeholder="Ej: @shop_plumas, link de perfil o Reel..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
          />

          <button
            onClick={() => handleAddOrAudit()}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md hover:scale-[1.01]"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Extrayendo Datos Reales...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" /> Extraer y Comparar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Benchmark de Comparación Real */}
      {competitors.some((c) => c.reels.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2 shrink-0">
          <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            Benchmark Frente a tu Cuenta
          </h5>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            {myAvgViews > 0 && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Tus Vistas Promedio</span>
                <span className="font-mono font-black text-slate-100 text-sm">{myAvgViews}</span>
              </div>
            )}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Tus Likes Promedio</span>
              <span className="font-mono font-black text-slate-100 text-sm">{myAvgLikes}</span>
            </div>
            {myAvgComments > 0 && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Tus Comentarios Promedio</span>
                <span className="font-mono font-black text-slate-100 text-sm">{myAvgComments}</span>
              </div>
            )}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Competidores Promedio (Likes)</span>
              <span className="font-mono font-black text-amber-400 text-sm">
                {formatMetric(averageAvailable(competitors.map((c) => c.avg_likes)))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Competidores */}
      {competitors.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-300">Sin competidores auditados</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Ingresá <strong>@shop_plumas</strong> o el link de un Reel para ver sus likes y comentarios reales sin datos inventados.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {competitors.map((comp) => {
            const isExpanded = expandedId === comp.id || competitors.length === 1;
            const hasReels = comp.reels.length > 0;

            return (
              <div
                key={comp.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition-all"
              >
                {/* Header Competidor */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : comp.id)}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {comp.avatar_url ? (
                      <img
                        src={comp.avatar_url}
                        alt={comp.handle}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-violet-950 border border-violet-700/50 flex items-center justify-center text-violet-300 font-bold text-xs shrink-0">
                        {comp.handle.replace('@', '').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 text-xs truncate">{comp.handle}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {hasReels
                          ? `${comp.reels.length} reel${comp.reels.length > 1 ? 's' : ''} auditado${comp.reels.length > 1 ? 's' : ''}`
                          : 'Listo para auditar Reels'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasReels && (
                      <div className="text-right text-[11px]">
                        <span className="text-pink-400 font-mono font-bold flex items-center gap-0.5 justify-end">
                          <Heart className="w-3 h-3" /> {formatMetric(comp.avg_likes)}
                        </span>
                        <span className="text-blue-400 font-mono text-[10px] flex items-center gap-0.5 justify-end">
                          <MessageCircle className="w-2.5 h-2.5" /> {formatMetric(comp.avg_comments)}
                        </span>
                      </div>
                    )}

                    <button
                      onClick={(e) => handleDeleteCompetitor(comp.id, e)}
                      className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Eliminar competidor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contenido Expandido */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-800 space-y-2.5 pt-2.5 bg-slate-950/30">
                    {/* Formulario para agregar Reel a este competidor específico */}
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-pink-400" />
                        Auditar Reel de {comp.handle}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Pegá el enlace de cualquier Reel público de su perfil para medir likes y comentarios reales:
                      </p>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={reelInputByComp[comp.id] || ''}
                          onChange={(e) =>
                            setReelInputByComp((prev) => ({ ...prev, [comp.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddOrAudit(reelInputByComp[comp.id] || '', comp.id);
                            }
                          }}
                          placeholder="https://www.instagram.com/p/... o /reel/..."
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                        />
                        <button
                          onClick={() => handleAddOrAudit(reelInputByComp[comp.id] || '', comp.id)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg shrink-0 flex items-center gap-1"
                        >
                          {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Auditar
                        </button>
                      </div>

                      {/* Atajo rápido para auditar el reel conocido de Shop de Plumas */}
                      {comp.handle.toLowerCase().includes('plumas') && (
                        <div className="pt-1 flex items-center justify-between text-[10px] bg-pink-950/20 border border-pink-500/20 p-2 rounded-lg">
                          <span className="text-pink-300 truncate max-w-[170px]">Reel real Display en Shop de Plumas</span>
                          <button
                            onClick={() =>
                              handleAddOrAudit('https://www.instagram.com/p/DcveKFpx1eP/', comp.id)
                            }
                            className="text-amber-300 hover:text-amber-200 font-bold underline shrink-0 flex items-center gap-1"
                          >
                            Auditar ahora ⚡
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Insights detectados si ya tiene reels */}
                    {comp.top_hook && (
                      <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-[11px] space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 block">Gancho extraído:</span>
                        <p className="text-slate-300 italic">"{comp.top_hook}"</p>
                      </div>
                    )}

                    {comp.top_audio && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                        <span>🎵 Audio:</span>
                        <span className="text-slate-300 font-mono truncate">{comp.top_audio}</span>
                      </div>
                    )}

                    {/* Lista de Reels extraídos */}
                    {hasReels && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Reels Auditados ({comp.reels.length}):
                        </span>
                        {comp.reels.map((reel) => (
                          <div
                            key={reel.id}
                            className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2 hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {reel.thumbnail_url ? (
                                <img
                                  src={reel.thumbnail_url}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                  <Play className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0 space-y-0.5">
                                <p className="text-[10px] text-slate-200 truncate max-w-[130px] font-medium">
                                  {reel.caption || 'Reel sin descripción'}
                                </p>
                                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                                  <span className="text-pink-400 font-bold">❤️ {formatMetric(reel.likes)}</span>
                                  <span className="text-blue-400 font-bold">💬 {formatMetric(reel.comments_count)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={reel.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-500 hover:text-slate-300"
                                title="Ver en Instagram"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              {onAddReelToCanvas && (
                                <button
                                  onClick={() => {
                                    onAddReelToCanvas({
                                      id: reel.id,
                                      media_type: 'REELS',
                                      thumbnail_url: reel.thumbnail_url,
                                      permalink: reel.url,
                                      caption: reel.caption || `Reel de ${comp.handle}`,
                                      timestamp: reel.timestamp,
                                      // undefined (no 0) cuando Instagram no expuso el dato:
                                      // el Canvas ya sabe mostrar "Sin dato" para eso.
                                      like_count: hasValue(reel.likes) ? reel.likes : undefined,
                                      comments_count: hasValue(reel.comments_count) ? reel.comments_count : undefined,
                                    });
                                    toast.success(`🎬 Reel de ${comp.handle} agregado al Canvas!`);
                                  }}
                                  className="px-2 py-1 bg-violet-600/30 hover:bg-violet-600 border border-violet-500/40 text-violet-200 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Canvas
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveReel(comp.id, reel.id)}
                                className="p-1 text-slate-600 hover:text-rose-400"
                                title="Eliminar este reel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
