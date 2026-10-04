import type { ReactNode } from 'react';

// Piezas visuales del panel admin del kiosco (oscuro, como el resto de /admin).

export const card = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-5';
export const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-violet-500';
export const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const btnPrimary = `${btn} bg-violet-600 text-white hover:bg-violet-500`;
export const btnGhost = `${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`;
export const btnDanger = `${btn} border border-red-500/40 text-red-300 hover:bg-red-500/10`;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${checked ? 'border-violet-500/60 bg-violet-500/10 text-white' : 'border-slate-700 text-slate-400'}`}>
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-violet-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Select<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select className={input} value={String(value)}
      onChange={e => {
        const found = options.find(o => String(o.value) === e.target.value);
        if (found) onChange(found.value);
      }}>
      {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${card} space-y-4`}>
      <h3 className="text-base font-bold text-white">{title}</h3>
      {children}
    </section>
  );
}
