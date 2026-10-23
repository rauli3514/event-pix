import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Settings2, Trash2, Unlink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GalleryLinks from './GalleryLinks';
import { DEFAULT_PUBLIC_SITE } from '@/lib/videoBooth/share';
import { btnDanger, btnGhost, btnPrimary, card, Field, input } from './ui';
import { ONLINE_WINDOW_MS, type VideoDeviceRow } from './types';

// Equipos de la cabina: vincular con el código que muestra la app EventPix Video,
// nombre y estado.

const relative = (iso: string | null, now: number) => {
  if (!iso) return 'nunca';
  const min = Math.round((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
};

export default function DevicesTab({ devices, loadedAt, onChange, onConfigure }: {
  devices: VideoDeviceRow[];
  loadedAt: number;
  onChange: () => void;
  onConfigure: (device: VideoDeviceRow) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const link = async () => {
    const deviceCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(deviceCode)) {
      toast.error('El código tiene 6 letras o números, como aparece en la pantalla del equipo');
      return;
    }
    setBusy('link');
    const existing = await supabase.from('video_devices').select('id').eq('device_code', deviceCode).maybeSingle();
    if (!existing.data) {
      setBusy(null);
      toast.error(existing.error?.message || 'No aparece ese código: dejá el equipo prendido con internet en la pantalla del código y probá de nuevo.');
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('video_devices').update({
      pairing_status: 'linked', name: name.trim() || null, linked_by: user.user?.id ?? null,
    }).eq('id', existing.data.id);
    setBusy(null);
    if (error) { toast.error(`No se pudo vincular: ${error.message}`); return; }
    toast.success('Equipo vinculado: en unos segundos pasa a la cabina.');
    setCode('');
    setName('');
    onChange();
  };

  const update = async (device: VideoDeviceRow, patch: Record<string, unknown>, ok: string) => {
    setBusy(device.id);
    const { error } = await supabase.from('video_devices').update(patch).eq('id', device.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success(ok); onChange(); }
  };

  const remove = async (device: VideoDeviceRow) => {
    if (!window.confirm(`¿Borrar el equipo ${device.name || device.device_code}? Si vuelve a prenderse aparece de nuevo como pendiente.`)) return;
    setBusy(device.id);
    const { error } = await supabase.from('video_devices').delete().eq('id', device.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success('Equipo borrado'); onChange(); }
  };

  const linked = devices.filter(d => d.pairing_status === 'linked');
  const pending = devices.filter(d => d.pairing_status !== 'linked');

  return (
    <div className="space-y-6">
      <section className={`${card} space-y-4`}>
        <h2 className="text-base font-bold text-white">Vincular un equipo</h2>
        <p className="text-sm text-slate-400">Abrí la app <b>EventPix Video</b> en el equipo: muestra un código de 6 caracteres.</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] items-end">
          <Field label="Código">
            <input className={`${input} font-mono uppercase tracking-widest`} value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC234" />
          </Field>
          <Field label="Nombre (opcional)">
            <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Cabina 360 Nº 1" />
          </Field>
          <button onClick={() => void link()} disabled={busy === 'link'} className={btnPrimary}><Link2 className="h-4 w-4" /> Vincular</button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-white">Equipos vinculados ({linked.length})</h2>
        {!linked.length && <p className="text-sm text-slate-500">Todavía no hay equipos vinculados.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {linked.map(d => {
            const online = !!d.last_seen && loadedAt - new Date(d.last_seen).getTime() < ONLINE_WINDOW_MS;
            const pendingSettings = d.settings_rev > d.applied_rev;
            const event = (d.reported?.video?.eventTitle as string | undefined) || '';
            const gallery = ((d.settings?.video?.galleryCode ?? d.reported?.video?.galleryCode) as string | undefined) || '';
            const site = (String(d.reported?.video?.publicSiteUrl ?? '').trim() || DEFAULT_PUBLIC_SITE);
            return (
              <div key={d.id} className={`${card} space-y-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{d.name || 'Sin nombre'}</p>
                    <p className="font-mono text-xs text-slate-400">{d.device_code}{d.app_version ? ` · v${d.app_version}` : ''}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}>
                    {online ? 'En línea' : `Visto ${relative(d.last_seen, loadedAt)}`}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {event ? <>Evento: <span className="text-slate-200">{event}</span></> : 'Sin evento'}
                  {pendingSettings && <span className="ml-2 text-amber-300">· cambios esperando que se prenda</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onConfigure(d)} className={btnPrimary}><Settings2 className="h-4 w-4" /> Configurar</button>
                  {gallery && <GalleryLinks site={site} code={gallery} compact />}
                  <button onClick={() => { const n = window.prompt('Nombre del equipo', d.name ?? ''); if (n !== null) void update(d, { name: n.trim() || null }, 'Nombre cambiado'); }} disabled={busy === d.id} className={btnGhost}>Renombrar</button>
                  <button onClick={() => void update(d, { pairing_status: 'pending' }, 'Equipo desvinculado')} disabled={busy === d.id} className={btnGhost}><Unlink className="h-4 w-4" /> Desvincular</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white">Esperando vinculación ({pending.length})</h2>
          <div className="flex flex-wrap gap-2">
            {pending.map(d => (
              <span key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
                <button onClick={() => setCode(d.device_code)} className="font-mono text-slate-200 hover:text-white" title="Usar este código">{d.device_code}</button>
                <span className="text-slate-500">{relative(d.last_seen, loadedAt)}</span>
                <button onClick={() => void remove(d)} disabled={busy === d.id} className={`${btnDanger} px-2 py-1`} aria-label="Borrar"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
