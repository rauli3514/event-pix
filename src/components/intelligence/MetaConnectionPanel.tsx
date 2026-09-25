import React, { useState, useEffect, useCallback } from 'react';
import {
  Instagram, CheckCircle2, AlertCircle, Loader2,
  Eye, Heart, MessageCircle, Play, TrendingUp,
  Plus, ExternalLink, Settings, Trash2, Zap, Users,
  GripVertical, AlertTriangle, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MetaGraphService,
  MetaCredentials,
  MetaMediaItem,
  MetaMediaInsights,
  MetaProfileInsights,
  DiscoveredAccount
} from '../../services/meta/MetaGraphService';
import { AccountBenchmarkService } from '../../services/intelligence/AccountBenchmarkService';
import { ProfileSnapshotService } from '../../services/intelligence/ProfileSnapshotService';
import { IntelligenceStorageService } from '../../services/intelligence/IntelligenceStorageService';
import { ContentDnaEngine } from '../../services/intelligence/ContentDnaEngine';
import { hasValue } from '../../services/intelligence/metricUtils';

interface MetaConnectionPanelProps {
  businessId: string;
  onAddReelToCanvas?: (reel: MetaMediaItem & { insights?: MetaMediaInsights }) => void;
  onOpenFullAnalysis?: () => void;
}

type PanelState = 'not_connected' | 'verifying' | 'select_account' | 'connected' | 'error';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysAgo(iso: string): string {
  if (!iso) return '';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'hace 1 día';
  return `hace ${diff} días`;
}

