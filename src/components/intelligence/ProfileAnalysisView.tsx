// ================================================================
// ProfileAnalysisView.tsx
// Análisis de Comercio — pantalla completa, estilo Socialinsider: elegís
// un perfil (el tuyo o cualquier competidor de Instagram/TikTok ya
// guardado) y ves Resumen ejecutivo, Contenido, Engagement y Comparar,
// todo con datos reales. Nunca fabrica reach/guardados/audiencia para
// perfiles de terceros — Meta y TikTok no lo exponen para nadie, y donde
// no hay dato se muestra "Sin dato", no un número inventado.
// EventPix Intelligence — SaaS Studio
// ================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Instagram, Users, FileText, Heart, MessageCircle, Eye, Share2,
  TrendingUp, TrendingDown, Plus, RefreshCw, Play, ExternalLink,
  Star, Music2, X, ArrowLeftRight, ShieldCheck
} from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';
import { MetaGraphService, MetaMediaItem, MetaMediaInsights } from '../../services/meta/MetaGraphService';
import { ProfileSnapshotService } from '../../services/intelligence/ProfileSnapshotService';
import { hasValue, formatMetric, averageAvailable } from '../../services/intelligence/metricUtils';
import { CompetitorProfile } from './CompetitorAnalysisPanel';
import { TikTokProfile } from './TikTokPanel';

// ---- Normalización: mismo formato para cuenta propia, competencia IG y TikTok ----

interface UnifiedPost {
  id: string;
  thumbnailUrl?: string;
  caption?: string;
  permalink: string;
  timestamp: string;
  likeCount: number | null;
  commentCount: number | null;
  viewCount: number | null;
  shareCount: number | null;
  saveCount: number | null;
}

interface UnifiedProfile {
  id: string;
  platform: 'instagram' | 'tiktok';
  isOwn: boolean;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  followerCount: number | null;
  mediaCount: number | null;
  posts: UnifiedPost[];
}

const IG_COMPETITORS_KEY = 'eventpix_real_competitors';
const TIKTOK_KEY = 'eventpix_tiktok_profiles';

function ownReelToPost(r: MetaMediaItem & { insights?: MetaMediaInsights }): UnifiedPost {
  return {
    id: r.id,
    thumbnailUrl: r.thumbnail_url,
    caption: r.caption,
    permalink: r.permalink,
    timestamp: r.timestamp,
    likeCount: hasValue(r.like_count) ? r.like_count! : null,
    commentCount: hasValue(r.comments_count) ? r.comments_count! : null,
    viewCount: hasValue(r.insights?.plays) ? r.insights!.plays! : null,
    shareCount: hasValue(r.insights?.shares) ? r.insights!.shares! : null,
    saveCount: hasValue(r.insights?.saved) ? r.insights!.saved! : null,
  };
}

function competitorReelToPost(r: CompetitorProfile['reels'][number]): UnifiedPost {
  return {
    id: r.id,
    thumbnailUrl: r.thumbnail_url,
    caption: r.caption,
    permalink: r.url,
    timestamp: r.timestamp,
    likeCount: hasValue(r.likes) ? (r.likes as number) : null,
    commentCount: hasValue(r.comments_count) ? (r.comments_count as number) : null,
    // Meta nunca expone vistas/guardados de una cuenta ajena, ni a nosotros
    // ni a ningún tercero — no es un hueco nuestro, es un límite real.
    viewCount: null,
    shareCount: null,
    saveCount: null,
  };
}

function tiktokVideoToPost(v: TikTokProfile['videos'][number]): UnifiedPost {
  return {
    id: v.id,
    thumbnailUrl: v.thumbnailUrl,
    caption: v.caption,
    permalink: v.permalink,
    timestamp: v.createdAt,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    viewCount: v.playCount,
    shareCount: v.shareCount,
    saveCount: null,
  };
}

/** Tasa de engagement sobre seguidores — la única que se puede calcular
 * igual para cuenta propia y de terceros, porque solo necesita likes +
 * comentarios + seguidores (todo público), nunca alcance/impresiones. */
