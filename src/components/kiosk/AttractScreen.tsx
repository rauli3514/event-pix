import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Camera, Hand } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixMark } from '@/components/kiosk/brand/EventPixLogo';
import { nameStyleProps, type NameStyle } from '@/components/kiosk/attractStyles';
import { listEventPhotos, readStoredPhoto } from '@/lib/kioskStorage';
import { isAnimatedSplash, splashStyleOf, splashVideoSrc } from '@/lib/kioskSettings';
import { getScreenMedia } from '@/lib/kioskMedia';

// Pantalla de bienvenida ("Tocá para empezar") con animaciones de photobooth hechas
// con CSS: livianas para la TV box y se acomodan a la tele horizontal o vertical
// (todo en vmin). El nombre del evento es lo principal; abajo, el llamado a tocar.

const SAMPLE_PHOTOS = [
  '/ai-themes/polaroid-party.jpg', '/ai-themes/fiesta-disco-70s.jpg', '/ai-themes/gala-alfombra-roja.jpg',
  '/ai-themes/paparazzi-nocturno.jpg', '/ai-themes/vhs-retro-80s.jpg', '/ai-themes/princesa-de-cuento.jpg',
  '/ai-themes/selfie-con-tiburon.jpg', '/ai-themes/toon-3d.jpg',
];
const CONFETTI_COLORS = ['#ff2e93', '#ffd23f', '#00d4ff', '#7b2ff7', '#2ee6a6', '#ffffff'];

// Pseudoaleatorio fijo: las mismas posiciones en cada render
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Fotos del evento guardadas en el equipo (o de muestra si todavía no hay). */
function useEventPhotos(enabled: boolean, count: number) {
  const [photos, setPhotos] = useState<string[]>(SAMPLE_PHOTOS);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listEventPhotos(count)
      .then(list => Promise.all(list.map(p => readStoredPhoto(p.uri, 320).catch(() => null))))
      .then(found => {
        const real = found.filter((s): s is string => !!s);
        if (alive && real.length >= 3) setPhotos(real);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled, count]);
  return photos;
}

function PolaroidRain() {
  const photos = useEventPhotos(true, 10);
  const cards = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    '--x': `${4 + (i * 9.6) % 92}%`,
    '--w': `${15 + rand(i, 1) * 9}vmin`,
    '--r0': `${-14 + rand(i, 2) * 28}deg`,
    '--r1': `${-14 + rand(i, 3) * 28}deg`,
    '--dx': `${-6 + rand(i, 4) * 12}vmin`,
    '--dur': `${20 + rand(i, 5) * 10}s`,
    '--delay': `${-i * 2.7}s`,
  } as CSSProperties)), []);
  return (
    <>
      <AuroraBackground />
      {cards.map((style, i) => (
        <div key={i} className="attract-polaroid" style={style}>
          <img src={photos[i % photos.length]} alt="" />
        </div>
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,5,26,0.85)_0%,rgba(7,5,26,0.35)_45%,transparent_75%)]" />
    </>
  );
}

function CameraFlashScene() {
  const blades = 8;
  return (
    <>
      <AuroraBackground />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="attract-shutter relative w-[95vmin] h-[95vmin]">
          <svg viewBox="-100 -100 200 200" className="attract-iris absolute inset-0 w-full h-full opacity-60">
            <defs>
              <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff2e93" />
                <stop offset="0.5" stopColor="#7b2ff7" />
                <stop offset="1" stopColor="#00d4ff" />
              </linearGradient>
            </defs>
            {Array.from({ length: blades }, (_, i) => (
              <path key={i} transform={`rotate(${(360 / blades) * i})`}
                d="M 0 -96 A 96 96 0 0 1 67.9 -67.9 L 20 -30 L -8 -42 Z"
                fill="url(#blade)" opacity={0.35 + (i % 2) * 0.25} stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
            ))}
            <circle r="97" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
            <circle r="44" fill="rgba(7,5,26,0.8)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          </svg>
        </div>
      </div>
      <div className="attract-flash absolute inset-0 bg-white pointer-events-none" />
    </>
  );
}

function NeonScene() {
  return (
    <>
      <div className="absolute inset-0 bg-[#0b0614]" />
      {/* pared de fondo */}
      <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] bg-[length:6vmin_3vmin]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,46,147,0.25),transparent_65%)]" />
      <div className="attract-neon-frame absolute inset-[6vmin] rounded-[5vmin] border-[0.6vmin] border-[#ff7ac0]"
        style={{ boxShadow: '0 0 2vmin #ff2e93, 0 0 6vmin #ff2e93, inset 0 0 2vmin #ff2e93, inset 0 0 6vmin rgba(255,46,147,0.6)' }} />
      <div className="attract-neon-frame absolute inset-[9vmin] rounded-[4vmin] border-[0.4vmin] border-[#7ff3ff]"
        style={{ boxShadow: '0 0 1.5vmin #00d4ff, 0 0 5vmin #00d4ff, inset 0 0 1.5vmin #00d4ff', animationDelay: '-3s' }} />
    </>
  );
}

