import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Coins, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { btnDanger, btnGhost, btnPrimary, card, Field, input } from './ui';
import type { KioskAccountRow, KioskDeviceRow } from './types';

// Clientes y créditos de IA. La cabina clásica es libre; cada conversión con IA
// gasta 1 crédito del cliente dueño del equipo. Los créditos se cargan acá.

const PACKS = [10, 20, 30, 50, 100];

interface LedgerRow {
  id: string;
  delta: number;
  reason: 'purchase' | 'generation' | 'refund' | 'adjust';
  note: string | null;
  device_id: string | null;
  created_at: string;
}

const REASONS: Record<LedgerRow['reason'], string> = {
  purchase: 'Compra',
  generation: 'Foto con IA',
  refund: 'Devolución (la IA falló)',
  adjust: 'Ajuste',
};

export default function ClientsTab({ accounts, devices, onChange }: {
  accounts: KioskAccountRow[];
  devices: KioskDeviceRow[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const current = accounts.find(a => a.id === selected) ?? null;

  const create = async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase.from('kiosk_accounts')
      .insert({ name: name.trim(), contact: contact.trim() || null }).select('id').single();
    if (error) {
      toast.error(`No se pudo crear: ${error.message}`);
      return;
    }
    setName('');
    setContact('');
    setSelected(data.id);
    onChange();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div className={`${card} space-y-3`}>
          <h3 className="text-base font-bold text-white">Nuevo cliente</h3>
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre o empresa" />
          <input className={input} value={contact} onChange={e => setContact(e.target.value)} placeholder="WhatsApp o email (opcional)" />
          <button onClick={create} disabled={!name.trim()} className={`${btnPrimary} w-full`}><Plus className="h-4 w-4" /> Crear cliente</button>
          <p className="text-xs text-slate-500">Después asignale sus equipos en Equipos y cargale créditos acá.</p>
        </div>
        <div className="space-y-2">
          {accounts.length === 0 && <p className="text-sm text-slate-400">Todavía no hay clientes.</p>}
          {accounts.map(a => {
            const count = devices.filter(d => d.account_id === a.id).length;
            return (
              <button key={a.id} onClick={() => setSelected(a.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${selected === a.id ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'}`}>
                <span>
                  <span className="block font-semibold text-white">{a.name}</span>
                  <span className="text-xs text-slate-400">{count} equipo{count === 1 ? '' : 's'}{a.contact ? ` · ${a.contact}` : ''}</span>
                </span>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${a.credits > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>{a.credits}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {current
          ? <ClientDetail key={current.id} account={current} devices={devices.filter(d => d.account_id === current.id)} onChange={onChange}
              onDeleted={() => { setSelected(null); onChange(); }} />
          : <div className={`${card} flex min-h-[240px] items-center justify-center text-slate-400`}><Coins className="mr-2 h-5 w-5" /> Elegí un cliente para ver y cargar sus créditos.</div>}
      </div>
    </div>
  );
}

function ClientDetail({ account, devices, onChange, onDeleted }: {
  account: KioskAccountRow;
  devices: KioskDeviceRow[];
  onChange: () => void;
  onDeleted: () => void;
}) {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState('');
  const [note, setNote] = useState('');

  const loadLedger = useCallback(async () => {
    const { data, error } = await supabase.from('kiosk_credit_ledger')
      .select('id, delta, reason, note, device_id, created_at')
      .eq('account_id', account.id).order('created_at', { ascending: false }).limit(100);
    if (!error) setLedger((data ?? []) as LedgerRow[]);
  }, [account.id]);
  useEffect(() => {
    const t = window.setTimeout(loadLedger, 0);
    return () => window.clearTimeout(t);
  }, [loadLedger, account.credits]);

  const add = async (delta: number, reason: 'purchase' | 'adjust', text?: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('kiosk_credits_add', { p_account: account.id, p_delta: delta, p_reason: reason, p_note: text || null });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${delta > 0 ? `+${delta}` : delta} créditos · saldo ${data}`);
    onChange();
  };

  const applyAdjust = () => {
    const n = parseInt(adjust, 10);
    if (!n) return;
    void add(n, 'adjust', note.trim() || undefined);
    setAdjust('');
    setNote('');
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar el cliente "${account.name}"? Sus equipos quedan sin cliente y se pierde el saldo (${account.credits}).`)) return;
    const { error } = await supabase.from('kiosk_accounts').delete().eq('id', account.id);
    if (error) toast.error(error.message);
    else onDeleted();
  };

  const deviceName = (id: string | null) => {
    const d = devices.find(x => x.id === id);
    return d ? d.name || d.device_code : null;
  };
  const used = ledger.filter(l => l.reason === 'generation').length - ledger.filter(l => l.reason === 'refund').length;

  return (
    <div className="space-y-5">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">{account.name}</h3>
            <p className="text-sm text-slate-400">
              {account.contact || 'Sin contacto'} · {devices.length ? devices.map(d => d.name || d.device_code).join(', ') : 'sin equipos asignados'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-white">{account.credits}</p>
            <p className="text-xs text-slate-400">créditos de IA{used > 0 ? ` · ${used} usados (últimos 100 mov.)` : ''}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-300">Cargar pack</p>
          <div className="flex flex-wrap gap-2">
            {PACKS.map(n => (
              <button key={n} onClick={() => add(n, 'purchase', `Pack ${n}`)} disabled={busy} className={btnPrimary}>+{n}</button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[140px_1fr_auto] md:items-end">
          <Field label="Ajuste (+/-)">
            <input className={input} inputMode="numeric" value={adjust} onChange={e => setAdjust(e.target.value.replace(/[^\d-]/g, ''))} placeholder="-5" />
          </Field>
          <Field label="Motivo">
            <input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Regalo, corrección…" />
          </Field>
          <button onClick={applyAdjust} disabled={busy || !parseInt(adjust, 10)} className={btnGhost}>Aplicar</button>
        </div>
      </div>

      <div className={`${card} space-y-2`}>
        <h3 className="text-base font-bold text-white">Movimientos</h3>
        {ledger.length === 0 && <p className="text-sm text-slate-400">Sin movimientos todavía.</p>}
        <div className="divide-y divide-slate-800">
          {ledger.map(l => (
            <div key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="text-slate-200">{REASONS[l.reason]}</span>
                <span className="text-slate-500">
                  {l.note ? ` · ${l.note}` : ''}{deviceName(l.device_id) ? ` · ${deviceName(l.device_id)}` : ''}
                  {' · '}{new Date(l.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <span className={`font-bold ${l.delta > 0 ? 'text-emerald-300' : 'text-slate-300'}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={remove} className={btnDanger}><Trash2 className="h-4 w-4" /> Borrar cliente</button>
    </div>
  );
}