function engagementRateOverFollowers(posts: UnifiedPost[], followerCount: number | null): number | null {
  if (!followerCount || followerCount <= 0 || posts.length === 0) return null;
  const rates = posts
    .filter((p) => hasValue(p.likeCount) || hasValue(p.commentCount))
    .map((p) => (((p.likeCount || 0) + (p.commentCount || 0)) / followerCount) * 100);
  if (rates.length === 0) return null;
  return Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100;
}

function postsPerDay(posts: UnifiedPost[]): number | null {
  const withDates = posts.filter((p) => p.timestamp && !isNaN(new Date(p.timestamp).getTime()));
  if (withDates.length < 2) return null;
  const times = withDates.map((p) => new Date(p.timestamp).getTime()).sort((a, b) => a - b);
  const spanDays = Math.max(1, (times[times.length - 1] - times[0]) / (1000 * 60 * 60 * 24));
  return Math.round((withDates.length / spanDays) * 10) / 10;
}

interface ProfileAnalysisViewProps {
  businessId: string;
  onClose?: () => void;
}

export const ProfileAnalysisView: React.FC<ProfileAnalysisViewProps> = ({ businessId, onClose }) => {
  const [profiles, setProfiles] = useState<UnifiedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumen' | 'contenido' | 'engagement' | 'comparar'>('resumen');
  const [growthHistory, setGrowthHistory] = useState<{ date: string; seguidores: number }[]>([]);
  const [addInput, setAddInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    const loaded: UnifiedProfile[] = [];

    // Cuenta propia (Instagram conectado por Graph API)
    if (MetaGraphService.isConfigured(businessId)) {
      try {
        const [profile, reels] = await Promise.all([
          MetaGraphService.getProfile(businessId),
          MetaGraphService.getReelsWithInsights(25, businessId),
        ]);
        loaded.push({
          id: 'own_instagram',
          platform: 'instagram',
          isOwn: true,
          handle: profile.username,
          displayName: profile.name || profile.username,
          avatarUrl: profile.profile_picture_url,
          followerCount: profile.followers_count ?? null,
          mediaCount: profile.media_count ?? null,
          posts: reels.map(ownReelToPost),
        });
      } catch (err) {
        console.warn('ProfileAnalysisView: no se pudo cargar la cuenta propia de Instagram', err);
      }
    }

    // Competidores de Instagram guardados en Auditoría
    try {
      const raw = localStorage.getItem(`${IG_COMPETITORS_KEY}_${businessId}`);
      const competitors: CompetitorProfile[] = raw ? JSON.parse(raw) : [];
      for (const c of competitors) {
        loaded.push({
          id: c.id,
          platform: 'instagram',
          isOwn: false,
          handle: c.handle.replace('@', ''),
          displayName: c.display_name,
          avatarUrl: c.avatar_url,
          followerCount: c.followers_count ?? null,
          mediaCount: c.reels.length,
          posts: c.reels.map(competitorReelToPost),
        });
      }
    } catch (err) {
      console.warn('ProfileAnalysisView: no se pudo leer competidores de Instagram', err);
    }

    // Perfiles de TikTok guardados
    try {
      const raw = localStorage.getItem(`${TIKTOK_KEY}_${businessId}`);
      const tiktokProfiles: TikTokProfile[] = raw ? JSON.parse(raw) : [];
      for (const t of tiktokProfiles) {
        loaded.push({
          id: t.id,
          platform: 'tiktok',
          isOwn: !!t.isOwn,
          handle: t.username,
          displayName: t.displayName,
          avatarUrl: t.avatarUrl,
          followerCount: t.followerCount,
          mediaCount: t.videoCount,
          posts: t.videos.map(tiktokVideoToPost),
        });
      }
    } catch (err) {
      console.warn('ProfileAnalysisView: no se pudo leer perfiles de TikTok', err);
    }

    setProfiles(loaded);
    setIsLoading(false);
    setSelectedId((prev) => prev && loaded.some((p) => p.id === prev) ? prev : (loaded.find((p) => p.isOwn)?.id || loaded[0]?.id || null));
  }, [businessId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selected = useMemo(() => profiles.find((p) => p.id === selectedId) || null, [profiles, selectedId]);
  const compareTarget = useMemo(() => profiles.find((p) => p.id === compareId) || null, [profiles, compareId]);

  // Guardar la foto de hoy y traer el historial de crecimiento real del perfil elegido.
  useEffect(() => {
    if (!selected) { setGrowthHistory([]); return; }
    ProfileSnapshotService.recordSnapshotIfNeeded({
      businessId,
      kind: selected.isOwn ? 'own' : 'competitor',
      platform: selected.platform,
      handle: selected.handle,
      followerCount: selected.followerCount,
      mediaCount: selected.mediaCount,
    });
    ProfileSnapshotService.getHistory(businessId, selected.platform, selected.handle, 90).then((history) => {
      setGrowthHistory(
        history
          .filter((h) => hasValue(h.follower_count))
          .map((h) => ({ date: h.snapshot_date.slice(5), seguidores: h.follower_count as number }))
      );
    });
  }, [selected, businessId]);

  const handleAddProfile = async () => {
    const raw = addInput.trim();
    if (!raw) return;
    setIsAdding(true);
    const toastId = toast.loading('Buscando el perfil público...');

    try {
      const isTikTok = /tiktok\.com/i.test(raw) || raw.toLowerCase().startsWith('tt:');
      if (isTikTok) {
        const handle = raw.replace(/^tt:/i, '');
        const res = await fetch(`/api/tiktok-scrape?url=${encodeURIComponent(handle)}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo extraer el perfil de TikTok.');

        const key = `${TIKTOK_KEY}_${businessId}`;
        const existing: TikTokProfile[] = JSON.parse(localStorage.getItem(key) || '[]');
        const newProfile: TikTokProfile = {
          id: `tiktok_${data.username}`,
          username: data.username,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          bio: data.bio,
          verified: data.verified,
          followerCount: data.followerCount,
          followingCount: data.followingCount,
          heartCount: data.heartCount,
          videoCount: data.videoCount,
          videos: data.videos || [],
          fetchedAt: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify([newProfile, ...existing.filter((p) => p.username !== newProfile.username)]));
        toast.success(`@${data.username} agregado.`, { id: toastId });
      } else {
        const cleanHandle = raw.replace('@', '').replace(/https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
        if (!MetaGraphService.isConfigured(businessId)) {
          throw new Error('Conectá tu propia cuenta de Instagram en Auditoría → Instagram para poder buscar otros perfiles.');
        }
        const discovery = await MetaGraphService.getBusinessDiscovery(cleanHandle, businessId);
        if (!discovery.success) throw new Error(discovery.error);

        const bd = discovery.data;
        const key = `${IG_COMPETITORS_KEY}_${businessId}`;
        const existing: CompetitorProfile[] = JSON.parse(localStorage.getItem(key) || '[]');
        const newProfile: CompetitorProfile = {
          id: `comp_${Date.now()}`,
          handle: `@${bd.username}`,
          display_name: bd.name || bd.username,
          avatar_url: bd.profile_picture_url,
          followers_count: bd.followers_count,
          reels: bd.media.map((m) => ({
            id: `reel_${m.id}`,
            url: m.permalink,
            thumbnail_url: m.thumbnail_url || m.media_url,
            caption: m.caption || '',
            likes: typeof m.like_count === 'number' ? m.like_count : ('no_disponible' as const),
            comments_count: typeof m.comments_count === 'number' ? m.comments_count : ('no_disponible' as const),
            timestamp: m.timestamp,
          })),
          avg_likes: averageAvailable(bd.media.map((m) => (typeof m.like_count === 'number' ? m.like_count : undefined))),
          avg_comments: averageAvailable(bd.media.map((m) => (typeof m.comments_count === 'number' ? m.comments_count : undefined))),
        };
        localStorage.setItem(
          key,
          JSON.stringify([newProfile, ...existing.filter((p) => p.handle.toLowerCase() !== newProfile.handle.toLowerCase())])
        );
        toast.success(`@${bd.username} agregado.`, { id: toastId });
      }

      setAddInput('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'No se pudo agregar el perfil.', { id: toastId });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex-1 flex h-full min-h-0 bg-[#080C14] text-slate-100">
      {/* Selector de Perfiles */}
      <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/60 flex flex-col min-h-0">
        <div className="p-3 border-b border-slate-800/80 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-violet-400" />
            Perfiles
          </h2>
          <div className="flex gap-1">
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProfile()}
              placeholder="@handle IG o link de TikTok"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleAddProfile}
              disabled={isAdding}
              className="px-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shrink-0"
            >
              {isAdding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
          {isLoading && (
            <div className="p-4 text-center text-[11px] text-slate-500">Cargando perfiles reales...</div>
          )}
          {!isLoading && profiles.length === 0 && (
            <div className="p-4 text-center text-[11px] text-slate-500">
              Sin perfiles todavía. Agregá el tuyo o uno de competencia arriba.
            </div>
          )}
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full p-2 rounded-xl flex items-center gap-2 text-left transition-all ${
                selectedId === p.id ? 'bg-violet-600/20 border border-violet-500/40' : 'hover:bg-slate-900 border border-transparent'
              }`}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.handle} className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  {p.platform === 'tiktok' ? <Music2 className="w-3.5 h-3.5" /> : <Instagram className="w-3.5 h-3.5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-100 truncate flex items-center gap-1">
                  @{p.handle}
                  {p.isOwn && <Star className="w-2.5 h-2.5 text-amber-400 shrink-0" fill="currentColor" />}
                </p>
                <p className="text-[9px] text-slate-500 font-mono">{formatMetric(p.followerCount ?? undefined)} seguidores</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-bold text-slate-200">Sin perfil seleccionado</p>
              <p className="text-xs text-slate-500">Agregá tu cuenta o un competidor de Instagram/TikTok en el panel izquierdo para ver su análisis.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header del perfil + Tabs */}
            <div className="shrink-0 border-b border-slate-800/80 bg-slate-950/40 px-5 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {selected.avatarUrl ? (
                    <img src={selected.avatarUrl} alt={selected.handle} className="w-10 h-10 rounded-xl object-cover border border-slate-700" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                      {selected.platform === 'tiktok' ? <Music2 className="w-5 h-5" /> : <Instagram className="w-5 h-5" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold text-slate-100 truncate">@{selected.handle}</h1>
                    <p className="text-[11px] text-slate-500">{selected.displayName}</p>
                  </div>
                  {selected.isOwn && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                      <ShieldCheck className="w-3 h-3" /> Tu cuenta
                    </span>
                  )}
                </div>
                {onClose && (
                  <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-1 text-xs font-bold">
                {([
                  ['resumen', 'Resumen ejecutivo'],
                  ['contenido', 'Contenido'],
                  ['engagement', 'Engagement'],
                  ['comparar', 'Comparar'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-3 py-2 rounded-t-lg border-b-2 transition-all ${
                      activeTab === key ? 'border-violet-500 text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              {activeTab === 'resumen' && <ResumenTab profile={selected} growthHistory={growthHistory} />}
              {activeTab === 'contenido' && <ContenidoTab profile={selected} />}
              {activeTab === 'engagement' && <EngagementTab profile={selected} />}
              {activeTab === 'comparar' && (
                <CompararTab
                  profile={selected}
                  profiles={profiles}
                  compareTarget={compareTarget}
                  onSelectCompare={setCompareId}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---- Tarjeta de estadística reutilizable ----
const StatCard: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
    </div>
    <span className="text-lg font-black text-slate-100 font-mono">{value}</span>
  </div>
);

// ---- Resumen ejecutivo ----
const ResumenTab: React.FC<{ profile: UnifiedProfile; growthHistory: { date: string; seguidores: number }[] }> = ({ profile, growthHistory }) => {
  const engRate = engagementRateOverFollowers(profile.posts, profile.followerCount);
  const perDay = postsPerDay(profile.posts);
  const netGrowth = growthHistory.length >= 2 ? growthHistory[growthHistory.length - 1].seguidores - growthHistory[0].seguidores : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Seguidores" value={formatMetric(profile.followerCount ?? undefined)} icon={<Users className="w-3 h-3" />} />
        <StatCard label="Publicaciones" value={formatMetric(profile.mediaCount ?? undefined)} icon={<FileText className="w-3 h-3" />} />
        <StatCard label="Engagement / Seguidores" value={engRate !== null ? `${engRate}%` : 'Sin dato'} icon={<Heart className="w-3 h-3" />} />
        <StatCard label="Publicaciones / Día" value={perDay !== null ? String(perDay) : 'Sin dato'} icon={<TrendingUp className="w-3 h-3" />} />
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-200">Crecimiento de Seguidores (real, desde que se empezó a trackear)</h3>
          {netGrowth !== null && (
            <span className={`text-xs font-bold flex items-center gap-1 ${netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netGrowth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {netGrowth >= 0 ? '+' : ''}{netGrowth}
            </span>
          )}
        </div>
        {growthHistory.length < 2 ? (
          <p className="text-[11px] text-slate-500 py-8 text-center">
            Todavía no hay suficiente historial — se guarda una foto por día a partir de hoy. Volvé en unos días para ver la curva real.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
              <Line type="monotone" dataKey="seguidores" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// ---- Contenido ----
const ContenidoTab: React.FC<{ profile: UnifiedProfile }> = ({ profile }) => {
  const [sortBy, setSortBy] = useState<'viewCount' | 'likeCount' | 'commentCount'>('viewCount');
  const sorted = [...profile.posts].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  return (
    <div className="space-y-3 max-w-5xl">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-slate-500">Ordenar por:</span>
        {([['viewCount', 'Vistas'], ['likeCount', 'Likes'], ['commentCount', 'Comentarios']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2.5 py-1 rounded-lg font-semibold ${sortBy === key ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-8 text-center">Sin publicaciones cargadas para este perfil todavía.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sorted.map((post) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
              className="bg-slate-900 border border-slate-800 hover:border-violet-500/50 rounded-xl overflow-hidden transition-all group"
            >
              <div className="aspect-[9/16] bg-slate-950 relative">
                {post.thumbnailUrl ? (
                  <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Play className="w-6 h-6" />
                  </div>
                )}
                <ExternalLink className="w-3 h-3 absolute top-1.5 right-1.5 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-2 space-y-1">
                <p className="text-[10px] text-slate-300 line-clamp-2 leading-snug min-h-[26px]">{post.caption || 'Sin descripción'}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 flex-wrap">
                  {post.viewCount !== null && <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5 text-cyan-400" />{formatMetric(post.viewCount)}</span>}
                  <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-pink-400" />{formatMetric(post.likeCount ?? undefined)}</span>
                  <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5 text-blue-400" />{formatMetric(post.commentCount ?? undefined)}</span>
                  {post.shareCount !== null && <span className="flex items-center gap-0.5"><Share2 className="w-2.5 h-2.5 text-emerald-400" />{formatMetric(post.shareCount)}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- Engagement ----
const EngagementTab: React.FC<{ profile: UnifiedProfile }> = ({ profile }) => {
  const totalLikes = profile.posts.reduce((s, p) => s + (p.likeCount || 0), 0);
  const totalComments = profile.posts.reduce((s, p) => s + (p.commentCount || 0), 0);
  const totalShares = profile.posts.reduce((s, p) => s + (p.shareCount || 0), 0);
  const withViews = profile.posts.filter((p) => hasValue(p.viewCount));
  const avgViews = withViews.length > 0 ? Math.round(withViews.reduce((s, p) => s + (p.viewCount || 0), 0) / withViews.length) : null;
  const engRate = engagementRateOverFollowers(profile.posts, profile.followerCount);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Likes Totales" value={formatMetric(totalLikes)} icon={<Heart className="w-3 h-3" />} />
        <StatCard label="Comentarios Totales" value={formatMetric(totalComments)} icon={<MessageCircle className="w-3 h-3" />} />
        <StatCard label="Compartidos Totales" value={totalShares > 0 ? formatMetric(totalShares) : 'Sin dato'} icon={<Share2 className="w-3 h-3" />} />
        <StatCard label="Vistas Promedio" value={avgViews !== null ? formatMetric(avgViews) : 'Sin dato'} icon={<Eye className="w-3 h-3" />} />
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
        <span className="text-[10px] font-bold uppercase text-slate-400">Tasa de Engagement por Seguidores</span>
        <p className="text-2xl font-black text-violet-300 font-mono">{engRate !== null ? `${engRate}%` : 'Sin dato'}</p>
        <p className="text-[10px] text-slate-500">(likes + comentarios) / seguidores, promediado por publicación — la única tasa comparable igual para tu cuenta y para competencia.</p>
      </div>

      {profile.posts.length > 0 && profile.posts.every((p) => p.viewCount === null) && !profile.isOwn && (
        <p className="text-[11px] text-amber-300/80 bg-amber-950/20 border border-amber-500/20 rounded-xl p-3">
          Este es un perfil de terceros: Meta no expone alcance, guardados ni tasa por visualizaciones de cuentas que no son tuyas. Conectá tu propia cuenta para ver esas métricas completas.
        </p>
      )}
    </div>
  );
};

// ---- Comparar ----
const CompararTab: React.FC<{
  profile: UnifiedProfile;
  profiles: UnifiedProfile[];
  compareTarget: UnifiedProfile | null;
  onSelectCompare: (id: string) => void;
}> = ({ profile, profiles, compareTarget, onSelectCompare }) => {
  const others = profiles.filter((p) => p.id !== profile.id);

  const metricsFor = (p: UnifiedProfile) => ({
    seguidores: p.followerCount || 0,
    publicaciones: p.posts.length,
    likes: p.posts.reduce((s, x) => s + (x.likeCount || 0), 0),
    comentarios: p.posts.reduce((s, x) => s + (x.commentCount || 0), 0),
    engagement: engagementRateOverFollowers(p.posts, p.followerCount) || 0,
  });

  if (!compareTarget) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-xs text-slate-400">Elegí con quién comparar a @{profile.handle}:</p>
        <div className="space-y-1.5">
          {others.length === 0 && <p className="text-[11px] text-slate-500">Agregá otro perfil para poder comparar.</p>}
          {others.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectCompare(p.id)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/50 flex items-center gap-2 text-left"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-200">@{p.handle}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const a = metricsFor(profile);
  const b = metricsFor(compareTarget);
  const rows: Array<{ label: string; key: keyof typeof a; suffix?: string }> = [
    { label: 'Seguidores', key: 'seguidores' },
    { label: 'Publicaciones', key: 'publicaciones' },
    { label: 'Likes Totales', key: 'likes' },
    { label: 'Comentarios Totales', key: 'comentarios' },
    { label: 'Engagement / Seguidores', key: 'engagement', suffix: '%' },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <span>@{profile.handle}</span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
          <span>@{compareTarget.handle}</span>
        </div>
        <button onClick={() => onSelectCompare('')} className="text-[11px] text-slate-500 hover:text-slate-300">
          Cambiar
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2">
            <span className="text-[11px] font-bold text-slate-300">{row.label}</span>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart
                layout="vertical"
                data={[
                  { name: profile.handle, value: a[row.key] },
                  { name: compareTarget.handle, value: b[row.key] },
                ]}
                margin={{ left: 60 }}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} width={60} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }}
                  formatter={(v: number) => `${v}${row.suffix || ''}`}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
};
