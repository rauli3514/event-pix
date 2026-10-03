import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Animaciones del kiosco (cuenta regresiva, flash, espera de la IA, resultado).
// Solo transform/opacity: la GPU de la TV box las mueve sin trabarse.

/** Número grande que "salta" en cada segundo, con anillo de progreso. */
export function CountdownRing({ value, total }: { value: number | null; total: number }) {
  const size = 420;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = value ? (value - 1) / Math.max(1, total) : 0;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(123,47,247,0.35),transparent_65%)]" />
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="countdown-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff2e93" />
            <stop offset="0.5" stopColor="#7b2ff7" />
            <stop offset="1" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#countdown-ring)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </svg>
      <AnimatePresence mode="popLayout">
        {value !== null && (
          <motion.span
            key={value}
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="carlmarx-bold text-white text-[14rem] leading-none"
            style={{ textShadow: '0 0 60px rgba(255,46,147,0.75), 0 0 120px rgba(0,212,255,0.5)' }}
          >
            {value}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Flash blanco de cámara que se desvanece. */
export function CameraFlash() {
  return (
    <motion.div
      className="absolute inset-0 z-50 bg-white pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  );
}

const AI_PHRASES = [
  'Analizando tu foto…',
  'Mezclando colores…',
  'La IA está dibujando…',
  'Agregando los detalles…',
  'Últimos retoques…',
];

/** Orbe de colores girando con frases que cambian, mientras trabaja la IA. */
export function AIProcessing({ title, subtitle }: { title: string; subtitle?: string }) {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setPhrase(p => (p + 1) % AI_PHRASES.length), 2800);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-full gap-10">
      <div className="relative w-64 h-64">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, #ff2e93, #7b2ff7, #00d4ff, #ffd23f, #ff2e93)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
        />
        <div className="absolute inset-3 rounded-full bg-[#07051a]/85" />
        <motion.div
          className="absolute inset-10 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c86bff_35%,#7b2ff7_70%)]"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <h2 className="carlmarx-bold text-[clamp(3rem,7vw,6rem)] text-white text-center">{title}</h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={subtitle ? 'fixed' : phrase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="text-white/75 text-3xl"
        >
          {subtitle || AI_PHRASES[phrase]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
