// ================================================================
// TeleprompterModal.tsx
// Teleprompter Profesional para Grabación de Reels y Tiktoks
// Con Autoscroll, Velocidad Ajustable, Espejo y Exportación a Edits/CapCut
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Play, Pause, RotateCcw, Copy, Check,
  Gauge, FlipHorizontal, Maximize2, Minimize2, Video
} from 'lucide-react';
import { toast } from 'sonner';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  scriptText: string;
  hook?: string;
  cta?: string;
}

export const TeleprompterModal: React.FC<TeleprompterModalProps> = ({
  isOpen,
  onClose,
  title,
  scriptText
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // 1 to 5
  const [fontSize, setFontSize] = useState<'medium' | 'large' | 'xlarge'>('large');
  const [isMirrored, setIsMirrored] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Limpiar texto de acotaciones técnicas si las tuviera
  const cleanScript = scriptText
    ? scriptText.replace(/\[.*?\]|\(.*?\)/g, '').trim()
    : '';

  const words = cleanScript.split(/\s+/).filter(Boolean).length;
  // Promedio de habla: 130 palabras por minuto
  const estimatedSeconds = Math.round((words / 130) * 60);

  // Manejo de autoscroll suave
  useEffect(() => {
    if (!isPlaying || countdown !== null) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const scrollStep = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop += speed * 0.55;
        if (
          scrollContainerRef.current.scrollTop + scrollContainerRef.current.clientHeight >=
          scrollContainerRef.current.scrollHeight - 5
        ) {
          setIsPlaying(false);
          return;
        }
      }
      animFrameRef.current = requestAnimationFrame(scrollStep);
    };

    animFrameRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, countdown]);

  // Manejo de Cuenta Regresiva al presionar Play
  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCountdown(null);
    } else {
      setCountdown(3);
    }
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 750);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
      setIsPlaying(true);
    }
  }, [countdown]);

  const handleResetScroll = () => {
    setIsPlaying(false);
    setCountdown(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyCleanScript = () => {
    const textToCopy = cleanScript || scriptText;
    navigator.clipboard.writeText(textToCopy);
    setHasCopied(true);
    toast.success('¡Guión copiado! Pegalo directamente en Edits, CapCut o tu app de teleprompter.');
    setTimeout(() => setHasCopied(false), 3000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Atajo de teclado: Barra espaciadora para Play/Pause, Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.code === 'Space' && (e.target === document.body || (e.target as HTMLElement).tagName === 'DIV')) {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, countdown]);

  if (!isOpen) return null;

  const fontClasses = {
    medium: 'text-2xl sm:text-3xl leading-relaxed',
    large: 'text-3xl sm:text-5xl leading-snug',
    xlarge: 'text-4xl sm:text-6xl leading-tight'
  }[fontSize];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-2 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] flex flex-col bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Control Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100">{title}</h3>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  MODO GRABACIÓN
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {words} palabras • ~{estimatedSeconds}s de duración estimada (130 ppm)
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCleanScript}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
              title="Copiar texto limpio para pegar en Edits / CapCut"
            >
              {hasCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">Copiar para Teleprompter</span>
              <span className="sm:hidden">Copiar</span>
            </button>

            <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
              <button
                onClick={() => setFontSize('medium')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${fontSize === 'medium' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                title="Texto Mediano"
              >
                A
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-2 py-1 rounded-lg text-sm font-bold transition-colors ${fontSize === 'large' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                title="Texto Grande"
              >
                A+
              </button>
              <button
                onClick={() => setFontSize('xlarge')}
                className={`px-2 py-1 rounded-lg text-base font-bold transition-colors ${fontSize === 'xlarge' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                title="Texto Extra Grande"
              >
                A++
              </button>
            </div>

            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className={`p-2 rounded-xl border transition-colors ${isMirrored ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
              title="Espejar horizontalmente (para cristal de teleprompter)"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition-colors hidden sm:flex"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700 text-slate-400 rounded-xl transition-colors"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Teleprompter Scrolling Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden flex flex-col justify-center">
          <div className="pointer-events-none absolute inset-x-0 top-1/3 h-24 border-y border-cyan-500/20 bg-cyan-500/5 z-10 flex items-center justify-between px-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/50">Línea de Mirada 👁️</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/50">Línea de Mirada 👁️</span>
          </div>

          {countdown !== null && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
              <span className="text-8xl sm:text-9xl font-black text-cyan-400 animate-ping font-mono">
                {countdown === 0 ? '¡YA!' : countdown}
              </span>
              <p className="text-slate-400 text-sm mt-6 font-semibold">
                Prepará tu postura y mirá a la cámara...
              </p>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-y-auto px-6 sm:px-20 py-32 text-center select-text transition-transform duration-200 ${isMirrored ? 'scale-x-[-1]' : ''}`}
            style={{ scrollBehavior: 'auto' }}
          >
            <div className={`max-w-3xl mx-auto space-y-12 font-medium tracking-wide text-slate-100 ${fontClasses}`}>
              {cleanScript.split('\n\n').filter(Boolean).map((paragraph, idx) => (
                <p key={idx} className="leading-relaxed hover:text-amber-300 transition-colors">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="h-96" />
          </div>
        </div>

        {/* Bottom Playback & Speed Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTogglePlay}
              className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-xl transition-all active:scale-95 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pausar [Espacio]</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Comenzar Grabación</span>
                </>
              )}
            </button>

            <button
              onClick={handleResetScroll}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors border border-slate-700"
              title="Volver al inicio"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-400">Velocidad:</span>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-cyan-300 w-10 text-right">
              {speed}x
            </span>
          </div>

          <div className="text-[11px] text-slate-500 hidden md:block">
            Presioná <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px]">Espacio</kbd> para pausar/reanudar
          </div>
        </div>

      </div>
    </div>
  );
};