function PartyScene() {
  const pieces = useMemo(() => Array.from({ length: 42 }, (_, i) => ({
    '--x': `${rand(i, 6) * 100}%`,
    '--s': `${1.2 + rand(i, 7) * 1.6}vmin`,
    '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    '--dx': `${-10 + rand(i, 8) * 20}vmin`,
    '--spin': `${360 + rand(i, 9) * 720}deg`,
    '--dur': `${6 + rand(i, 10) * 6}s`,
    '--delay': `${-rand(i, 11) * 12}s`,
  } as CSSProperties)), []);
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,#3b0d5c_0%,#12062a_55%,#07051a_100%)]" />
      <div className="attract-beam left-[-20vmax]" style={{ '--c': 'rgba(255,46,147,0.9)', '--dur': '7s' } as CSSProperties} />
      <div className="attract-beam right-[-20vmax]" style={{ '--c': 'rgba(0,212,255,0.9)', '--dur': '9s', animationDelay: '-4s' } as CSSProperties} />
      <div className="attract-beam left-[20%]" style={{ '--c': 'rgba(255,210,63,0.8)', '--dur': '11s', animationDelay: '-2s' } as CSSProperties} />
      {pieces.map((style, i) => <div key={i} className="attract-confetti" style={style} />)}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,5,26,0.6),transparent_70%)]" />
    </>
  );
}

/** Video o imagen propia subida en Ajustes (guardada en el equipo). */
function CustomMedia({ screen }: { screen: string }) {
  const [media, setMedia] = useState<{ url: string; video: boolean } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = (e: Event) => { if ((e as CustomEvent).detail === screen) setVersion(v => v + 1); };
    window.addEventListener('kiosk-media-changed', onChange);
    return () => window.removeEventListener('kiosk-media-changed', onChange);
  }, [screen]);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    getScreenMedia(screen).then(rec => {
      if (!alive) return;
      if (!rec) { setMedia(null); return; }
      url = URL.createObjectURL(rec.blob);
      setMedia({ url, video: rec.type.startsWith('video/') });
    }).catch(() => alive && setMedia(null));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [screen, version]);
  if (!media) return <AuroraBackground />;
  return (
    <>
      <div className="absolute inset-0 bg-black" />
      {media.video
        ? <video key={media.url} src={media.url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        : <img src={media.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {/* leve viñeta para que se lean los textos encima */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35),rgba(0,0,0,0.15)_70%)]" />
    </>
  );
}

export function AttractBackground({ splash }: { splash?: string }) {
  if (splash?.startsWith('custom:')) return <CustomMedia screen={splash.slice(7)} />;
  if (splash === 'aurora') return <AuroraBackground />;
  const style = splashStyleOf(splash);
  if (style === 'polaroids') return <PolaroidRain />;
  if (style === 'flash') return <CameraFlashScene />;
  if (style === 'neon') return <NeonScene />;
  if (style === 'fiesta') return <PartyScene />;
  const video = splashVideoSrc(style);
  return (
    <>
      <div className="absolute inset-0 bg-black" />
      {video && (
        <video key={video} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80">
          <source src={video} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
    </>
  );
}

export default function AttractScreen({ splash, eventTitle, welcomeTitle, subtitle, nameStyle }: {
  splash?: string;
  eventTitle?: string;
  welcomeTitle?: string;
  subtitle?: string;
  nameStyle?: NameStyle;
}) {
  const cta = welcomeTitle || 'Tocá para empezar';
  // Neón: el nombre se ve como cartel de neón aunque el estilo elegido sea otro
  const neonScene = isAnimatedSplash(splash) && splashStyleOf(splash) === 'neon';
  const name = nameStyleProps(neonScene && (!nameStyle || nameStyle === 'white') ? 'neon' : nameStyle);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AttractBackground splash={splash} />
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-[4vmin] px-[6vmin] text-center">
        {eventTitle ? (
          <>
            <div className="flex items-center gap-[1.6vmin]">
              <EventPixMark size={0} className="w-[6vmin] h-[6vmin] min-w-9 min-h-9 drop-shadow-[0_0.8vmin_2.4vmin_rgba(123,47,247,0.6)]" />
              <p className="text-white/80 uppercase tracking-[0.5em] text-[2.2vmin] font-semibold">Photobooth</p>
            </div>
            <h1 className={`carlmarx-bold leading-[0.95] text-[clamp(3rem,14vmin,11rem)] ${name.className} ${neonScene ? 'attract-neon' : ''}`} style={name.style}>
              {eventTitle}
            </h1>
          </>
        ) : (
          <>
            <EventPixMark size={0} className="w-[11vmin] h-[11vmin] min-w-14 min-h-14 drop-shadow-[0_1vmin_3vmin_rgba(123,47,247,0.6)]" />
            <h1 className={`carlmarx-bold leading-[0.95] text-[clamp(3rem,13vmin,10rem)] ${name.className}`} style={name.style}>{cta}</h1>
          </>
        )}
        {subtitle && <p className="text-white/90 text-[clamp(1.2rem,3.6vmin,2.6rem)] max-w-[80vmin]" style={{ textShadow: '0 0.4vmin 2vmin rgba(0,0,0,0.7)' }}>{subtitle}</p>}

        <div className="relative mt-[3vmin]">
          <span className="attract-cta-ring absolute inset-0 rounded-full border-[0.5vmin] border-white/70" />
          <span className="attract-cta-ring absolute inset-0 rounded-full border-[0.5vmin] border-white/50" style={{ animationDelay: '0.9s' }} />
          <div className="relative flex items-center gap-[2vmin] rounded-full overflow-hidden px-[5vmin] py-[2.4vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_2vmin_6vmin_-1vmin_rgba(255,46,147,0.7)]">
            <span className="attract-shine absolute inset-0" />
            {eventTitle ? <Hand className="relative w-[4.5vmin] h-[4.5vmin] text-white" /> : <Camera className="relative w-[4.5vmin] h-[4.5vmin] text-white" />}
            <span className="relative carlmarx-bold text-white text-[clamp(1.4rem,4.4vmin,3.2rem)] tracking-wide">
              {eventTitle ? cta : 'Sacate una foto'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
