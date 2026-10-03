import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  INITIAL_BUSINESS,
  INITIAL_BRAND_DNA
} from '../../services/intelligence/mockData';
import { BrandDNA, IntelligencePost, BusinessAuditReport, NodeType, NO_DATA, IntelligenceBusiness } from '../../types/intelligence';
import { fromApi, rate } from '../../services/intelligence/metricUtils';
import { BrandDnaPanel } from '../../components/intelligence/BrandDnaPanel';
import { BusinessAuditPanel } from '../../components/intelligence/BusinessAuditPanel';
import { ProfileAnalysisView } from '../../components/intelligence/ProfileAnalysisView';
import { StrategyCanvas, CanvasNode, CanvasEdge } from '../../components/intelligence/StrategyCanvas';
import { ReelBreakdownModal } from '../../components/intelligence/ReelBreakdownModal';
import { ExecutiveIntelligenceReportModal } from '../../components/intelligence/ExecutiveIntelligenceReportModal';
import { CRMConversationalHub } from '../../components/intelligence/CRMConversationalHub';
import { ExecutiveDecisionDashboard } from '../../components/intelligence/ExecutiveDecisionDashboard';
import { ReelAnalyzerService } from '../../services/intelligence/reelAnalyzerService';
import { ContentIntelligenceEngine } from '../../services/intelligence/ContentIntelligenceEngine';
import { IntelligenceStorageService } from '../../services/intelligence/IntelligenceStorageService';
import { CRMStorageService } from '../../services/intelligence/CRMStorageService';
import { MetaGraphService, MetaMediaItem, MetaMediaInsights, BusinessDiscoveryMedia } from '../../services/meta/MetaGraphService';
import { supabase } from '../../lib/supabase';
import { UnifiedConnectionsModal } from '../../components/intelligence/UnifiedConnectionsModal';
import { ConnectionStorageService } from '../../services/intelligence/ConnectionStorageService';
import { AIProviderService } from '../../services/intelligence/AIProviderService';
import { UnifiedConnectionsState } from '../../types/connections';
import { MetaAdCampaign } from '../../types/ads';
import { NewClientRegistrationModal } from '../../components/intelligence/NewClientRegistrationModal';
import { ProfileAndAiContextView } from '../../components/intelligence/profile/ProfileAndAiContextView';
import { ChatMessage, ContentFormatMode } from '../../components/intelligence/canvas/AiChatCardNode';
import { AppSidebar } from '../../components/intelligence/layout/AppSidebar';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';

// Convierte un media de Meta (propio) en un IntelligencePost. Métricas
// estrictamente reportadas por Meta: lo que no viene, no existe — no se
// estima a partir de otros campos ni se rellena con 0.
function metaMediaToIntelligencePost(
  reel: MetaMediaItem & { insights?: MetaMediaInsights },
  businessId: string
): IntelligencePost {
  const likes = fromApi(reel.like_count);
  const comments = fromApi(reel.comments_count);
  const views = fromApi(reel.insights?.plays ?? reel.insights?.impressions);
  const reach = fromApi(reel.insights?.reach);
  const shares = fromApi(reel.insights?.shares);
  const saves = fromApi(reel.insights?.saved);
  const avgWatchTime = fromApi(reel.insights?.ig_reels_avg_watch_time);
  const totalWatchTime = fromApi(reel.insights?.ig_reels_video_view_total_time);

  const cleanCaption = reel.caption || '';
  const cleanTitle = cleanCaption
    ? (cleanCaption.slice(0, 70) + (cleanCaption.length > 70 ? '...' : ''))
    : `Reel ${reel.id.slice(-6)}`;

  return {
    id: reel.id,
    business_id: businessId,
    title: cleanTitle,
    media_type: reel.media_type,
    video_url: reel.permalink,
    // Solo presente cuando media_type es un video real (REELS/VIDEO);
    // para imágenes reel.media_url no es un archivo de video descargable.
    meta_media_url: reel.media_type !== 'IMAGE' ? reel.media_url : undefined,
    thumbnail_url: reel.thumbnail_url || (reel.media_type === 'IMAGE' ? reel.media_url : undefined),
    // Meta no devuelve la duración en los campos consultados; 0 = desconocida.
    duration_seconds: 0,
    objective: 'sales',
    published_at: reel.timestamp,
    created_at: reel.timestamp,
    raw_transcript: cleanCaption || cleanTitle,
    metrics: {
      post_id: reel.id,
      views,
      reach,
      likes,
      comments,
      shares,
      saves,
      // Meta no expone seguidores ganados ni visitas al perfil a nivel de media individual.
      followers_gained: NO_DATA,
      profile_visits: NO_DATA,
      average_watch_time_seconds: avgWatchTime,
      total_watch_time_seconds: totalWatchTime,
      // Las tasas se derivan solo si existen numerador y denominador reales.
      like_rate: rate(likes, views),
      comment_rate: rate(comments, views),
      share_rate: rate(shares, views),
      save_rate: rate(saves, views),
      retention_percentage: NO_DATA,
      source: 'meta_graph_api',
      synced_at: new Date().toISOString(),
      media_type: reel.media_type
    }
    // Sin `analysis`: importar un Reel no equivale a haberlo analizado.
    // El análisis (gancho, estructura, segmentos, diagnóstico) se produce cuando
    // el usuario lo transcribe y lo procesa con IA desde el desglose del Reel.
  };
}

// Igual que metaMediaToIntelligencePost, pero para media obtenida vía
// business_discovery (cuenta compartida de la plataforma, cuando el negocio
// no conectó su propia cuenta de Meta). No incluye reach/guardados/plays:
// business_discovery nunca los expone, ni de la cuenta propia consultada así.
function businessDiscoveryMediaToIntelligencePost(m: BusinessDiscoveryMedia, businessId: string): IntelligencePost {
  const likes = fromApi(m.like_count);
  const comments = fromApi(m.comments_count);
  const cleanCaption = m.caption || '';
  const cleanTitle = cleanCaption
    ? (cleanCaption.slice(0, 70) + (cleanCaption.length > 70 ? '...' : ''))
    : `Reel ${m.id.slice(-6)}`;

  return {
    id: m.id,
    business_id: businessId,
    title: cleanTitle,
    media_type: m.media_type,
    video_url: m.permalink,
    meta_media_url: m.media_type !== 'IMAGE' ? m.media_url : undefined,
    thumbnail_url: m.thumbnail_url || (m.media_type === 'IMAGE' ? m.media_url : undefined),
    duration_seconds: 0,
    objective: 'sales',
    published_at: m.timestamp,
    created_at: m.timestamp,
    raw_transcript: cleanCaption || cleanTitle,
    metrics: {
      post_id: m.id,
      views: NO_DATA,
      reach: NO_DATA,
      likes,
      comments,
      shares: NO_DATA,
      saves: NO_DATA,
      followers_gained: NO_DATA,
      profile_visits: NO_DATA,
      average_watch_time_seconds: NO_DATA,
      total_watch_time_seconds: NO_DATA,
      like_rate: NO_DATA,
      comment_rate: NO_DATA,
      share_rate: NO_DATA,
      save_rate: NO_DATA,
      retention_percentage: NO_DATA,
      source: 'meta_graph_api',
      synced_at: new Date().toISOString(),
      media_type: m.media_type
    }
  };
}

