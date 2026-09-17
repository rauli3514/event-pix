import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  INITIAL_BUSINESS,
  INITIAL_BRAND_DNA
} from '../../services/intelligence/mockData';
import { BrandDNA, IntelligencePost, BusinessAuditReport, NodeType, NO_DATA, IntelligenceBusiness } from '../../types/intelligence';
import { fromApi, rate } from '../../services/intelligence/metricUtils';
import { BrandDnaPanel } from '../../components/intelligence/BrandDnaPanel';
import { BusinessAuditPanel } from '../../components/intelligence/BusinessAuditPanel';
import { StrategyCanvas, CanvasNode, CanvasEdge } from '../../components/intelligence/StrategyCanvas';
import { ReelBreakdownModal } from '../../components/intelligence/ReelBreakdownModal';
import { ExecutiveIntelligenceReportModal } from '../../components/intelligence/ExecutiveIntelligenceReportModal';
import { CRMConversationalHub } from '../../components/intelligence/CRMConversationalHub';
import { ExecutiveDecisionDashboard } from '../../components/intelligence/ExecutiveDecisionDashboard';
import { ReelAnalyzerService } from '../../services/intelligence/reelAnalyzerService';
import { ContentIntelligenceEngine } from '../../services/intelligence/ContentIntelligenceEngine';
import { IntelligenceStorageService } from '../../services/intelligence/IntelligenceStorageService';
import { CRMStorageService } from '../../services/intelligence/CRMStorageService';
import { MetaGraphService, MetaMediaItem, MetaMediaInsights } from '../../services/meta/MetaGraphService';
import { supabase } from '../../lib/supabase';
import { UnifiedConnectionsModal } from '../../components/intelligence/UnifiedConnectionsModal';
import { ConnectionStorageService } from '../../services/intelligence/ConnectionStorageService';
import { AIProviderService } from '../../services/intelligence/AIProviderService';
import { UnifiedConnectionsState } from '../../types/connections';
import { MetaAdCampaign } from '../../types/ads';
import { BusinessSwitcher } from '../../components/intelligence/BusinessSwitcher';
import { NewClientRegistrationModal } from '../../components/intelligence/NewClientRegistrationModal';
import { ProfileAndAiContextView } from '../../components/intelligence/profile/ProfileAndAiContextView';
import { ChatMessage, ContentFormatMode } from '../../components/intelligence/canvas/AiChatCardNode';
import { Brain, Activity, Tv, Sparkles, Cloud, Loader2, MessageSquare, LayoutDashboard, Network, Radio, Trash2, Bot, User, Zap } from 'lucide-react';
import { toast } from 'sonner';

