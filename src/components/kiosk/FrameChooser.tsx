import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import { rotateArrowKey } from '@/lib/screenRotation';
import type { FrameOption } from '@/lib/frameOptions';

// El invitado ve su foto con el marco principal y con las flechas (en pantalla o
// del control) va pasando por los otros marcos habilitados. Lo que se ve es la
// foto final, la misma que se imprime. Las demás se preparan en segundo plano.

export default function FrameChooser({ photo, options, initialIndex = 0, merge, onConfirm }: {
  photo: string;
  options: FrameOption[];
  initialIndex?: number;
  merge: (photo: string, frame: string | null) => Promise<string>;
  onConfirm: (finalImage: string) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(1);
  const [rendered, setRendered] = useState<Record<number, string>>({});
  const preview = rendered[index] ?? null;
  // La función de unir puede cambiar en cada render del kiosco: no debe volver a generar
  const mergeRef = useRef(merge);
  useEffect(() => { mergeRef.current = merge; });

  // Primero el marco que se está mirando, después los vecinos
  useEffect(() => {
    let alive = true;
    const order = [index, (index + 1) % options.length, (index - 1 + options.length) % options.length];
    (async () => {
      for (const i of order) {
        if (!alive) return;
        if (rendered[i]) continue;
        let src: string;
        try {
          src = await mergeRef.current(photo, options[i]?.url ?? null);
        } catch {
          src = photo;
        }
        if (!alive) return;
        setRendered(prev => ({ ...prev, [i]: src }));
      }
    })();
    return () => { alive = false; };
  }, [photo, options, index, rendered]);

  const move = (delta: number) => {
    setDirection(delta);
    setIndex(i => (i + delta + options.length) % options.length);
  };

  // Flechas del control remoto: izquierda/derecha cambian el marco
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = rotateArrowKey(e.key);
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        e.stopImmediatePropagation();
        move(key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const arrow = 'absolute top-1/2 -translate-y-1/2 z-20 w-[9vmin] h-[9vmin] rounded-full kiosk-glass flex items-center justify-center text-white hover:scale-110 transition-transform focus:outline-none';

  return (
    <div className="kiosk-root text-white">
      <ScreenBackground screen="reveal" />
      <div className="relative z-10 h-full flex flex-col items-center gap-[2.5vmin] p-[4vmin]">
        <h2 className="carlmarx-bold text-[clamp(2rem,6vmin,4rem)] text-center">Elegí tu marco</h2>

        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div className="relative h-full max-w-full aspect-[2/3]">
            <div className="absolute inset-0 rounded-[2vmin] overflow-hidden shadow-[0_3vmin_8vmin_-2vmin_rgba(0,0,0,0.8)] bg-black/40">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                {preview ? (
                  <motion.img key={`${index}`} src={preview} alt="Tu foto con el marco" className="absolute inset-0 w-full h-full object-contain"
                    custom={direction}
                    initial={{ x: `${direction * 60}%`, opacity: 0, rotate: direction * 6 }}
                    animate={{ x: 0, opacity: 1, rotate: 0 }}
                    exit={{ x: `${-direction * 60}%`, opacity: 0, rotate: -direction * 6 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 26 }} />
                ) : (
                  <motion.div key="loading" className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 className="w-14 h-14 animate-spin text-white/70" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {options.length > 1 && (
              <>
                <button tabIndex={-1} onClick={() => move(-1)} className={`${arrow} -left-[11vmin]`} aria-label="Marco anterior">
                  <ChevronLeft className="w-[6vmin] h-[6vmin]" />
                </button>
                <button tabIndex={-1} onClick={() => move(1)} className={`${arrow} -right-[11vmin]`} aria-label="Marco siguiente">
                  <ChevronRight className="w-[6vmin] h-[6vmin]" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-[1.4vmin]">
          {options.map((o, i) => (
            <span key={o.key} className={`h-[1.4vmin] rounded-full transition-all ${i === index ? 'w-[5vmin] bg-white' : 'w-[1.4vmin] bg-white/35'}`} />
          ))}
        </div>

        <button data-autofocus onClick={() => preview && onConfirm(preview)} disabled={!preview}
          className="w-full max-w-md py-[2.2vmin] rounded-2xl carlmarx-bold text-white text-[clamp(1.4rem,3.6vmin,2.4rem)] focus:outline-none focus:ring-4 focus:ring-white/80 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#ff2e93,#7b2ff7)', boxShadow: '0 0 40px rgba(255,46,147,0.5)' }}>
          ¡Listo! →
        </button>
      </div>
    </div>
  );
}
