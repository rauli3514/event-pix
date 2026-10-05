import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Film, FolderOpen, Image as ImageIcon, LayoutGrid, Monitor, Printer, Share2, Timer, Wand2 } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import SplashSection from './settings/SplashSection';
import CameraSection from './settings/CameraSection';
import ExperiencesSection from './settings/ExperiencesSection';
import ResultSection from './settings/ResultSection';
import PhotosSection from './settings/PhotosSection';
import BackgroundsSection from './settings/BackgroundsSection';
import ShareSection from './settings/ShareSection';
import FxSection from './settings/FxSection';
import PrinterSection from './settings/PrinterSection';
import DeviceSection from './settings/DeviceSection';

// Ajustes del equipo (TV box), detrás del PIN del inicio. Todo se guarda al
// instante en el equipo y el kiosco lo lee al abrirse.

const SECTIONS = [
  { key: 'splash', label: 'Pantalla de inicio', icon: ImageIcon, Component: SplashSection },
  { key: 'backgrounds', label: 'Fondos animados', icon: Film, Component: BackgroundsSection },
  { key: 'camera', label: 'Cámara', icon: Camera, Component: CameraSection },
  { key: 'experiences', label: 'Experiencias y marco', icon: LayoutGrid, Component: ExperiencesSection },
  { key: 'fx', label: 'Filtros de color', icon: Wand2, Component: FxSection },
  { key: 'result', label: 'Resultado y tiempos', icon: Timer, Component: ResultSection },
  { key: 'photos', label: 'Fotos y respaldo', icon: FolderOpen, Component: PhotosSection },
  { key: 'share', label: 'Compartir y nube', icon: Share2, Component: ShareSection },
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
    <div ref={rootRef} className="relative h-screen flex portrait:flex-col text-white overflow-hidden">
      <AuroraBackground />
      {/* "Volver" arriba y la lista con scroll: con muchas secciones entra en cualquier pantalla.
          Con la pantalla vertical la lista pasa a ser una barra arriba, para dejar ancho al contenido. */}
      <aside className="relative w-80 shrink-0 flex flex-col gap-3 p-5 border-r border-white/10 bg-[#07051a]/55 portrait:w-full portrait:flex-row portrait:flex-wrap portrait:items-center portrait:p-3 portrait:border-r-0 portrait:border-b">
        <div className="px-2 portrait:hidden"><EventPixLogo size={40} subtitle="Ajustes" /></div>
        <button onClick={() => navigate('/box')}
          className="shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-semibold bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
          <ArrowLeft className="w-6 h-6" /> <span className="portrait:hidden">Volver al inicio</span><span className="hidden portrait:inline">Volver</span>
        </button>
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 -mx-1 px-1 py-1 portrait:flex-row portrait:overflow-y-visible portrait:overflow-x-auto portrait:basis-full portrait:mx-0">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg portrait:text-base portrait:py-2.5 font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${s.key === active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_10px_30px_-12px_rgba(255,46,147,0.8)]' : 'hover:bg-white/10 text-white/80'}`}
            >
              <s.icon className="w-6 h-6 shrink-0" /> {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="relative flex-1 min-h-0 overflow-y-auto p-8 portrait:p-5 pb-[calc(2rem+var(--osk-h,0px))]">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold">{current.label}</h2>
          <current.Component key={current.key} />
        </div>
      </main>
    </div>
  );
}
