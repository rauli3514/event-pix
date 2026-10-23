import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { checkinDevice, getDeviceCode, setStandalone } from '@/lib/videoBooth/device';

// Equipo sin vincular: muestra su código para darlo de alta en el panel de la
// cabina (Panel → Cabina de video → Equipos → Vincular). También se puede usar sin panel.

export default function PairingScreen({ onSkip }: { onSkip: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const code = getDeviceCode();
  useRemoteFocus(rootRef, [problem]);

  useEffect(() => {
    let alive = true;
    const check = () => checkinDevice()
      .then(() => { if (alive) setProblem(null); })
      .catch(e => { if (alive) setProblem(navigator.onLine === false ? 'Sin conexión a internet.' : (e instanceof Error ? e.message : String(e))); });
    void check();
    const t = window.setInterval(check, 8000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  return (
    <div ref={rootRef} className="relative min-h-screen overflow-hidden text-white">
      <AuroraBackground />
      <div className="relative min-h-screen flex flex-col items-center justify-center gap-10 p-10 text-center">
        <EventPixLogo size={64} subtitle="Video" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="kiosk-glass rounded-[2.5rem] px-14 py-10">
          <p className="text-xl text-white/70 uppercase tracking-[0.3em]">Código de este equipo</p>
          <p className="font-mono text-[clamp(3.5rem,11vw,8rem)] font-black tracking-[0.22em] mt-4 bg-gradient-to-r from-[#ff2e93] via-[#c86bff] to-[#00d4ff] bg-clip-text text-transparent">
            {code}
          </p>
          <p className="text-lg text-white/75 mt-6">
            En el panel entrá a <b className="text-white">Cabina de video → Equipos → Vincular</b><br />y cargá este código.
          </p>
        </motion.div>
        <div className="flex items-center gap-3 text-white/70 text-lg">
          {problem
            ? <><AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" /><span className="max-w-2xl">{problem}</span></>
            : <><Loader2 className="w-6 h-6 animate-spin text-[#00d4ff]" /><span>Esperando que lo vincules…</span></>}
        </div>
        <button data-autofocus onClick={() => { setStandalone(true); onSkip(); }}
          className="kiosk-glass rounded-full px-8 py-4 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
          Usar sin panel
        </button>
      </div>
    </div>
  );
}
