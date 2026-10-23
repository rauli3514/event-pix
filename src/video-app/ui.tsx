import type { ReactNode } from 'react';

// Piezas visuales de Ajustes de EventPix Video: grandes y con foco bien visible para
// manejarlas con el control remoto.

export const inputClass = 'w-full rounded-2xl bg-black/30 border border-white/15 px-5 py-4 text-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]';
export const buttonClass = 'flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] disabled:opacity-40';
export const primaryClass = 'flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] hover:brightness-110 shadow-[0_10px_30px_-10px_rgba(255,46,147,0.7)] focus:outline-none focus:ring-4 focus:ring-[#00d4ff] disabled:opacity-40';

export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="kiosk-glass rounded-[2rem] p-7 space-y-5">
      <div>
        <h3 className="text-xl font-bold">{title}</h3>
        {description && <p className="text-white/55 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Interruptor Sí/No como un botón entero, fácil de usar con OK. */
export function Toggle({ label, hint, checked, onChange }: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-6 rounded-2xl bg-black/20 border border-white/10 px-6 py-4 text-left hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]"
    >
      <span>
        <span className="block text-lg font-semibold">{label}</span>
        {hint && <span className="block text-white/50 text-sm mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 w-16 h-9 rounded-full p-1 transition-colors ${checked ? 'bg-gradient-to-r from-[#00d4ff] to-[#7b2ff7]' : 'bg-white/20'}`}>
        <span className={`block w-7 h-7 rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : ''}`} />
      </span>
    </button>
  );
}

/** Grupo de opciones (una sola elegida) como botones. */
export function Choice<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-white/70">{label}</p>
      <div className="flex flex-wrap gap-3">
        {options.map(o => (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className={`rounded-2xl px-6 py-3 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${o.value === value ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-white/70">{label}</span>
      {children}
    </label>
  );
}

/** Número con botones − y + (el control remoto no maneja bien los deslizadores). */
export function Stepper({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const big = Math.max(step, Math.round((max - min) / 10 / step) * step);
  const key = 'rounded-2xl px-5 py-3 text-xl font-bold bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] disabled:opacity-30';
  return (
    <div className="space-y-2">
      <p className="text-white/70">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        {big > step && <button className={key} disabled={value <= min} onClick={() => onChange(clamp(value - big))}>−{big}</button>}
        <button className={key} disabled={value <= min} onClick={() => onChange(clamp(value - step))} aria-label="Menos">−</button>
        <div className="relative h-3 flex-1 min-w-[8rem] rounded-full bg-white/15 overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00d4ff] to-[#ff2e93]" style={{ width: `${((value - min) / (max - min || 1)) * 100}%` }} />
        </div>
        <button className={key} disabled={value >= max} onClick={() => onChange(clamp(value + step))} aria-label="Más">+</button>
        {big > step && <button className={key} disabled={value >= max} onClick={() => onChange(clamp(value + big))}>+{big}</button>}
      </div>
    </div>
  );
}

/** Varias opciones a la vez (se prenden y apagan). */
export function MultiChoice({ label, values, options, onChange }: {
  label: string; values: string[]; options: { value: string; label: string }[]; onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-white/70">{label}</p>
      <div className="flex flex-wrap gap-3">
        {options.map(o => {
          const on = values.includes(o.value);
          return (
            <button key={o.value} onClick={() => onChange(on ? values.filter(v => v !== o.value) : [...values, o.value])}
              className={`rounded-2xl px-5 py-3 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${on ? 'bg-gradient-to-r from-[#00d4ff] to-[#7b2ff7]' : 'bg-white/10 hover:bg-white/20 text-white/60'}`}>
              {on ? '✓ ' : ''}{o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-white/55">{children}</p>;
}

/** Pestañas de Ajustes. */
export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string; dot?: boolean; off?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <nav className="flex flex-wrap gap-2 kiosk-glass rounded-[1.5rem] p-2">
      {tabs.map(t => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`relative rounded-2xl px-5 py-3 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${t.value === value ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'hover:bg-white/10'} ${t.off && t.value !== value ? 'text-white/40' : ''}`}>
          {t.label}
          {t.dot && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#ff2e93] ring-2 ring-[#07051a]" />}
        </button>
      ))}
    </nav>
  );
}
