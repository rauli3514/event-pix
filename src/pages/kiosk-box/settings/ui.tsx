import type { ReactNode } from 'react';

// Piezas visuales de Ajustes de la TV box: grandes y con foco bien visible para
// manejarlas con el control remoto.

export const inputClass = 'w-full rounded-2xl bg-black/30 border border-white/15 px-5 py-4 text-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-4 focus:ring-cyan-400';
export const buttonClass = 'flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-400 disabled:opacity-40';
export const primaryClass = 'flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold bg-violet-600 hover:bg-violet-500 focus:outline-none focus:ring-4 focus:ring-cyan-400 disabled:opacity-40';

export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/5 border border-white/10 p-7 space-y-5">
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
      className="w-full flex items-center justify-between gap-6 rounded-2xl bg-black/20 border border-white/10 px-6 py-4 text-left hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-400"
    >
      <span>
        <span className="block text-lg font-semibold">{label}</span>
        {hint && <span className="block text-white/50 text-sm mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 w-16 h-9 rounded-full p-1 transition-colors ${checked ? 'bg-emerald-500' : 'bg-white/20'}`}>
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
            className={`rounded-2xl px-6 py-3 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-cyan-400 ${o.value === value ? 'bg-violet-600' : 'bg-white/10 hover:bg-white/20'}`}
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
