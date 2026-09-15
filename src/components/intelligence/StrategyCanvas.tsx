import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IntelligencePost, NodeType } from '../../types/intelligence';
import {
  Plus, Sparkles, Layers, Zap, Eye, Trash2, CheckCircle2, RefreshCw,
  Link, Bot, FileImage, MessageSquare, ArrowRight, Send, Tv, QrCode, Instagram,
  Link2, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Move, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Focus,
  Heart, Copy, Check, Video, Lightbulb, Flame, X
} from 'lucide-react';
import { ReelSynthesisResult } from '../../services/intelligence/reelAnalyzerService';
import { MetaMediaItem, MetaMediaInsights } from '../../services/meta/MetaGraphService';
import { DisplayTvPreviewModal } from './DisplayTvPreviewModal';
import { TeleprompterModal } from './TeleprompterModal';
import { AutoDmStudioModal } from './AutoDmStudioModal';
import { AiChatCardNode, ChatMessage, ContentFormatMode } from './canvas/AiChatCardNode';
import { HooksResourceDrawer } from './canvas/HooksResourceDrawer';
import { IntelligenceStorageService } from '../../services/intelligence/IntelligenceStorageService';
import { formatMetric } from '../../services/intelligence/metricUtils';
import { toast } from 'sonner';

export interface CanvasNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  post?: IntelligencePost;
  synthesisResult?: ReelSynthesisResult;
  integrationName?: string;
  actionStatus?: string;
  chatMessages?: ChatMessage[];
  activeMode?: ContentFormatMode;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

interface StrategyCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onAddNodeFromUrl: (url: string) => void;
  onAddIntegrationNode: (type: NodeType, name: string) => void;
  onSynthesize: (sourceNodeIds: string[]) => void;
  onInspectNode: (post: IntelligencePost) => void;
  onDeleteNode: (nodeId: string) => void;
  isSynthesizing: boolean;
  onAddReelToCanvas?: (reel: MetaMediaItem & { insights?: MetaMediaInsights }, position?: { x: number; y: number }) => void;
  isBrandDnaOpen?: boolean;
  onToggleBrandDna?: () => void;
  isAuditOpen?: boolean;
  onToggleAudit?: () => void;
  onToggleFullScreenCanvas?: () => void;
  onOpenCrm?: () => void;
  onToggleConnectEdge?: (sourceId: string, targetId: string) => void;
  onDisconnectAllFromTarget?: (targetId: string) => void;
  onSendChatMessage?: (nodeId: string, text: string, mode: ContentFormatMode) => Promise<void>;
  onUpdateNodeChatMode?: (nodeId: string, mode: ContentFormatMode) => void;
  onCreateAiChatNode?: (position?: { x: number; y: number }, sourceReelId?: string) => void;
  preferredAIProvider?: 'claude' | 'gemini' | 'openai' | 'local_engine' | 'auto';
  onSelectAIProvider?: (provider: 'claude' | 'gemini' | 'openai' | 'auto') => void;
}

