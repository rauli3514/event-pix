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
import { MetaGraphService, BusinessDiscoveryMedia } from '../../services/meta/MetaGraphService';
import { TikTokPanel } from './TikTokPanel';

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
  followers_count?: number;
  niche?: string;
  reels: AuditedCompetitorReel[];
  avg_likes: MetricValue;
  avg_comments: MetricValue;
  top_hook?: string;
  top_cta?: string;
  top_audio?: string;
}

interface CompetitorAnalysisPanelProps {
  businessId?: string;
  businessName?: string;
  myAvgViews?: number;
  myAvgLikes?: number;
  myAvgComments?: number;
  myEngagementRate?: number;
  myAvgRetention?: number;
  onAddReelToCanvas?: (reel: any) => void;
}

const STORAGE_KEY = 'eventpix_real_competitors';
const getStorageKey = (businessId?: string) => (businessId ? `${STORAGE_KEY}_${businessId}` : STORAGE_KEY);

// Gancho y CTA preliminares a partir de un caption real, sea que venga de
// business_discovery o del scraper público — mismo criterio para ambos.
function extractHookAndCta(caption: string, username?: string): { hookText: string; ctaText: string } {
  const firstLine = caption.split('\n')[0] || caption.slice(0, 80);
  const hookText = firstLine.length > 5 ? firstLine : (username ? `Contenido de @${username}` : 'Gancho visual de Instagram');
  const ctaMatch = caption.match(/(coment[áa]|escrib[íi]|segu[íi]|link in bio|link en bio|guard[áa]|compart[íi]|particip[áa]|mencion[áa])[^\.\n]*/i);
  const ctaText = ctaMatch ? ctaMatch[0] : 'Interacción y participación';
  return { hookText, ctaText };
}

// Convierte un post de business_discovery (dato real de Meta, con el token de
// NUESTRA cuenta) en el mismo formato que usa el resto del panel.
function businessDiscoveryMediaToReel(m: BusinessDiscoveryMedia, username?: string): AuditedCompetitorReel {
  const caption = m.caption || (username ? `Reel de @${username}` : 'Reel de Instagram');
  const { hookText, ctaText } = extractHookAndCta(caption, username);
  return {
    id: `reel_${m.id}`,
    url: m.permalink,
    thumbnail_url: m.thumbnail_url || m.media_url,
    caption,
    likes: typeof m.like_count === 'number' ? m.like_count : NO_DATA,
    comments_count: typeof m.comments_count === 'number' ? m.comments_count : NO_DATA,
    hook_extracted: hookText,
    cta_extracted: ctaText,
    timestamp: m.timestamp,
  };
}

