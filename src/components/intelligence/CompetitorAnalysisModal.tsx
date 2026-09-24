import { useState } from 'react';
import { X, Search, Loader2, Users, TrendingUp, Zap, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '../../lib/apiAuth';
import { BrandDNA } from '../../types/intelligence';
import { ProfileAnalysisResponse, TopReel } from '../../types/profileAnalysis';
import { WinningTopicInput } from '../../types/spokenReel';
import { SpokenReelGeneratorModal } from './SpokenReelGeneratorModal';

interface CompetitorAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  ownInstagramHandle?: string;
  brandDna: BrandDNA;
}

/**
 * Motor 1 (Analizador de Perfiles Públicos): permite analizar cualquier
 * @usuario público de Instagram (propio o de un competidor), ver sus métricas
 * reales y detectar los formatos ganadores. Desde cada Reel exitoso —o desde
 * el Brand DNA a secas— se puede saltar directo al Motor 2 para generar un
 * guion hablado inspirado en ese patrón.
 */
export function CompetitorAnalysisModal({ isOpen, onClose, businessId, ownInstagramHandle, brandDna }: CompetitorAnalysisModalProps) {
  const [username, setUsername] = useState(ownInstagramHandle?.replace('@', '') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ProfileAnalysisResponse | null>(null);
  const [scriptTopic, setScriptTopic] = useState<WinningTopicInput | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    const handle = username.trim().replace(/^@/, '');
    if (!handle) {
      toast.error('Ingresá un @usuario para analizar.');
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/profile-analysis?username=${encodeURIComponent(handle)}`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'No se pudo analizar el perfil.');
        return;
      }
      setResult(data as ProfileAnalysisResponse);
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al analizar el perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  const openScriptFromReel = (reel: TopReel) => {
    setScriptTopic({
      source: result?.profile.username === ownInstagramHandle?.replace('@', '') ? 'own_reel' : 'competitor_reel',
      caption: reel.caption,
      engagement_rate: reel.engagement_rate,
      reel_url: reel.url,
    });
  };

  const openScriptFromBrandDna = () => {
    setScriptTopic({ source: 'brand_dna' });
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-slate-100">Analizar Competidor / Perfil</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3">
              <span className="text-slate-500 text-sm">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="usuario_de_instagram"
                className="flex-1 bg-transparent py-2.5 text-sm text-slate-100 outline-none"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 rounded-xl font-semibold text-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Analizar
            </button>
          </div>

          <button
            onClick={openScriptFromBrandDna}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-xl py-2"
          >
            <Zap className="w-3.5 h-3.5" /> Crear Reel Hablado a partir de tu Brand DNA (sin perfil de referencia)
          </button>

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                {result.profile.profile_pic && (
                  <img src={result.profile.profile_pic} alt={result.profile.username} className="w-12 h-12 rounded-full object-cover" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-100">@{result.profile.username}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {result.profile.followers.toLocaleString('es-AR')} seguidores
                  </p>
                </div>
              </div>

              {result.profile.biography && (
                <p className="text-xs text-slate-400 italic">{result.profile.biography}</p>
              )}

              {result.winning_patterns.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-1.5">Formatos ganadores</p>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {result.winning_patterns.map((p, i) => <li key={i}>• {p}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                  Top {result.top_reels.length} posts por Engagement Rate
                </p>
                <div className="space-y-2">
                  {result.top_reels.map((reel) => (
                    <div key={reel.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-slate-300 line-clamp-2 flex-1">{reel.caption || '(sin descripción)'}</p>
                        <span className="shrink-0 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {reel.engagement_rate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>❤️ {reel.likes.toLocaleString('es-AR')}</span>
                          <span>💬 {reel.comments.toLocaleString('es-AR')}</span>
                          {reel.views != null && <span>▶️ {reel.views.toLocaleString('es-AR')}</span>}
                          {reel.url && (
                            <a href={reel.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 hover:text-slate-300">
                              <ExternalLink className="w-3 h-3" /> Ver
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => openScriptFromReel(reel)}
                          className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200"
                        >
                          <Zap className="w-3 h-3" /> Crear Reel Hablado sobre esto
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SpokenReelGeneratorModal
        isOpen={scriptTopic !== null}
        onClose={() => setScriptTopic(null)}
        businessId={businessId}
        brandDna={brandDna}
        topic={scriptTopic}
      />
    </div>
  );
}
