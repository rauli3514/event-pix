import { useEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import CameraVideo from '@/components/kiosk/CameraVideo';

// Pausa entre fotos de una toma múltiple: las fotos ya sacadas caen como
// polaroids, se sugiere una pose nueva y se ve la cámara en vivo para
// acomodarse. Al terminar el tiempo (o con "¡Listos!") sigue la cuenta regresiva.

const POSES = [
  '¡Ahora una cara graciosa! 🤪',
  '¡Todos juntos, bien apretados! 🤗',
  '¡Pose de estrellas de cine! 😎',
  '¡Un abrazo grupal! 💞',
  '¡Saltá… o hacé que saltás! 🙌',
  '¡Cara de sorpresa! 😱',
  '¡Corazón con las manos! 🫶',
  '¡La más elegante! 💃🕺',
  '¡La pose más SEXY gana! 🔥',
  '¡Pose de Instagram! 📸✨',
  '¡Todos señalando a la cámara! 👉',
  '¡Brindis imaginario! 🥂',
  '¡Pongan cara de enojados! 😠',
  '¡Ahora como una banda de rock! 🤘',
];

export default function NextShot({ shots, total, seconds, videoRef, mirror, rotation, onReady }: {
  shots: string[];
  total: number;
  seconds: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  mirror?: boolean;
  rotation?: number;
  onReady: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(false);
  const readyRef = useRef(onReady);
  useEffect(() => { readyRef.current = onReady; });
  // Una pose distinta en cada pausa
  const [pose] = useState(() => POSES[(shots.length - 1 + Math.floor(Math.random() * POSES.length)) % POSES.length]);
  const [, poseText, poseEmoji] = pose.match(/^(.*?)\s*([^\p{L}\p{N}!¡?¿.,…]*)$/u) ?? ['', pose, ''];

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    readyRef.current();
  };

  useEffect(() => {
    const t = window.setInterval(() => {
      setLeft(v => Math.max(0, v - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (left > 0 || doneRef.current) return;
    doneRef.current = true;
    readyRef.current();
  }, [left]);

  const next = shots.length + 1;
  const progress = 1 - left / seconds;
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="kiosk-root text-white">
      <ScreenBackground screen="getReady" />
      <div className="relative z-10 h-full flex flex-wrap items-center justify-center content-center gap-[5vmin] p-[5vmin]">
        {/* Fotos ya sacadas, apiladas como polaroids */}
        <div className="relative w-[34vmin] h-[34vmin] shrink-0">
          {shots.map((src, i) => {
            const latest = i === shots.length - 1;
            const angle = (i % 2 ? 1 : -1) * (4 + i * 3);
            return (
              <motion.div key={i}
                className="absolute inset-0 m-auto w-fit h-fit bg-white p-[1vmin] pb-[4vmin] rounded-[0.8vmin] shadow-[0_2vmin_5vmin_rgba(0,0,0,0.55)]"
                initial={latest ? { scale: 2.2, y: '-30vmin', rotate: 0, opacity: 0 } : false}
                animate={{ scale: 1, y: i * -6, x: i * 10, rotate: angle, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14, delay: latest ? 0.15 : 0 }}>
                <img src={src} alt={`Foto ${i + 1}`} className="block max-w-[28vmin] max-h-[26vmin] w-auto h-auto rounded-[0.4vmin]" />
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-col items-center text-center gap-[2.5vmin] max-w-[70vmin]">
          <motion.p className="carlmarx-bold text-[clamp(2.5rem,9vmin,6rem)] leading-none"
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
            ¡Genial!
          </motion.p>
          <p className="text-[clamp(1.3rem,4vmin,2.6rem)] text-white/90">
            Preparate para la foto <b className="text-white">{next}</b> de {total}
          </p>
          <AnimatePresence mode="wait">
            <motion.p key={pose}
              className="carlmarx-bold leading-tight text-[clamp(2.6rem,9vmin,6.5rem)]"
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
              <span className="bg-gradient-to-r from-[#ffd23f] via-[#ff2e93] to-[#00d4ff] bg-clip-text text-transparent">{poseText}</span>
              {/* El emoji va aparte: con el degradé del texto se vería como una mancha */}
              {poseEmoji && <span className="ml-[0.25em] whitespace-nowrap">{poseEmoji}</span>}
            </motion.p>
          </AnimatePresence>

          <div className="flex items-center gap-[4vmin] mt-[1vmin]">
            {/* Cámara en vivo, para acomodarse */}
            <div className={`relative ${rotation === 90 || rotation === 270 ? 'w-[18vmin] aspect-[9/16]' : 'w-[30vmin] aspect-video'} rounded-[2vmin] overflow-hidden border-[0.4vmin] border-white/70 shadow-2xl bg-black`}>
              <CameraVideo videoRef={videoRef} mirror={mirror} rotation={rotation} />
              <span className="absolute bottom-1 inset-x-0 text-center text-[1.6vmin] text-white/85 drop-shadow">Así te ve la cámara</span>
            </div>
            {/* Tiempo que falta */}
            <div className="relative w-[18vmin] h-[18vmin]">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
                <circle cx="60" cy="60" r={R} fill="none" stroke="url(#nextShotRing)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                <defs>
                  <linearGradient id="nextShotRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ff2e93" />
                    <stop offset="1" stopColor="#00d4ff" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center carlmarx-bold text-[7vmin]">{left}</span>
            </div>
          </div>

          <button data-autofocus onClick={finish}
            className="mt-[1vmin] px-[6vmin] py-[2vmin] rounded-full carlmarx-bold text-[clamp(1.3rem,3.6vmin,2.4rem)] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_1.5vmin_4vmin_-1vmin_rgba(255,46,147,0.7)] focus:outline-none focus:ring-4 focus:ring-white/80">
            ¡Listos!
          </button>
        </div>
      </div>
    </div>
  );
}