export const MetaConnectionPanel: React.FC<MetaConnectionPanelProps> = ({ businessId, onAddReelToCanvas, onOpenFullAnalysis }) => {
  const [state, setState] = useState<PanelState>(
    MetaGraphService.isConfigured(businessId) ? 'verifying' : 'not_connected'
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredAccount[]>([]);
  const [profile, setProfile] = useState<MetaProfileInsights | null>(null);
  const [reels, setReels] = useState<Array<MetaMediaItem & { insights?: MetaMediaInsights }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [directReelUrl, setDirectReelUrl] = useState('');
  const [isImportingDirect, setIsImportingDirect] = useState(false);
  const [adAccountIdDraft, setAdAccountIdDraft] = useState(() => MetaGraphService.loadCredentials(businessId)?.adAccountId || '');

  const handleSaveAdAccountId = () => {
    const current = MetaGraphService.loadCredentials(businessId);
    if (!current) return;
    MetaGraphService.saveCredentials({ ...current, adAccountId: adAccountIdDraft.trim() }, businessId);
    toast.success('Cuenta publicitaria guardada. Ya podés auditar tus anuncios en la pestaña "Ads".');
  };

  // Manual credential form
  const [formCreds, setFormCreds] = useState<MetaCredentials>({
    appId: import.meta.env.VITE_META_APP_ID || '2345235469580053',
    appSecret: '',
    accessToken: '',
    instagramAccountId: '',
  });

  const loadConnectedData = useCallback(async () => {
    setIsLoadingData(true);
    setErrorMsg('');

    try {
      const [profileData, reelsData] = await Promise.all([
        MetaGraphService.getProfile(businessId),
        MetaGraphService.getReelsWithInsights(15, businessId),
      ]);
      setProfile(profileData);
      setReels(reelsData);
      setState('connected');

      if (profileData?.username) {
        ProfileSnapshotService.recordSnapshotIfNeeded({
          businessId,
          kind: 'own',
          platform: 'instagram',
          handle: profileData.username,
          followerCount: profileData.followers_count,
          mediaCount: profileData.media_count,
        });
      }

      // Calcular inmediatamente el Benchmark de Medianas y minar Content DNA
      if (reelsData.length > 0) {
        const benchmark = AccountBenchmarkService.calculateAccountBenchmark(
          businessId,
          profileData?.username,
          reelsData
        );
        IntelligenceStorageService.saveBenchmark(businessId, benchmark);

        // Deconstruir Content DNA de los reels reales
        const dnaItems = reelsData.map(r => ContentDnaEngine.deconstructReelDna(r));
        const classifications = reelsData.map(r => AccountBenchmarkService.evaluateReelPerformance(r, benchmark));
        const { hypotheses } = ContentDnaEngine.detectWinningAndLosingPatterns(dnaItems, classifications, businessId);
        IntelligenceStorageService.saveHypotheses(businessId, hypotheses);
      }
    } catch (err: any) {
      console.error('Error cargando datos de Meta:', err);
      setErrorMsg(err?.message || 'Error al obtener datos reales de tu cuenta de Instagram.');
      setState('error');
    } finally {
      setIsLoadingData(false);
    }
  }, [businessId]);

  // Verify connection on mount if credentials exist
  useEffect(() => {
    if (state === 'verifying') {
      const saved = MetaGraphService.loadCredentials(businessId);
      if (!saved?.accessToken) {
        setState('not_connected');
        return;
      }

      MetaGraphService.testAndDiscoverAccounts(saved.accessToken, saved.instagramAccountId)
        .then((result) => {
          if (result.success) {
            loadConnectedData();
          } else {
            setErrorMsg(result.error || 'El token de acceso expiró o no es válido.');
            setState('error');
          }
        })
        .catch((e) => {
          setErrorMsg(e?.message || 'Fallo de conexión.');
          setState('error');
        });
    }
  }, [state, loadConnectedData, businessId]);

  const handleTestAndDiscover = async () => {
    if (!formCreds.accessToken.trim()) {
      toast.error('Pegá tu Access Token de Meta para continuar.');
      return;
    }

    setState('verifying');
    setErrorMsg('');
    setWarningMsg('');

    try {
      const res = await MetaGraphService.testAndDiscoverAccounts(
        formCreds.accessToken,
        formCreds.instagramAccountId
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Token inválido o sin permisos.');
        setState('error');
        return;
      }

      if (res.warning) {
        setWarningMsg(res.warning);
      }

      if (res.accounts.length === 1) {
        // Auto-seleccionar si solo hay 1 cuenta vinculada
        const acct = res.accounts[0];
        const updatedCreds: MetaCredentials = {
          ...formCreds,
          instagramAccountId: acct.instagramAccountId,
          facebookPageId: acct.facebookPageId,
          facebookPageName: acct.facebookPageName,
          pageAccessToken: acct.pageAccessToken,
          accountUsername: acct.username,
          accountName: acct.name,
          accountAvatar: acct.profilePictureUrl,
          isBasicDisplay: acct.isBasicDisplay,
        };
        MetaGraphService.saveCredentials(updatedCreds, businessId);
        toast.success(`🎉 Conectado exitosamente con @${acct.username}`);
        loadConnectedData();
      } else if (res.accounts.length > 1) {
        // Mostrar selector de cuentas
        setDiscoveredAccounts(res.accounts);
        setState('select_account');
      } else {
        // Token válido pero sin cuentas de Instagram vinculadas
        setErrorMsg(
          res.warning ||
            'El token de Meta es válido, pero no se encontró ninguna cuenta de Instagram vinculada a tus páginas de Facebook.'
        );
        setState('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ocurrió un error inesperado al comprobar el token.');
      setState('error');
    }
  };

  const handleSelectAccount = (acct: DiscoveredAccount) => {
    const updatedCreds: MetaCredentials = {
      ...formCreds,
      instagramAccountId: acct.instagramAccountId,
      facebookPageId: acct.facebookPageId,
      facebookPageName: acct.facebookPageName,
      pageAccessToken: acct.pageAccessToken,
      accountUsername: acct.username,
      accountName: acct.name,
      accountAvatar: acct.profilePictureUrl,
      isBasicDisplay: acct.isBasicDisplay,
    };
    MetaGraphService.saveCredentials(updatedCreds, businessId);
    toast.success(`🎉 Vinculado a @${acct.username}`);
    loadConnectedData();
  };

  const handleDisconnect = () => {
    MetaGraphService.clearCredentials(businessId);
    setProfile(null);
    setReels([]);
    setState('not_connected');
    toast.success('Cuenta desconectada.');
  };

  // Importar Reel individual por enlace usando el scraper en vivo
  const handleImportDirectReel = async () => {
    if (!directReelUrl.trim()) {
      toast.error('Pegá el enlace de un Reel de Instagram.');
      return;
    }

    setIsImportingDirect(true);
    const toastId = toast.loading('Extrayendo métricas reales de Instagram...');

    try {
      const res = await fetch(`/api/instagram-scrape?url=${encodeURIComponent(directReelUrl.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo extraer información de este Reel.');
      }

      // El scraper devuelve null (no 0) cuando Instagram no expuso el dato en
      // la página pública — un 0 acá se vería idéntico a un Reel con cero
      // interacciones reales, que es exactamente el bug que ya arreglamos en
      // el scraper de competidores.
      const likes = typeof data.likes === 'number' ? data.likes : undefined;
      const commentsCount = typeof data.commentsCount === 'number' ? data.commentsCount : undefined;
      const interactionParts = [likes, commentsCount].filter((v): v is number => typeof v === 'number');

      const importedReel: MetaMediaItem & { insights?: MetaMediaInsights } = {
        id: `reel_${data.shortcode || Date.now()}`,
        media_type: 'REELS',
        media_url: data.videoUrl,
        thumbnail_url: data.imageUrl,
        permalink: directReelUrl.trim(),
        caption: data.caption || 'Reel de Instagram',
        timestamp: new Date().toISOString(),
        like_count: likes,
        comments_count: commentsCount,
        insights: {
          media_id: `reel_${data.shortcode || Date.now()}`,
          // El scraper público solo expone likes/comentarios visibles en la página.
          // Reach, impressions y plays son insights privados que Instagram no
          // publica en el HTML: no se estiman a partir de likes, quedan
          // ausentes hasta que se conecten por Meta Graph API.
          total_interactions: interactionParts.length > 0 ? interactionParts.reduce((a, b) => a + b, 0) : undefined,
          unavailable: true,
          unavailable_reason: 'Reel importado por scraping público: Instagram no expone reach/impressions/plays fuera de Meta Graph API.',
        },
      };

      setReels((prev) => [importedReel, ...prev.filter((r) => r.permalink !== importedReel.permalink)]);
      setDirectReelUrl('');
      toast.success(
        hasValue(likes) || hasValue(commentsCount)
          ? `✅ Reel importado con éxito (${likes ?? 'sin dato'} likes, ${commentsCount ?? 'sin dato'} comentarios)`
          : '✅ Reel importado, pero Instagram no expuso likes ni comentarios en la página pública.',
        { id: toastId }
      );

      if (onAddReelToCanvas) {
        onAddReelToCanvas(importedReel);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsImportingDirect(false);
    }
  };

  // ---- Render: State Verifying ----
  if (state === 'verifying') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-200">Verificando con Meta Graph API...</p>
          <p className="text-xs text-slate-400 mt-1">Comprobando validez del token y cuentas asociadas</p>
        </div>
      </div>
    );
  }

  // ---- Render: State Select Account (Si hay múltiples) ----
  if (state === 'select_account') {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-2xl space-y-1">
          <h4 className="font-bold text-violet-300 text-xs flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Cuentas de Instagram Detectadas
          </h4>
          <p className="text-[11px] text-slate-400">
            Tu token tiene acceso a las siguientes cuentas de Instagram Business. Seleccioná cuál querés vincular:
          </p>
        </div>

        <div className="space-y-2">
          {discoveredAccounts.map((acct) => (
            <div
              key={acct.instagramAccountId}
              className="bg-slate-900 border border-slate-800 hover:border-pink-500/50 p-3 rounded-2xl flex items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                {acct.profilePictureUrl ? (
                  <img
                    src={acct.profilePictureUrl}
                    alt={acct.username}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
                    <Instagram className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-100 text-xs truncate">@{acct.username}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {acct.facebookPageName ? `Página: ${acct.facebookPageName}` : acct.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleSelectAccount(acct)}
                className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shrink-0 flex items-center gap-1 transition-all"
              >
                Vincular <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setState('not_connected')}
          className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 text-center"
        >
          Volver a ingresar token
        </button>
      </div>
    );
  }

  // ---- Render: State Error ----
  if (state === 'error') {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <div className="bg-red-950/30 border border-red-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2.5 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <h4 className="font-bold text-sm">Fallo de Autenticación Meta</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/60 p-2.5 rounded-xl border border-red-900/50 break-words">
            {errorMsg}
          </p>
          <div className="text-[11px] text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-300">Pasos habituales para solucionar:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Revisá que el token no haya expirado en el Explorador de la API Graph.</li>
              <li>Asegurate de que tenga activados los permisos <code className="text-pink-400">instagram_basic</code> y <code className="text-pink-400">pages_show_list</code>.</li>
              <li>Tu perfil de Instagram debe ser de tipo Profesional (Empresa o Creador) y estar vinculado a una Fanpage de Facebook.</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              MetaGraphService.clearCredentials(businessId);
              setState('not_connected');
            }}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all"
          >
            Reintentar con otro Token
          </button>
        </div>

        {/* Opción rápida sin token: importar Reel por URL */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 space-y-2">
          <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            ¿Querés empezar ya sin configurar Meta?
          </p>
          <p className="text-[11px] text-slate-400">
            Podés importar y auditar cualquier Reel público directamente pegando su enlace:
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={directReelUrl}
              onChange={(e) => setDirectReelUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={handleImportDirectReel}
              disabled={isImportingDirect}
              className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shrink-0"
            >
              {isImportingDirect ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Importar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: State Not Connected ----
  if (state === 'not_connected') {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Header Card */}
        <div className="bg-gradient-to-br from-pink-950/40 to-violet-950/40 border border-pink-500/25 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shrink-0">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Conectar Instagram Real</h3>
              <p className="text-[11px] text-slate-400">App: eventPix intelligence · ID: 2345235469580053</p>
            </div>
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">
            Conectá tu cuenta de Instagram para sincronizar tus Reels reales, obtener métricas de reproducción, likes y comentarios, y armar la estrategia con IA.
          </p>
        </div>

        {/* Configuración con Token */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-pink-400" />
              Token de Acceso Meta Graph
            </span>
            <a
              href="https://developers.facebook.com/tools/explorer/2345235469580053/"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 underline"
            >
              Abrir Graph Explorer <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {/* Qué permisos tildar en el Graph Explorer — para que conectar esto
              no obligue a pedir permisos de mensajes/publicación que esta
              pantalla ni usa. Ver tus Reels y auditar competencia nunca
              necesita que el token pueda leer tus DMs. */}
          <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[10px] text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-300">¿Qué permisos tildar al generar el token?</p>
            <p>
              <strong className="text-emerald-400">Para esto (métricas propias y de competencia):</strong>{' '}
              <code className="text-pink-400">instagram_basic</code>, <code className="text-pink-400">instagram_manage_insights</code>,{' '}
              <code className="text-pink-400">pages_show_list</code>. Nada más — no hace falta permiso de mensajes ni de publicación.
            </p>
            <p>
              <strong className="text-amber-400">Solo si además vas a usar el Auto-DM</strong> (desde el conector "Meta Suite" del lienzo),
              agregale <code className="text-pink-400">instagram_manage_messages</code> al mismo token.
            </p>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                Access Token (Usuario o Página) *
              </label>
              <textarea
                rows={2}
                value={formCreds.accessToken}
                onChange={(e) => setFormCreds((prev) => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Pegá acá tu token que empieza con EAABsbCS..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                Instagram Account ID (Opcional — se auto-detecta)
              </label>
              <input
                type="text"
                value={formCreds.instagramAccountId}
                onChange={(e) => setFormCreds((prev) => ({ ...prev, instagramAccountId: e.target.value }))}
                placeholder="178414... (dejar vacío para detectar automáticamente)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">
                Cuenta Publicitaria de Meta Ads (Opcional — necesaria para auditar anuncios pagos)
              </label>
              <input
                type="text"
                value={formCreds.adAccountId || ''}
                onChange={(e) => setFormCreds((prev) => ({ ...prev, adAccountId: e.target.value }))}
                placeholder="act_1234567890 (la encontrás en Meta Ads Manager)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>

            <button
              onClick={handleTestAndDiscover}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verificar y Auto-Detectar Cuenta
            </button>
          </div>
        </div>

        {/* Método Alternativo Directo: Importar Reel por URL */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-200">Importar Reel Directo (Sin Token)</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Si no tenés un token a mano, pegá directamente el link de cualquier Reel de tu perfil para extraer sus datos y comentarios reales:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={directReelUrl}
              onChange={(e) => setDirectReelUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={handleImportDirectReel}
              disabled={isImportingDirect}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs flex items-center gap-1 shrink-0"
            >
              {isImportingDirect ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Importar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: State Connected ----
  // Solo promedia engagement sobre reels con reach/impressions reales:
  // sin esa base no hay forma de calcular una tasa, y estimar el
  // denominador a partir de likes fabricaba el dato en vez de reportar
  // que faltaba.
  const reelsWithReach = reels.filter((r) => hasValue(r.insights?.reach) || hasValue(r.insights?.impressions));
  const avgEngagement =
    reelsWithReach.length > 0
      ? reelsWithReach.reduce((s, r) => {
          const total = r.insights?.total_interactions ?? (r.like_count || 0) + (r.comments_count || 0);
          const reach = (r.insights?.reach ?? r.insights?.impressions) as number;
          return s + (total / reach) * 100;
        }, 0) / reelsWithReach.length
      : 0;

  const totalPlays = reels.reduce((s, r) => s + (r.insights?.plays || 0), 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {warningMsg && (
        <div className="mx-4 mt-3 flex items-start gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* Si ningún Reel trajo reach/impressions reales, mostramos el motivo
          exacto que reportó Meta en vez de dejar "Sin dato" sin explicación. */}
      {reels.length > 0 && reelsWithReach.length === 0 && (
        <div className="mx-4 mt-3 flex items-start gap-2 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Se sincronizaron tus Reels pero Meta no devolvió métricas de alcance/interacciones para ninguno.
            {reels[0]?.insights?.unavailable_reason ? ` Motivo: ${reels[0].insights.unavailable_reason}` : ''}
          </span>
        </div>
      )}
      {/* Profile Header */}
      <div className="px-4 pt-3 pb-2 space-y-2 shrink-0 bg-slate-900/40 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="relative">
            {profile?.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt={profile.username}
                className="w-10 h-10 rounded-2xl border-2 border-pink-500/50 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <CheckCircle2 className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-100 text-xs truncate">@{profile?.username || 'instagram_user'}</p>
            <p className="text-[10px] text-slate-400 truncate">{profile?.name || 'Cuenta Verificada'}</p>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            title="Desconectar cuenta"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-center">
            <p className="font-black text-slate-100 font-mono">
              {profile?.followers_count ? formatNumber(profile.followers_count) : '—'}
            </p>
            <p className="text-slate-500 text-[9px]">Seguidores Reales</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-center">
            <p className="font-black text-slate-100 font-mono">
              {reels.length}
            </p>
            <p className="text-slate-500 text-[9px]">Reels Sincronizados</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-center">
            <p className="font-black text-slate-100 font-mono">
              {reelsWithReach.length > 0 ? `${avgEngagement.toFixed(1)}%` : 'Sin dato'}
            </p>
            <p className="text-slate-500 text-[9px]">Engagement Promedio</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 text-center">
            <p className="font-black text-slate-100 font-mono">
              {totalPlays > 0 ? formatNumber(totalPlays) : 'Sin dato'}
            </p>
            <p className="text-slate-500 text-[9px]">Reproducciones Totales</p>
          </div>
        </div>

        {/* Cuenta publicitaria de Meta Ads — se puede agregar/editar en cualquier momento sin reconectar Instagram */}
        <div className="pt-1 flex gap-1.5">
          <input
            type="text"
            value={adAccountIdDraft}
            onChange={(e) => setAdAccountIdDraft(e.target.value)}
            placeholder="Cuenta publicitaria: act_1234567890 (para auditar Ads)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono"
          />
          <button
            onClick={handleSaveAdAccountId}
            className="px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
          >
            Guardar
          </button>
        </div>

        {/* Input para agregar más Reels individuales si no aparecen todos */}
        <div className="pt-1">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={directReelUrl}
              onChange={(e) => setDirectReelUrl(e.target.value)}
              placeholder="Agregar otro Reel por enlace..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={handleImportDirectReel}
              disabled={isImportingDirect}
              className="px-2.5 py-1 rounded-xl bg-pink-600/30 hover:bg-pink-600 border border-pink-500/40 text-pink-200 text-[11px] font-bold shrink-0"
            >
              {isImportingDirect ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Header de sección: acá el foco es arrastrar Reels al Canvas.
          Las métricas detalladas viven en Análisis de Comercio. */}
      <div className="px-4 py-2 shrink-0 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <Play className="w-3.5 h-3.5 text-pink-400" />
          Reels Reales ({reels.length})
        </span>
        {onOpenFullAnalysis && (
          <button
            onClick={onOpenFullAnalysis}
            className="flex items-center gap-1 text-[10px] font-bold text-violet-300 hover:text-violet-200 transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            Ver métricas completas
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5 custom-scrollbar">
        {isLoadingData && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoadingData && (
          <>
            {reels.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Play className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">No hay Reels cargados todavía</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Pegá el link de cualquier Reel de tu cuenta en la barra de arriba para importarlo con sus métricas reales.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-pink-950/20 border border-pink-500/30 rounded-xl text-[10px] text-pink-300">
                  <GripVertical className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>
                    <strong>Arrastrá</strong> cualquier Reel directo al Canvas para analizarlo con IA.
                  </span>
                </div>

                {reels.map((reel) => (
                  <div
                    key={reel.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(reel));
                      e.dataTransfer.setData('text/plain', reel.permalink);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="bg-slate-900 border border-slate-800 hover:border-pink-500/60 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-pink-950/30 transition-all group select-none"
                  >
                    <div className="flex gap-2.5 p-3 items-start">
                      <div className="pt-4 text-slate-600 group-hover:text-pink-400 transition-colors shrink-0">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 shrink-0 relative bg-slate-800">
                        {reel.thumbnail_url ? (
                          <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 bg-pink-600 rounded-md px-1 text-[8px] font-bold text-white">
                          REEL
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                          {reel.caption || 'Sin descripción'}
                        </p>
                        <p className="text-[9px] text-slate-500">{daysAgo(reel.timestamp)}</p>
                        <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5">
                            <Heart className="w-2.5 h-2.5 text-pink-400" /> {hasValue(reel.like_count) ? formatNumber(reel.like_count) : 'Sin dato'}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageCircle className="w-2.5 h-2.5 text-blue-400" /> {hasValue(reel.comments_count) ? reel.comments_count : 'Sin dato'}
                          </span>
                          {reel.insights?.plays ? (
                            <span className="flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5 text-violet-400" /> {formatNumber(reel.insights.plays)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Footer con botón para agregar al Canvas */}
                    <div className="border-t border-slate-800/80 px-3 py-2 flex items-center justify-between bg-slate-950/40">
                      <span className="text-[10px] text-emerald-400 font-mono">Métricas reales</span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={reel.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="Ver en Instagram"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {onAddReelToCanvas && (
                          <button
                            onClick={() => {
                              onAddReelToCanvas(reel);
                              toast.success('🎬 Reel agregado al Canvas!');
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:bg-violet-600 text-[10px] font-bold transition-all"
                          >
                            <Plus className="w-3 h-3" /> Canvas
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
