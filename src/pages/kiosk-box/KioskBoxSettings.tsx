import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, FolderOpen, Image as ImageIcon, LayoutGrid, Monitor, Printer, Timer } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import SplashSection from './settings/SplashSection';
import CameraSection from './settings/CameraSection';
import ExperiencesSection from './settings/ExperiencesSection';
import ResultSection from './settings/ResultSection';
import PhotosSection from './settings/PhotosSection';
import PrinterSection from './settings/PrinterSection';
import DeviceSection from './settings/DeviceSection';

// Ajustes del equipo (TV box), detrás del PIN del inicio. Todo se guarda al
// instante en el equipo y el kiosco lo lee al abrirse.

const SECTIONS = [
  { key: 'splash', label: 'Pantalla de inicio', icon: ImageIcon, Component: SplashSection },
  { key: 'camera', label: 'Cámara', icon: Camera, Component: CameraSection },
  { key: 'experiences', label: 'Experiencias y marco', icon: LayoutGrid, Component: ExperiencesSection },
  { key: 'result', label: 'Resultado y tiempos', icon: Timer, Component: ResultSection },
  { key: 'photos', label: 'Fotos y respaldo', icon: FolderOpen, Component: PhotosSection },
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
    <div ref={rootRef} className="relative h-screen flex text-white overflow-hidden">
      <AuroraBackground />
      <aside className="relative w-80 shrink-0 flex flex-col gap-2 p-6 border-r border-white/10 bg-[#07051a]/55">
        <div className="px-2 pb-6"><EventPixLogo size={44} subtitle="Ajustes" /></div>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${s.key === active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_10px_30px_-12px_rgba(255,46,147,0.8)]' : 'hover:bg-white/10 text-white/80'}`}
          >
            <s.icon className="w-6 h-6" /> {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => navigate('/box')}
          className="flex items-center gap-3 rounded-2xl px-4 py-4 text-lg font-semibold bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
          <ArrowLeft className="w-6 h-6" /> Volver al inicio
        </button>
      </aside>

      <main className="relative flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold">{current.label}</h2>
          <current.Component key={current.key} />
        </div>
      </main>
    </div>
  );
}
