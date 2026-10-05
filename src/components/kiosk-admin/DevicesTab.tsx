import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Settings2, Trash2, Unlink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RemoteSettings } from '@/lib/kioskRemote';
import { btnDanger, btnGhost, btnPrimary, card, Field, input, Select } from './ui';
import { ONLINE_WINDOW_MS, type KioskAccountRow, type KioskDeviceRow, type KioskEventRow } from './types';

// Equipos: vincular con el código que muestra la TV, nombre, evento y estado.

const relative = (iso: string | null, now: number) => {
  if (!iso) return 'nunca';
  const min = Math.round((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
};

export default function DevicesTab({ devices, events, accounts, loadedAt, onChange, onConfigure }: {
  devices: KioskDeviceRow[];
  events: KioskEventRow[];
  /** null = base sin la migración de créditos */
  accounts: KioskAccountRow[] | null;
  loadedAt: number;
  onChange: () => void;
  onConfigure: (device: KioskDeviceRow) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const eventOptions = [{ value: '', label: 'Sin evento' }, ...events.map(e => ({ value: e.id, label: e.name }))];
  const accountOptions = [{ value: '', label: 'Sin cliente (sin IA)' }, ...(accounts ?? []).map(a => ({ value: a.id, label: `${a.name} · ${a.credits} créditos` }))];

  // Al asignar un evento, el nombre del evento va al equipo: es la carpeta de las fotos en Drive
  const withEventTitle = (device: Pick<KioskDeviceRow, 'settings' | 'settings_rev'>, evId: string) => {
    const ev = events.find(e => e.id === evId);
    if (!ev) return {};
    const settings: RemoteSettings = { ...(device.settings ?? {}), general: { ...(device.settings?.general ?? {}), eventTitle: ev.name } };
    return { settings, settings_rev: (device.settings_rev || 0) + 1 };
  };

  const link = async () => {
    const deviceCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(deviceCode)) {
      toast.error('El código tiene 6 letras o números, como aparece en la TV');
      return;
    }
    setBusy('link');
    const existing = await supabase.from('kiosk_devices').select('id, settings, settings_rev').eq('device_code', deviceCode).maybeSingle();
    if (!existing.data) {
      setBusy(null);
      toast.error(existing.error?.message || 'No aparece ese código: dejá la TV prendida con internet en la pantalla del código y probá de nuevo.');
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('kiosk_devices').update({
      pairing_status: 'linked',
      name: name.trim() || null,
      kiosk_event_id: eventId || null,
      linked_by: user.user?.id ?? null,
      ...withEventTitle(existing.data as KioskDeviceRow, eventId),
    }).eq('id', existing.data.id);
    setBusy(null);
    if (error) {
      toast.error(`No se pudo vincular: ${error.message}`);
      return;
    }
    toast.success('Equipo vinculado: en unos segundos la TV pasa al inicio.');
    setCode('');
    setName('');
    setEventId('');
    onChange();
  };

  const update = async (device: KioskDeviceRow, patch: Record<string, unknown>, ok?: string) => {
    setBusy(device.id);
    const { error } = await supabase.from('kiosk_devices').update(patch).eq('id', device.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      if (ok) toast.success(ok);
      onChange();
    }
  };

  const remove = async (device: KioskDeviceRow) => {
    if (!window.confirm(`¿Borrar el equipo ${device.name || device.device_code}? Si la TV sigue prendida vuelve a aparecer como pendiente.`)) return;
    setBusy(device.id);
    const { error } = await supabase.from('kiosk_devices').delete().eq('id', device.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else onChange();
  };

  const linked = devices.filter(d => d.pairing_status === 'linked');
  const pending = devices.filter(d => d.pairing_status !== 'linked');

  return (
    <div className="space-y-6">
      <div className={`${card} space-y-4`}>
        <h3 className="text-base font-bold text-white">Vincular un equipo</h3>
        <p className="text-sm text-slate-400">Prendé la TV box con la app EventPix Kiosco: muestra un código de 6 caracteres. Cargalo acá.</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <Field label="Código">
            <input className={`${input} font-mono uppercase tracking-widest`} maxLength={6} value={code}
              onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
          </Field>
          <Field label="Nombre (opcional)">
            <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Tanix salón 1" />
          </Field>
          <Field label="Evento">
            <Select value={eventId} options={eventOptions} onChange={setEventId} />
          </Field>
          <button onClick={link} disabled={busy === 'link'} className={btnPrimary}><Link2 className="h-4 w-4" /> Vincular</button>
        </div>
        {pending.length > 0 && (
          <p className="text-sm text-slate-400">
            Esperando vinculación: {pending.map(d => (
              <button key={d.id} onClick={() => setCode(d.device_code)} className="mr-2 font-mono text-violet-300 hover:underline">{d.device_code}</button>
            ))}
          </p>
        )}
      </div>

      {linked.length === 0 && <p className="text-slate-400">Todavía no hay equipos vinculados.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {linked.map(d => {
          const online = !!d.last_seen && loadedAt - new Date(d.last_seen).getTime() < ONLINE_WINDOW_MS;
          const pendingConfig = (d.settings_rev || 0) > (d.applied_rev || 0);
          return (
            <div key={d.id} className={`${card} space-y-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-white">{d.name || 'Sin nombre'}</p>
                  <p className="font-mono text-sm text-slate-400">{d.device_code}{d.app_version ? ` · v${d.app_version}` : ''}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/60 text-slate-300'}`}>
                  {online ? '● En línea' : `Visto ${relative(d.last_seen, loadedAt)}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre">
                  <input key={d.name ?? ''} className={input} defaultValue={d.name ?? ''}
                    onBlur={e => { if (e.target.value.trim() !== (d.name ?? '')) void update(d, { name: e.target.value.trim() || null }); }} />
                </Field>
                <Field label="Evento">
                  <Select value={d.kiosk_event_id ?? ''} options={eventOptions}
                    onChange={v => update(d, { kiosk_event_id: v || null, ...withEventTitle(d, v) }, v ? 'Evento asignado: el equipo usa su nombre y carpeta.' : undefined)} />
                </Field>
                {accounts && (
                  <div className="col-span-2">
                    <Field label="Cliente (créditos de IA)">
                      <Select value={d.account_id ?? ''} options={accountOptions}
                        onChange={v => update(d, { account_id: v || null }, v ? 'Cliente asignado: la IA de este equipo usa sus créditos.' : undefined)} />
                    </Field>
                  </div>
                )}
              </div>
              <p className={`text-sm ${pendingConfig ? 'text-amber-300' : 'text-slate-400'}`}>
                {pendingConfig
                  ? 'Hay cambios esperando: se aplican cuando el equipo se conecte.'
                  : d.reported?.general?.eventTitle ? `Evento en la TV: ${String(d.reported.general.eventTitle)}` : 'Configuración al día.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onConfigure(d)} className={btnPrimary}><Settings2 className="h-4 w-4" /> Configurar</button>
                <button onClick={() => update(d, { pairing_status: 'pending', kiosk_event_id: null }, 'Equipo desvinculado')} disabled={busy === d.id} className={btnGhost}>
                  <Unlink className="h-4 w-4" /> Desvincular
                </button>
                <button onClick={() => remove(d)} disabled={busy === d.id} className={btnDanger}><Trash2 className="h-4 w-4" /> Borrar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
