import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { getGeneralSettings } from '@/lib/kioskSettings';
import { SCREENSAVER_PREVIEW_EVENT, screensaverMinutes } from '@/lib/kioskScreensaver';

// Protector de pantalla del kiosco: si nadie toca la pantalla ni el control remoto
// durante el tiempo elegido (Ajustes → Pantalla de inicio), aparece el logo animado
// paseando por la pantalla. Cualquier toque o tecla lo cierra sin activar nada debajo.
// Solo anima transform y opacity, para que la GPU de la TV box no se trabe.

/** El protector cuenta solo en el inicio, el kiosco, la galería e Ingreso VIP (no en Ajustes). */
const IDLE_PATH = /^\/(box|box\/galeria|box\/vip|kiosco)\/?$/;
const KIOSK_PATH = /^\/(box|kiosco)(\/|$)/;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
/** Lo que sigue al toque que despierta (soltar, click) tampoco llega a la pantalla de abajo. */
const FOLLOW_UP_EVENTS = ['pointerup', 'mousedown', 'mouseup', 'touchend', 'click'] as const;

export default function KioskScreensaver() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastArm = useRef(0);
  const swallowKeyUp = useRef(false);
  const wokeAt = useRef(0);
  // Con la pantalla girada en la web, el kiosco corre dentro del iframe girado de
  // RotatedScreen: el protector cuenta ahí adentro (afuera no se monta)
  const counts = IDLE_PATH.test(pathname);

  const show = useCallback((value: boolean) => {
    visibleRef.current = value;
    setVisible(value);
  }, []);

  const arm = useCallback((force = false) => {
    if (!counts) return;
    const now = Date.now();
    // pointermove llega muchas veces por segundo: se reprograma como mucho una vez por segundo
    if (!force && now - lastArm.current < 1000) return;
    lastArm.current = now;
    clearTimeout(timer.current);
    const minutes = screensaverMinutes();
    if (minutes > 0) timer.current = setTimeout(() => show(true), minutes * 60_000);
  }, [counts, show]);

  useEffect(() => {
    if (!KIOSK_PATH.test(pathname)) return;
    const onActivity = (e: Event) => {
      if (visibleRef.current) {
        // El toque o la tecla que despierta no tiene que apretar nada de la pantalla de abajo
        if (e.type === 'pointermove') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.type === 'keydown') swallowKeyUp.current = true;
        wokeAt.current = Date.now();
        show(false);
        arm(true);
        return;
      }
      arm();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!swallowKeyUp.current) return;
      swallowKeyUp.current = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onFollowUp = (e: Event) => {
      if (Date.now() - wokeAt.current > 800) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onPreview = () => show(true);
    ACTIVITY_EVENTS.forEach(t => window.addEventListener(t, onActivity, { capture: true, passive: false }));
    FOLLOW_UP_EVENTS.forEach(t => window.addEventListener(t, onFollowUp, true));
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener(SCREENSAVER_PREVIEW_EVENT, onPreview);
    arm(true);
    return () => {
      ACTIVITY_EVENTS.forEach(t => window.removeEventListener(t, onActivity, true));
      FOLLOW_UP_EVENTS.forEach(t => window.removeEventListener(t, onFollowUp, true));
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener(SCREENSAVER_PREVIEW_EVENT, onPreview);
      clearTimeout(timer.current);
    };
  }, [pathname, arm, show]);

  if (!visible) return null;
  return <ScreensaverScene eventTitle={getGeneralSettings().eventTitle} />;
}

const SPARKLES = [
  { x: 12, y: 18, s: 2.2, d: 0 }, { x: 84, y: 14, s: 1.6, d: 1.1 }, { x: 70, y: 78, s: 2.6, d: 2.3 },
  { x: 22, y: 72, s: 1.4, d: 0.6 }, { x: 48, y: 9, s: 1.2, d: 1.8 }, { x: 92, y: 52, s: 1.8, d: 2.9 },
  { x: 6, y: 46, s: 1.5, d: 3.4 }, { x: 38, y: 88, s: 2, d: 1.4 },
];
const STAR = 'M12 0l2.6 8.4L24 12l-9.4 3.6L12 24l-2.6-8.4L0 12l9.4-3.6z';

