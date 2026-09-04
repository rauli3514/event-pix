import React, { useState } from 'react';
import {
  INITIAL_BUSINESS,
  INITIAL_BRAND_DNA,
  INITIAL_POSTS,
  INITIAL_AUDIT_REPORT
} from '../../services/intelligence/mockData';
import { BrandDNA, IntelligencePost, BusinessAuditReport, NodeType } from '../../types/intelligence';
import { BrandDnaPanel } from '../../components/intelligence/BrandDnaPanel';
import { BusinessAuditPanel } from '../../components/intelligence/BusinessAuditPanel';
import { StrategyCanvas, CanvasNode, CanvasEdge } from '../../components/intelligence/StrategyCanvas';
import { ReelBreakdownModal } from '../../components/intelligence/ReelBreakdownModal';
import { ReelAnalyzerService } from '../../services/intelligence/reelAnalyzerService';
import { Brain, Activity, Share2, Tv } from 'lucide-react';
import { toast } from 'sonner';

export const IntelligenceCanvasPage: React.FC = () => {
  const [business] = useState(INITIAL_BUSINESS);
  const [brandDna, setBrandDna] = useState<BrandDNA>(INITIAL_BRAND_DNA);
  const [posts, setPosts] = useState<IntelligencePost[]>(INITIAL_POSTS);
  const [auditReport, setAuditReport] = useState<BusinessAuditReport>(INITIAL_AUDIT_REPORT);

  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: 'node_1', x: 40, y: 80, type: 'reel', post: INITIAL_POSTS[0] },
    {
      id: 'node_synth',
      x: 360,
      y: 80,
      type: 'synthesis',
      synthesisResult: {
        title: 'Super Guion Fusionado',
        hook: 'Escuchá esto antes de grabar tu próximo Reel... La razón por la que los comercios más exitosos están usando automatización con IA.',
        structure_breakdown: [
          '0-3s: Hook de Alta Curiosidad + Texto Flotante OCR',
          '3-12s: Exposición del Freno de Conversión del Mercado',
          '12-32s: Demostración Visual de los 3 Patrones Ganadores',
          '32-45s: CTA de Comentario por Palabra Clave ("APP")'
        ],
        cta: 'Comenta "APP" y te la envío ya!!! ⬇️',
        full_script: `[HOOK (0-3s)]\n(Corte rápido + Texto gigante en amarillo en pantalla)\n"Escuchá esto antes de grabar tu próximo Reel... La razón por la que los comercios más exitosos están usando automatización con IA."\n\n[PROBLEMA / CONFLICTO (3-12s)]\nSi estás publicando videos estáticos o esperando que el algoritmo te regale alcance sin una estructura probada, estás perdiendo el 80% de tus prospectos.\n\n[VALOR & DEMOSTRACIÓN (12-32s)]\nAcá está la clave: Enganchá con una pregunta chocante en los primeros 1.5s, demostrá el resultado visualmente y usá subtítulos dinámicos.\n\n[CTA (32-45s)]\nComenta "APP" y te la envío ya!!! ⬇️`,
        why_it_works: 'Combina retención del 32% con emisión en Pantallas TV del local.',
        expected_impact: '2.4x más guardados y transmisión directa en las pantallas del local.'
      }
    },
    { id: 'node_display', x: 780, y: 40, type: 'display_digital', integrationName: 'EventPix Display Hub (Pantallas TV)' },
    { id: 'node_meta', x: 780, y: 220, type: 'meta_business', integrationName: 'Meta Business Suite (Auto-DM)' },
    { id: 'node_canva', x: 780, y: 400, type: 'canva', integrationName: 'Canva Design Kit' }
  ]);

  const [edges, setEdges] = useState<CanvasEdge[]>([
    { id: 'edge_1_synth', source: 'node_1', target: 'node_synth' },
    { id: 'edge_synth_display', source: 'node_synth', target: 'node_display' },
    { id: 'edge_synth_meta', source: 'node_synth', target: 'node_meta' },
    { id: 'edge_synth_canva', source: 'node_synth', target: 'node_canva' }
  ]);

  const [isBrandDnaOpen, setIsBrandDnaOpen] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(true);
  const [inspectedPost, setInspectedPost] = useState<IntelligencePost | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleAddNodeFromUrl = (url: string) => {
    const newId = `node_${Date.now()}`;
    const newPost: IntelligencePost = {
      id: `post_${Date.now()}`,
      business_id: business.id,
      title: 'Reel Importado de Instagram',
      video_url: url,
      thumbnail_url: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=400&auto=format&fit=crop',
      duration_seconds: 50,
      objective: 'engagement',
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      metrics: {
        post_id: `post_${Date.now()}`,
        views: 11200,
        reach: 9800,
        likes: 740,
        comments: 115,
        shares: 240,
        saves: 480,
        followers_gained: 39,
        average_watch_time_seconds: 16.0,
        total_watch_time_seconds: 179200,
        profile_visits: 210,
        like_rate: 6.6,
        comment_rate: 1.0,
        share_rate: 2.1,
        save_rate: 4.2,
        retention_percentage: 32.0
      },
      analysis: {
        post_id: `post_${Date.now()}`,
        hook_data: {
          text: 'La estrategia no secreta para duplicar tus ventas en Reels',
          type: 'secreto_revelado',
          curiosity_score: 90,
          clarity_score: 92,
          auditory_strength: 'alta',
          has_text_on_screen: true
        },
        promise: 'Reconstrucción estratégica del Reel.',
        topic: 'Estrategia de Ventas',
        audience: 'Comercios B2B',
        structure: ['hook', 'problem', 'value', 'cta'],
        language_data: {
          tone: 'Directo',
          proximity: 'cercano',
          technicality: 'baja',
          second_person_usage: true
        },
        emotions: ['curiosidad', 'confianza'],
        visual_analysis: {
          scene_change_frequency_sec: 2.0,
          has_captions: true,
          main_visual_element: 'Subtítulos amarillos en vivo'
        },
        cta_data: {
          detected: true,
          text: 'Comenta "APP" y te la envío ya!!! ⬇️',
          type: 'comment_keyword',
          strength: 'fuerte'
        },
        time_segments: [
          { range: '0-3s', content: 'La estrategia no secreta...', narrative_role: 'hook', visual_cue: 'Corte rápido' },
          { range: '3-15s', content: 'Exposición del problema...', narrative_role: 'problem', visual_cue: 'B-roll de estudio' },
          { range: '15-40s', content: 'Desarrollo de la solución...', narrative_role: 'value', visual_cue: 'Gráfico animado' },
          { range: '40-50s', content: 'Comenta "APP" y te la envío ya!!!', narrative_role: 'cta', visual_cue: 'Sticker rosa' }
        ],
        diagnosis: {
          what_worked: ['Gancho de alto impacto.'],
          what_failed: ['Ninguno detectado.'],
          hypotheses: ['Buena tasa de guardados.'],
          what_to_change: ['Ninguno.'],
          what_to_repeat: ['Texto amarillo en pantalla.'],
          next_test: 'Probar combinación con Reel #1.'
        }
      }
    };

    const newCanvasNode: CanvasNode = {
      id: newId,
      x: 40,
      y: 80 + nodes.filter(n => n.type === 'reel').length * 280,
      type: 'reel',
      post: newPost
    };

    setNodes(prev => [...prev, newCanvasNode]);
    setPosts(prev => [...prev, newPost]);

    const updatedAudit = ReelAnalyzerService.calculateAuditReport([...posts, newPost], brandDna);
    setAuditReport(updatedAudit);

    toast.success('Reel importado y analizado con éxito!');
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
    setIsSynthesizing(true);
    const selectedPosts = nodes
      .filter(n => sourceNodeIds.includes(n.id) && n.post)
      .map(n => n.post!);

    try {
      const result = await ReelAnalyzerService.synthesizeReels({
        business_id: business.id,
        source_posts: selectedPosts.length > 0 ? selectedPosts : [INITIAL_POSTS[0]],
        brand_dna: brandDna
      });

      const synthNodeId = `synth_${Date.now()}`;
      const synthNode: CanvasNode = {
        id: synthNodeId,
        x: 360,
        y: 80,
        type: 'synthesis',
        synthesisResult: result
      };

      const newEdges: CanvasEdge[] = sourceNodeIds.map(srcId => ({
        id: `edge_${srcId}_${synthNodeId}`,
        source: srcId,
        target: synthNodeId
      }));

      setNodes(prev => [...prev.filter(n => n.type !== 'synthesis'), synthNode]);
      setEdges(prev => [...prev.filter(e => e.target !== synthNodeId), ...newEdges]);

      toast.success('Super Guion generado combinando conectores e IA!');
    } catch (err) {
      toast.error('Error al generar la síntesis del guion.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    toast.info('Nodo eliminado.');
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080C14] text-slate-100 overflow-hidden font-sans">
      <header className="h-16 bg-slate-950/90 border-b border-slate-800/80 px-6 flex items-center justify-between z-40 backdrop-blur-xl shrink-0">
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
                Social $\rightarrow$ Display TV Omnichannel
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Analista + Estratega para <strong className="text-slate-200">{auditReport.instagram_handle || business.name}</strong>
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Tv className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300">Display TV Hub:</span>
            <span className="text-amber-400 font-bold font-mono">3 Pantallas Activas</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300">Meta Suite & Canva:</span>
            <span className="text-emerald-400 font-bold font-mono">Conectados</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300">Health Score:</span>
            <span className="text-cyan-400 font-bold font-mono">{auditReport.health_score}/100</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        <BrandDnaPanel
          business={business}
          brandDna={brandDna}
          onUpdateDna={setBrandDna}
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
        />

        <BusinessAuditPanel
          business={business}
          auditReport={auditReport}
          isOpen={isAuditOpen}
          onToggle={() => setIsAuditOpen(!isAuditOpen)}
        />
      </div>

      <ReelBreakdownModal
        post={inspectedPost}
        onClose={() => setInspectedPost(null)}
      />
    </div>
  );
};
