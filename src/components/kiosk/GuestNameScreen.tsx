import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';
import ScreenBackground from '@/components/kiosk/ScreenBackground';

// El invitado escribe su nombre (o los nombres del grupo) para que vaya en la
// foto. Teclado en pantalla para la tele táctil o el control remoto; también
// sirve un teclado USB. Se puede saltear.

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '&', '♥'],
];
const MAX = 28;

// Mayúscula en cada nombre, pero "y" / "e" quedan en minúscula (Sofi y Juan)
const capitalize = (s: string) => s.toLowerCase().replace(/(^|\s|&)\S/g, c => c.toUpperCase()).replace(/ ([YE])(?= |$)/g, (_, c: string) => ` ${c.toLowerCase()}`);

export default function GuestNameScreen({ photo, onDone }: { photo?: string | null; onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  const doneRef = useRef(false);
  const finish = (value: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(capitalize(value.trim()));
  };
  const add = (ch: string) => setName(n => (n + ch).slice(0, MAX));

  // Teclado físico (USB)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[\p{L}\d &♥.'-]/u.test(e.key)) { add(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { setName(n => n.slice(0, -1)); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const key = 'h-[8.5vmin] min-w-[8.5vmin] px-[1.5vmin] rounded-[1.6vmin] bg-white/12 border border-white/15 carlmarx-bold text-[3.6vmin] hover:bg-white/25 focus:bg-white/30 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] active:scale-95 transition-transform';

  return (
    <div className="kiosk-root text-white">
      <ScreenBackground screen="reveal" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center portrait:justify-start portrait:pt-[10vh] gap-[3vmin] p-[4vmin]">
        <div className="flex items-center gap-[4vmin]">
          {photo && (
            <motion.img src={photo} alt="" className="h-[22vmin] rounded-[1.6vmin] shadow-2xl border-[0.5vmin] border-white"
              initial={{ rotate: -8, scale: 0.8, opacity: 0 }} animate={{ rotate: -4, scale: 1, opacity: 1 }} />
          )}
          <div className="text-center">
            <h2 className="carlmarx-bold text-[clamp(2rem,7vmin,4.5rem)] leading-tight">¿Cómo te llamás?</h2>
            <p className="text-white/70 text-[2.6vmin]">Tu nombre va a quedar en la foto</p>
          </div>
        </div>

        <div className="min-w-[60vmin] max-w-[90vw] rounded-[2vmin] bg-black/40 border-[0.4vmin] border-white/40 px-[4vmin] py-[2vmin] text-center carlmarx-bold text-[6vmin] min-h-[11vmin]">
          {name ? capitalize(name) : <span className="text-white/35">Ej: Sofi y Juan</span>}
          <span className="inline-block w-[0.5vmin] h-[5vmin] bg-white/80 ml-1 align-middle animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-[1.2vmin]">
          {ROWS.map((row, i) => (
            <div key={i} className="flex gap-[1.2vmin]">
              {row.map(ch => (
                <button key={ch} onClick={() => add(ch)} className={key} data-autofocus={ch === 'Q' ? true : undefined}>{ch}</button>
              ))}
            </div>
          ))}
          <div className="flex gap-[1.2vmin]">
            <button onClick={() => setName(n => n.slice(0, -1))} className={`${key} flex items-center justify-center`} aria-label="Borrar">
              <Delete className="w-[4vmin] h-[4vmin]" />
            </button>
            <button onClick={() => add(' ')} className={`${key} w-[46vmin]`}>espacio</button>
          </div>
        </div>

        <div className="flex gap-[3vmin]">
          <button onClick={() => finish('')}
            className="px-[5vmin] py-[2vmin] rounded-full border-[0.3vmin] border-white/40 bg-black/40 carlmarx-bold text-[3.2vmin] focus:outline-none focus:ring-4 focus:ring-white/80">
            Saltar
          </button>
          <button onClick={() => finish(name)} disabled={!name.trim()}
            className="px-[7vmin] py-[2vmin] rounded-full carlmarx-bold text-[3.2vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_1.5vmin_4vmin_-1vmin_rgba(255,46,147,0.7)] disabled:opacity-40 focus:outline-none focus:ring-4 focus:ring-white/80">
            ¡Listo! →
          </button>
        </div>
      </div>
    </div>
  );
}
