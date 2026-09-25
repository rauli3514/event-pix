// ================================================================
// TikTokPanel.tsx
// Auditoría de perfiles de TikTok (propio o de competencia) con datos
// públicos reales — sin API, sin login, igual que Instagram Competencia
// pero para TikTok, que todavía expone estos datos en su HTML público.
// EventPix Intelligence — SaaS Studio
// ================================================================

import React, { useState, useEffect } from 'react';
import {
  Music2, Plus, RefreshCw, Trash2, ExternalLink, Heart, MessageCircle,
  Eye, Share2, Users, Play, Clock, ShieldCheck, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { ProfileSnapshotService } from '../../services/intelligence/ProfileSnapshotService';

export interface TikTokVideoStat {
  id: string;
  caption: string;
  thumbnailUrl: string;
  permalink: string;
  createdAt: string;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
}

export interface TikTokProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  verified: boolean;
  followerCount: number | null;
  followingCount: number | null;
  heartCount: number | null;
  videoCount: number | null;
  videos: TikTokVideoStat[];
  fetchedAt: string;
  // TikTok no distingue "cuenta propia" de "competencia" a nivel técnico
  // (ambas se leen igual, por scraping público) — esta marca es manual,
  // para que el Análisis de Comercio sepa cuál mostrar como "tu cuenta".
  isOwn?: boolean;
}

interface TikTokPanelProps {
  businessId?: string;
}

const STORAGE_KEY = 'eventpix_tiktok_profiles';
const getStorageKey = (businessId?: string) => (businessId ? `${STORAGE_KEY}_${businessId}` : STORAGE_KEY);

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return 'Sin dato';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Día y hora con más publicaciones reales — nunca un promedio inventado:
// si no hay videos con fecha, no se muestra nada en vez de "lunes" al azar.
function computeBestPostingTime(videos: TikTokVideoStat[]): { day: string; hour: string } | null {
  if (videos.length === 0) return null;
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const v of videos) {
    const d = new Date(v.createdAt);
    if (isNaN(d.getTime())) continue;
    dayCounts[d.getDay()]++;
    hourCounts[d.getHours()]++;
  }
  const topDay = dayCounts.indexOf(Math.max(...dayCounts));
  const topHour = hourCounts.indexOf(Math.max(...hourCounts));
  return {
    day: DAY_LABELS[topDay],
    hour: `${topHour === 0 ? 12 : topHour > 12 ? topHour - 12 : topHour}${topHour >= 12 ? 'PM' : 'AM'}`,
  };
}

