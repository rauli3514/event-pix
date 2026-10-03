import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { glassStyleOf, isGlassFrame, renderGlassFrame } from '@/lib/glassFrame';
import type { FrameOption } from '@/lib/frameOptions';

// El invitado ve su foto con cada marco habilitado y elige uno. La vista grande es
// la foto final (la misma que se imprime); las miniaturas son livianas.

function Thumb({ photo, option, title, subtitle }: { photo: string; option: FrameOption; title?: string; subtitle?: string }) {
  const [glass, setGlass] = useState<string | null>(null);
  useEffect(() => {
    if (!isGlassFrame(option.url)) return;
    let alive = true;
    renderGlassFrame(photo, { style: glassStyleOf(option.url), title, subtitle, width: 240 })
      .then(src => alive && setGlass(src))
      .catch(() => {});
    return () => { alive = false; };
  }, [photo, option.url, title, subtitle]);

  if (isGlassFrame(option.url)) {
    return glass ? <img src={glass} alt="" className="w-full h-full object-cover" />
      : <div className="w-full h-full flex items-center justify-center bg-white/5"><Loader2 className="w-8 h-8 animate-spin text-white/50" /></div>;
  }
  return (
    <div className="relative w-full h-full bg-black">
      <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {option.url && <img src={option.url} alt="" className="absolute inset-0 w-full h-full" />}
    </div>
  );
}

export default function FrameChooser({ photo, options, merge, title, subtitle, onConfirm }: {
  photo: string;
  options: FrameOption[];
  merge: (photo: string, frame: string | null) => Promise<string>;
  title?: string;
  subtitle?: string;
  onConfirm: (finalImage: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [rendered, setRendered] = useState<{ index: number; src: string } | null>(null);
  const preview = rendered && rendered.index === selected ? rendered.src : null;
  // La función de unir puede cambiar en cada render del kiosco: no debe volver a generar
  const mergeRef = useRef(merge);
  useEffect(() => { mergeRef.current = merge; });

  useEffect(() => {
    let alive = true;
    mergeRef.current(photo, options[selected]?.url ?? null)
      .then(src => alive && setRendered({ index: selected, src }))
      .catch(() => alive && setRendered({ index: selected, src: photo }));
    return () => { alive = false; };
  }, [photo, options, selected]);

  return (
    <div className="kiosk-root text-white">
      <AuroraBackground />
      <div className="relative z-10 h-full flex flex-col items-center gap-[3vmin] p-[4vmin]">
        <h2 className="carlmarx-bold text-[clamp(2rem,6vmin,4rem)] text-center">Elegí tu marco</h2>

        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div className="relative h-full max-w-full aspect-[2/3] rounded-[2vmin] overflow-hidden shadow-[0_3vmin_8vmin_-2vmin_rgba(0,0,0,0.8)] bg-black/40">
            {preview ? (
              <motion.img key={preview} src={preview} alt="Tu foto con el marco" className="w-full h-full object-contain"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-14 h-14 animate-spin text-white/70" /></div>
            )}
          </div>
        </div>

        <div className="w-full flex items-center justify-center gap-[2vmin] overflow-x-auto px-2 py-3">
          {options.map((o, i) => (
            <button key={o.key} onClick={() => setSelected(i)} data-autofocus={i === 0 ? true : undefined}
              className={`shrink-0 flex flex-col items-center gap-2 rounded-[1.6vmin] p-1.5 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] focus:scale-105 transition-transform ${i === selected ? 'bg-gradient-to-br from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10'}`}>
              <div className="w-[11vmin] aspect-[2/3] rounded-[1.2vmin] overflow-hidden">
                <Thumb photo={photo} option={o} title={title} subtitle={subtitle} />
              </div>
              <span className="text-[1.8vmin] font-semibold px-1">{o.label}</span>
            </button>
          ))}
        </div>

        <button onClick={() => preview && onConfirm(preview)} disabled={!preview}
          className="w-full max-w-md py-[2.2vmin] rounded-2xl carlmarx-bold text-white text-[clamp(1.4rem,3.6vmin,2.4rem)] focus:outline-none focus:ring-4 focus:ring-white/80 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#ff2e93,#7b2ff7)', boxShadow: '0 0 40px rgba(255,46,147,0.5)' }}>
          ¡Listo! →
        </button>
      </div>
    </div>
  );
}
