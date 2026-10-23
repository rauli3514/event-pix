import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { AURORA, bgKey, patternBackground, themeBackground, type ThemeBackground } from '@/lib/videoBooth/backgrounds';
import { getMedia, MEDIA_EVENT } from '@/lib/videoBooth/mediaStore';

// Fondo de las pantallas de la cabina: el de siempre, uno de fábrica o uno
// propio (imagen o video en loop, un poco oscurecido para que se lean los textos).

const BLOB_POS = ['a', 'b', 'c', 'd'] as const;

/** Fondo de fábrica: base de color con cuatro manchas que se mueven. */
export function ThemeLayer({ theme, className = '' }: { theme: ThemeBackground; className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: theme.base }} aria-hidden="true">
      {BLOB_POS.map((k, i) => (
        <div key={k} className={`kiosk-aurora-blob ${k}`} style={{ background: `radial-gradient(circle, ${theme.blobs[i]}, transparent 62%)` }} />
      ))}
      {/* Viñeta suave en los bordes */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${theme.base}99)` }} />
    </div>
  );
}

type Css = CSSProperties;
const abs: Css = { position: 'absolute', inset: 0 };
/** Capa para oscurecer un poco los fondos claros (los textos son blancos) */
const Dim = ({ color }: { color: string }) => <div style={{ ...abs, background: color }} />;
const Circle = ({ style }: { style: Css }) => <div className="vb-anim" style={{ position: 'absolute', borderRadius: '9999px', animation: 'vb-float 14s ease-in-out infinite', ...style }} />;

/** Fondos de fábrica dibujados: claros y neón. */
export function PatternLayer({ id, className = '' }: { id: string; className?: string }) {
  const wrap = (bg: string, children: ReactNode) => (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: bg }} aria-hidden="true">{children}</div>
  );
  switch (id) {
    case 'p-rayas':
      return wrap('linear-gradient(160deg, #e6d6c4, #c7ad94)', <>
        <div className="vb-anim" style={{ ...abs, backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.22) 0 26px, transparent 26px 70px), linear-gradient(transparent, transparent)', animation: 'vb-pan 40s linear infinite' }} />
        <Circle style={{ width: '50vmax', height: '50vmax', top: '-18vmax', right: '-14vmax', background: '#9c7a5e', opacity: 0.85 }} />
        <Circle style={{ width: '42vmax', height: '42vmax', bottom: '-18vmax', left: '-14vmax', background: '#a98667', opacity: 0.85, animationDelay: '-7s' }} />
        <Dim color="rgba(50,30,15,0.28)" />
      </>);
    case 'p-boda':
      return wrap('linear-gradient(160deg, #f5ddd6, #d8a79d)', <>
        <Circle style={{ width: '60vmax', height: '60vmax', top: '-25vmax', left: '-20vmax', background: 'radial-gradient(circle, rgba(255,255,255,0.7), transparent 65%)' }} />
        <Circle style={{ width: '55vmax', height: '55vmax', bottom: '-25vmax', right: '-18vmax', background: 'radial-gradient(circle, rgba(190,110,105,0.6), transparent 65%)', animationDelay: '-6s' }} />
        <div style={{ position: 'absolute', inset: '3.5vmin', border: '2px solid rgba(201,162,74,0.85)', borderRadius: '2vmin' }} />
        <div style={{ position: 'absolute', inset: '5vmin', border: '1px solid rgba(201,162,74,0.6)', borderRadius: '1.5vmin' }} />
        <Dim color="rgba(70,25,30,0.26)" />
      </>);
    case 'p-salvia':
      return wrap('linear-gradient(160deg, #cfd9c0, #93a685)', <>
        {[[-8, -6, 28, -30], [70, -10, 32, 35], [-10, 70, 30, 40], [72, 68, 34, -25]].map(([x, y, w, r], i) => (
          <div key={i} className="vb-anim" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}vmax`, height: `${w * 0.45}vmax`, borderRadius: '50%', background: 'rgba(95,125,85,0.55)', transform: `rotate(${r}deg)`, animation: 'vb-glow 9s ease-in-out infinite', animationDelay: `${-i * 2}s` }} />
        ))}
        <Dim color="rgba(20,40,20,0.26)" />
      </>);
    case 'p-dorado':
      return wrap('linear-gradient(135deg, #f3e3b8, #d2ad62 50%, #efd9a3)', <>
        <div style={{ ...abs, backgroundImage: 'repeating-linear-gradient(60deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 46px)' }} />
        <div className="vb-anim" style={{ position: 'absolute', top: '-50%', bottom: '-50%', left: '20%', width: '25%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)', animation: 'vb-sheen 7s ease-in-out infinite alternate' }} />
        <Dim color="rgba(70,45,10,0.3)" />
      </>);
    case 'p-confeti':
      return wrap('#f4ece2', <>
        <div className="vb-anim" style={{
          ...abs,
          backgroundImage: 'radial-gradient(circle, #f4a3bb 0 7px, transparent 8px), radial-gradient(circle, #8fcbe9 0 6px, transparent 7px), radial-gradient(circle, #f6d27a 0 8px, transparent 9px), linear-gradient(160deg, #f6eee4, #e9dccd)',
          backgroundSize: '90px 90px, 130px 130px, 110px 110px, 100% 100%',
          backgroundPosition: '0 0, 40px 60px, 70px 20px, 0 0',
          animation: 'vb-pan-dots 60s linear infinite',
        }} />
        <Dim color="rgba(40,25,50,0.38)" />
      </>);
    case 'p-minimal':
      return wrap('linear-gradient(160deg, #dedee2, #a7a9b2)', <>
        <Circle style={{ width: '70vmax', height: '70vmax', top: '-35vmax', right: '-25vmax', border: '2px solid rgba(255,255,255,0.55)' }} />
        <Circle style={{ width: '45vmax', height: '45vmax', bottom: '-20vmax', left: '-12vmax', border: '2px solid rgba(255,255,255,0.45)', animationDelay: '-5s' }} />
        <Circle style={{ width: '18vmax', height: '18vmax', bottom: '12%', right: '10%', background: 'rgba(255,255,255,0.25)', animationDelay: '-9s' }} />
        <Dim color="rgba(0,0,0,0.3)" />
      </>);
    case 'n-grilla':
      return wrap('radial-gradient(ellipse at center, #1a0830, #05020c 70%)', <>
        <div className="vb-anim" style={{
          ...abs,
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,46,147,0.45) 0 2px, transparent 2px 70px), repeating-linear-gradient(90deg, rgba(0,212,255,0.4) 0 2px, transparent 2px 70px)',
          filter: 'drop-shadow(0 0 6px rgba(255,46,147,0.8))',
          animation: 'vb-pan 30s linear infinite',
        }} />
        <div style={{ ...abs, background: 'radial-gradient(ellipse at center, rgba(5,2,12,0.75) 25%, transparent 70%)' }} />
      </>);
    case 'n-marco':
      return wrap('radial-gradient(ellipse at center, #140629, #05020c 75%)', <>
        <div className="vb-anim" style={{ position: 'absolute', inset: '4vmin', borderRadius: '4vmin', border: '4px solid #ff2e93', boxShadow: '0 0 25px #ff2e93, inset 0 0 25px #ff2e93', animation: 'vb-glow 2.6s ease-in-out infinite' }} />
        <div className="vb-anim" style={{ position: 'absolute', inset: '7.5vmin', borderRadius: '3vmin', border: '3px solid #00d4ff', boxShadow: '0 0 20px #00d4ff, inset 0 0 20px #00d4ff', animation: 'vb-glow 2.6s ease-in-out infinite', animationDelay: '-1.3s' }} />
      </>);
    case 'n-synth':
      return wrap('linear-gradient(#12002b 0%, #3d0a5e 38%, #b3266b 58%, #12002b 58.2%)', <>
        <div style={{
          position: 'absolute', left: '50%', top: '14%', width: '38vmin', height: '38vmin', transform: 'translateX(-50%)', borderRadius: '9999px',
          background: 'linear-gradient(#ffd23f, #ff2e93)',
          WebkitMaskImage: 'linear-gradient(#000 55%, transparent 55% 60%, #000 60% 68%, transparent 68% 72%, #000 72% 79%, transparent 79% 83%, #000 83%)',
          maskImage: 'linear-gradient(#000 55%, transparent 55% 60%, #000 60% 68%, transparent 68% 72%, #000 72% 79%, transparent 79% 83%, #000 83%)',
          boxShadow: '0 0 60px rgba(255,80,150,0.6)',
        }} />
        <div style={{ position: 'absolute', left: '-50%', right: '-50%', bottom: '-10%', height: '52%', perspective: '300px' }}>
          <div className="vb-anim" style={{
            position: 'absolute', inset: 0, transform: 'rotateX(62deg)', transformOrigin: 'top',
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,46,200,0.9) 0 2px, transparent 2px 80px), repeating-linear-gradient(90deg, rgba(255,46,200,0.9) 0 2px, transparent 2px 80px)',
            animation: 'vb-road 1.6s linear infinite',
          }} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '57%', height: '2.5%', background: 'linear-gradient(transparent, rgba(255,120,200,0.55), transparent)' }} />
        <Dim color="rgba(10,0,25,0.25)" />
      </>);
    default:
      return null;
  }
}