export const TikTokPanel: React.FC<TikTokPanelProps> = ({ businessId }) => {
  const [profiles, setProfiles] = useState<TikTokProfile[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    try {
      const raw = localStorage.getItem(getStorageKey(businessId));
      setProfiles(raw ? (JSON.parse(raw) as TikTokProfile[]) : []);
    } catch {
      setProfiles([]);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    try {
      localStorage.setItem(getStorageKey(businessId), JSON.stringify(profiles));
    } catch (e) {
      console.warn('Error saving TikTok profiles:', e);
    }
  }, [profiles, businessId]);

  const handleAddProfile = async () => {
    if (!input.trim()) {
      toast.error('Ingresá un @usuario o link de perfil de TikTok.');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Consultando el perfil público en TikTok...');

    try {
      const res = await fetch(`/api/tiktok-scrape?url=${encodeURIComponent(input.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo extraer información de este perfil de TikTok.');
      }

      const existing = profiles.find((p) => p.username === data.username);
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
        isOwn: existing?.isOwn,
      };

      setProfiles((prev) => [newProfile, ...prev.filter((p) => p.username !== newProfile.username)]);
      setExpandedId(newProfile.id);
      setInput('');
      if (businessId) {
        ProfileSnapshotService.recordSnapshotIfNeeded({
          businessId,
          kind: newProfile.isOwn ? 'own' : 'competitor',
          platform: 'tiktok',
          handle: newProfile.username,
          followerCount: newProfile.followerCount,
          followingCount: newProfile.followingCount,
          mediaCount: newProfile.videoCount,
          totalLikes: newProfile.heartCount,
        });
      }
      toast.success(
        `✅ @${data.username} agregado (${formatNumber(data.followerCount)} seguidores, ${newProfile.videos.length} videos reales)`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast.success('Perfil de TikTok eliminado.');
  };

  // Solo puede haber un perfil marcado como "mi cuenta" a la vez.
  const handleToggleOwn = (id: string) => {
    setProfiles((prev) => prev.map((p) => ({ ...p, isOwn: p.id === id ? !p.isOwn : false })));
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Music2 className="w-3.5 h-3.5 text-cyan-300" />
            Auditoría de TikTok
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Datos públicos reales
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Pegá tu propio @usuario o el de un competidor — sin conectar ninguna cuenta. Trae seguidores, videos, vistas,
          likes y el mejor horario para publicar, leyendo directo del perfil público.
        </p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddProfile()}
            placeholder="@tu_usuario o link de tiktok.com/@..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleAddProfile}
            disabled={isProcessing}
            className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
          >
            {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Agregar
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-[11px] text-slate-500">Sin perfiles de TikTok auditados todavía.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {profiles.map((profile) => {
            const isExpanded = expandedId === profile.id;
            const bestTime = computeBestPostingTime(profile.videos);
            const topVideos = [...profile.videos].sort(
              (a, b) => (b.playCount || 0) - (a.playCount || 0)
            );

            return (
              <div key={profile.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.username} className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-300 font-bold text-xs shrink-0">
                        {profile.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 text-xs truncate flex items-center gap-1.5">
                        @{profile.username}
                        {profile.isOwn && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-bold uppercase shrink-0">
                            Mi cuenta
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatNumber(profile.followerCount)} seguidores • {profile.videos.length} videos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleOwn(profile.id); }}
                      title={profile.isOwn ? 'Quitar marca de "mi cuenta"' : 'Marcar como mi cuenta'}
                      className={`p-1 rounded-lg hover:bg-slate-800 ${profile.isOwn ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
                    >
                      <Star className="w-3.5 h-3.5" fill={profile.isOwn ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(profile.id); }}
                      className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-800 space-y-2.5 pt-2.5 bg-slate-950/30">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 text-center">
                        <Users className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-0.5" />
                        <span className="font-mono font-bold text-slate-100 block">{formatNumber(profile.followerCount)}</span>
                        <span className="text-slate-500 text-[9px]">Seguidores</span>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 text-center">
                        <Heart className="w-3.5 h-3.5 text-pink-400 mx-auto mb-0.5" />
                        <span className="font-mono font-bold text-slate-100 block">{formatNumber(profile.heartCount)}</span>
                        <span className="text-slate-500 text-[9px]">Likes totales</span>
                      </div>
                    </div>

                    {bestTime && (
                      <div className="p-2.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl text-[11px] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-slate-300">
                          Día/hora con más publicaciones reales: <strong className="text-cyan-300">{bestTime.day} a las {bestTime.hour}</strong>
                        </span>
                      </div>
                    )}

                    {topVideos.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Videos ordenados por vistas ({topVideos.length}):
                        </span>
                        {topVideos.slice(0, 10).map((v) => (
                          <div key={v.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center gap-2">
                            {v.thumbnailUrl ? (
                              <img src={v.thumbnailUrl} alt="" className="w-10 h-14 rounded-lg object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-10 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                <Play className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="text-[10px] text-slate-200 truncate font-medium">{v.caption || 'Sin descripción'}</p>
                              <div className="flex items-center gap-2 text-[9px] text-slate-400 flex-wrap">
                                <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5 text-cyan-400" />{formatNumber(v.playCount)}</span>
                                <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-pink-400" />{formatNumber(v.likeCount)}</span>
                                <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5 text-blue-400" />{formatNumber(v.commentCount)}</span>
                                <span className="flex items-center gap-0.5"><Share2 className="w-2.5 h-2.5 text-emerald-400" />{formatNumber(v.shareCount)}</span>
                              </div>
                            </div>
                            <a href={v.permalink} target="_blank" rel="noreferrer" className="p-1 text-slate-500 hover:text-slate-300 shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
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