export const IntelligenceCanvasPage: React.FC = () => {
  const [business, setBusiness] = useState(INITIAL_BUSINESS);
  const [brandDna, setBrandDna] = useState<BrandDNA>(INITIAL_BRAND_DNA);
  const [posts, setPosts] = useState<IntelligencePost[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving'>('synced');
  const [viewMode, setViewMode] = useState<'canvas' | 'messages' | 'profile' | 'dashboard'>('profile');
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

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

  // Cuenta activa (detecta credenciales reales de Meta si existen)
  const [accountHandle, setAccountHandle] = useState<string>(() => {
    const creds = MetaGraphService.loadCredentials(IntelligenceStorageService.getActiveBusinessId() || undefined);
    if (creds?.accountUsername && !creds.accountUsername.includes('tecno_eventos')) {
      return `@${creds.accountUsername.replace('@', '')}`;
    }
    return '@display_digital';
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

  const [isBrandDnaOpen, setIsBrandDnaOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
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

        // Cargar Brand DNA guardado
        const savedDna = await IntelligenceStorageService.loadBrandDna(activeBiz.id);
        if (savedDna && isMounted) {
          setBrandDna(savedDna);
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

    // 1. Cargar Brand DNA del nuevo negocio
    const savedDna = await IntelligenceStorageService.loadBrandDna(newBiz.id);
    if (savedDna) {
      setBrandDna(savedDna);
    }

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
        x: 40,
        y: 220 + nodes.filter(n => n.type === 'reel').length * 280,
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
    const newId = `node_reel_${reel.id}`;

    if (nodes.some(n => n.post?.id === reel.id)) {
      toast.info('Este Reel ya está en tu Canvas.');
      return;
    }

    // Métricas estrictamente reportadas por Meta. Lo que no viene, no existe:
    // no se estima a partir de los likes ni se rellena con 0.
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

    const newPost: IntelligencePost = {
      id: reel.id,
      business_id: business.id,
      title: cleanTitle,
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
        synced_at: new Date().toISOString()
      },
      // Sin `analysis`: importar un Reel no equivale a haberlo analizado.
      // El análisis (gancho, estructura, segmentos, diagnóstico) se produce cuando
      // el usuario lo transcribe y lo procesa con IA desde el desglose del Reel.
      // Rellenarlo acá con scores fijos y segmentos de cartelería digital era
      // exactamente lo que hacía que el sistema "supiera" cosas que nunca miró.
    };

    const newCanvasNode: CanvasNode = {
      id: newId,
      x: position?.x ?? 40,
      y: position?.y ?? (220 + nodes.filter(n => n.type === 'reel').length * 280),
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
      activeMode: 'b_roll',
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

  const handleSendChatMessage = async (nodeId: string, text: string, mode: ContentFormatMode) => {
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
        userInstruction: text,
        mode,
        sourcePosts,
        profileContext: profileContext || undefined,
        connections: currentConns,
        chatHistory: previousMessages
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
    <div className="h-screen w-screen bg-[#080C14] text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* Header Superior Reorganizado y Orientado a Decisiones */}
      <header className="min-h-14 border-b border-slate-800/80 bg-slate-950/80 px-4 py-2 flex flex-wrap items-center justify-between gap-y-2 z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-slate-100 uppercase">
                EVENTPIX INTELLIGENCE
              </h1>
              <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                Centro de Decisión & Acción
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Analista + Estratega para <strong className="text-slate-200">{accountHandle}</strong>
            </p>
          </div>

          {/* Switcher Multi-Tenant de Clientes / Comercios */}
          <div className="hidden md:block ml-2 border-l border-slate-800/80 pl-3">
            <BusinessSwitcher
              currentBusiness={business}
              onSelectBusiness={handleSelectBusiness}
              onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
              readOnly={!isSuperAdmin}
            />
          </div>
        </div>

        {/* Selector Central de Vistas: Lienzo (Board) vs Perfil & Contexto IA vs Métricas */}
        <div className="hidden sm:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === 'canvas'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Lienzo (Board)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('messages')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === 'messages'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Mensajes</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('profile')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === 'profile'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <User className="w-3.5 h-3.5 text-pink-300" />
            <span>Perfil & Contexto IA</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === 'dashboard'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Métricas</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="hidden xl:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Tv className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300">Display TV:</span>
            <span className="text-slate-400 font-medium">0 Pantallas</span>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300">Salud Negocio:</span>
            <span className="text-cyan-400 font-bold font-mono">{executiveReport.global_health_score}/100</span>
          </div>

          {/* Indicador de Nube SaaS */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px]">
            {syncStatus === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span className="text-violet-300 font-medium">Guardando...</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">SaaS Cloud</span>
              </>
            )}
          </div>

          {/* Botón Central de Conexiones & APIs */}
          <button
            onClick={() => setIsConnectionsOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 text-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-all hover:scale-105 shadow-sm"
            title="Conectar y sincronizar Shop de Plumas, Meta/WhatsApp, OpenAI y Claude"
          >
            <Radio className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline">Conectar APIs</span>
            <span className="sm:hidden">APIs</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
              activeConnectionsCount > 0
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {activeConnectionsCount > 0 ? `🟢 ${activeConnectionsCount}` : '⚪ 0'}
            </span>
          </button>

          {/* Selector Rápido de IA Activa (Multi-IA Auto vs Claude vs Gemini vs OpenAI) */}
          {(Boolean(connections.gemini?.apiKey && connections.gemini.apiKey.length > 5) ||
            Boolean(connections.claude?.apiKey && connections.claude.apiKey.length > 5) ||
            Boolean(connections.openai?.apiKey && connections.openai.apiKey.length > 5) ||
            connections.openai.status === 'connected' ||
            connections.claude.status === 'connected' ||
            connections.gemini?.status === 'connected') && (
            <button
              onClick={handleToggleAIProvider}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all hover:scale-105 border shadow-sm ${
                connections.preferredAIProvider === 'gemini'
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20 shadow-sky-500/10'
                  : connections.preferredAIProvider === 'claude'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shadow-amber-500/10'
                  : connections.preferredAIProvider === 'openai'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 shadow-emerald-500/10'
                  : 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/25 shadow-fuchsia-500/15'
              }`}
              title="Click para alternar entre Multi-IA Automático, Claude Sonnet, Google Gemini y ChatGPT GPT-4o"
            >
              {connections.preferredAIProvider === 'gemini' ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  <span>IA: Gemini 1.5</span>
                </>
              ) : connections.preferredAIProvider === 'claude' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>IA: Claude Sonnet</span>
                </>
              ) : connections.preferredAIProvider === 'openai' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span>IA: GPT-4o</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 animate-pulse" />
                  <span>⚡ Multi-IA: Auto</span>
                </>
              )}
            </button>
          )}

          {/* Botón Destacado: INFORME DE INTELIGENCIA */}
          <button
            onClick={() => setIsExecutiveReportOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-lg shadow-violet-600/30 transition-all hover:scale-105"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">Informe de Inteligencia</span>
            <span className="sm:hidden">Informe</span>
          </button>

          {/* Botón Reiniciar Datos a 0 */}
          <button
            onClick={handleResetToZero}
            className="flex items-center gap-1.5 bg-rose-950/30 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-all"
            title="Limpiar datos demo y comenzar desde 0"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">Reiniciar a 0</span>
          </button>
        </div>
      </header>

      {/* VISTA DINÁMICA: PERFIL & CONTEXTO IA, DASHBOARD EJECUTIVO O LIENZO DE ESTRATEGIA */}
      {viewMode === 'profile' ? (
        <ProfileAndAiContextView
          businessId={business.id}
          onProfileUpdated={(updated) => {
            if (updated.profile.instagram_handle) {
              setAccountHandle(`@${updated.profile.instagram_handle}`);
            }
          }}
        />
      ) : viewMode === 'messages' ? (
        <CRMConversationalHub
          isOpen={true}
          onClose={() => setViewMode('canvas')}
          brandDna={brandDna}
          businessId={business.id}
          variant="inline"
        />
      ) : viewMode === 'dashboard' ? (
        <ExecutiveDecisionDashboard
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
          />

          <BusinessAuditPanel
            business={business}
            auditReport={auditReport}
            isOpen={isAuditOpen}
            onToggle={() => setIsAuditOpen(!isAuditOpen)}
            onAddReelToCanvas={handleAddReelFromMeta}
            onOpenExecutiveReport={() => setIsExecutiveReportOpen(true)}
            onAddAdToCanvas={handleAddAdToCanvas}
            onPromoteReelToAd={handlePromoteReelToAd}
            posts={posts}
            accountHandle={accountHandle}
            connections={connections}
            onOpenConnections={() => setIsConnectionsOpen(true)}
          />
        </div>
      )}

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