// Cuadrícula de tarjetas Reel en el Lienzo: antes se apilaban en una sola
// columna vertical (misma x, y creciente), así que con muchas publicaciones
// sincronizadas los cables hacia la tarjeta de IA se volvían una maraña de
// líneas casi paralelas viajando una distancia enorme. En filas de 4 quedan
// agrupadas y los cables se ven ordenados en vez de "cortados".
const REEL_GRID_COLUMNS = 4;
const REEL_GRID_COL_SPACING = 300;
const REEL_GRID_ROW_SPACING = 280;
function reelGridPosition(index: number): { x: number; y: number } {
  const col = index % REEL_GRID_COLUMNS;
  const row = Math.floor(index / REEL_GRID_COLUMNS);
  return { x: 40 + col * REEL_GRID_COL_SPACING, y: 220 + row * REEL_GRID_ROW_SPACING };
}

export const IntelligenceCanvasPage: React.FC = () => {
  const [business, setBusiness] = useState(INITIAL_BUSINESS);
  const [brandDna, setBrandDna] = useState<BrandDNA>(INITIAL_BRAND_DNA);
  const [posts, setPosts] = useState<IntelligencePost[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving'>('synced');
  const [viewMode, setViewMode] = useState<'canvas' | 'messages' | 'profile' | 'dashboard' | 'analysis'>('profile');
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // "Perfil & Contexto IA" es la pantalla obligatoria de entrada solo hasta
  // que se guarda por primera vez (con el @handle de Instagram ya
  // verificado) — a partir de ahí deja de ser una pestaña permanente y
  // Lienzo pasa a ser el punto de entrada normal.
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const hasAutoRoutedToCanvasRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const ctx = await IntelligenceStorageService.loadProfileContext(business.id);
      if (!isMounted) return;
      const completed = !!ctx.profile.instagram_handle?.trim();
      setProfileCompleted(completed);
      if (completed && !hasAutoRoutedToCanvasRef.current) {
        hasAutoRoutedToCanvasRef.current = true;
        setViewMode((vm) => (vm === 'profile' ? 'canvas' : vm));
      } else if (!completed) {
        // Cambiaste a un negocio/cliente que todavía no completó su perfil:
        // vuelve a ser la pantalla obligatoria de entrada para ese negocio.
        hasAutoRoutedToCanvasRef.current = false;
        setViewMode('profile');
      }
    })();
    return () => { isMounted = false; };
  }, [business.id]);

  // Rol del usuario logueado: un cliente normal solo ve/gestiona su propio negocio
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (isMounted) setIsSuperAdmin(profile?.role === 'super_admin');
    })();
    return () => { isMounted = false; };
  }, []);

  // Estado de Conexiones Unificadas (Shop de Plumas, Meta/WhatsApp, OpenAI, Claude)
  const [connections, setConnections] = useState<UnifiedConnectionsState>(() => {
    return ConnectionStorageService.loadConnections(INITIAL_BUSINESS.id);
  });
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);

  // Contador de conexiones activas
  const activeConnectionsCount = useMemo(() => {
    let count = 0;
    if (connections.openai.status === 'connected') count++;
    if (connections.claude.status === 'connected') count++;
    if (connections.whatsapp.status === 'connected') count++;
    if (connections.shopDePlumas.status === 'connected') count++;
    return count;
  }, [connections]);

  // Cuenta activa (detecta credenciales reales de Meta si existen). El valor
  // real se corrige apenas hydrate() carga el negocio activo — esto es solo
  // el placeholder del primer render.
  const [accountHandle, setAccountHandle] = useState<string>(() => {
    const creds = MetaGraphService.loadCredentials(IntelligenceStorageService.getActiveBusinessId() || undefined);
    if (creds?.accountUsername) {
      return `@${creds.accountUsername.replace('@', '')}`;
    }
    return INITIAL_BUSINESS.instagram_handle || '@tu_negocio';
  });

  // Cálculo dinámico del informe determinístico de inteligencia
  const executiveReport = useMemo(() => {
    return ContentIntelligenceEngine.generateExecutiveReport(posts, brandDna, accountHandle);
  }, [posts, brandDna, accountHandle]);

  const [auditReport, setAuditReport] = useState<BusinessAuditReport>(() => {
    return ReelAnalyzerService.calculateAuditReport([], INITIAL_BRAND_DNA, accountHandle);
  });

  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState(false);

  // Inicialización limpia 0-base (sin nodos mockeados ni guiones inventados)
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);

  // "Nueva Idea": entrada simple y rápida de generación de contenido, separada
  // de la tarjeta de Estrategia del lienzo. Usa SIEMPRE todos los Reels ya
  // sincronizados del negocio como contexto automático (sin conectar a mano).
  const [isQuickIdeaOpen, setIsQuickIdeaOpen] = useState(false);
  const [quickIdeaMessages, setQuickIdeaMessages] = useState<ChatMessage[]>([]);
  const [quickIdeaMode, setQuickIdeaMode] = useState<ContentFormatMode>('reel_hablado');
  const [isQuickIdeaGenerating, setIsQuickIdeaGenerating] = useState(false);

  const [isBrandDnaOpen, setIsBrandDnaOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [inspectedPost, setInspectedPost] = useState<IntelligencePost | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // 1. Hidratación inicial desde Supabase SaaS / LocalStorage
  useEffect(() => {
    let isMounted = true;
    async function hydrate() {
      try {
        const activeId = IntelligenceStorageService.getActiveBusinessId();
        const businessesList = await IntelligenceStorageService.listBusinesses();
        const activeBiz = businessesList.find(b => b.id === activeId) || businessesList[0];

        if (!isMounted || !activeBiz) return;
        setBusiness(activeBiz);
        if (activeBiz.instagram_handle) {
          setAccountHandle(activeBiz.instagram_handle);
        }

        // Cargar Brand DNA guardado. Sin `savedDna` (negocio nuevo sin Brand
        // DNA guardado todavía) NO hay que dejar el estado en el valor
        // inicial de la demo (EventPix Display Hub): se normaliza un DNA
        // genérico y vacío propio de este negocio.
        const savedDna = await IntelligenceStorageService.loadBrandDna(activeBiz.id);
        if (isMounted) {
          setBrandDna(savedDna || IntelligenceStorageService.normalizeBrandDna(null, activeBiz.id));
        }

        // Cargar Posts guardados
        const savedPosts = await IntelligenceStorageService.loadPosts(activeBiz.id);
        if (savedPosts && savedPosts.length > 0 && isMounted) {
          setPosts(savedPosts);
          const updatedAudit = ReelAnalyzerService.calculateAuditReport(
            savedPosts,
            savedDna || brandDna,
            activeBiz.instagram_handle
          );
          setAuditReport(updatedAudit);
        }

        // Cargar Canvas guardado
        const savedCanvas = await IntelligenceStorageService.loadCanvasState(activeBiz.id);
        if (savedCanvas && savedCanvas.nodes.length > 0 && isMounted) {
          const cleanedNodes = savedCanvas.nodes.filter(
            (n) => !(n.post && n.post.title === 'Reel de Instagram' && (n.post.metrics?.likes === 0 || !n.post.metrics?.likes))
          );
          setNodes(cleanedNodes);
          if (savedCanvas.edges && savedCanvas.edges.length > 0) {
            setEdges(savedCanvas.edges);
          }
        }

        // Cargar Conexiones Unificadas del negocio
        const savedConnections = ConnectionStorageService.loadConnections(activeBiz.id);
        if (savedConnections && isMounted) {
          setConnections(savedConnections);
        }
      } catch (err) {
        console.warn('Error en hidratación de datos:', err);
      }
    }

    hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cambio dinámico de Negocio / Cliente activo (Multi-Tenant)
  const handleSelectBusiness = async (newBiz: IntelligenceBusiness) => {
    setBusiness(newBiz);
    if (newBiz.instagram_handle) {
      setAccountHandle(newBiz.instagram_handle);
    }
    IntelligenceStorageService.setActiveBusinessId(newBiz.id);

    // 1. Cargar Brand DNA del nuevo negocio. Sin dato guardado, normalizar uno
    // genérico y vacío en vez de dejar el estado con el Brand DNA del negocio
    // anterior (o el de la demo) — cada negocio empieza limpio.
    const savedDna = await IntelligenceStorageService.loadBrandDna(newBiz.id);
    setBrandDna(savedDna || IntelligenceStorageService.normalizeBrandDna(null, newBiz.id));

    // 2. Cargar conexiones del nuevo negocio
    const conns = ConnectionStorageService.loadConnections(newBiz.id);
    setConnections(conns);

    // 3. Cargar posts/reels guardados para este negocio
    const savedPosts = await IntelligenceStorageService.loadPosts(newBiz.id);
    if (savedPosts && savedPosts.length > 0) {
      setPosts(savedPosts);
      const updatedAudit = ReelAnalyzerService.calculateAuditReport(savedPosts, savedDna || brandDna, newBiz.instagram_handle);
      setAuditReport(updatedAudit);
    } else {
      setPosts([]);
      setAuditReport(ReelAnalyzerService.calculateAuditReport([], savedDna || brandDna, newBiz.instagram_handle));
    }

    // 4. Cargar canvas del nuevo negocio
    const savedCanvas = await IntelligenceStorageService.loadCanvasState(newBiz.id);
    if (savedCanvas && savedCanvas.nodes.length > 0) {
      setNodes(savedCanvas.nodes);
      setEdges(savedCanvas.edges || []);
    } else {
      setNodes([]);
      setEdges([]);
    }

    toast.success(`Cambiado a: ${newBiz.name} (${newBiz.instagram_handle})`);
  };

  // 2. Guardado de Brand DNA con notificación de nube
  const handleUpdateBrandDna = useCallback((newDna: BrandDNA) => {
    setBrandDna(newDna);
    setSyncStatus('saving');
    IntelligenceStorageService.saveBrandDna(business.id, newDna).finally(() => {
      setSyncStatus('synced');
    });
    const updatedAudit = ReelAnalyzerService.calculateAuditReport(posts, newDna, accountHandle);
    setAuditReport(updatedAudit);
  }, [business.id, posts, accountHandle]);

  // 3. Auto-guardado de Canvas State (con debounce para no saturar la red)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSyncStatus('saving');
      IntelligenceStorageService.saveCanvasState(business.id, nodes, edges).finally(() => {
        setSyncStatus('synced');
      });
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, business.id]);

  const handleAddNodeFromUrl = async (url: string) => {
    const toastId = toast.loading('Extrayendo contenido real del Reel desde Instagram...');
    let effectiveUrl = url.trim();
    if (effectiveUrl.includes('shop_plumas') && !effectiveUrl.includes('/p/') && !effectiveUrl.includes('/reel/')) {
      effectiveUrl = 'https://www.instagram.com/p/DcveKFpx1eP/';
      toast.info('Detectado @shop_plumas: analizando su Reel real de Display en el local...', { id: toastId });
    }

    let scrapedData: {
      caption?: string;
      username?: string;
      imageUrl?: string;
      shortcode?: string;
      likes?: number;
      commentsCount?: number;
      comments?: Array<{ author: string; text: string }>;
      audioTrack?: string;
      followers?: string;
      videoUrl?: string;
    } | null = null;

    try {
      const res = await fetch(`/api/instagram-scrape?url=${encodeURIComponent(effectiveUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && !data.isProfile) {
          scrapedData = data;
        } else if (data.isProfile) {
          toast.error(`Pegaste el perfil de @${data.username}. Para analizar en el Canvas ingresá el link de un Reel (ej: https://www.instagram.com/p/...)`, { id: toastId });
          return;
        }
      }
    } catch (e) {
      console.warn('Error al consultar endpoint de scrape:', e);
    }

    if (!scrapedData) {
      toast.error('No se pudo extraer información de este Reel. Verificá que el enlace sea público.', { id: toastId });
      return;
    }

    try {
      const currentConns = ConnectionStorageService.loadConnections(business.id);

      // Transcripción automática opcional con Whisper si OpenAI está configurado
      let transcriptData: { transcript?: string; segments?: any[]; hasSpeech?: boolean; message?: string } | null = null;
      if (currentConns.openai.isActive && currentConns.openai.apiKey) {
        try {
          toast.loading('🎙️ Analizando pista de audio con Whisper AI...', { id: toastId });
          const transcribeRes = await fetch('/api/instagram-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, apiKey: currentConns.openai.apiKey })
          });
          if (transcribeRes.ok) {
            transcriptData = await transcribeRes.json();
          }
        } catch (tErr) {
          console.warn('Transcripción opcional omitida:', tErr);
        }
      }

      toast.loading('⚡ Analizando con Framework Scripty y ChatGPT...', { id: toastId });

      const newPost = await AIProviderService.analyzeScrapedReel({
        caption: scrapedData?.caption || 'Reel de Instagram',
        username: scrapedData?.username || accountHandle.replace('@', ''),
        url,
        imageUrl: scrapedData?.imageUrl,
        businessId: business.id,
        connections: currentConns,
        brandDna,
        realMetrics: {
          likes: scrapedData?.likes,
          commentsCount: scrapedData?.commentsCount,
          audioTrack: scrapedData?.audioTrack,
          followers: scrapedData?.followers
        },
        scrapedTranscript: transcriptData?.transcript,
        hasSpeech: transcriptData?.hasSpeech
      });

      const newId = `node_${Date.now()}`;
      const newCanvasNode: CanvasNode = {
        id: newId,
        ...reelGridPosition(nodes.filter(n => n.type === 'reel').length),
        type: 'reel',
        post: newPost
      };

      const updatedPosts = [...posts, newPost];
      setNodes(prev => [...prev, newCanvasNode]);
      setPosts(updatedPosts);
      setSyncStatus('saving');
      IntelligenceStorageService.savePosts(business.id, updatedPosts).finally(() => {
        setSyncStatus('synced');
      });

      const updatedAudit = ReelAnalyzerService.calculateAuditReport(updatedPosts, brandDna, accountHandle);
      setAuditReport(updatedAudit);

      const metricsSummary = scrapedData?.likes !== undefined
        ? ` (${scrapedData.likes} likes, ${scrapedData.commentsCount || 0} comentarios)`
        : '';
      toast.success(`🎬 Reel importado con éxito${metricsSummary}! Estructuras Scripty cargadas.`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al procesar el Reel.', { id: toastId });
    }
  };

  const handleAddReelFromMeta = (
    reel: MetaMediaItem & { insights?: MetaMediaInsights },
    position?: { x: number; y: number }
  ) => {
    if (nodes.some(n => n.post?.id === reel.id)) {
      toast.info('Este Reel ya está en tu Canvas.');
      return;
    }

    const newPost = metaMediaToIntelligencePost(reel, business.id);
    const newCanvasNode: CanvasNode = {
      id: `node_reel_${reel.id}`,
      ...(position ?? reelGridPosition(nodes.filter(n => n.type === 'reel').length)),
      type: 'reel',
      post: newPost
    };

    const updatedPosts = [...posts, newPost];
    setNodes(prev => [...prev, newCanvasNode]);
    setPosts(updatedPosts);
    setSyncStatus('saving');
    IntelligenceStorageService.savePosts(business.id, updatedPosts).finally(() => {
      setSyncStatus('synced');
    });
    const updatedAudit = ReelAnalyzerService.calculateAuditReport(updatedPosts, brandDna, accountHandle);
    setAuditReport(updatedAudit);
    toast.success(`🎬 Reel "${newPost.title}" agregado al Canvas!`);
  };

  // Traer de una todos los Reels reales ya cargados (con sus métricas de
  // Meta) en vez de arrastrarlos uno por uno — Informe de Inteligencia y
  // Métricas dependen de `posts`, así que sin esto quedaban vacíos aunque
  // la cuenta tuviera cientos de publicaciones reales.
  // Núcleo compartido: agrega posts nuevos al canvas + `posts`, evitando
  // duplicados. Lo usan tanto el camino de Meta propia (con insights reales
  // de reach/plays/guardados) como el de la cuenta compartida de la
  // plataforma (solo likes/comentarios públicos, para negocios que no
  // conectaron su propia cuenta de Meta).
  const applyNewPostsToCanvas = (candidatePosts: IntelligencePost[]) => {
    const existingIds = new Set(nodes.filter(n => n.post).map(n => n.post!.id));
    const newPosts = candidatePosts.filter(p => !existingIds.has(p.id));
    if (newPosts.length === 0) {
      toast.info('Ya tenés todos estos Reels sincronizados.');
      return;
    }

    const baseIndex = nodes.filter(n => n.type === 'reel').length;
    const newCanvasNodes: CanvasNode[] = newPosts.map((post, i) => ({
      id: `node_reel_${post.id}`,
      ...reelGridPosition(baseIndex + i),
      type: 'reel',
      post
    }));

    const updatedPosts = [...posts, ...newPosts];
    setNodes(prev => [...prev, ...newCanvasNodes]);
    setPosts(updatedPosts);
    setSyncStatus('saving');
    IntelligenceStorageService.savePosts(business.id, updatedPosts).finally(() => {
      setSyncStatus('synced');
    });
    const updatedAudit = ReelAnalyzerService.calculateAuditReport(updatedPosts, brandDna, accountHandle);
    setAuditReport(updatedAudit);
    toast.success(`⚡ ${newPosts.length} Reels reales sincronizados al Informe y Métricas.`);
  };

  const handleSyncAllReelsFromMeta = (reelsList: Array<MetaMediaItem & { insights?: MetaMediaInsights }>) => {
    applyNewPostsToCanvas(reelsList.map(r => metaMediaToIntelligencePost(r, business.id)));
  };

  // Versión sin lista previa: la usan los estados vacíos del Informe de
  // Inteligencia y Métricas, que no tienen los Reels ya cargados como sí
  // los tiene el panel de Auditoría → Instagram. Si el negocio conectó su
  // propia cuenta de Meta usa esos datos (con reach/plays/guardados reales);
  // si no, cae a la cuenta compartida de la plataforma vía business_discovery
  // (solo likes/comentarios públicos, igual que en Análisis de Comercio).
  const handleSyncAllReelsDirect = async () => {
    const toastId = toast.loading('Sincronizando tus Reels reales...');
    try {
      if (MetaGraphService.isConfigured(business.id)) {
        const reelsList = await MetaGraphService.getReelsWithInsights(25, business.id);
        if (reelsList.length === 0) {
          toast.error('No encontramos Reels en tu cuenta todavía.', { id: toastId });
          return;
        }
        toast.dismiss(toastId);
        applyNewPostsToCanvas(reelsList.map(r => metaMediaToIntelligencePost(r, business.id)));
        return;
      }

      const ctx = await IntelligenceStorageService.loadProfileContext(business.id);
      const ownHandle = ctx.profile.instagram_handle?.trim();
      if (!ownHandle) {
        toast.error('Completá tu @usuario de Instagram en Perfil & Contexto IA primero.', { id: toastId });
        return;
      }
      const discovery = await MetaGraphService.getBusinessDiscovery(ownHandle, business.id);
      if (!discovery.success) {
        toast.error(discovery.error, { id: toastId });
        return;
      }
      if (discovery.data.media.length === 0) {
        toast.error('No encontramos publicaciones públicas en tu cuenta todavía.', { id: toastId });
        return;
      }
      toast.dismiss(toastId);
      applyNewPostsToCanvas(discovery.data.media.map(m => businessDiscoveryMediaToIntelligencePost(m, business.id)));
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo sincronizar tus Reels.', { id: toastId });
    }
  };

  const handleApplyNextPostToCanvas = () => {
    const nextPost = executiveReport.next_recommended_post;
    const newSynthNode: CanvasNode = {
      id: `node_synth_${Date.now()}`,
      x: 360,
      y: 80,
      type: 'synthesis',
      synthesisResult: {
        title: 'Guión Recomendado por Inteligencia',
        hook: nextPost.hook,
        structure_breakdown: [
          '0-3s: Gancho de Alta Retención Comprobada',
          '3-12s: Problema de Visibilidad del Comercio',
          '12-28s: Demostración Visual de Display Digital en Vivo',
          '28-40s: Llamado a la Acción hacia WhatsApp'
        ],
        cta: nextPost.cta,
        full_script: `[HOOK (0-3s)]\n"${nextPost.hook}"\n\n[ESTRUCTURA]\n${nextPost.structure}\n\n[LLAMADO A LA ACCIÓN]\n"${nextPost.cta}"`,
        teleprompter_clean_script: `${nextPost.hook}\n\n${nextPost.structure}\n\n${nextPost.cta}`,
        alternative_hooks: [],
        why_it_works: nextPost.justification,
        expected_impact: 'Diseñado a partir de los patrones con mayor tasa de interés e intención comercial de tu cuenta.'
      }
    };

    setNodes(prev => [newSynthNode, ...prev.filter(n => n.type !== 'synthesis')]);
    setIsExecutiveReportOpen(false);
    toast.success('🎬 ¡Guión recomendado por el motor de IA cargado en el Canvas!');
  };

  const handleAddIntegrationNode = (type: NodeType, name: string) => {
    const newId = `node_${type}_${Date.now()}`;
    const newNode: CanvasNode = {
      id: newId,
      x: 780,
      y: 40 + nodes.filter(n => n.type !== 'reel' && n.type !== 'synthesis').length * 160,
      type,
      integrationName: name
    };
    setNodes(prev => [...prev, newNode]);
    toast.success(`Nodo conector "${name}" añadido al canvas!`);
  };

  const handleSynthesize = async (sourceNodeIds: string[]) => {
    if (sourceNodeIds.length === 0) {
      toast.error('Seleccioná al menos un Reel en el canvas para sintetizar');
      return;
    }

    setIsSynthesizing(true);
    toast.info('Sintetizando patrones y ensamblando el Super Guion de Ventas...');

    try {
      const selectedPosts = nodes
        .filter(n => sourceNodeIds.includes(n.id) && n.post)
        .map(n => n.post as IntelligencePost);

      const currentConns = ConnectionStorageService.loadConnections(business.id);
      const catalogProducts = currentConns.shopDePlumas.status === 'connected'
        ? currentConns.shopDePlumas.syncedProducts
        : [];

      const result = await AIProviderService.generateSynthesis(
        selectedPosts,
        brandDna,
        currentConns,
        catalogProducts
      );

      const synthNode = nodes.find(n => n.type === 'synthesis');
      if (synthNode) {
        setNodes(prev => prev.map(n => n.type === 'synthesis' ? { ...n, synthesisResult: result } : n));
      } else {
        const newSynthNode: CanvasNode = {
          id: `node_synth_${Date.now()}`,
          x: 360,
          y: 80,
          type: 'synthesis',
          synthesisResult: result
        };
        setNodes(prev => [...prev, newSynthNode]);
      }

      const aiLabel = currentConns.preferredAIProvider === 'openai' && currentConns.openai.status === 'connected'
        ? 'OpenAI GPT-4o'
        : currentConns.preferredAIProvider === 'claude' && currentConns.claude.status === 'connected'
        ? 'Anthropic Claude'
        : 'Motor de Inteligencia';

      toast.success(`Super Guion sintetizado con éxito (${aiLabel})!`);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar la síntesis');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSelectAIProvider = (provider: 'claude' | 'gemini' | 'openai' | 'auto') => {
    const updated: UnifiedConnectionsState = { ...connections, preferredAIProvider: provider };
    setConnections(updated);
    ConnectionStorageService.saveConnections(business.id, updated);
    const label = provider === 'gemini' ? 'Google Gemini' : provider === 'claude' ? 'Claude Sonnet' : provider === 'openai' ? 'ChatGPT GPT-4o' : '⚡ Multi-IA (Orquestación Automática)';
    toast.success(`Motor de IA: ${label}`);
  };

  const handleToggleAIProvider = () => {
    const order: Array<'auto' | 'claude' | 'gemini' | 'openai'> = ['auto', 'claude', 'gemini', 'openai'];
    const currentIdx = order.indexOf((connections.preferredAIProvider as any) || 'auto');
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % order.length;
    handleSelectAIProvider(order[nextIdx]);
  };

  const handleAddAdToCanvas = (campaign: MetaAdCampaign) => {
    const newId = `node_ad_${campaign.id}_${Date.now()}`;
    const newNode: CanvasNode = {
      id: newId,
      x: 780,
      y: 40 + nodes.filter(n => n.type !== 'reel' && n.type !== 'synthesis').length * 160,
      type: 'meta_business',
      integrationName: `Meta Ad: ${campaign.name} ($${campaign.cpa.toFixed(2)} CPA)`,
      actionStatus: campaign.status_verdict === 'ganadora' ? 'Escalando presupuesto' : 'Auditoría activa'
    };
    setNodes(prev => [...prev, newNode]);
    toast.success(`Campaña de Ads "${campaign.name}" agregada al Canvas!`);
  };

  const handlePromoteReelToAd = (reelTitle: string) => {
    const reelNode = nodes.find(n => n.type === 'reel' && n.post?.title?.includes(reelTitle.slice(0, 15))) || nodes.find(n => n.type === 'reel');
    const adNodeId = `node_ad_cross_${Date.now()}`;
    const adNode: CanvasNode = {
      id: adNodeId,
      x: 780,
      y: 200,
      type: 'meta_business',
      integrationName: `Meta Ads: Anuncio de Prospección (Reel Ganador)`,
      actionStatus: 'CPA Proyectado: -35%'
    };

    setNodes(prev => [...prev, adNode]);
    if (reelNode) {
      setEdges(prev => [...prev, { id: `edge_${reelNode.id}_${adNodeId}`, source: reelNode.id, target: adNodeId }]);
    }
    toast.success(`⚡ Creativo orgánico vinculado directamente a campaña publicitaria en el Canvas!`);
  };

  const handleToggleFullScreenCanvas = () => {
    if (isBrandDnaOpen || isAuditOpen) {
      setIsBrandDnaOpen(false);
      setIsAuditOpen(false);
      toast.info('Lienzo al 100%: Paneles laterales colapsados.');
    } else {
      setIsBrandDnaOpen(false);
      setIsAuditOpen(true);
      toast.info('Panel de auditoría restaurado.');
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    toast.info('Nodo eliminado del canvas.');
  };

  const handleToggleConnectEdge = (sourceId: string, targetId: string) => {
    setEdges(prev => {
      const exists = prev.some(e => e.source === sourceId && e.target === targetId);
      if (exists) {
        toast.info('Fuente desconectada.');
        return prev.filter(e => !(e.source === sourceId && e.target === targetId));
      } else {
        toast.success('¡Reel conectado al Chat con IA!');
        return [...prev, { id: `edge_${sourceId}_${targetId}_${Date.now()}`, source: sourceId, target: targetId }];
      }
    });
  };

  const handleDisconnectAllFromTarget = (targetId: string) => {
    setEdges(prev => prev.filter(e => e.target !== targetId));
    toast.info('Todas las fuentes desconectadas del Chat.');
  };

  const handleUpdateNodeChatMode = (nodeId: string, mode: ContentFormatMode) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, activeMode: mode } : n));
  };

  const handleCreateAiChatNode = (position?: { x: number; y: number }, sourceReelId?: string) => {
    const existing = nodes.find(n => n.type === 'ai_chat');
    if (existing) {
      if (sourceReelId) {
        handleToggleConnectEdge(sourceReelId, existing.id);
      } else {
        toast.info('Ya tenés una tarjeta de Chat con IA activa en el lienzo.');
      }
      return;
    }

    const newId = `node-ai-chat-${Date.now()}`;
    const newNode: CanvasNode = {
      id: newId,
      x: position?.x ?? 540,
      y: position?.y ?? 80,
      type: 'ai_chat',
      activeMode: 'reel_hablado',
      chatMessages: [
        {
          id: `msg-welcome-${Date.now()}`,
          sender: 'ai',
          text: '¡Hola! Soy tu asistente de estrategia y redacción de guiones. Conectá cualquier Reel de tu lienzo con el cable magenta, elegí un formato (Reel hablado, B-roll, Carrusel, etc.) y decime qué querés crear o transformar.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    setNodes(prev => [...prev, newNode]);
    if (sourceReelId) {
      setEdges(prev => [...prev, { id: `edge_${sourceReelId}_${newId}_${Date.now()}`, source: sourceReelId, target: newId }]);
    }
    toast.success('¡Tarjeta de Chat con IA agregada al lienzo!');
  };

  const handleSendChatMessage = async (nodeId: string, text: string, mode: ContentFormatMode, referenceReelText?: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Agregar mensaje del usuario inmediatamente
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const msgs = n.chatMessages || [];
        return { ...n, chatMessages: [...msgs, userMsg], activeMode: mode };
      }
      return n;
    }));

    try {
      // 1. Obtener fuentes conectadas a este chat
      const connectedEdges = edges.filter(e => e.target === nodeId);
      const sourcePosts = connectedEdges
        .map(e => nodes.find(n => n.id === e.source)?.post)
        .filter(Boolean) as IntelligencePost[];

      // 2. Cargar contexto estratégico permanente del perfil
      // `loadProfileContext` es async: sin await la IA recibía una Promise pendiente
      // y todo el contexto de negocio (nicho, tono, CTAs) caía a valores por defecto.
      const profileContext = await IntelligenceStorageService.loadProfileContext(business.id);

      // 3. Conexiones unificadas
      const currentConns = ConnectionStorageService.loadConnections(business.id);

      // Obtener historial previo de conversación del nodo
      const chatNode = nodes.find(n => n.id === nodeId);
      const previousMessages = chatNode?.chatMessages || [];

      // 4. Llamar al orquestador adaptScriptWithChat
      const result = await AIProviderService.adaptScriptWithChat({
        businessId: business.id,
        userInstruction: text,
        mode,
        sourcePosts,
        profileContext: profileContext || undefined,
        connections: currentConns,
        chatHistory: previousMessages,
        referenceReelText
      });

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: result.replyText,
        scriptData: result.scriptData,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          const msgs = n.chatMessages || [];
          return { ...n, chatMessages: [...msgs, aiMsg] };
        }
        return n;
      }));
    } catch (err: any) {
      console.error('Error generando guion en chat IA:', err);
      toast.error('Error al generar respuesta de IA');
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        sender: 'ai',
        text: 'Ocurrió un error al procesar tu solicitud con el motor de IA. Por favor, intentá nuevamente.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          const msgs = n.chatMessages || [];
          return { ...n, chatMessages: [...msgs, errorMsg] };
        }
        return n;
      }));
    }
  };

  // "Nueva Idea": mismo orquestador que el Chat con IA del lienzo
  // (adaptScriptWithChat), pero usando TODOS los Reels ya sincronizados del
  // negocio (`posts`) como fuente automática en vez de depender de que el
  // usuario los conecte a mano con el cable del lienzo.
  const handleSendQuickIdea = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `qi-${Date.now()}-user`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setQuickIdeaMessages(prev => [...prev, userMsg]);
    setIsQuickIdeaGenerating(true);

    try {
      const profileContext = await IntelligenceStorageService.loadProfileContext(business.id);
      const currentConns = ConnectionStorageService.loadConnections(business.id);

      const result = await AIProviderService.adaptScriptWithChat({
        businessId: business.id,
        userInstruction: text,
        mode: quickIdeaMode,
        sourcePosts: posts,
        profileContext: profileContext || undefined,
        connections: currentConns,
        chatHistory: quickIdeaMessages
      });

      const aiMsg: ChatMessage = {
        id: `qi-${Date.now()}-ai`,
        sender: 'ai',
        text: result.replyText,
        scriptData: result.scriptData,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setQuickIdeaMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Error generando Nueva Idea:', err);
      toast.error('Error al generar respuesta de IA');
      const errorMsg: ChatMessage = {
        id: `qi-${Date.now()}-err`,
        sender: 'ai',
        text: 'Ocurrió un error al procesar tu solicitud con el motor de IA. Por favor, intentá nuevamente.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setQuickIdeaMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsQuickIdeaGenerating(false);
    }
  };

  const handleResetQuickIdea = () => setQuickIdeaMessages([]);

  // Acciones provenientes del Dashboard Ejecutivo
  const handleApplyRecommendationToCanvas = () => {
    setViewMode('canvas');
    const reelNodeIds = nodes.filter(n => n.type === 'reel').map(n => n.id);
    if (reelNodeIds.length > 0) {
      handleSynthesize(reelNodeIds);
    }
    toast.success('🎯 Recomendación de IA aplicada en el Lienzo Estratégico!');
  };

  const handleAddVariantToCanvas = (post: IntelligencePost) => {
    const variantId = `node_var_${Date.now()}`;
    const variantNode: CanvasNode = {
      id: variantId,
      x: 40,
      y: 480,
      type: 'reel',
      post: {
        ...post,
        id: `var_${post.id}`,
        title: `Variante: ${post.title} (CTA: "APP")`
      }
    };
    setNodes(prev => [...prev, variantNode]);
    setEdges(prev => [...prev, { id: `edge_${variantId}_synth`, source: variantId, target: 'node_synth' }]);
    setViewMode('canvas');
    toast.success('✨ Variante creada y vinculada a la Síntesis IA en el Lienzo!');
  };

  const handleResetToZero = useCallback(async () => {
    if (window.confirm('¿Seguro que querés reiniciar todo a 0? Se limpiarán el lienzo, publicaciones y reportes de este negocio para comenzar únicamente con tus datos reales. Las conversaciones reales del CRM no se tocan.')) {
      const ownHandle = business.instagram_handle || accountHandle;
      await IntelligenceStorageService.clearAllData(business.id);
      CRMStorageService.clearAllData(business.id);
      MetaGraphService.clearCredentials(business.id);
      setAccountHandle(ownHandle);
      setPosts([]);
      setNodes([]);
      setEdges([]);
      const emptyAudit = ReelAnalyzerService.calculateAuditReport([], brandDna, ownHandle);
      setAuditReport(emptyAudit);
      toast.success(`✨ Sistema reiniciado a 0 con ${ownHandle}. Listo para cargar tus datos reales.`);
    }
  }, [brandDna, business.instagram_handle, accountHandle]);

  return (
    <div className="h-screen w-screen bg-[#080C14] text-slate-100 flex overflow-hidden font-sans select-none">
      {/* BARRA LATERAL DE NAVEGACIÓN (Desktop) — reemplaza al header horizontal
          para liberar todo el ancho de pantalla para el Lienzo. */}
      <div className="hidden md:flex h-full">
        <AppSidebar
          business={business}
          accountHandle={accountHandle}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          profileCompleted={profileCompleted}
          isSuperAdmin={isSuperAdmin}
          onSelectBusiness={handleSelectBusiness}
          onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
          activeConnectionsCount={activeConnectionsCount}
          onOpenConnections={() => setIsConnectionsOpen(true)}
          onOpenExecutiveReport={() => setIsExecutiveReportOpen(true)}
          connections={connections}
          onToggleAIProvider={handleToggleAIProvider}
          syncStatus={syncStatus}
          healthScore={executiveReport.global_health_score}
          onResetToZero={handleResetToZero}
        />
      </div>

      {/* BARRA LATERAL EN MÓVIL (overlay a pantalla completa) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative h-full">
            <AppSidebar
              business={business}
              accountHandle={accountHandle}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              profileCompleted={profileCompleted}
              isSuperAdmin={isSuperAdmin}
              onSelectBusiness={handleSelectBusiness}
              onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
              activeConnectionsCount={activeConnectionsCount}
              onOpenConnections={() => setIsConnectionsOpen(true)}
              onOpenExecutiveReport={() => setIsExecutiveReportOpen(true)}
              connections={connections}
              onToggleAIProvider={handleToggleAIProvider}
              syncStatus={syncStatus}
              healthScore={executiveReport.global_health_score}
              onResetToZero={handleResetToZero}
              onNavigate={() => setIsMobileSidebarOpen(false)}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* BARRA SUPERIOR COMPACTA (solo móvil): la navegación principal ahora
            vive en la barra lateral, que en pantallas chicas queda oculta. */}
        <div className="md:hidden flex items-center gap-2.5 px-3 py-2 border-b border-slate-800/80 bg-slate-950/90 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-200 truncate">{business.name}</span>
          <span className="text-[10px] font-mono text-violet-400 ml-auto shrink-0">{accountHandle}</span>
        </div>

      {/* VISTA DINÁMICA: PERFIL & CONTEXTO IA, DASHBOARD EJECUTIVO O LIENZO DE ESTRATEGIA */}
      {viewMode === 'profile' ? (
        <ProfileAndAiContextView
          businessId={business.id}
          onProfileUpdated={(updated) => {
            if (updated.profile.instagram_handle) {
              const cleanHandle = `@${updated.profile.instagram_handle}`;
              setAccountHandle(cleanHandle);
              setBusiness((prev) => ({ ...prev, instagram_handle: cleanHandle }));
            }
            if (updated.profile.business_name?.trim() || updated.profile.niche?.trim()) {
              setBusiness((prev) => ({
                ...prev,
                name: updated.profile.business_name?.trim() || prev.name,
                niche: updated.profile.niche?.trim() || prev.niche,
              }));
            }
            const wasFirstCompletion = !profileCompleted && !!updated.profile.instagram_handle?.trim();
            setProfileCompleted(!!updated.profile.instagram_handle?.trim());
            if (wasFirstCompletion) {
              hasAutoRoutedToCanvasRef.current = true;
              setViewMode('canvas');
            }
          }}
        />
      ) : viewMode === 'messages' ? (
        <CRMConversationalHub
          isOpen={true}
          onClose={() => setViewMode('canvas')}
          brandDna={brandDna}
          businessId={business.id}
          businessName={business.name}
          onAddAdToCanvas={handleAddAdToCanvas}
          onPromoteReelToAd={handlePromoteReelToAd}
          variant="inline"
        />
      ) : viewMode === 'analysis' ? (
        <ProfileAnalysisView
          businessId={business.id}
          onClose={() => setViewMode('canvas')}
        />
      ) : viewMode === 'dashboard' ? (
        <ExecutiveDecisionDashboard
          businessId={business.id}
          posts={posts}
          brandDna={brandDna}
          accountHandle={accountHandle}
          onSwitchToCanvas={() => setViewMode('canvas')}
          onOpenCrm={() => setViewMode('messages')}
          onOpenExecutiveReport={() => setIsExecutiveReportOpen(true)}
          onInspectPost={setInspectedPost}
          onApplyRecommendationToCanvas={handleApplyRecommendationToCanvas}
          onAddVariantToCanvas={handleAddVariantToCanvas}
          onOpenConnections={() => setIsConnectionsOpen(true)}
          onSyncAllReels={handleSyncAllReelsDirect}
          onOpenTvPreview={() => {
            setViewMode('canvas');
            toast.info('Mostrando el lienzo: hace clic en el nodo Display TV para gestionar pantallas.');
          }}
        />
      ) : (
        <div className="flex-1 flex relative overflow-hidden">
          <BrandDnaPanel
            business={business}
            brandDna={brandDna}
            onUpdateDna={handleUpdateBrandDna}
            isOpen={isBrandDnaOpen}
            onToggle={() => setIsBrandDnaOpen(!isBrandDnaOpen)}
            onEditFullProfile={() => setViewMode('profile')}
          />

          <StrategyCanvas
            nodes={nodes}
            edges={edges}
            onAddNodeFromUrl={handleAddNodeFromUrl}
            onAddIntegrationNode={handleAddIntegrationNode}
            onSynthesize={handleSynthesize}
            onInspectNode={setInspectedPost}
            onDeleteNode={handleDeleteNode}
            isSynthesizing={isSynthesizing}
            onAddReelToCanvas={handleAddReelFromMeta}
            isBrandDnaOpen={isBrandDnaOpen}
            onToggleBrandDna={() => setIsBrandDnaOpen(!isBrandDnaOpen)}
            isAuditOpen={isAuditOpen}
            onToggleAudit={() => setIsAuditOpen(!isAuditOpen)}
            onToggleFullScreenCanvas={handleToggleFullScreenCanvas}
            onOpenCrm={() => setViewMode('messages')}
            onToggleConnectEdge={handleToggleConnectEdge}
            onDisconnectAllFromTarget={handleDisconnectAllFromTarget}
            onSendChatMessage={handleSendChatMessage}
            onUpdateNodeChatMode={handleUpdateNodeChatMode}
            onCreateAiChatNode={handleCreateAiChatNode}
            preferredAIProvider={connections.preferredAIProvider}
            onSelectAIProvider={handleSelectAIProvider}
            isQuickIdeaOpen={isQuickIdeaOpen}
            onToggleQuickIdea={() => setIsQuickIdeaOpen(!isQuickIdeaOpen)}
            quickIdeaMessages={quickIdeaMessages}
            quickIdeaMode={quickIdeaMode}
            onQuickIdeaModeChange={setQuickIdeaMode}
            onSendQuickIdea={handleSendQuickIdea}
            onResetQuickIdea={handleResetQuickIdea}
            isQuickIdeaGenerating={isQuickIdeaGenerating}
            quickIdeaPostsCount={posts.length}
          />

          <BusinessAuditPanel
            business={business}
            auditReport={auditReport}
            brandDna={brandDna}
            isOpen={isAuditOpen}
            onToggle={() => setIsAuditOpen(!isAuditOpen)}
            onAddReelToCanvas={handleAddReelFromMeta}
            onSyncAllReels={handleSyncAllReelsFromMeta}
            onOpenExecutiveReport={() => setIsExecutiveReportOpen(true)}
            onOpenFullAnalysis={() => setViewMode('analysis')}
            posts={posts}
            accountHandle={accountHandle}
          />
        </div>
      )}
      </main>

      <ReelBreakdownModal
        post={inspectedPost}
        onClose={() => setInspectedPost(null)}
        onUpdatePost={(updatedPost) => {
          setPosts(prev => {
            const nextPosts = prev.map(p => p.id === updatedPost.id ? updatedPost : p);
            IntelligenceStorageService.savePosts(business.id, nextPosts);
            const updatedAudit = ReelAnalyzerService.calculateAuditReport(nextPosts, brandDna, accountHandle);
            setAuditReport(updatedAudit);
            return nextPosts;
          });
          setNodes(prev => prev.map(n => n.post?.id === updatedPost.id ? { ...n, post: updatedPost } : n));
          setInspectedPost(updatedPost);
        }}
        brandDna={brandDna}
        businessId={business.id}
      />

      <ExecutiveIntelligenceReportModal
        isOpen={isExecutiveReportOpen}
        onClose={() => setIsExecutiveReportOpen(false)}
        report={executiveReport}
        onApplyNextPostToCanvas={handleApplyNextPostToCanvas}
        onSyncAllReels={handleSyncAllReelsDirect}
      />

      <UnifiedConnectionsModal
        isOpen={isConnectionsOpen}
        onClose={() => setIsConnectionsOpen(false)}
        businessId={business.id}
        onConnectionsUpdated={(newConns) => setConnections(newConns)}
        isSuperAdmin={isSuperAdmin}
        catalogProvider={business.catalog_provider}
      />

      <NewClientRegistrationModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        onClientRegistered={handleSelectBusiness}
      />
    </div>
  );
};
