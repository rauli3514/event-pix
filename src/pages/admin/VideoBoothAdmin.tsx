import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Clapperboard, Library, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import DevicesTab from '@/components/video-admin/DevicesTab';
import DeviceConfig from '@/components/video-admin/DeviceConfig';
import GalleryTab from '@/components/video-admin/GalleryTab';
import LibraryTab from '@/components/video-admin/LibraryTab';
import { btnGhost } from '@/components/video-admin/ui';
import type { VideoDeviceRow } from '@/components/video-admin/types';

// Panel de la cabina de video (/admin/cabina-video): equipos de la app EventPix
// Video, su configuración a distancia y las galerías online. Separado del kiosco.

type Tab = 'devices' | 'galleries' | 'library';

export default function VideoBoothAdmin() {
  const [tab, setTab] = useState<Tab>('devices');
  const [devices, setDevices] = useState<VideoDeviceRow[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('video_devices').select('*').order('created_at', { ascending: false });
    setLoading(false);
    setMissing(!!error && /video_devices|relation|schema cache/i.test(error.message));
    if (error) { if (!/video_devices|relation|schema cache/i.test(error.message)) toast.error(`No se pudieron cargar los equipos: ${error.message}`); return; }
    setDevices((data ?? []) as VideoDeviceRow[]);
    setLoadedAt(Date.now());
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 60000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  const device = devices.find(d => d.id === configuring) ?? null;
  const tabClass = (t: Tab) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/admin" className={btnGhost}><ArrowLeft className="h-4 w-4" /> Admin</Link>
            <div>
              <h1 className="text-xl font-bold text-white">Cabina de video</h1>
              <p className="text-xs text-slate-400">App EventPix Video: equipos, configuración, galerías y biblioteca</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-xl border border-slate-800 p-1">
              <button onClick={() => { setTab('devices'); setConfiguring(null); }} className={tabClass('devices')}><MonitorSmartphone className="h-4 w-4" /> Equipos</button>
              <button onClick={() => { setTab('galleries'); setConfiguring(null); }} className={tabClass('galleries')}><Clapperboard className="h-4 w-4" /> Galerías</button>
              <button onClick={() => { setTab('library'); setConfiguring(null); }} className={tabClass('library')}><Library className="h-4 w-4" /> Biblioteca</button>
            </nav>
            <button onClick={() => void load()} disabled={loading} className={btnGhost} aria-label="Actualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {missing && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Falta correr en Supabase (SQL Editor) el archivo
            <code className="mx-1 rounded bg-black/30 px-1">supabase/migrations/20261022000000_video_booth.sql</code>.
          </p>
        )}
        {tab === 'devices' && (device
          ? <DeviceConfig key={device.id} device={device} onClose={() => setConfiguring(null)} onSaved={() => { setConfiguring(null); void load(); }} />
          : <DevicesTab devices={devices} loadedAt={loadedAt} onChange={() => void load()} onConfigure={d => setConfiguring(d.id)} />)}
        {tab === 'galleries' && <GalleryTab devices={devices} />}
        {tab === 'library' && <LibraryTab />}
      </main>
    </div>
  );
}