function ScreensaverScene({ eventTitle }: { eventTitle?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden cursor-none select-none kiosk-saver-in" role="presentation">
      <AuroraBackground />

      {SPARKLES.map((p, i) => (
        <svg key={i} viewBox="0 0 24 24" className="kiosk-saver-twinkle absolute"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.s}vmin`, height: `${p.s}vmin`, animationDelay: `${p.d}s` }} aria-hidden="true">
          <path d={STAR} fill={i % 3 === 0 ? '#ffd23f' : '#fff'} />
        </svg>
      ))}

      {/* El logo pasea: X e Y con períodos distintos dibujan un recorrido que no se repite enseguida */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="kiosk-saver-x">
          <div className="kiosk-saver-y">
            <div className="kiosk-saver-pop flex flex-col items-center gap-[3vmin]">
              <div className="relative">
                <span className="kiosk-saver-glow absolute -inset-[60%] rounded-full" />
                <span className="kiosk-saver-ring absolute inset-0 rounded-[30%] border-[0.6vmin] border-white/60" />
                <span className="kiosk-saver-ring absolute inset-0 rounded-[30%] border-[0.6vmin] border-[#00d4ff]/60" style={{ animationDelay: '1.5s' }} />
                <AnimatedMark />
              </div>
              <p className="brand-wordmark text-white leading-none text-[clamp(2rem,8vmin,6rem)]" style={{ textShadow: '0 1vmin 4vmin rgba(0,0,0,0.5)' }}>
                Event<span className="bg-gradient-to-r from-[#ff2e93] via-[#b14bff] to-[#00d4ff] bg-clip-text text-transparent">Pix</span>
              </p>
              {eventTitle && <p className="carlmarx-bold text-white/85 text-[clamp(1.4rem,4.5vmin,3.4rem)] -mt-[1.5vmin]">{eventTitle}</p>}
            </div>
          </div>
        </div>
      </div>

      <p className="kiosk-saver-hint absolute bottom-[5vmin] inset-x-0 text-center text-white/80 font-semibold tracking-[0.35em] uppercase text-[clamp(0.9rem,2.4vmin,1.6rem)]">
        Tocá la pantalla para sacarte una foto
      </p>
    </div>
  );
}

/** El ícono del kiosco con vida: late, el lente gira y los destellos titilan. */
function AnimatedMark() {
  return (
    <svg viewBox="0 0 64 64" className="relative kiosk-saver-breathe w-[26vmin] h-[26vmin] min-w-32 min-h-32" aria-hidden="true">
      <defs>
        <linearGradient id="saver-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2e93" />
          <stop offset="0.5" stopColor="#7b2ff7" />
          <stop offset="1" stopColor="#00d4ff" />
        </linearGradient>
        <linearGradient id="saver-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="saver-glint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="saver-lens" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3a1d7a" />
          <stop offset="1" stopColor="#0b0620" />
        </radialGradient>
        <clipPath id="saver-squircle">
          <path d="M32 2c21 0 30 9 30 30s-9 30-30 30S2 53 2 32 11 2 32 2z" />
        </clipPath>
      </defs>
      <path d="M32 2c21 0 30 9 30 30s-9 30-30 30S2 53 2 32 11 2 32 2z" fill="url(#saver-bg)" />
      <path d="M32 2c21 0 30 9 30 30H2C2 11 11 2 32 2z" fill="url(#saver-shine)" />
      {/* reflejo que cruza el ícono */}
      <g clipPath="url(#saver-squircle)">
        <rect className="kiosk-saver-glint" x="-30" y="-10" width="18" height="84" fill="url(#saver-glint)" transform="rotate(20 32 32)" />
      </g>
      <circle cx="32" cy="34" r="15" fill="#fff" fillOpacity="0.95" />
      <circle cx="32" cy="34" r="11.5" fill="url(#saver-lens)" />
      <circle className="kiosk-saver-iris" cx="32" cy="34" r="8.6" fill="none" stroke="#ff7ac0" strokeWidth="0.9" strokeDasharray="3 2.4" strokeOpacity="0.8" />
      <circle className="kiosk-saver-focus" cx="32" cy="34" r="6" fill="none" stroke="#00d4ff" strokeWidth="2" strokeOpacity="0.9" />
      <circle cx="28.5" cy="30.5" r="2.4" fill="#fff" fillOpacity="0.85" />
      <path className="kiosk-saver-star" d="M48 9l1.9 4.6L54.5 15.5l-4.6 1.9L48 22l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#ffd23f" />
      <path className="kiosk-saver-star small" d="M53.5 22.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff" />
    </svg>
  );
}
