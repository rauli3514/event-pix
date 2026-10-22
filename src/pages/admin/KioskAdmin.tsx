import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, Coins, MonitorSmartphone, RefreshCw, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import DevicesTab from '@/components/kiosk-admin/DevicesTab';
import DeviceConfig from '@/components/kiosk-admin/DeviceConfig';
import EventsTab from '@/components/kiosk-admin/EventsTab';
import ClientsTab from '@/components/kiosk-admin/ClientsTab';
import ThemesTab from '@/components/kiosk-admin/ThemesTab';
import { btnGhost } from '@/components/kiosk-admin/ui';
import type { KioskAccountRow, KioskDeviceRow, KioskEventRow } from '@/components/kiosk-admin/types';

// Panel admin del kiosco (app.eventpix.com.ar/admin/kioscos): equipos, su
// configuración a distancia, los eventos con sus fotos en Drive y los clientes
// con sus créditos de IA.

const DEVICE_COLUMNS = 'id, device_code, name, pairing_status, kiosk_event_id, app_version, last_seen';
const REMOTE_COLUMNS = 'settings, settings_rev, applied_rev, reported, reported_at';
const CREDIT_COLUMNS = 'account_id';

type Tab = 'devices' | 'events' | 'clients' | 'themes';

export default function KioskAdmin() {
  const [tab, setTab] = useState<Tab>('devices');
  const [devices, setDevices] = useState<KioskDeviceRow[]>([]);
  const [events, setEvents] = useState<KioskEventRow[]>([]);
  const [accounts, setAccounts] = useState<KioskAccountRow[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [missingMigration, setMissingMigration] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const query = (columns: string) => supabase.from('kiosk_devices').select(columns).order('created_at', { ascending: false });
    const isColumnError = (msg?: string) => !!msg && /settings|reported|applied_rev|account_id|column/i.test(msg);
    let res = await query(`${DEVICE_COLUMNS}, ${REMOTE_COLUMNS}, ${CREDIT_COLUMNS}`);
    // Base sin las migraciones nuevas: se listan igual con lo que haya
    if (res.error && isColumnError(res.error.message)) res = await query(`${DEVICE_COLUMNS}, ${REMOTE_COLUMNS}`);
    const missing = !!res.error && isColumnError(res.error.message);
    if (missing) res = await query(DEVICE_COLUMNS);
    const acc = await supabase.from('kiosk_accounts').select('id, name, contact, credits, created_at').order('name');
    // Sin la migración de créditos, la pestaña Clientes avisa
    setAccounts(acc.error ? null : (acc.data ?? []) as KioskAccountRow[]);
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
              <button onClick={() => { setTab('clients'); setConfiguring(null); }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'clients' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Coins className="h-4 w-4" /> Clientes y créditos
              </button>
              <button onClick={() => { setTab('themes'); setConfiguring(null); }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'themes' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Wand2 className="h-4 w-4" /> Temáticas IA
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
          : <DevicesTab devices={devices} events={events} accounts={accounts} loadedAt={loadedAt} onChange={load}
              onConfigure={d => (missingMigration ? toast.error('Primero corré la migración de configuración remota') : setConfiguring(d.id))} />)}
        {tab === 'themes' && <ThemesTab />}
        {tab === 'events' && <EventsTab events={events} devices={devices} onChange={load} />}
        {tab === 'clients' && (accounts
          ? <ClientsTab accounts={accounts} devices={devices} onChange={load} />
          : (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Para usar clientes y créditos falta correr en Supabase (SQL Editor) el archivo
              <code className="mx-1 rounded bg-black/30 px-1">supabase/migrations/20261005000000_kiosk_credits.sql</code>.
            </p>
          ))}
      </main>
    </div>
  );
}