export const StrategyCanvas: React.FC<StrategyCanvasProps> = ({
  nodes,
  edges,
  onAddNodeFromUrl,
  onAddIntegrationNode,
  onSynthesize,
  onInspectNode,
  onDeleteNode,
  isSynthesizing,
  onAddReelToCanvas,
  isBrandDnaOpen,
  onToggleBrandDna,
  isAuditOpen,
  onToggleAudit,
  onToggleFullScreenCanvas,
  onOpenCrm,
  onToggleConnectEdge,
  onDisconnectAllFromTarget,
  onSendChatMessage,
  onUpdateNodeChatMode,
  onCreateAiChatNode,
  preferredAIProvider,
  onSelectAIProvider
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [canvasInputUrl, setCanvasInputUrl] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [isTvModalOpen, setIsTvModalOpen] = useState(false);
  const [isDragOverTemplate, setIsDragOverTemplate] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  // Estados de Panning (correr el lienzo con el mouse) y Zoom
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);

  // Widget "¿Qué Hacer Ahora?" y Evidencia
  const [isRationaleOpen, setIsRationaleOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const businessId = IntelligenceStorageService.getActiveBusinessId() || 'tecno_eventos_arg';
  const activeBenchmark = IntelligenceStorageService.getBenchmark(businessId);
  const activeHypotheses = IntelligenceStorageService.getHypotheses(businessId);
  const topHypothesis = activeHypotheses.length > 0 ? activeHypotheses[0] : null;

  // Estados del Super Guión, Teleprompter y Pestañas del Nodo Síntesis
  const [teleprompterModal, setTeleprompterModal] = useState<{
    isOpen: boolean;
    title: string;
    scriptText: string;
    hook?: string;
    cta?: string;
  }>({
    isOpen: false,
    title: '',
    scriptText: '',
    hook: '',
    cta: ''
  });
  const [isAutoDmModalOpen, setIsAutoDmModalOpen] = useState(false);
  const [autoDmScriptData, setAutoDmScriptData] = useState<{ hook?: string; cta?: string }>({});
  const [synthesisTab, setSynthesisTab] = useState<{ [nodeId: string]: 'teleprompter' | 'ideas' | 'hooks' | 'structure' }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHooksDrawerOpen, setIsHooksDrawerOpen] = useState(false);

  const handleCopyText = (text: string, id: string, message: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(message);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.canvas-node') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('.canvas-toolbar') ||
      target.closest('.canvas-hud')
    ) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    if (canvasRef.current) {
      setScrollStart({
        left: canvasRef.current.scrollLeft,
        top: canvasRef.current.scrollTop,
      });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      const newX = Math.max(10, Math.round((e.clientX - dragOffset.x) / zoomLevel));
      const newY = Math.max(10, Math.round((e.clientY - dragOffset.y) / zoomLevel));
      setNodePositions(prev => ({
        ...prev,
        [draggedNodeId]: { x: newX, y: newY }
      }));
      return;
    }

    if (isPanning && canvasRef.current) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      canvasRef.current.scrollLeft = scrollStart.left - deltaX;
      canvasRef.current.scrollTop = scrollStart.top - deltaY;
    }
  };

  const handleMouseUpCanvas = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(Number((prev + 0.1).toFixed(1)), 1.4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(Number((prev - 0.1).toFixed(1)), 0.6));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  };

  const handleDropOnTemplate = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTemplate(false);
    setIsDragOverCanvas(false);

    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const reel = JSON.parse(jsonStr) as MetaMediaItem & { insights?: MetaMediaInsights };
        if (reel && reel.id) {
          if (onAddReelToCanvas) {
            onAddReelToCanvas(reel);
          }
          return;
        }
      } catch (err) {
        console.error('Error parsing dropped reel', err);
      }
    }

    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (text && text.trim().startsWith('http')) {
      onAddNodeFromUrl(text.trim());
    }
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
    setIsDragOverTemplate(false);

    const rect = canvasRef.current?.getBoundingClientRect();
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;
    const dropX = rect ? Math.max(30, Math.round((e.clientX - rect.left + scrollLeft - 140) / zoomLevel)) : 100;
    const dropY = rect ? Math.max(30, Math.round((e.clientY - rect.top + scrollTop - 80) / zoomLevel)) : 250;

    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const reel = JSON.parse(jsonStr) as MetaMediaItem & { insights?: MetaMediaInsights };
        if (reel && reel.id && onAddReelToCanvas) {
          onAddReelToCanvas(reel, { x: dropX, y: dropY });
          return;
        }
      } catch (err) {
        console.error('Error parsing dropped reel on canvas', err);
      }
    }

    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (text && text.trim().startsWith('http')) {
      onAddNodeFromUrl(text.trim());
    }
  };

  const getNodePos = (node: CanvasNode) => {
    return nodePositions[node.id] || { x: node.x, y: node.y };
  };

  const getNodeDimensions = (node: CanvasNode) => {
    if (node.type === 'synthesis') return { width: 380, height: 420 };
    if (node.type === 'ai_chat') return { width: 380, height: 500 };
    if (node.type === 'reel') return { width: 280, height: 260 };
    return { width: 270, height: 170 };
  };

  const isReelConnectedToChat = (reelId: string) => {
    return edges.some(e => e.source === reelId && nodes.some(n => n.id === e.target && n.type === 'ai_chat'));
  };

  const handleConnectReelToChat = (reelId: string) => {
    const existingChat = nodes.find(n => n.type === 'ai_chat');
    if (existingChat) {
      if (onToggleConnectEdge) {
        onToggleConnectEdge(reelId, existingChat.id);
      }
    } else if (onCreateAiChatNode) {
      const reelNode = nodes.find(n => n.id === reelId);
      const rPos = reelNode ? getNodePos(reelNode) : { x: 450, y: 120 };
      onCreateAiChatNode({ x: rPos.x + 360, y: rPos.y }, reelId);
    }
  };

  const handleMouseDownNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const pos = getNodePos(node);
    setDragOffset({
      x: e.clientX - pos.x * zoomLevel,
      y: e.clientY - pos.y * zoomLevel
    });
  };

  const handleToggleSelectNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedNodeIds.includes(id)) {
      setSelectedNodeIds(selectedNodeIds.filter(i => i !== id));
    } else {
      setSelectedNodeIds([...selectedNodeIds, id]);
    }
  };

  const handleAddUrl = (urlToUse?: string) => {
    const targetUrl = urlToUse || inputUrl || canvasInputUrl;
    if (!targetUrl.trim()) {
      toast.error('Por favor ingresá un enlace de Reel válido.');
      return;
    }
    onAddNodeFromUrl(targetUrl.trim());
    setInputUrl('');
    setCanvasInputUrl('');
  };

  const handleExecuteConnectorAction = (nodeId: string, actionName: string) => {
    if (actionName.includes('Display Digital') || actionName.includes('Pantallas TV') || actionName.includes('Emitir en TV')) {
      setIsTvModalOpen(true);
      return;
    }

    if (actionName.includes('Auto-DM') || actionName.includes('Meta Suite')) {
      const synthNode = nodes.find(n => n.type === 'synthesis' && n.synthesisResult);
      if (synthNode?.synthesisResult) {
        setAutoDmScriptData({
          hook: synthNode.synthesisResult.hook,
          cta: synthNode.synthesisResult.cta
        });
      }
      setIsAutoDmModalOpen(true);
      return;
    }

    setExecutingNodeId(nodeId);
    toast.info(`Ejecutando: ${actionName}...`);

    setTimeout(() => {
      setExecutingNodeId(null);
      if (actionName.includes('Auto-DM')) {
        toast.success('⚡ Auto-Responder de Meta Suite activo! Abriendo CRM conversacional...');
        if (onOpenCrm) onOpenCrm();
      } else if (actionName.includes('Canva')) {
        toast.success('🎨 Diseño exportado a Canva con el kit de marca EventPix!');
      } else {
        toast.success(`Acción "${actionName}" completada con éxito!`);
      }
    }, 1200);
  };

  return (
    <div className="relative flex-1 flex flex-col h-full bg-[#080C14] overflow-hidden">
      {/* Toolbar Superior Limpia (Fija, sin tapar ninguna tarjeta) */}
      <div className="canvas-toolbar shrink-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-[#0B101B]/95 border-b border-slate-800/80 px-6 py-2.5 shadow-xl backdrop-blur-xl">
        
        {/* Controles de Espacio / Paneles */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[11px]">
          {onToggleBrandDna && (
            <button
              onClick={onToggleBrandDna}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                isBrandDnaOpen
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title={isBrandDnaOpen ? 'Ocultar ADN de Marca' : 'Mostrar ADN de Marca'}
            >
              {isBrandDnaOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">ADN Marca</span>
            </button>
          )}

          {onToggleAudit && (
            <button
              onClick={onToggleAudit}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                isAuditOpen
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title={isAuditOpen ? 'Ocultar Auditoría & Ads' : 'Mostrar Auditoría & Ads'}
            >
              {isAuditOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Auditoría & Ads</span>
            </button>
          )}

          {onToggleFullScreenCanvas && (
            <button
              onClick={onToggleFullScreenCanvas}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                !isBrandDnaOpen && !isAuditOpen
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-600/30'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
              }`}
              title="Lienzo 100%: Ocultar todas las barras laterales para ver todo el espacio"
            >
              {!isBrandDnaOpen && !isAuditOpen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{!isBrandDnaOpen && !isAuditOpen ? 'Restaurar' : 'Lienzo 100%'}</span>
            </button>
          )}
        </div>

        {/* Paleta de Conectores Rápidos */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[11px]">
          <span className="text-slate-400 px-2 font-bold uppercase text-[10px]">Añadir Conector:</span>
          <button
            onClick={() => onAddIntegrationNode('display_digital', 'Display Hub (Pantallas TV)')}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all"
          >
            <Tv className="w-3.5 h-3.5" /> Display TV
          </button>
          <button
            onClick={() => onAddIntegrationNode('meta_business', 'Meta Suite (Auto-DM)')}
            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Meta Suite
          </button>
          <button
            onClick={() => onAddIntegrationNode('canva', 'Canva Design Kit')}
            className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all"
          >
            <FileImage className="w-3.5 h-3.5" /> Canva
          </button>
          {onCreateAiChatNode && (
            <button
              onClick={() => onCreateAiChatNode()}
              className="bg-gradient-to-r from-pink-600/20 to-rose-600/20 hover:from-pink-600/30 hover:to-rose-600/30 text-pink-300 border border-pink-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-sm"
              title="Añadir tarjeta de Chat con IA al Lienzo"
            >
              <Bot className="w-3.5 h-3.5 text-pink-400" />
              <span>+ Chat con IA (Card)</span>
            </button>
          )}
          <button
            onClick={() => setIsHooksDrawerOpen(true)}
            className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 hover:from-rose-500/20 hover:to-pink-500/20 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-sm"
            title="Abrir Banco de Ganchos Probados (Hooks 0-3s)"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Ganchos</span>
          </button>
        </div>

        {/* Fusión */}
        <div className="flex items-center gap-3">
          <button
            disabled={selectedNodeIds.length < 1 || isSynthesizing}
            onClick={() => onSynthesize(selectedNodeIds)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              selectedNodeIds.length >= 1 && !isSynthesizing
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:scale-105'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSynthesizing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                Sintetizando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                FUSIONAR ({selectedNodeIds.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Widget "¿Qué Hacer Ahora?" / Próximo Paso Estratégico */}
      {!isBannerDismissed && (
        <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-950 border-b border-pink-500/20 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Lightbulb className="w-3 h-3 text-pink-400" />
              ¿Qué hacer ahora?
            </span>
            <p className="text-slate-200 text-xs truncate">
              {topHypothesis ? (
                <>
                  <strong className="text-pink-200">Próximo experimento:</strong> {topHypothesis.statement}
                </>
              ) : (
                <>
                  <strong className="text-pink-200">Próximo paso:</strong> Conectá Reels al nodo de IA para detectar patrones ganadores y calcular tu mediana.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {topHypothesis && (
              <button
                type="button"
                onClick={() => setIsRationaleOpen(!isRationaleOpen)}
                className="text-[11px] font-bold text-pink-300 hover:text-pink-200 underline decoration-pink-500/40 underline-offset-2 transition-colors"
              >
                {isRationaleOpen ? 'Ocultar evidencia' : '¿Por qué me recomendás esto?'}
              </button>
            )}

            {onCreateAiChatNode && (
              <button
                type="button"
                onClick={() => onCreateAiChatNode()}
                className="px-2.5 py-1 rounded-lg bg-pink-600/30 hover:bg-pink-600/50 text-pink-200 border border-pink-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>+ Abrir Tarjeta de Experimento</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsBannerDismissed(true)}
              className="text-slate-500 hover:text-slate-300 p-1"
              title="Cerrar recomendación"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Desglose de Evidencia "¿Por qué me recomendás esto?" */}
      {isRationaleOpen && topHypothesis && (
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-3 text-xs text-slate-300 space-y-2 z-20 shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <span className="font-bold text-pink-400 uppercase text-[10px] tracking-wider">
              📊 Evidencia Empírica de la Cuenta ({activeBenchmark?.sample_size || 0} publicaciones analizadas):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Nivel de Confianza: <strong className="text-slate-200">{topHypothesis.confidence.toUpperCase()}</strong>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Patrón Observado:</span>
              <p className="font-medium text-slate-200 mt-0.5">{topHypothesis.evidence_basis}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Métrica Objetivo:</span>
              <p className="font-medium text-emerald-300 mt-0.5">{topHypothesis.target_benchmark_comparison}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Mediana de Referencia:</span>
              <p className="font-medium text-slate-200 mt-0.5">
                {activeBenchmark ? `${formatMetric(activeBenchmark.median_views)} vistas | ${formatMetric(activeBenchmark.median_saves)} guardados` : 'Pendiente de sincronización'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Superficie de Scroll y Panning del Lienzo */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        onMouseLeave={handleMouseUpCanvas}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!isDragOverCanvas) setIsDragOverCanvas(true);
        }}
        onDragLeave={() => setIsDragOverCanvas(false)}
        onDrop={handleDropOnCanvas}
        className={`relative flex-1 bg-[#080C14] overflow-auto select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        } flex flex-col custom-scrollbar transition-colors ${
          isDragOverCanvas ? 'ring-2 ring-inset ring-pink-500/30 bg-pink-950/5' : ''
        }`}
        style={{ minHeight: '600px' }}
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none min-w-[2800px] min-h-[1800px]"
          style={{
            backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Container Escalable para Nodos y SVG */}
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: '0 0',
            width: '2800px',
            minHeight: '1800px',
          }}
          className="relative p-6"
        >
        {/* SVG Canvas Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 min-w-[2800px] min-h-[1800px]">
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id="magentaEdgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#E1306C" />
              <stop offset="100%" stopColor="#F43F5E" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="magentaGlow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const isAiChat = targetNode.type === 'ai_chat' || sourceNode.type === 'ai_chat';
            const sPos = getNodePos(sourceNode);
            const tPos = getNodePos(targetNode);
            const sDim = getNodeDimensions(sourceNode);
            const tDim = getNodeDimensions(targetNode);

            const x1 = sPos.x + sDim.width;
            const y1 = sPos.y + (sourceNode.type === 'reel' ? 68 : Math.min(sDim.height / 2, 80));

            const x2 = tPos.x;
            const y2 = tPos.y + (targetNode.type === 'ai_chat' ? 44 : Math.min(tDim.height / 2, 80));

            const dx = Math.abs(x2 - x1) * 0.5;
            const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            return (
              <g key={edge.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isAiChat ? "url(#magentaEdgeGradient)" : "url(#edgeGradient)"}
                  strokeWidth={isAiChat ? "3.5" : "3.5"}
                  filter={isAiChat ? "url(#magentaGlow)" : "url(#glow)"}
                  className="animate-pulse"
                />
                <circle cx={x1} cy={y1} r="5" fill={isAiChat ? "#EC4899" : "#8B5CF6"} stroke="#F8FAFC" strokeWidth="1.5" />
                <circle cx={x2} cy={y2} r="5" fill={isAiChat ? "#E1306C" : "#10B981"} stroke="#F8FAFC" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>

        {/* Workspace Canvas con Nodos */}
        <div className="relative w-full h-full z-20 pt-6 p-6 min-h-[1800px]">
          
          {/* TARJETA / DROPZONE ESPACIOSA EN EL CANVAS PARA PEGAR / ARRASTRAR REEL */}
          <div
            style={{ left: '40px', top: '10px' }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'copy';
              setIsDragOverTemplate(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOverTemplate(false);
            }}
            onDrop={handleDropOnTemplate}
            className={`canvas-node absolute w-72 bg-gradient-to-b from-slate-900 to-slate-950 border-2 rounded-2xl p-4 shadow-xl z-20 space-y-3 transition-all ${
              isDragOverTemplate
                ? 'border-pink-500 ring-4 ring-pink-500/30 scale-105 bg-pink-950/40 shadow-pink-950/60 shadow-2xl'
                : 'border-dashed border-violet-500/40 hover:border-violet-500/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Instagram className="w-4 h-4 text-pink-400" />
                {isDragOverTemplate ? '¡Soltá para Analizar!' : 'Arrastrar o Pegar Reel'}
              </span>
            <span className="text-[9px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono font-bold">
              IA ANALYZER
            </span>
          </div>

          {isDragOverTemplate ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed border-pink-400/80 rounded-xl bg-pink-500/10 animate-pulse">
              <Sparkles className="w-8 h-8 text-pink-400 animate-bounce" />
              <span className="text-xs font-bold text-pink-200">Soltá el Reel acá</span>
              <span className="text-[10px] text-pink-300">Desglosaremos su gancho y métricas en vivo</span>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-400 leading-snug">
                Arrastrá un Reel desde la pestaña de Instagram o pegá cualquier enlace:
              </p>

              <div className="space-y-2">
                <div className="relative">
                  <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="https://www.instagram.com/reel/..."
                    value={canvasInputUrl}
                    onChange={(e) => setCanvasInputUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUrl(canvasInputUrl)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <button
                  onClick={() => handleAddUrl(canvasInputUrl)}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all hover:scale-102"
                >
                  <Plus className="w-4 h-4" />
                  ANALIZAR Y AGREGAR AL CANVAS
                </button>
              </div>
            </>
          )}
        </div>

        {/* ESTADO VACÍO EN EL CANVAS (0-BASE) */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center z-10">
            <div className="max-w-md bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
                <Layers className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">
                  Lienzo Estratégico en 0
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pegá el enlace de un Reel en la barra superior o hacé clic en "Agregar al Lienzo" desde la Auditoría de Competidores para comenzar a estructurar tus nodos reales.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">1. Analizar Reel</span>
                <span>→</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">2. Síntesis IA</span>
                <span>→</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">3. Difusión & CRM</span>
              </div>
            </div>
          </div>
        )}

        {/* NODOS EN EL CANVAS */}
        {nodes.map(node => {
          const pos = getNodePos(node);
          const isSelected = selectedNodeIds.includes(node.id);

          if (node.type === 'reel' && node.post) {
            const post = node.post;
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className={`canvas-node absolute w-72 bg-slate-900/90 border rounded-2xl shadow-2xl backdrop-blur-xl transition-shadow group ${
                  isSelected
                    ? 'border-violet-500 ring-2 ring-violet-500/40 shadow-violet-950/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConnectReelToChat(node.id);
                  }}
                  title={isReelConnectedToChat(node.id) ? "Desconectar del Chat IA" : "Conectar con Chat IA"}
                  className={`absolute -right-3 top-14 w-6 h-6 rounded-full border-2 border-slate-950 shadow-md flex items-center justify-center text-white z-30 transition-transform hover:scale-125 cursor-pointer group/anchor ${
                    isReelConnectedToChat(node.id)
                      ? 'bg-gradient-to-r from-pink-500 to-rose-600 ring-2 ring-pink-400/50'
                      : 'bg-violet-600 hover:bg-pink-500'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-white ${isReelConnectedToChat(node.id) ? 'animate-pulse' : 'group-hover/anchor:animate-ping'}`} />
                </button>

                <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleToggleSelectNode(node.id, e)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-violet-600 border-violet-500 text-white' : 'border-slate-700 bg-slate-950 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Link className="w-3 h-3 text-cyan-400" /> Reel {post.objective}
                    </span>
                  </div>

                  <button onClick={() => onDeleteNode(node.id)} className="text-slate-600 hover:text-rose-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 space-y-2.5">
                  <div className="flex gap-3">
                    <img
                      src={post.thumbnail_url}
                      alt={post.title}
                      className="w-16 h-24 object-cover rounded-xl border border-slate-800 shrink-0"
                    />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">
                        {post.title}
                      </h4>
                      {post.analysis && (
                        <div className="bg-violet-950/40 border border-violet-500/30 px-2 py-1 rounded-lg text-[10px] text-violet-300 font-semibold truncate">
                          Hook: "{post.analysis.hook_data.text}"
                        </div>
                      )}
                    </div>
                  </div>

                  {post.metrics && (
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-1 border-t border-slate-800/60 font-mono">
                      <div className="bg-slate-950 px-2 py-1 rounded-lg text-slate-300 text-center" title="Vistas estimadas">
                        <Eye className="w-3 h-3 text-cyan-400 inline mr-1" />
                        {formatMetric(post.metrics.views, { compact: true })}
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded-lg text-slate-300 text-center" title="Likes reales de Instagram">
                        <Heart className="w-3 h-3 text-rose-400 inline mr-1" />
                        {formatMetric(post.metrics.likes)}
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded-lg text-slate-300 text-center" title="Comentarios reales de Instagram">
                        <MessageSquare className="w-3 h-3 text-emerald-400 inline mr-1" />
                        {formatMetric(post.metrics.comments)}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() => onInspectNode(post)}
                      className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold py-1.5 rounded-xl border border-slate-700/80 flex items-center justify-center gap-1 transition-all"
                    >
                      <Layers className="w-3 h-3 text-violet-400" />
                      Ver Detalle
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnectReelToChat(node.id);
                      }}
                      className={`text-[10px] font-semibold py-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all ${
                        isReelConnectedToChat(node.id)
                          ? 'bg-pink-950/40 border-pink-500/50 text-pink-300 hover:bg-pink-950/70'
                          : 'bg-slate-800/50 hover:bg-pink-600/20 text-slate-300 hover:text-pink-200 border-slate-700/60 hover:border-pink-500/40'
                      }`}
                    >
                      <Link2 className="w-3 h-3 text-pink-400" />
                      {isReelConnectedToChat(node.id) ? 'Conectado' : 'Al Chat IA'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (['meta_business', 'chatgpt', 'claude', 'canva', 'automation_action', 'display_digital'].includes(node.type)) {
            const isExecuting = executingNodeId === node.id;
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className={`canvas-node absolute w-64 bg-slate-900 border rounded-2xl shadow-xl backdrop-blur-xl transition-all ${
                  isSelected ? 'border-amber-500 ring-2 ring-amber-500/40' : 'border-slate-800'
                }`}
              >
                <div className="absolute -left-2.5 top-12 w-5 h-5 rounded-full bg-amber-400 border-2 border-slate-950 shadow-md flex items-center justify-center text-white z-30">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>

                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950 rounded-t-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <button
                      onClick={(e) => handleToggleSelectNode(node.id, e)}
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-amber-600 border-amber-500 text-white' : 'border-slate-700 bg-slate-950 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                    {node.type === 'display_digital' && <Tv className="w-4 h-4 text-amber-400" />}
                    {node.type === 'meta_business' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                    {node.type === 'chatgpt' && <Bot className="w-4 h-4 text-emerald-400" />}
                    {node.type === 'canva' && <FileImage className="w-4 h-4 text-violet-400" />}
                    <span className="truncate">{node.integrationName || node.type}</span>
                  </div>
                  <button onClick={() => onDeleteNode(node.id)} className="text-slate-600 hover:text-rose-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Estado:</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                      Conectado
                    </span>
                  </div>

                  {node.type === 'display_digital' && (
                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => handleExecuteConnectorAction(node.id, 'Enviar a Pantallas TV')}
                        disabled={isExecuting}
                        className="w-full bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 border border-amber-500/30 font-semibold py-1.5 px-2 rounded-xl flex items-center justify-between text-[10px] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Tv className="w-3.5 h-3.5 text-amber-400" />
                          Enviar a Pantallas TV
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleExecuteConnectorAction(node.id, 'Generar QR WhatsApp')}
                        disabled={isExecuting}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold py-1 px-2 rounded-xl flex items-center justify-between text-[9px] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <QrCode className="w-3 h-3 text-emerald-400" />
                          Generar QR WhatsApp
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {node.type === 'meta_business' && (
                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => handleExecuteConnectorAction(node.id, 'Activar Auto-DM ("Comenta APP")')}
                        disabled={isExecuting}
                        className="w-full bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-500/30 font-semibold py-1.5 px-2 rounded-xl flex items-center justify-between text-[10px] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Send className="w-3 h-3 text-cyan-400" />
                          Activar Auto-DM ("APP")
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>

                      {onOpenCrm && (
                        <button
                          onClick={onOpenCrm}
                          className="w-full bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-500/30 font-semibold py-1 px-2 rounded-xl flex items-center justify-between text-[9px] transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3 text-emerald-400" />
                            Ver Conversaciones CRM (2)
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {node.type === 'canva' && (
                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => handleExecuteConnectorAction(node.id, 'Exportar Plantilla a Canva')}
                        disabled={isExecuting}
                        className="w-full bg-violet-950/60 hover:bg-violet-900/60 text-violet-200 border border-violet-500/30 font-semibold py-1.5 px-2 rounded-xl flex items-center justify-between text-[10px] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileImage className="w-3 h-3 text-violet-400" />
                          Crear Diseño en Canva
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (node.type === 'synthesis' && node.synthesisResult) {
            const synth = node.synthesisResult;
            const currentTab = synthesisTab[node.id] || 'teleprompter';
            const cleanScript = synth.teleprompter_clean_script || synth.full_script.replace(/\[.*?\]|\(.*?\)/g, '').trim();
            const wordCount = cleanScript.split(/\s+/).filter(Boolean).length;
            const estSeconds = Math.round((wordCount / 130) * 60);

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className="canvas-node absolute w-[430px] bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500/60 rounded-3xl shadow-2xl backdrop-blur-xl z-30"
              >
                <div className="absolute -left-2.5 top-12 w-5 h-5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-md flex items-center justify-center text-white z-30">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>

                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-t-3xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-cyan-300 block">
                        Super Guión & Teleprompter
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {wordCount} palabras • ~{estSeconds}s de lectura
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteNode(node.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Eliminar nodo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tabs Switcher */}
                <div className="grid grid-cols-4 p-1.5 bg-slate-950/90 border-b border-slate-800 text-[10px] font-bold text-slate-400">
                  <button
                    onClick={() => setSynthesisTab(prev => ({ ...prev, [node.id]: 'teleprompter' }))}
                    className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      currentTab === 'teleprompter'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    <Video className="w-3 h-3" />
                    <span>Guión</span>
                  </button>

                  <button
                    onClick={() => setSynthesisTab(prev => ({ ...prev, [node.id]: 'ideas' }))}
                    className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      currentTab === 'ideas'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    <Lightbulb className="w-3 h-3" />
                    <span>3 Ideas</span>
                  </button>

                  <button
                    onClick={() => setSynthesisTab(prev => ({ ...prev, [node.id]: 'hooks' }))}
                    className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      currentTab === 'hooks'
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Ganchos</span>
                  </button>

                  <button
                    onClick={() => setSynthesisTab(prev => ({ ...prev, [node.id]: 'structure' }))}
                    className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      currentTab === 'structure'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Técnico</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-4 space-y-3 text-xs max-h-[460px] overflow-y-auto custom-scrollbar">
                  
                  {/* TAB 1: GUIÓN TELEPROMPTER */}
                  {currentTab === 'teleprompter' && (
                    <div className="space-y-3">
                      {/* Botón Principal de Copia para Edits/CapCut */}
                      <button
                        onClick={() => handleCopyText(cleanScript, `teleprompter-${node.id}`, '¡Guión copiado! Pegalo en Edits, CapCut o tu app de teleprompter.')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/25 transition-all"
                      >
                        {copiedId === `teleprompter-${node.id}` ? (
                          <>
                            <Check className="w-4 h-4 text-white" />
                            <span>¡Copiado al Portapapeles!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>📋 Copiar para Teleprompter (Edits / CapCut)</span>
                          </>
                        )}
                      </button>

                      {/* Botón para Abrir Teleprompter Pantalla Completa */}
                      <button
                        onClick={() => setTeleprompterModal({
                          isOpen: true,
                          title: synth.title || 'Super Guión Fusionado',
                          scriptText: cleanScript,
                          hook: synth.hook,
                          cta: synth.cta
                        })}
                        className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold py-2 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs transition-colors"
                      >
                        <Video className="w-3.5 h-3.5 text-cyan-400" />
                        <span>📺 Abrir Grabador Teleprompter en Pantalla</span>
                      </button>

                      {/* Texto Limpio en Párrafos */}
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold border-b border-slate-800 pb-1.5">
                          <span>DIÁLOGO EXACTO A DECIR FRENTE A CÁMARA:</span>
                          <span className="text-cyan-400 font-mono">100% Hablado</span>
                        </div>
                        <div className="space-y-2 text-slate-200 text-xs leading-relaxed max-h-48 overflow-y-auto pr-1">
                          {cleanScript.split('\n\n').filter(Boolean).map((p, pIdx) => (
                            <p key={pIdx} className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                              {p}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Hook & CTA Quick Glance */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-bold text-violet-400 uppercase block">Hook Inicial (0-3s)</span>
                          <p className="text-slate-300 italic text-[11px] line-clamp-2">"{synth.hook}"</p>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase block">CTA Final</span>
                          <p className="text-slate-300 text-[11px] line-clamp-2">"{synth.cta}"</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: 3 IDEAS NUEVAS */}
                  {currentTab === 'ideas' && (
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-bold text-amber-300 block">
                        3 Ideas Nuevas Derivadas con Diálogos Listos:
                      </span>
                      {(synth.new_reel_ideas && synth.new_reel_ideas.length > 0 ? synth.new_reel_ideas : [
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
                      ]).map((idea, iIdx) => (
                        <div key={iIdx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300 text-xs">{idea.title}</span>
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                              {idea.angle}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 italic bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                            {idea.spoken_dialogue}
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-emerald-400 font-semibold">{idea.cta}</span>
                            <button
                              onClick={() => handleCopyText(idea.spoken_dialogue, `idea-${node.id}-${iIdx}`, '¡Guión de la idea copiado!')}
                              className="text-[10px] bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1"
                            >
                              {copiedId === `idea-${node.id}-${iIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>Copiar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: GANCHOS ALTERNATIVOS */}
                  {currentTab === 'hooks' && (
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-bold text-violet-300 block">
                        Ganchos Probados para los Primeros 3 Segundos:
                      </span>
                      {(synth.alternative_hooks && synth.alternative_hooks.length > 0 ? synth.alternative_hooks : [
                        { type: 'Curiosidad', text: '¿Sabías por qué los locales que más venden ya no usan carteles de lona?' },
                        { type: 'Dolor / Pérdida', text: 'El 80% de las personas que pasan frente a tu negocio no entran por esto...' },
                        { type: 'Resultado Directo', text: 'Cómo captar la atención de tu cuadra completa con una sola pantalla vertical.' }
                      ]).map((hookItem, hIdx) => (
                        <div key={hIdx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-violet-400 tracking-wider">
                              {hookItem.type}
                            </span>
                            <button
                              onClick={() => handleCopyText(hookItem.text, `hook-${node.id}-${hIdx}`, '¡Gancho copiado!')}
                              className="text-[10px] bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-300 px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1"
                            >
                              {copiedId === `hook-${node.id}-${hIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>Copiar</span>
                            </button>
                          </div>
                          <p className="text-slate-200 text-xs font-medium italic">"{hookItem.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 4: ESTRUCTURA TÉCNICA */}
                  {currentTab === 'structure' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Estructura Fusionada:</span>
                        <div className="space-y-1">
                          {synth.structure_breakdown.map((item, idx) => (
                            <div key={idx} className="bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-slate-300 text-[11px]">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Llamado a la Acción (CTA):</span>
                        <p className="text-emerald-200 font-semibold text-[11px]">"{synth.cta}"</p>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-cyan-400 tracking-wider">Por qué funciona:</span>
                        <p className="text-slate-300 text-[11px]">{synth.why_it_works}</p>
                      </div>
                    </div>
                  )}

                  {/* Conectores / Acciones Físicas y de Redes */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleExecuteConnectorAction(node.id, 'Emitir en TV')}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[10px] transition-all shadow-lg shadow-amber-600/20"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      Emitir en TV
                    </button>
                    <button
                      onClick={() => handleExecuteConnectorAction(node.id, 'Auto-DM en Meta Business Suite')}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[10px] transition-all shadow-lg shadow-cyan-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Auto-DM
                    </button>
                    <button
                      onClick={() => handleExecuteConnectorAction(node.id, 'Diseño en Canva')}
                      className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 text-[10px] transition-all shadow-lg shadow-violet-600/20"
                    >
                      <FileImage className="w-3.5 h-3.5" />
                      Canva
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (node.type === 'ai_chat') {
            const incomingEdges = edges.filter(e => e.target === node.id);
            const connectedPosts = incomingEdges
              .map(e => nodes.find(n => n.id === e.source)?.post)
              .filter(Boolean) as IntelligencePost[];

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className="canvas-node absolute z-30"
              >
                <AiChatCardNode
                  cardId={node.id.startsWith('node-ai-chat-') ? node.id.replace('node-ai-chat-', 'Card #') : 'Card #8'}
                  connectedPosts={connectedPosts}
                  messages={node.chatMessages || []}
                  activeMode={node.activeMode || 'b_roll'}
                  onModeChange={(mode) => onUpdateNodeChatMode && onUpdateNodeChatMode(node.id, mode)}
                  onSendMessage={(text, mode) => onSendChatMessage ? onSendChatMessage(node.id, text, mode) : Promise.resolve()}
                  onDisconnectAll={() => onDisconnectAllFromTarget && onDisconnectAllFromTarget(node.id)}
                  onDisconnectSource={(postId) => {
                    const srcNode = nodes.find(n => n.post?.id === postId);
                    if (srcNode && onToggleConnectEdge) {
                      onToggleConnectEdge(srcNode.id, node.id);
                    }
                  }}
                  onOpenTeleprompter={(scriptText, title) => {
                    setTeleprompterModal({
                      isOpen: true,
                      title: title || 'Guión de Chat IA',
                      scriptText: scriptText,
                      hook: '',
                      cta: ''
                    });
                  }}
                  onClose={() => onDeleteNode(node.id)}
                  preferredAIProvider={preferredAIProvider}
                  onSelectAIProvider={onSelectAIProvider}
                />
              </div>
            );
          }

          return null;
        })}
        </div>
      </div>

      {/* Floating HUD de Navegación, Zoom y Pan.
          Portal directo a document.body: este HUD vive dentro del
          contenedor con scroll/pan del lienzo (canvasRef) y dentro del
          div con transform: scale() del zoom, así que position:absolute
          o position:fixed acá adentro quedan atados a ese contenido — se
          mueven y se pierden al arrastrar el lienzo. El portal lo saca
          de ese árbol para que quede anclado a la ventana de verdad. */}
      {createPortal(
        <div className="canvas-hud fixed bottom-4 left-6 z-20 flex items-center gap-1.5 bg-slate-950/90 border border-slate-800/90 px-3 py-1.5 rounded-2xl shadow-2xl backdrop-blur-xl text-xs">
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800 text-slate-400 text-[11px]">
            <Move className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Arrastrá lienzo</span>
          </div>

          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.6}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30"
            title="Alejar (Zoom Out)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetView}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono font-bold rounded-lg border border-slate-800 text-[11px] transition-colors"
            title="Restablecer zoom al 100% y centrar"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 1.4}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30"
            title="Acercar (Zoom In)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetView}
            className="p-1 text-slate-400 hover:text-violet-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Centrar vista (100%)"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}
      </div>

      <DisplayTvPreviewModal
        isOpen={isTvModalOpen}
        onClose={() => setIsTvModalOpen(false)}
        scriptHook="Escuchá esto antes de grabar tu próximo Reel... Descubrí la automatización que duplica las ventas en tu comercio."
        scriptCta='Comenta "APP" en Instagram o escaneá el QR para recibir la promoción VIP en WhatsApp'
      />

      <TeleprompterModal
        isOpen={teleprompterModal.isOpen}
        onClose={() => setTeleprompterModal(prev => ({ ...prev, isOpen: false }))}
        title={teleprompterModal.title}
        scriptText={teleprompterModal.scriptText}
        hook={teleprompterModal.hook}
        cta={teleprompterModal.cta}
      />

      <AutoDmStudioModal
        isOpen={isAutoDmModalOpen}
        onClose={() => setIsAutoDmModalOpen(false)}
        scriptHook={autoDmScriptData.hook}
        scriptCta={autoDmScriptData.cta}
        onOpenCrm={onOpenCrm}
      />

      <HooksResourceDrawer
        isOpen={isHooksDrawerOpen}
        onClose={() => setIsHooksDrawerOpen(false)}
        onApplyHookToChat={(hookText) => {
          const chatNode = nodes.find(n => n.type === 'ai_chat');
          if (chatNode && onSendChatMessage) {
            onSendChatMessage(chatNode.id, hookText, chatNode.activeMode || 'b_roll');
          } else if (onCreateAiChatNode) {
            onCreateAiChatNode({ x: 520, y: 100 });
            setTimeout(() => {
              const freshChat = nodes.find(n => n.type === 'ai_chat');
              if (freshChat && onSendChatMessage) {
                onSendChatMessage(freshChat.id, hookText, 'b_roll');
              }
            }, 300);
          }
        }}
      />
    </div>
  );
};
