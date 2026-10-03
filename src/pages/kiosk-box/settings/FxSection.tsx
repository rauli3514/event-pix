import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, ImagePlus, Play, Square, Trash2 } from 'lucide-react';
import { getCameraSettings, getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { openCameraStream, stopStream } from '@/lib/kioskCamera';
import { saveScreenMedia, removeScreenMedia } from '@/lib/kioskMedia';
import {
  ANCHORS, BUILT_IN_ACCESSORIES, COLOR_FILTERS, detectFacesInVideo, drawAccessory, filterCss, loadCustomAccessory,
  type Anchor, type CustomAccessory,
} from '@/lib/faceFx';
import { buttonClass, Choice, Field, inputClass, Panel, primaryClass, Toggle } from './ui';

// Filtros de color y accesorios que siguen la cara (sin internet).
export default function FxSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const filters = settings.filters ?? COLOR_FILTERS.map(f => f.value);
  const customs = (settings.customAccessories ?? []) as CustomAccessory[];
  const accessories = settings.accessories ?? [...BUILT_IN_ACCESSORIES.map(a => a.value), ...customs.map(c => `custom:${c.id}`)];

  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const chip = (on: boolean) => `flex items-center gap-2 rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${on ? 'bg-gradient-to-r from-[#ff2e93]/80 to-[#7b2ff7]/80' : 'bg-black/20 border border-white/10 hover:bg-white/10'}`;

  // ─── Subir accesorio propio ───
  const fileRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [newAnchor, setNewAnchor] = useState<Anchor>('head');
  const upload = async (file?: File) => {
    if (!file) return;
    const id = Date.now().toString(36);
    try {
      await saveScreenMedia(`acc:${id}`, file);
      const list = [...customs, { id, name: newName.trim() || file.name.replace(/\.\w+$/, ''), anchor: newAnchor, scale: 1 }];
      update({ customAccessories: list, accessories: [...accessories, `custom:${id}`] });
      setNewName('');
      toast.success('Accesorio cargado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };
  const removeCustom = async (id: string) => {
    await removeScreenMedia(`acc:${id}`);
    update({ customAccessories: customs.filter(c => c.id !== id), accessories: accessories.filter(a => a !== `custom:${id}`) });
  };
  const setScale = (id: string, scale: number) => update({ customAccessories: customs.map(c => (c.id === id ? { ...c, scale } : c)) });

  return (
    <div className="space-y-6">
      <Panel title="Filtros de color" description="Después de sacarse la foto, el invitado elige un filtro (Fotos y Portada Fashion). No necesitan internet.">
        <Toggle label="Ofrecer filtros de color" checked={!!settings.enableFilters} onChange={enableFilters => update({ enableFilters })} />
        {settings.enableFilters && (
          <div className="flex flex-wrap gap-3">
            {COLOR_FILTERS.filter(f => f.value !== 'none').map(f => (
              <button key={f.value} onClick={() => update({ filters: toggleIn(filters, f.value) })} className={chip(filters.includes(f.value))}>
                {filters.includes(f.value) && <Check className="w-5 h-5" />}
                <span className="w-8 h-8 rounded-lg bg-[url('/ai-themes/polaroid-party.jpg')] bg-cover" style={{ filter: f.css }} />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Accesorios que siguen la cara" description="Anteojos, coronas, orejas… se ubican solos sobre cada cara de la foto. Funciona sin internet.">
        <Toggle label="Ofrecer accesorios" checked={!!settings.enableAccessories} onChange={enableAccessories => update({ enableAccessories })} />
        {settings.enableAccessories && (
          <>
            <div className="flex flex-wrap gap-3">
              {BUILT_IN_ACCESSORIES.map(a => (
                <button key={a.value} onClick={() => update({ accessories: toggleIn(accessories, a.value) })} className={chip(accessories.includes(a.value))}>
                  {accessories.includes(a.value) && <Check className="w-5 h-5" />} {a.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-black/20 border border-white/10 p-5 space-y-4">
              <p className="font-bold">Mis accesorios (PNG con fondo transparente)</p>
              {customs.map(c => (
                <div key={c.id} className="flex flex-wrap items-center gap-3">
                  <button onClick={() => update({ accessories: toggleIn(accessories, `custom:${c.id}`) })} className={chip(accessories.includes(`custom:${c.id}`))}>
                    {accessories.includes(`custom:${c.id}`) && <Check className="w-5 h-5" />} {c.name}
                  </button>
                  <span className="text-white/60">{ANCHORS.find(a => a.value === c.anchor)?.label}</span>
                  <Choice label="" value={c.scale}
                    options={[0.8, 1, 1.2, 1.5].map(v => ({ value: v, label: v === 1 ? 'Normal' : v < 1 ? 'Más chico' : v === 1.2 ? 'Más grande' : 'Muy grande' }))}
                    onChange={v => setScale(c.id, v)} />
                  <button onClick={() => removeCustom(c.id)} className={buttonClass} aria-label="Borrar"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre">
                  <input className={inputClass} placeholder="Ej: Anteojos de corazón" value={newName} onChange={e => setNewName(e.target.value)} />
                </Field>
                <Choice label="Dónde va" value={newAnchor} options={ANCHORS} onChange={setNewAnchor} />
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/webp" className="hidden" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              <button onClick={() => fileRef.current?.click()} className={buttonClass}><ImagePlus className="w-5 h-5" /> Subir PNG</button>
              <p className="text-white/50 text-sm">
                Anteojos o antifaz: el PNG centrado en los ojos, de ancho ~2,5 veces la distancia entre ojos. Sombreros, coronas u orejas: la base del dibujo
                apoya en la frente. Bigote o labios: centrado en la boca. Usá imágenes recortadas sin bordes vacíos (por ejemplo, de Canva).
              </p>
            </div>
          </>
        )}
      </Panel>

      {settings.enableAccessories && <LiveTest accessories={accessories} customs={customs} filters={settings.enableFilters ? filters : []} />}
    </div>
  );
}

/** Prueba en vivo: cámara + accesorio + cuadros por segundo, para ver si el equipo da. */
function LiveTest({ accessories, customs, filters }: { accessories: string[]; customs: CustomAccessory[]; filters: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [acc, setAcc] = useState(accessories[0] ?? 'glasses');
  const [filter, setFilter] = useState('none');
  const accRef = useRef(acc);
  useEffect(() => { accRef.current = acc; }, [acc]);

  useEffect(() => {
    if (!running) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    let frames = 0;
    let since = performance.now();
    const cam = getCameraSettings();
    (async () => {
      try {
        stream = await openCameraStream(cam.deviceId);
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const loop = async () => {
          if (!alive) return;
          const canvas = canvasRef.current!;
          if (video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const faces = await detectFacesInVideo(video, performance.now());
            const custom = await loadCustomAccessory(accRef.current);
            for (const f of faces) drawAccessory(ctx, f, accRef.current, custom);
            frames++;
            const now = performance.now();
            if (now - since > 1000) {
              setFps(Math.round((frames * 1000) / (now - since)));
              frames = 0;
              since = now;
            }
          }
          raf = requestAnimationFrame(() => void loop());
        };
        void loop();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo abrir la cámara');
        setRunning(false);
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stopStream(stream);
    };
  }, [running]);

  const options = [...BUILT_IN_ACCESSORIES.filter(a => accessories.includes(a.value)), ...customs.filter(c => accessories.includes(`custom:${c.id}`)).map(c => ({ value: `custom:${c.id}`, label: c.name }))];
  const cam = getCameraSettings();

  return (
    <Panel title="Probar en vivo" description="Muestra la cámara con el accesorio encima y cuántos cuadros por segundo da el equipo. Con 10 o más se ve bien; en la foto final siempre queda bien ubicado.">
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setRunning(r => !r)} className={running ? buttonClass : primaryClass}>
          {running ? <><Square className="w-5 h-5" /> Detener</> : <><Play className="w-5 h-5" /> Probar</>}
        </button>
        <Choice label="" value={acc} options={options} onChange={setAcc} />
      </div>
      {filters.length > 0 && (
        <Choice label="Filtro" value={filter} options={COLOR_FILTERS.filter(f => f.value === 'none' || filters.includes(f.value)).map(f => ({ value: f.value, label: f.label }))} onChange={setFilter} />
      )}
      {running && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
          <div className="absolute inset-0" style={{ transform: `scaleX(${cam.mirror ? -1 : 1})`, filter: filterCss(filter) }}>
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-contain" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
          </div>
          <span className={`absolute top-3 left-3 rounded-full px-4 py-1.5 font-bold ${fps >= 10 ? 'bg-emerald-500' : fps >= 6 ? 'bg-amber-500' : 'bg-red-500'}`}>{fps} cuadros/s</span>
        </div>
      )}
    </Panel>
  );
}