/** Archivo de un fondo propio (se libera solo). */
function useBackgroundFile(id: string | null) {
  const [file, setFile] = useState<{ id: string; url: string; video: boolean } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let current: string | null = null;
    const load = () => getMedia(bgKey(id)).then(rec => {
      if (!alive) return;
      if (current) URL.revokeObjectURL(current);
      current = rec ? URL.createObjectURL(rec.blob) : null;
      setFile(current && rec ? { id, url: current, video: rec.blob.type.startsWith('video/') } : null);
    }).catch(() => { /* sin el archivo: el fondo de siempre */ });
    void load();
    const onChange = (e: Event) => { if ((e as CustomEvent).detail === bgKey(id)) void load(); };
    window.addEventListener(MEDIA_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(MEDIA_EVENT, onChange);
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  return file && file.id === id ? file : null;
}

export default function ScreenBackground({ value, dim = 0.35, className = '' }: { value?: string; dim?: number; className?: string }) {
  const theme = themeBackground(value);
  const pattern = patternBackground(value);
  const ownId = value && value !== AURORA && !theme && !pattern ? value : null;
  const file = useBackgroundFile(ownId);
  if (theme) return <ThemeLayer theme={theme} className={className} />;
  if (pattern) return <PatternLayer id={pattern.id} className={className} />;
  if (!ownId || !file) return <AuroraBackground className={className} />;
  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${className}`} aria-hidden="true">
      {file.video
        ? <video key={file.url} src={file.url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        : <img src={file.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${Math.max(0, Math.min(0.8, dim))})` }} />
    </div>
  );
}
