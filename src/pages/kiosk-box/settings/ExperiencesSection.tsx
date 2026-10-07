import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Upload } from 'lucide-react';
import { BUILT_IN_FRAMES, getFrameUrl, getGeneralSettings, saveFrameUrl, saveGeneralSettings } from '@/lib/kioskSettings';
import { GLASS_PREFIX, GLASS_STYLES, renderGlassFrame, type GlassStyle } from '@/lib/glassFrame';
import { allFrameOptions, isCustomFrame } from '@/lib/frameOptions';
import { buttonClass, Field, inputClass, Panel, Toggle } from './ui';
import PhotoLayoutPanel from './PhotoLayoutPanel';
import CoverPanel from './CoverPanel';
import TriviaPanel from './TriviaPanel';

const MODES = [
  { key: 'enableSelfie', label: 'Fotos (selfie con marco)', hint: 'Ícono "Fotos" del inicio.' },
  { key: 'enableAI', label: 'Retrato mágico (IA)', hint: 'Estilos de retrato con inteligencia artificial.' },
  { key: 'enablePortadaAI', label: 'Portada Fashion IA', hint: 'La IA viste de modelo y sale la tapa de revista con el nombre.' },
  { key: 'enableCaricatura', label: 'Caricatura con Messi (IA)', hint: 'Caricatura del invitado festejando con Messi.' },
  { key: 'enableFiguritas', label: 'Figurita Mundial 2026', hint: 'Figurita del álbum con la cara del invitado, su país, posición y datos.' },
] as const satisfies readonly { key: string; label: string; hint: string; off?: boolean }[];

// Un PNG de marco pesado puede no entrar en el almacenamiento del equipo
const MAX_FRAME_BYTES = 3 * 1024 * 1024;
const SAMPLE_PHOTO = '/ai-themes/polaroid-party.jpg';

export default function ExperiencesSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const [frame, setFrame] = useState(getFrameUrl);
  const [previews, setPreviews] = useState<Partial<Record<GlassStyle, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  // El marco lleva siempre el nombre del evento de "Pantalla de inicio"
  const title = settings.eventTitle || '';
  const subtitle = settings.frameSubtitle || '';

  // Vistas previas de los marcos de vidrio con los textos actuales (chicas, para la TV box)
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      for (const s of GLASS_STYLES) {
        try {
          const url = await renderGlassFrame(SAMPLE_PHOTO, { style: s.value, title, subtitle, width: 360 });
          if (!cancelled) setPreviews(prev => ({ ...prev, [s.value]: url }));
        } catch {
          // sin vista previa para ese estilo
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [title, subtitle]);

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

  const isCustom = isCustomFrame(frame);

  return (
    <div className="space-y-6">
      <Panel title="Experiencias" description="Las que apagues no aparecen en el kiosco.">
        {MODES.map(m => (
          <Toggle key={m.key} label={m.label} hint={m.hint}
            checked={'off' in m ? settings[m.key] === true : settings[m.key] !== false}
            onChange={v => setSettings(saveGeneralSettings({ [m.key]: v }))} />
        ))}
        <Toggle label="Juego de 1 minuto antes de la foto (Fotos)" hint="Un juego al azar (tateti, pelotita, piedra papel o tijera, memotest, reflejos, Simón dice, trivia) y después la foto. En Fotos IA siempre hay juego mientras la IA trabaja."
          checked={settings.photoGame === true} onChange={photoGame => setSettings(saveGeneralSettings({ photoGame }))} />
      </Panel>

      <TriviaPanel />

      <CoverPanel />

      <PhotoLayoutPanel />

      <Panel title="Marco Liquid Glass" description="Se genera sobre cada foto: el borde es la misma foto como vidrio esmerilado, con el nombre del evento abajo.">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-white/70">Nombre del evento</span>
            <p className="rounded-2xl bg-black/20 border border-white/10 px-5 py-4 text-lg">
              {title || <span className="text-amber-300">Cargalo en Pantalla de inicio</span>}
            </p>
          </div>
          <Field label="Texto chico (opcional)">
            <input className={inputClass} placeholder="Ej: 12 · 10 · 2026" value={settings.frameSubtitle || ''}
              onChange={e => setSettings(saveGeneralSettings({ frameSubtitle: e.target.value }))} />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {GLASS_STYLES.map(s => (
            <FrameOption key={s.value} label={s.label} src={previews[s.value]} loading={!previews[s.value]}
              selected={frame === `${GLASS_PREFIX}${s.value}`} onClick={() => chooseFrame(`${GLASS_PREFIX}${s.value}`)} />
          ))}
        </div>
      </Panel>

      <Panel title="El invitado elige el marco" description="Después de la foto, el invitado ve su foto con cada marco habilitado y elige. El marco elegido arriba es el que aparece primero.">
        <Toggle label="Dejar que el invitado elija el marco" hint="Si está apagado, se usa siempre el marco elegido."
          checked={!!settings.guestFrameChoice} onChange={guestFrameChoice => setSettings(saveGeneralSettings({ guestFrameChoice }))} />
        {settings.guestFrameChoice && (
          <p className="text-white/70">
            Arranca con: <b className="text-white">{allFrameOptions().find(o => o.url === frame)?.label ?? 'Sin marco'}</b>
            <span className="text-white/50"> (el marco elegido en "Marco Liquid Glass" u "Otros marcos")</span>
          </p>
        )}
        {settings.guestFrameChoice && (
          <div className="grid grid-cols-3 gap-3">
            {allFrameOptions().map(o => {
              const enabled = (settings.guestFrames ?? []).includes(o.key);
              const toggle = () => {
                const list = new Set(settings.guestFrames ?? []);
                if (enabled) list.delete(o.key); else list.add(o.key);
                setSettings(saveGeneralSettings({ guestFrames: [...list] }));
              };
              return (
                <button key={o.key} onClick={toggle}
                  className={`flex items-center gap-3 rounded-2xl px-5 py-4 text-left text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${enabled ? 'bg-gradient-to-r from-[#ff2e93]/80 to-[#7b2ff7]/80' : 'bg-black/20 border border-white/10 hover:bg-white/10'}`}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${enabled ? 'bg-white text-[#7b2ff7]' : 'bg-white/10'}`}>
                    {enabled && <Check className="w-5 h-5" strokeWidth={3} />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Otros marcos" description="Marcos de imagen (PNG con el centro transparente).">
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

function FrameOption({ label, src, selected, loading, onClick }: {
  label: string;
  src?: string;
  selected: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`rounded-2xl overflow-hidden border-4 text-left transition-transform focus:outline-none focus:ring-4 focus:ring-[#00d4ff] focus:scale-[1.03] ${selected ? 'border-[#ff2e93]' : 'border-transparent'}`}>
      <div className="aspect-[2/3] bg-[repeating-conic-gradient(#ffffff14_0_25%,transparent_0_50%)] bg-[length:24px_24px] flex items-center justify-center">
        {src ? <img src={src} alt={label} className="w-full h-full object-contain" />
          : <span className="text-white/50 text-lg">{loading ? 'Generando…' : 'Ninguno'}</span>}
      </div>
      <p className="px-3 py-2 bg-black/30 font-semibold">{label}{selected ? '  ✓' : ''}</p>
    </button>
  );
}
