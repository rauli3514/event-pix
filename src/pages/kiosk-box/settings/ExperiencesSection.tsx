import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { BUILT_IN_FRAMES, getFrameUrl, getGeneralSettings, saveFrameUrl, saveGeneralSettings } from '@/lib/kioskSettings';
import { buttonClass, Panel, Toggle } from './ui';

const MODES = [
  { key: 'enableSelfie', label: 'Fotos (selfie con marco)', hint: 'Ícono "Fotos" del inicio.' },
  { key: 'enableAI', label: 'Retrato mágico (IA)', hint: 'Estilos de retrato con inteligencia artificial.' },
  { key: 'enableMundial', label: 'Mundial 2026 (IA)', hint: 'Carta de jugador con nombre y posición.' },
  { key: 'enableCaricatura', label: 'Caricatura Mundial (IA)', hint: 'Caricatura con el nombre del invitado.' },
  { key: 'enableFiguritas', label: 'Hacer figurita', hint: 'Figurita del álbum con fondo quitado.' },
] as const;

// Un PNG de marco pesado puede no entrar en el almacenamiento del equipo
const MAX_FRAME_BYTES = 3 * 1024 * 1024;

export default function ExperiencesSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const [frame, setFrame] = useState(getFrameUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const chooseFrame = (url: string | null) => {
    if (saveFrameUrl(url)) setFrame(url);
    else toast.error('No hay espacio para guardar ese marco. Probá con una imagen más liviana.');
  };

  const uploadFrame = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_FRAME_BYTES) {
      toast.error('El marco pesa más de 3 MB. Exportalo más liviano (PNG con transparencia).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => chooseFrame(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isCustom = !!frame && !BUILT_IN_FRAMES.some(f => f.url === frame);

  return (
    <div className="space-y-6">
      <Panel title="Experiencias" description="Las que apagues no aparecen en el kiosco.">
        {MODES.map(m => (
          <Toggle key={m.key} label={m.label} hint={m.hint}
            checked={settings[m.key] !== false}
            onChange={v => setSettings(saveGeneralSettings({ [m.key]: v }))} />
        ))}
      </Panel>

      <Panel title="Marco de las fotos" description="Se pone encima de las fotos de la experiencia Fotos. Usá un PNG con el centro transparente.">
        <div className="grid grid-cols-4 gap-4">
          <FrameOption label="Sin marco" selected={!frame} onClick={() => chooseFrame(null)} />
          {BUILT_IN_FRAMES.map(f => (
            <FrameOption key={f.url} label={f.label} src={f.url} selected={frame === f.url} onClick={() => chooseFrame(f.url)} />
          ))}
          {isCustom && <FrameOption label="Mi marco" src={frame!} selected onClick={() => chooseFrame(frame)} />}
        </div>
        <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={e => uploadFrame(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className={buttonClass}>
          <Upload className="w-5 h-5" /> Subir mi marco (PNG)
        </button>
      </Panel>
    </div>
  );
}

function FrameOption({ label, src, selected, onClick }: { label: string; src?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-2xl overflow-hidden border-4 text-left focus:outline-none focus:ring-4 focus:ring-cyan-400 ${selected ? 'border-violet-500' : 'border-transparent'}`}>
      <div className="aspect-[2/3] bg-[repeating-conic-gradient(#ffffff14_0_25%,transparent_0_50%)] bg-[length:24px_24px] flex items-center justify-center">
        {src ? <img src={src} alt={label} className="w-full h-full object-contain" /> : <span className="text-white/50 text-lg">Ninguno</span>}
      </div>
      <p className="px-3 py-2 bg-black/30 font-semibold">{label}</p>
    </button>
  );
}
