import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { rotateArrowKey } from '@/lib/screenRotation';

// Filtros de color en vivo: flechas grandes a los costados de la cámara y el nombre
// del filtro arriba. También con las flechas del control remoto (izquierda/derecha)
// y deslizando el dedo sobre la pantalla. Abajo solo queda el botón de sacar la foto.

export default function FilterCarousel({ filters, value, onChange }: {
  filters: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, filters.findIndex(f => f.value === value));
  const go = (delta: number) => onChange(filters[(index + delta + filters.length) % filters.length].value);
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; });

  // Control remoto: izquierda/derecha cambian el filtro (antes que la navegación de foco)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = rotateArrowKey(e.key);
      if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      goRef.current(key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Deslizar el dedo sobre la cámara
  const touchX = useRef<number | null>(null);
  const arrow = 'absolute top-1/2 -translate-y-1/2 z-20 w-[11vmin] h-[11vmin] rounded-full bg-black/45 backdrop-blur border-2 border-white/40 text-white flex items-center justify-center hover:bg-black/65 active:scale-90 transition-transform focus:outline-none';

  if (filters.length < 2) return null;
  const current = filters[index];

  return (
    <>
      <div className="absolute inset-0 z-10"
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }} />

      <button onClick={() => go(-1)} tabIndex={-1} className={`${arrow} left-[3vmin]`} aria-label="Filtro anterior">
        <ChevronLeft className="w-[7vmin] h-[7vmin]" />
      </button>
      <button onClick={() => go(1)} tabIndex={-1} className={`${arrow} right-[3vmin]`} aria-label="Filtro siguiente">
        <ChevronRight className="w-[7vmin] h-[7vmin]" />
      </button>

      {/* Nombre del filtro y puntitos de posición */}
      <div className="absolute top-[13vmin] inset-x-0 z-20 flex flex-col items-center gap-[1.4vmin] pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.span key={current.value}
            initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="px-[3.5vmin] py-[1.2vmin] rounded-full bg-black/50 backdrop-blur border border-white/25 carlmarx-bold text-white text-[clamp(1.4rem,3.6vmin,2.6rem)]">
            {current.label}
          </motion.span>
        </AnimatePresence>
        <div className="flex gap-[1vmin]">
          {filters.map(f => (
            <span key={f.value} className={`h-[1.2vmin] rounded-full transition-all ${f.value === current.value ? 'w-[4vmin] bg-white' : 'w-[1.2vmin] bg-white/45'}`} />
          ))}
        </div>
      </div>
    </>
  );
}
