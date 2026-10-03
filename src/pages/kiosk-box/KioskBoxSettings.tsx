import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image as ImageIcon, LayoutGrid, Monitor, Printer, Timer } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import SplashSection from './settings/SplashSection';
import CameraSection from './settings/CameraSection';
import ExperiencesSection from './settings/ExperiencesSection';
import ResultSection from './settings/ResultSection';
import PrinterSection from './settings/PrinterSection';
import DeviceSection from './settings/DeviceSection';

// Ajustes del equipo (TV box), detrás del PIN del inicio. Todo se guarda al
// instante en el equipo y el kiosco lo lee al abrirse.

const SECTIONS = [
  { key: 'splash', label: 'Pantalla de inicio', icon: ImageIcon, Component: SplashSection },
  { key: 'camera', label: 'Cámara', icon: Camera, Component: CameraSection },
  { key: 'experiences', label: 'Experiencias y marco', icon: LayoutGrid, Component: ExperiencesSection },
  { key: 'result', label: 'Resultado y tiempos', icon: Timer, Component: ResultSection },
  { key: 'printer', label: 'Impresora', icon: Printer, Component: PrinterSection },
  { key: 'device', label: 'Equipo', icon: Monitor, Component: DeviceSection },
] as const;

export default function KioskBoxSettings() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<(typeof SECTIONS)[number]['key']>('camera');
  useRemoteFocus(rootRef, [active]);

  const current = SECTIONS.find(s => s.key === active) ?? SECTIONS[0];

  return (
    <div ref={rootRef} className="h-screen flex bg-gradient-to-br from-[#0b1026] via-[#151a4a] to-[#3b0f5c] text-white">
      <aside className="w-80 shrink-0 flex flex-col gap-2 p-6 border-r border-white/10 bg-black/20">
        <h1 className="text-2xl font-bold px-3 pb-4">Ajustes</h1>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-cyan-400 ${s.key === active ? 'bg-violet-600' : 'hover:bg-white/10 text-white/80'}`}
          >
            <s.icon className="w-6 h-6" /> {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => navigate('/box')}
          className="flex items-center gap-3 rounded-2xl px-4 py-4 text-lg font-semibold bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-cyan-400">
          <ArrowLeft className="w-6 h-6" /> Volver al inicio
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold">{current.label}</h2>
          <current.Component key={current.key} />
        </div>
      </main>
    </div>
  );
}
