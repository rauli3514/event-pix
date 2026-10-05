import { useId } from 'react';

// Logo de EventPix para la app del kiosco: lente de cámara con un destello
// (las fotos IA) sobre un squircle en degradé magenta → violeta → cian.

export function EventPixMark({ size = 64, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size || undefined} height={size || undefined} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2e93" />
          <stop offset="0.5" stopColor="#7b2ff7" />
          <stop offset="1" stopColor="#00d4ff" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-lens`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3a1d7a" />
          <stop offset="1" stopColor="#0b0620" />
        </radialGradient>
      </defs>
      {/* squircle */}
      <path d="M32 2c21 0 30 9 30 30s-9 30-30 30S2 53 2 32 11 2 32 2z" fill={`url(#${id}-bg)`} />
      <path d="M32 2c21 0 30 9 30 30H2C2 11 11 2 32 2z" fill={`url(#${id}-shine)`} />
      {/* lente */}
      <circle cx="32" cy="34" r="15" fill="#fff" fillOpacity="0.95" />
      <circle cx="32" cy="34" r="11.5" fill={`url(#${id}-lens)`} />
      <circle cx="32" cy="34" r="6" fill="none" stroke="#00d4ff" strokeWidth="2" strokeOpacity="0.9" />
      <circle cx="28.5" cy="30.5" r="2.4" fill="#fff" fillOpacity="0.85" />
      {/* destello IA */}
      <path d="M48 9l1.9 4.6L54.5 15.5l-4.6 1.9L48 22l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#ffd23f" />
      <path d="M53.5 22.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff" />
    </svg>
  );
}

export function EventPixLogo({ size = 56, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <EventPixMark size={size} className="drop-shadow-[0_8px_24px_rgba(123,47,247,0.55)]" />
      <div className="leading-none">
        <p className="brand-wordmark text-white" style={{ fontSize: size * 0.55 }}>
          Event<span className="bg-gradient-to-r from-[#ff2e93] via-[#b14bff] to-[#00d4ff] bg-clip-text text-transparent">Pix</span>
        </p>
        {subtitle && <p className="text-white/60 font-semibold tracking-[0.3em] uppercase mt-1" style={{ fontSize: size * 0.2 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

/** Marca chica arriba al centro de las pantallas del kiosco. */
export function KioskBrandBadge() {
  return (
    <div className="absolute top-[2.5vmin] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-[1.2vmin] opacity-90" aria-hidden="true">
      <EventPixMark size={0} className="w-[5vmin] h-[5vmin] min-w-8 min-h-8 drop-shadow-[0_0.6vmin_1.8vmin_rgba(123,47,247,0.6)]" />
      <p className="brand-wordmark text-white text-[clamp(1rem,2.8vmin,2rem)] leading-none" style={{ textShadow: '0 0.3vmin 1.2vmin rgba(0,0,0,0.5)' }}>
        Event<span className="bg-gradient-to-r from-[#ff2e93] via-[#b14bff] to-[#00d4ff] bg-clip-text text-transparent">Pix</span>
      </p>
    </div>
  );
}
