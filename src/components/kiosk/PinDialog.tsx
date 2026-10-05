import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { EventPixMark } from '@/components/kiosk/brand/EventPixLogo';
import { getBoxPin } from '@/lib/kioskDevice';

// Teclado de clave (Ajustes y desbloqueo de secciones), manejable con el control remoto.

export default function PinDialog({ onCancel, onSuccess, title = 'Clave de ajustes' }: { onCancel: () => void; onSuccess: () => void; title?: string }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  useRemoteFocus(ref);

  const press = (digit: string) => {
    setError(false);
    setPin((pin + digit).slice(0, 8));
  };
  const submit = () => {
    if (pin === getBoxPin()) onSuccess();
    else {
      setError(true);
      setPin('');
    }
  };

  const keyClass = 'h-16 rounded-2xl bg-white/10 text-2xl font-bold hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]';
  return (
    <div
      className="fixed inset-0 z-50 bg-[#07051a]/80 backdrop-blur-md flex items-center justify-center"
      // Teclas numéricas del control remoto o de un teclado
      // Las teclas no salen del diálogo: OK no debe disparar la pantalla de atrás
      onKeyUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); okRef.current?.focus(); }
        else if (e.key === 'Backspace') { e.preventDefault(); setPin(pin.slice(0, -1)); }
      }}
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="kiosk-glass w-[24rem] rounded-[2rem] p-7 space-y-5"
      >
        <div className="flex flex-col items-center gap-3">
          <EventPixMark size={52} />
          <p className="text-lg font-semibold">{title}</p>
        </div>
        <div className="flex justify-center gap-3 h-6">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-gradient-to-br from-[#ff2e93] to-[#00d4ff]' : 'bg-white/20'}`} />
          ))}
        </div>
        {error && <p className="text-center text-[#ff6b9d] font-semibold">Clave incorrecta</p>}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => press(d)} className={keyClass}>{d}</button>
          ))}
          <button onClick={() => setPin(pin.slice(0, -1))} className={`${keyClass} flex items-center justify-center`} aria-label="Borrar">
            <Delete className="w-6 h-6" />
          </button>
          <button onClick={() => press('0')} className={keyClass}>0</button>
          <button ref={okRef} onClick={submit} className="h-16 rounded-2xl text-lg font-bold bg-gradient-to-br from-[#ff2e93] to-[#7b2ff7] focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">OK</button>
        </div>
        <button onClick={onCancel} className="w-full py-3 rounded-2xl text-white/70 hover:text-white focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}
