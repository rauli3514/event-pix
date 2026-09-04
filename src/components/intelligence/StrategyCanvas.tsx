import React, { useState, useRef } from 'react';
import { IntelligencePost } from '../../types/intelligence';
import { Plus, Sparkles, Layers, Zap, Eye, Bookmark, Trash2, CheckCircle2, RefreshCw, Link } from 'lucide-react';
import { ReelSynthesisResult } from '../../services/intelligence/reelAnalyzerService';

export interface CanvasNode {
  id: string;
  x: number;
  y: number;
  type: 'reel' | 'synthesis';
  post?: IntelligencePost;
  synthesisResult?: ReelSynthesisResult;
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
  onSynthesize: (sourceNodeIds: string[]) => void;
  onInspectNode: (post: IntelligencePost) => void;
  onDeleteNode: (nodeId: string) => void;
  isSynthesizing: boolean;
}

export const StrategyCanvas: React.FC<StrategyCanvasProps> = ({
  nodes,
  edges,
  onAddNodeFromUrl,
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
  const canvasRef = useRef<HTMLDivElement>(null);

  // Obtener posición real de un nodo
  const getNodePos = (node: CanvasNode) => {
    return nodePositions[node.id] || { x: node.x, y: node.y };
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
    const newX = Math.max(20, e.clientX - dragOffset.x);
    const newY = Math.max(20, e.clientY - dragOffset.y);
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

  return (
    <div
      ref={canvasRef}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      className="relative flex-1 bg-[#080C14] overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col"
    >
      {/* Fondo de cuadrícula de nodos (Grid dot pattern) */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* SVG Canvas Edges / Flechas de Conexión */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
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

          const x1 = sPos.x + 280; // Ancho del nodo tarjeta
          const y1 = sPos.y + 120;
          const x2 = tPos.x;
          const y2 = tPos.y + 140;

          // Curva Bézier suave entre nodos
          const dx = (x2 - x1) / 2;
          const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          return (
            <g key={edge.id}>
              <path
                d={pathD}
                fill="none"
                stroke="url(#edgeGradient)"
                strokeWidth="3"
                filter="url(#glow)"
                className="animate-pulse"
              />
              <circle cx={x1} cy={y1} r="4" fill="#8B5CF6" />
              <circle cx={x2} cy={y2} r="5" fill="#06B6D4" />
            </g>
          );
        })}
      </svg>

      {/* Barra de Herramientas Flotante Superior (Toolbar) */}
      <div className="absolute top-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-2xl backdrop-blur-xl">
        {/* Entrada de URL de Reel */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Pegá el link de un Reel (ej: https://www.instagram.com/reel/...)"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <button
            onClick={handleAddUrl}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-violet-600/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Pegar Reel
          </button>
        </div>

        {/* Acciones de Selección y Fusión */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {selectedNodeIds.length} Reels Seleccionados
          </div>

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
                FUSIONAR Y SINTETIZAR CON IA
              </>
            )}
          </button>
        </div>
      </div>

      {/* Renderizado de Nodos en el Canvas */}
      <div className="relative w-full h-full z-10 pt-20 p-6">
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
                {/* Header Nodo Reel */}
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

                  <button
                    onClick={() => onDeleteNode(node.id)}
                    className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Body Nodo Reel */}
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

                  {/* Badges de Métricas */}
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

                  {/* Acciones */}
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

          if (node.type === 'synthesis' && node.synthesisResult) {
            const synth = node.synthesisResult;
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className="absolute w-96 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-3xl shadow-2xl shadow-cyan-950/50 backdrop-blur-xl z-20"
              >
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-t-3xl">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                    NODO SÍNTESIS IA (Super Guion)
                  </span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                    RESULTADO FUSIONADO
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

                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">Guion Completo a Grabar:</span>
                    <pre className="text-slate-300 text-[10px] font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar p-2 bg-slate-900 rounded-xl">
                      {synth.full_script}
                    </pre>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};
