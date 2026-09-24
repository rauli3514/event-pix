import { useEffect, useState } from 'react';
import { X, Loader2, Zap, Clock, Type, Video, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '../../lib/apiAuth';
import { BrandDNA } from '../../types/intelligence';
import { GenerateSpokenScriptResponse, SpokenReelScript, WinningTopicInput } from '../../types/spokenReel';

interface SpokenReelGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  brandDna: BrandDNA;
  topic: WinningTopicInput | null;
}

/**
 * Motor 2 (Spoken Content Engine): genera un guion hablado Hook-Retain-Sell
 * a partir del Brand DNA del negocio y el tema ganador seleccionado (un Reel
 * propio, de un competidor, o el Brand DNA a secas). Muestra el resultado en
 * modo "tarjeta para el creador" con cronómetro estimado y modo teleprompter.
 */
export function SpokenReelGeneratorModal({ isOpen, onClose, businessId, brandDna, topic }: SpokenReelGeneratorModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [script, setScript] = useState<SpokenReelScript | null>(null);
  const [provider, setProvider] = useState<'claude' | 'openai' | null>(null);
  const [selectedHookIdx, setSelectedHookIdx] = useState(0);
  const [isTeleprompter, setIsTeleprompter] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!topic) return;
    setIsLoading(true);
    setScript(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/reels/generate-spoken-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ businessId, topic, brandDna }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'No se pudo generar el guion.');
        return;
      }
      const result = data as GenerateSpokenScriptResponse;
      setScript(result.script);
      setProvider(result.provider);
      setSelectedHookIdx(0);
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al generar el guion.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && topic) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, topic]);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    if (!script) return;
    const fullText = [
      `[GANCHO] ${script.hooks[selectedHookIdx]}`,
      `[ACCIÓN VISUAL] ${script.visual_hook}`,
      `[PROBLEMA] ${script.problem_agitation}`,
      `[SOLUCIÓN] ${script.solution_demo}`,
      `[CTA] ${script.cta}`,
    ].join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success('Guion copiado al portapapeles.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-100">Reel Hablado (Hook → Retain → Sell)</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              <p className="text-sm">Escribiendo el guion con {provider === 'openai' ? 'GPT-4o' : 'Claude'}...</p>
            </div>
          )}

          {!isLoading && !script && (
            <div className="text-center py-10 text-sm text-slate-400">
              No se pudo generar el guion todavía.
              <button
                onClick={generate}
                className="mt-3 mx-auto flex items-center gap-1.5 text-violet-400 hover:text-violet-300 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
            </div>
          )}

          {!isLoading && script && (
            <>
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" /> ~{script.estimated_seconds}s
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-emerald-400" /> {script.word_count} palabras
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsTeleprompter((v) => !v)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    {isTeleprompter ? 'Vista normal' : 'Modo Teleprompter'}
                  </button>
                  <button
                    onClick={handleCopyScript}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copiar
                  </button>
                </div>
              </div>

              {isTeleprompter ? (
                <div className="bg-black rounded-xl p-6 text-center space-y-6 leading-relaxed">
                  <p className="text-2xl font-bold text-amber-300">{script.hooks[selectedHookIdx]}</p>
                  <p className="text-lg text-slate-200">{script.problem_agitation}</p>
                  <p className="text-lg text-slate-200">{script.solution_demo}</p>
                  <p className="text-xl font-bold text-emerald-400">{script.cta}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-2">
                      Gancho verbal (0-3s) — elegí la variante a testear
                    </h3>
                    <div className="space-y-1.5">
                      {script.hooks.map((hook, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedHookIdx(idx)}
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                            selectedHookIdx === idx
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {hook}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-violet-400 mb-1.5 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" /> Gancho visual / acción
                    </h3>
                    <p className="text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      {script.visual_hook}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-rose-400 mb-1.5">
                      Problema / Agitación (3-15s)
                    </h3>
                    <p className="text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      {script.problem_agitation}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-cyan-400 mb-1.5">
                      Solución / Demostración (15-45s)
                    </h3>
                    <p className="text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      {script.solution_demo}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-1.5">
                      Llamado a la Acción (CTA final)
                    </h3>
                    <p className="text-sm font-semibold text-slate-100 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                      {script.cta}
                    </p>
                  </section>

                  {script.on_screen_text.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                        Texto en pantalla
                      </h3>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        {script.on_screen_text.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </section>
                  )}

                  {script.b_roll_suggestions.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                        B-roll sugerido
                      </h3>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        {script.b_roll_suggestions.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
