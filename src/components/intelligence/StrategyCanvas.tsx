import React, { useState, useRef } from 'react';
import { IntelligencePost, NodeType } from '../../types/intelligence';
import { Plus, Sparkles, Layers, Zap, Eye, Bookmark, Trash2, CheckCircle2, RefreshCw, Link, Bot, FileImage, MessageSquare, ArrowRight, Send, Tv, QrCode } from 'lucide-react';
import { ReelSynthesisResult } from '../../services/intelligence/reelAnalyzerService';
import { DisplayTvPreviewModal } from './DisplayTvPreviewModal';
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
}

export const StrategyCanvas: React.FC<StrategyCanvasProps> = ({
  nodes,
  edges,
  onAddNodeFromUrl,
  onAddIntegrationNode,
  onSynthesize,
  onInspectNode,
  onDeleteNode,
  isSynthesizing
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [isTvModalOpen, setIsTvModalOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getNodePos = (node: CanvasNode) => {
    return nodePositions[node.id] || { x: node.x, y: node.y };
  };

  const getNodeDimensions = (node: CanvasNode) => {
    if (node.type === 'synthesis') return { width: 380, height: 420 };
    if (node.type === 'reel') return { width: 280, height: 260 };
    return { width: 270, height: 170 };
  };

  const handleMouseDownNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const pos = getNodePos(node);
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!draggedNodeId) return;
    const newX = Math.max(10, e.clientX - dragOffset.x);
    const newY = Math.max(10, e.clientY - dragOffset.y);
    setNodePositions(prev => ({
      ...prev,
      [draggedNodeId]: { x: newX, y: newY }
    }));
  };

  const handleMouseUpCanvas = () => {
    setDraggedNodeId(null);
  };

  const handleToggleSelectNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedNodeIds.includes(id)) {
      setSelectedNodeIds(selectedNodeIds.filter(i => i !== id));
    } else {
      setSelectedNodeIds([...selectedNodeIds, id]);
    }
  };

  const handleAddUrl = () => {
    if (!inputUrl.trim()) return;
    onAddNodeFromUrl(inputUrl.trim());
    setInputUrl('');
  };

  const handleExecuteConnectorAction = (nodeId: string, actionName: string) => {
    if (actionName.includes('Display Digital') || actionName.includes('Pantallas TV') || actionName.includes('Emitir en TV')) {
      setIsTvModalOpen(true);
      return;
    }

    setExecutingNodeId(nodeId);
    toast.info(`Ejecutando: ${actionName}...`);

    setTimeout(() => {
      setExecutingNodeId(null);
      if (actionName.includes('Auto-DM')) {
        toast.success('⚡ Auto-Responder configurado en Meta Suite! Se enviará la plantilla al comentar "APP".');
      } else if (actionName.includes('Canva')) {
        toast.success('🎨 Diseño exportado a Canva con el kit de marca EventPix!');
      } else {
        toast.success(`Acción "${actionName}" completada con éxito!`);
      }
    }, 1500);
  };

  return (
    <div
      ref={canvasRef}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      className="relative flex-1 bg-[#080C14] overflow-auto select-none cursor-grab active:cursor-grabbing flex flex-col custom-scrollbar"
      style={{ minHeight: '600px', minWidth: '900px' }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none min-w-[2000px] min-h-[1500px]"
        style={{
          backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* SVG Canvas Edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 min-w-[2000px] min-h-[1500px]">
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
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

          const sPos = getNodePos(sourceNode);
          const tPos = getNodePos(targetNode);
          const sDim = getNodeDimensions(sourceNode);
          const tDim = getNodeDimensions(targetNode);

          const x1 = sPos.x + sDim.width;
          const y1 = sPos.y + Math.min(sDim.height / 2, 80);

          const x2 = tPos.x;
          const y2 = tPos.y + Math.min(tDim.height / 2, 80);

          const dx = Math.abs(x2 - x1) * 0.5;
          const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          return (
            <g key={edge.id}>
              <path
                d={pathD}
                fill="none"
                stroke="url(#edgeGradient)"
                strokeWidth="3.5"
                filter="url(#glow)"
                className="animate-pulse"
              />
              <circle cx={x1} cy={y1} r="5" fill="#8B5CF6" stroke="#F8FAFC" strokeWidth="1.5" />
              <circle cx={x2} cy={y2} r="5" fill="#10B981" stroke="#F8FAFC" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>

      {/* Toolbar Flotante */}
      <div className="sticky top-4 left-6 right-6 z-30 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-2xl backdrop-blur-xl shrink-0 mx-6">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Pegá el link de un Reel (ej: instagram.com/reel/...)"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={handleAddUrl}
            className="bg-violet-600 hover:bg-violet-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shrink-0 transition-all"
          >
            <Plus className="w-4 h-4" />
            Pegar Reel
          </button>
        </div>

        {/* Paleta de Conectores Rápidos */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <span className="text-slate-500 px-2 font-bold uppercase text-[9px]">Añadir Conector:</span>
          <button
            onClick={() => onAddIntegrationNode('display_digital', 'Display Hub (Pantallas TV)')}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all"
          >
            <Tv className="w-3 h-3" /> Display TV
          </button>
          <button
            onClick={() => onAddIntegrationNode('meta_business', 'Meta Suite (Auto-DM)')}
            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all"
          >
            <MessageSquare className="w-3 h-3" /> Meta Suite
          </button>
          <button
            onClick={() => onAddIntegrationNode('canva', 'Canva Design Kit')}
            className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all"
          >
            <FileImage className="w-3 h-3" /> Canva
          </button>
        </div>

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
                Sintetizando Guion IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                FUSIONAR CON CONECTORES ({selectedNodeIds.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Renderizado de Nodos */}
      <div className="relative w-full h-full z-20 pt-6 p-6 min-h-[800px]">
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
                className={`absolute w-72 bg-slate-900/90 border rounded-2xl shadow-2xl backdrop-blur-xl transition-shadow group ${
                  isSelected
                    ? 'border-violet-500 ring-2 ring-violet-500/40 shadow-violet-950/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="absolute -right-2.5 top-14 w-5 h-5 rounded-full bg-violet-600 border-2 border-slate-950 shadow-md flex items-center justify-center text-white z-30">
                  <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                </div>

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
                      <div className="bg-slate-950 px-2 py-1 rounded-lg text-slate-300 text-center">
                        <Eye className="w-3 h-3 text-cyan-400 inline mr-1" />
                        {(post.metrics.views / 1000).toFixed(1)}k
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded-lg text-slate-300 text-center">
                        <Bookmark className="w-3 h-3 text-violet-400 inline mr-1" />
                        {post.metrics.save_rate}%
                      </div>
                      <div className="bg-slate-950 px-2 py-1 rounded-lg text-slate-300 text-center">
                        <Zap className="w-3 h-3 text-emerald-400 inline mr-1" />
                        {post.metrics.retention_percentage}%
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => onInspectNode(post)}
                    className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold py-1.5 rounded-xl border border-slate-700/80 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Layers className="w-3.5 h-3.5 text-violet-400" />
                    Ver Despiece de 5 Capas
                  </button>
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
                className={`absolute w-64 bg-slate-900 border rounded-2xl shadow-xl backdrop-blur-xl transition-all ${
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
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className="absolute w-96 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-3xl shadow-2xl backdrop-blur-xl z-30"
              >
                <div className="absolute -left-2.5 top-12 w-5 h-5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-md flex items-center justify-center text-white z-30">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>

                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-t-3xl">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                    NODO SÍNTESIS IA (Super Guion)
                  </span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                    FUSIONADO
                  </span>
                </div>

                <div className="p-4 space-y-3.5 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-violet-400 tracking-wider">Hook Optimizado:</span>
                    <p className="text-slate-100 font-semibold italic">"{synth.hook}"</p>
                  </div>

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

          return null;
        })}
      </div>

      {/* Modal Previsualizador de Emisión TV */}
      <DisplayTvPreviewModal
        isOpen={isTvModalOpen}
        onClose={() => setIsTvModalOpen(false)}
        scriptHook="Escuchá esto antes de grabar tu próximo Reel... Descubrí la automatización que duplica las ventas en tu comercio."
        scriptCta='Comenta "APP" en Instagram o escaneá el QR para recibir la promoción VIP en WhatsApp'
      />
    </div>
  );
};