export const CompetitorAnalysisPanel: React.FC<CompetitorAnalysisPanelProps> = ({
  businessId,
  businessName,
  myAvgViews = 0,
  myAvgLikes = 0,
  myAvgComments = 0,
  onAddReelToCanvas,
}) => {
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [platformTab, setPlatformTab] = useState<'instagram' | 'tiktok'>('instagram');

  const [mainInput, setMainInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reelInputByComp, setReelInputByComp] = useState<Record<string, string>>({});

  // Cargar competidores del negocio activo. Antes vivían en una única clave
  // de localStorage compartida por todos los negocios de la cuenta — el
  // mismo tipo de fuga entre clientes ya corregido en perfil, CRM y Meta.
  useEffect(() => {
    if (!businessId) return;
    try {
      const raw = localStorage.getItem(getStorageKey(businessId));
      if (!raw) {
        setCompetitors([]);
        return;
      }
      const parsed: CompetitorProfile[] = JSON.parse(raw);
      // Limpiar posibles reels con métricas vacías de pruebas anteriores
      setCompetitors(
        parsed.map((comp) => {
          const validReels = (comp.reels || []).filter(
            (r) => hasValue(r.likes) || hasValue(r.comments_count) || r.thumbnail_url
          );
          return {
            ...comp,
            reels: validReels,
            avg_likes: averageAvailable(validReels.map((r) => r.likes)),
            avg_comments: averageAvailable(validReels.map((r) => r.comments_count)),
          };
        })
      );
    } catch {
      setCompetitors([]);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    try {
      localStorage.setItem(getStorageKey(businessId), JSON.stringify(competitors));
    } catch (e) {
      console.warn('Error saving competitors:', e);
    }
  }, [competitors, businessId]);

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
        const shortcode = raw.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1];
        const existingHandle = targetCompId
          ? competitors.find((c) => c.id === targetCompId)?.handle
          : undefined;

        // --- INTENTO 1: business_discovery (dato real de Meta, con nuestro
        // propio token, sin scrapear nada). Solo posible si ya sabemos el
        // handle del competidor y el Reel está entre sus últimos posteos
        // públicos que Meta nos deja consultar.
        if (existingHandle && shortcode && MetaGraphService.isConfigured(businessId)) {
          const discovery = await MetaGraphService.getBusinessDiscovery(existingHandle.replace('@', ''), businessId);
          if (discovery.success) {
            const match = discovery.data.media.find((m) => m.permalink.includes(shortcode));
            if (match) {
              const newReel = businessDiscoveryMediaToReel(match, discovery.data.username);
              setCompetitors((prev) =>
                prev.map((comp) => {
                  if (comp.id !== targetCompId) return comp;
                  const updatedReels = [newReel, ...comp.reels.filter((r) => r.id !== newReel.id)];
                  return {
                    ...comp,
                    avatar_url: discovery.data.profile_picture_url || comp.avatar_url,
                    followers_count: discovery.data.followers_count ?? comp.followers_count,
                    reels: updatedReels,
                    avg_likes: averageAvailable(updatedReels.map((r) => r.likes)),
                    avg_comments: averageAvailable(updatedReels.map((r) => r.comments_count)),
                    top_hook: newReel.hook_extracted,
                    top_cta: newReel.cta_extracted,
                  };
                })
              );
              setReelInputByComp((prev) => ({ ...prev, [targetCompId!]: '' }));
              toast.success(
                `✅ Reel auditado con datos verificados de Meta (${formatMetric(newReel.likes)} likes, ${formatMetric(newReel.comments_count)} comentarios)`,
                { id: toastId }
              );
              return;
            }
          }
        }

        // --- INTENTO 2 (respaldo): SCRAPER PÚBLICO ---
        // Necesario cuando no conocemos el handle todavía (primer Reel
        // pegado sin haber agregado el competidor antes) o cuando el Reel
        // es más viejo que lo que business_discovery nos deja ver.
        const res = await fetch(`/api/instagram-scrape?url=${encodeURIComponent(raw)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'No se pudo extraer métricas de este Reel.');
        }

        let likes: MetricValue = typeof data.likes === 'number' ? data.likes : NO_DATA;
        let commentsCount: MetricValue = typeof data.commentsCount === 'number' ? data.commentsCount : NO_DATA;
        const shortcodeForId = data.shortcode || shortcode || `${Date.now()}`;
        const cleanUsername = data.username ? data.username.replace('@', '') : '';
        const caption = data.caption || (cleanUsername ? `Reel de @${cleanUsername}` : 'Reel de Instagram');
        const imageUrl = data.imageUrl || '';

        // Ahora que sabemos el usuario, un último intento de reemplazar lo
        // scrapeado (que Instagram frecuentemente no expone) por el dato
        // real vía business_discovery.
        let usedRealMetrics = hasValue(likes) || hasValue(commentsCount);
        if (cleanUsername && shortcode && MetaGraphService.isConfigured(businessId)) {
          const discovery = await MetaGraphService.getBusinessDiscovery(cleanUsername, businessId);
          if (discovery.success) {
            const match = discovery.data.media.find((m) => m.permalink.includes(shortcode));
            if (match) {
              if (typeof match.like_count === 'number') { likes = match.like_count; usedRealMetrics = true; }
              if (typeof match.comments_count === 'number') { commentsCount = match.comments_count; usedRealMetrics = true; }
            }
          }
        }

        const { hookText, ctaText } = extractHookAndCta(caption, cleanUsername);

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
          id: `reel_${shortcodeForId}`,
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

        if (usedRealMetrics) {
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

        // --- INTENTO 1: business_discovery. Trae de una todos los posteos
        // públicos recientes con likes/comentarios reales verificados por
        // Meta — sin pegar un solo Reel a mano. Solo funciona si la cuenta
        // es Business/Creator pública (igual que la nuestra necesita serlo).
        const cleanHandle = detectedHandle.replace('@', '');
        // El token de Instagram está aislado por negocio (evita que un
        // negocio use sin querer los datos de otro cliente de la cuenta):
        // si el que está ACTIVO ahora mismo no tiene Instagram conectado,
        // esto falla aunque otro de tus negocios sí lo tenga.
        const discovery = MetaGraphService.isConfigured(businessId)
          ? await MetaGraphService.getBusinessDiscovery(cleanHandle, businessId)
          : {
              success: false as const,
              error: `"${businessName || 'Este negocio'}" (el que tenés activo ahora) todavía no tiene su propia cuenta de Instagram conectada. Conectala en la pestaña "Instagram" — cada negocio necesita la suya, no se comparte entre negocios.`,
            };

        if (discovery.success) {
          const bd = discovery.data;
          const reels = bd.media.map((m) => businessDiscoveryMediaToReel(m, bd.username));
          const newProfile: CompetitorProfile = {
            id: `comp_${Date.now()}`,
            handle: `@${bd.username}`,
            display_name: bd.name || bd.username,
            avatar_url: bd.profile_picture_url,
            followers_count: bd.followers_count,
            reels,
            avg_likes: averageAvailable(reels.map((r) => r.likes)),
            avg_comments: averageAvailable(reels.map((r) => r.comments_count)),
            top_hook: reels[0]?.hook_extracted,
            top_cta: reels[0]?.cta_extracted,
          };
          setCompetitors((prev) => [newProfile, ...prev]);
          setExpandedId(newProfile.id);
          setMainInput('');
          toast.success(
            `🎯 @${bd.username} agregado con ${reels.length} posteo${reels.length === 1 ? '' : 's'} real${reels.length === 1 ? '' : 'es'} (likes y comentarios verificados por Meta).`,
            { id: toastId }
          );
          return;
        }

        // --- INTENTO 2 (respaldo): agregar el competidor vacío y dejar que
        // audite Reels puntuales pegando el enlace (usa el scraper público).
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
        toast.warning(
          `${detectedHandle} agregado, pero no se pudo auto-completar con datos de Meta (${discovery.error}). Podés auditar Reels puntuales pegando su enlace.`,
          { id: toastId, duration: 8000 }
        );
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

      {/* Selector de Plataforma: Instagram (business_discovery, necesita tu
          cuenta conectada) vs TikTok (perfil público, sin conectar nada) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold shrink-0">
        <button
          onClick={() => setPlatformTab('instagram')}
          className={`py-1.5 rounded-lg transition-all ${
            platformTab === 'instagram' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Instagram
        </button>
        <button
          onClick={() => setPlatformTab('tiktok')}
          className={`py-1.5 rounded-lg transition-all ${
            platformTab === 'tiktok' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          TikTok
        </button>
      </div>

      {platformTab === 'tiktok' && <TikTokPanel businessId={businessId} />}

      {platformTab === 'instagram' && (
      <>
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
                        {hasValue(comp.followers_count) && ` • ${formatMetric(comp.followers_count)} seguidores`}
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
      </>
      )}
    </div>
  );
};
