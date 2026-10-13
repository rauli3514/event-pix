import logoUrl from '@/assets/brand/eventpix-logo.webp';

// Logo de EventPix (el mismo del ícono de la app y de la web): lente de cámara con
// destellos sobre un squircle en degradé magenta → violeta → cian.

export function EventPixMark({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <img src={logoUrl} alt="" aria-hidden="true" draggable={false}
      width={size || undefined} height={size || undefined}
      className={`select-none object-contain ${className}`} />
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
