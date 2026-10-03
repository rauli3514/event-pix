import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Equipos de la app "EventPix Kiosco" (TV box). El equipo muestra su código;
// acá se carga, se le pone nombre y se elige el evento al que sube las fotos.
// Ver supabase/migrations/20261003000000_kiosk_devices.sql.

interface KioskDevice {
  id: string;
  device_code: string;
  name: string | null;
  pairing_status: 'pending' | 'linked';
  kiosk_event_id: string | null;
  app_version: string | null;
  last_seen: string | null;
}

interface KioskEventOption {
  id: string;
  name: string;
}

// El equipo vinculado avisa cada minuto
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

const selectClass = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none';

export default function KioskDevicesPanel({ events }: { events: KioskEventOption[] }) {
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  // Hora de la última carga, para calcular "En línea" sin leer el reloj al renderizar
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [eventId, setEventId] = useState('');
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kiosk_devices')
      .select('id, device_code, name, pairing_status, kiosk_event_id, app_version, last_seen')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(`No se pudieron cargar los equipos: ${error.message}`);
      return;
    }
    setDevices(data || []);
    setLoadedAt(Date.now());
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    return () => window.clearTimeout(first);
  }, [load]);

  const link = async () => {
    const deviceCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(deviceCode)) {
      toast.error('El código tiene 6 letras o números, como aparece en la TV');
      return;
    }
    setLinking(true);
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('kiosk_devices')
      .update({
        pairing_status: 'linked',
        name: name.trim() || null,
        kiosk_event_id: eventId || null,
        linked_by: user.user?.id ?? null,
      })
      .eq('device_code', deviceCode)
      .select('id');
    setLinking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data?.length) {
      toast.error('No encontramos ese código. Abrí EventPix Kiosco en la TV box para que se registre y probá de nuevo.');
      return;
    }
    toast.success('Equipo vinculado. La TV box se actualiza sola en unos segundos.');
    setCode('');
    setName('');
    await load();
  };

  const updateDevice = async (id: string, patch: Partial<KioskDevice>) => {
    const { error } = await supabase.from('kiosk_devices').update(patch).eq('id', id);
    if (error) toast.error(error.message);
    await load();
  };

  const removeDevice = async (device: KioskDevice) => {
    if (!window.confirm(`¿Borrar el equipo ${device.name || device.device_code}? Si la app sigue abierta, vuelve a aparecer como pendiente.`)) return;
    const { error } = await supabase.from('kiosk_devices').delete().eq('id', device.id);
    if (error) toast.error(error.message);
    await load();
  };

  const isOnline = (d: KioskDevice) =>
    !!d.last_seen && loadedAt - new Date(d.last_seen).getTime() < ONLINE_WINDOW_MS;

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Vincular un equipo</CardTitle>
          <p className="text-sm text-slate-400">
            Abrí <b>EventPix Kiosco</b> en la TV box: muestra un código de 6 caracteres. Cargalo acá y elegí el evento.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-slate-300">Código</Label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" className="bg-slate-950 border-slate-800 text-white font-mono tracking-widest uppercase" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Nombre</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tótem 1" className="bg-slate-950 border-slate-800 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Evento</Label>
            <select value={eventId} onChange={e => setEventId(e.target.value)} className={selectClass}>
              <option value="">Sin evento</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
          <Button onClick={link} disabled={linking || code.trim().length !== 6} className="bg-violet-600 hover:bg-violet-700 py-6">
            {linking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />} Vincular
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Equipos</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="bg-slate-950 border-slate-800">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!devices.length && <p className="text-slate-500 text-sm">Todavía no hay equipos.</p>}
          {devices.map(d => (
            <div key={d.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-center rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div>
                <p className="text-white font-semibold">{d.name || 'Sin nombre'}</p>
                <p className="text-slate-400 text-sm font-mono">{d.device_code}</p>
                <p className="text-xs mt-1">
                  <span className={isOnline(d) ? 'text-emerald-400' : 'text-slate-500'}>{isOnline(d) ? '● En línea' : '○ Desconectado'}</span>
                  <span className="text-slate-500"> · {d.pairing_status === 'linked' ? 'Vinculado' : 'Pendiente'}</span>
                  {d.app_version && <span className="text-slate-500"> · v{d.app_version}</span>}
                </p>
              </div>
              <select
                value={d.kiosk_event_id || ''}
                onChange={e => updateDevice(d.id, { kiosk_event_id: e.target.value || null, pairing_status: 'linked' })}
                className={selectClass}
              >
                <option value="">Sin evento</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              <div className="flex gap-2">
                {d.pairing_status === 'linked' && (
                  <Button variant="outline" size="sm" onClick={() => updateDevice(d.id, { pairing_status: 'pending', kiosk_event_id: null })} className="bg-slate-950 border-slate-800" title="Desvincular">
                    <Unlink className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => removeDevice(d)} className="bg-slate-950 border-slate-800 text-red-400" title="Borrar">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
