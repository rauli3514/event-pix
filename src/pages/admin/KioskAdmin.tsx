import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import DevicesTab from '@/components/kiosk-admin/DevicesTab';
import DeviceConfig from '@/components/kiosk-admin/DeviceConfig';
import EventsTab from '@/components/kiosk-admin/EventsTab';
import { btnGhost } from '@/components/kiosk-admin/ui';
import type { KioskDeviceRow, KioskEventRow } from '@/components/kiosk-admin/types';

// Panel admin del kiosco (app.eventpix.com.ar/admin/kioscos): equipos, su
// configuración a distancia y los eventos con sus fotos en Drive.

const DEVICE_COLUMNS = 'id, device_code, name, pairing_status, kiosk_event_id, app_version, last_seen';
const REMOTE_COLUMNS = 'settings, settings_rev, applied_rev, reported, reported_at';

type Tab = 'devices' | 'events';

export default function KioskAdmin() {
  const [tab, setTab] = useState<Tab>('devices');
  const [devices, setDevices] = useState<KioskDeviceRow[]>([]);
  const [events, setEvents] = useState<KioskEventRow[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [missingMigration, setMissingMigration] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const query = (columns: string) => supabase.from('kiosk_devices').select(columns).order('created_at', { ascending: false });
    let res = await query(`${DEVICE_COLUMNS}, ${REMOTE_COLUMNS}`);
    // Base sin la migración de configuración remota: se listan igual
    const missing = !!res.error && /settings|reported|applied_rev|column/i.test(res.error.message);
    if (missing) res = await query(DEVICE_COLUMNS);
    const ev = await supabase.from('kiosk_events').select('id, name, event_date, created_at').order('created_at', { ascending: false });
    setLoading(false);
    setMissingMigration(missing);
    if (res.error) toast.error(`No se pudieron cargar los equipos: ${res.error.message}`);
    else setDevices((res.data ?? []) as unknown as KioskDeviceRow[]);
    if (ev.error) toast.error(`No se pudieron cargar los eventos: ${ev.error.message}`);
    else setEvents((ev.data ?? []) as KioskEventRow[]);
    setLoadedAt(Date.now());
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    // Estado "en línea" al día mientras el panel está abierto
    const timer = window.setInterval(load, 60000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  const device = devices.find(d => d.id === configuring) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/admin" className={btnGhost}><ArrowLeft className="h-4 w-4" /> Admin</Link>
            <div>
              <h1 className="text-xl font-bold text-white">Kioscos</h1>
              <p className="text-xs text-slate-400">Equipos, eventos y fotos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-xl border border-slate-800 p-1">
              <button onClick={() => { setTab('devices'); setConfiguring(null); }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'devices' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <MonitorSmartphone className="h-4 w-4" /> Equipos
              </button>
              <button onClick={() => { setTab('events'); setConfiguring(null); }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'events' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <CalendarDays className="h-4 w-4" /> Eventos y fotos
              </button>
            </nav>
            <button onClick={load} disabled={loading} className={btnGhost} aria-label="Actualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {missingMigration && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Para configurar los equipos a distancia falta correr en Supabase (SQL Editor) el archivo
            <code className="mx-1 rounded bg-black/30 px-1">supabase/migrations/20261004000000_kiosk_remote_settings.sql</code>.
          </p>
        )}
        {tab === 'devices' && (device && !missingMigration
          ? <DeviceConfig key={device.id} device={device} onClose={() => setConfiguring(null)} onSaved={() => { setConfiguring(null); void load(); }} />
          : <DevicesTab devices={devices} events={events} loadedAt={loadedAt} onChange={load}
              onConfigure={d => (missingMigration ? toast.error('Primero corré la migración de configuración remota') : setConfiguring(d.id))} />)}
        {tab === 'events' && <EventsTab events={events} devices={devices} onChange={load} />}
      </main>
    </div>
  );
}
