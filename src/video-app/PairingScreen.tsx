import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Link2, Loader2, Play } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { checkinDevice, getDeviceCode, isLicensed, LICENSE_EVENT, setStandalone, wantsPairing } from '@/lib/videoBooth/device';

// Primera vez que se abre la app: bienvenida con "Empezar" (se usa sola, en demo
// hasta que se active la licencia) o "Vincular a un panel", que muestra el código
// para darlo de alta en Cabina de video → Equipos → Vincular (equipos de EventPix).

export default function PairingScreen({ onSkip }: { onSkip: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'welcome' | 'code'>(() => (wantsPairing() ? 'code' : 'welcome'));
  const [problem, setProblem] = useState<string | null>(null);
  const [licensed, setLicensed] = useState(isLicensed);
  const code = getDeviceCode();
  useRemoteFocus(rootRef, [problem, view]);

  // Aviso al servidor: el equipo queda registrado (aparece como demo en el panel)
  useEffect(() => {
    let alive = true;
    const check = () => checkinDevice()
      .then(() => { if (alive) setProblem(null); })
      .catch(e => { if (alive) setProblem(navigator.onLine === false ? 'Sin conexión a internet.' : (e instanceof Error ? e.message : String(e))); });
    void check();
    const t = window.setInterval(check, 8000);
    const onLicense = () => setLicensed(isLicensed());
    window.addEventListener(LICENSE_EVENT, onLicense);
    return () => { alive = false; window.clearInterval(t); window.removeEventListener(LICENSE_EVENT, onLicense); };
  }, []);

  const start = () => { setStandalone(true); onSkip(); };

  if (view === 'welcome') {
    return (
      <div ref={rootRef} className="relative min-h-screen overflow-hidden text-white">
        <AuroraBackground />
        <div className="relative min-h-screen flex flex-col items-center justify-center gap-10 p-10 text-center">
          <EventPixLogo size={72} subtitle="Video" />
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-2xl">
            <h1 className="text-[clamp(2.2rem,6vw,4rem)] font-black leading-tight">¡Bienvenido a EventPix Video!</h1>
            <p className="text-xl text-white/75">Cabina de video 360, boomerang, cámara lenta, libro de firmas y más.</p>
          </motion.div>
          <motion.button data-autofocus onClick={start} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }}
            className="flex items-center gap-4 rounded-full px-16 py-7 text-3xl font-black bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_0_60px_rgba(255,46,147,0.45)] focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
            <Play className="w-9 h-9 fill-current" /> Empezar
          </motion.button>
          {!licensed && (
            <p className="max-w-xl text-white/60 text-base">
              Podés probar todas las funciones. Los videos salen con la marca <b className="text-amber-200">DEMO</b> hasta
              que actives la licencia (Ajustes → Equipo → Licencia).
            </p>
          )}
          <button onClick={() => setView('code')}
            className="flex items-center gap-2 rounded-full px-6 py-3 text-base text-white/60 hover:text-white focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
            <Link2 className="w-5 h-5" /> Vincular a un panel
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-wrap justify-center gap-4">
          <button data-autofocus onClick={() => setView('welcome')}
            className="kiosk-glass flex items-center gap-2 rounded-full px-8 py-4 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
            <ArrowLeft className="w-5 h-5" /> Volver
          </button>
          <button onClick={start}
            className="kiosk-glass rounded-full px-8 py-4 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
            Usar sin panel
          </button>
        </div>
      </div>
    </div>
  );
}
