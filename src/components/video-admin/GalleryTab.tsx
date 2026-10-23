import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Eye, EyeOff, Loader2, MessageCircle, Play, RefreshCw, Trash2, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PUBLIC_SITE, driveImageUrl } from '@/lib/videoBooth/share';
import { btnDanger, btnGhost, btnPrimary, card } from './ui';
import type { VideoDeviceRow } from './types';

// Moderación de las galerías online de la cabina de video: ver todos los videos
// de una galería (también los ocultos o pendientes de aprobación), aprobar,
// ocultar o sacar de la galería, y ver los envíos por WhatsApp.

interface Clip {
  id: string; gallery: string; drive_id: string; thumb_id: string | null; title: string | null;
  mode: string | null; device_id: string | null; created_at: string; hidden?: boolean;
}
interface GallerySummary { code: string; title: string; count: number; hidden: number; last: string }
type Filter = 'all' | 'visible' | 'hidden';

const MODE_LABEL: Record<string, string> = {
  clasico: 'Video', boomerang: 'Boomerang', lenta: 'Cámara lenta', '360': '360', firmas: 'Libro de firmas', glam: 'Glam',
};

const clipUrl = (siteUrl: string, c: Clip) => `${siteUrl}/clip?${new URLSearchParams({ d: c.drive_id, ...(c.title ? { t: c.title } : {}) }).toString()}`;

export default function GalleryTab({ devices }: { devices: VideoDeviceRow[] }) {
  const [galleries, setGalleries] = useState<GallerySummary[] | null>(null);
  const [code, setCode] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState('');
  const [sends, setSends] = useState<{ sent: number; failed: number } | null>(null);
  const [busy, setBusy] = useState('');

  // Galerías con videos (y las configuradas en los equipos aunque estén vacías)
  const loadGalleries = useCallback(async () => {
    const fetchRows = async (cols: string) => {
      const res = await supabase.from('video_clips').select(cols).order('created_at', { ascending: false }).limit(5000);
      return { data: res.data as unknown[] | null, error: res.error };
    };
    const { data, error } = await fetchRows('gallery, title, created_at, hidden');
    if (error) {
      setMissing(/video_clips|relation|schema cache/i.test(error.message) ? 'Falta correr la migración 20261022000000_video_booth.sql en Supabase.' : error.message);
      setGalleries([]);
      return;
    }
    const map = new Map<string, GallerySummary>();
    for (const row of (data ?? []) as { gallery: string; title: string | null; created_at: string; hidden?: boolean }[]) {
      const g = map.get(row.gallery) ?? { code: row.gallery, title: row.title ?? '', count: 0, hidden: 0, last: row.created_at };
      g.count++;
      if (row.hidden) g.hidden++;
      if (!g.title && row.title) g.title = row.title;
      map.set(row.gallery, g);
    }
    for (const d of devices) {
      const gc = (d.reported?.video?.galleryCode ?? d.settings?.video?.galleryCode) as string | undefined;
      if (gc && !map.has(gc)) map.set(gc, { code: gc, title: '', count: 0, hidden: 0, last: '' });
    }
    const list = [...map.values()].sort((a, b) => (b.last || '').localeCompare(a.last || ''));
    setGalleries(list);
    setCode(c => c || list[0]?.code || '');
  }, [devices]);

  const loadClips = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    const cols = 'id, gallery, drive_id, thumb_id, title, mode, device_id, created_at, hidden';
    const { data, error } = await supabase.from('video_clips').select(cols).eq('gallery', code).order('created_at', { ascending: false }).limit(1000);
    setLoading(false);
    if (error) { toast.error(`No se pudieron cargar los videos: ${error.message}`); return; }
    setClips((data ?? []) as unknown as Clip[]);
    const s = await supabase.from('video_sends').select('status').eq('gallery', code).limit(5000);
    if (s.error) setSends(null);
    else {
      const rows = (s.data ?? []) as { status: string }[];
      setSends({ sent: rows.filter(r => r.status === 'sent').length, failed: rows.filter(r => r.status === 'failed').length });
    }
  }, [code]);

  useEffect(() => { const t = window.setTimeout(loadGalleries, 0); return () => window.clearTimeout(t); }, [loadGalleries]);
  useEffect(() => {
    const first = window.setTimeout(loadClips, 0);
    if (!code) return () => window.clearTimeout(first);
    // Videos nuevos en vivo mientras se modera
    let pending = 0;
    const channel = supabase.channel(`admin-video-clips:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_clips', filter: `gallery=eq.${code}` }, () => {
        window.clearTimeout(pending);
        pending = window.setTimeout(loadClips, 500);
      })
      .subscribe();
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [code, loadClips]);

  const setHidden = async (ids: string[], hidden: boolean) => {
    if (!ids.length) return;
    setBusy(hidden ? 'hide' : 'show');
    const { error } = await supabase.from('video_clips').update({ hidden }).in('id', ids);
    setBusy('');
    if (error) { toast.error(`No se pudo cambiar: ${error.message}`); return; }
    setClips(list => list.map(c => (ids.includes(c.id) ? { ...c, hidden } : c)));
    toast.success(hidden ? 'Oculto de la galería' : 'Visible en la galería');
  };

  const remove = async (clip: Clip) => {
    if (!window.confirm('¿Sacar el video de la galería? (el archivo sigue en el Drive de la cabina y en el equipo)')) return;
    setBusy(clip.id);
    const { error } = await supabase.from('video_clips').delete().eq('id', clip.id);
    setBusy('');
    if (error) { toast.error(`No se pudo borrar: ${error.message}`); return; }
    setClips(list => list.filter(c => c.id !== clip.id));
    toast.success('Video borrado');
  };

  const shown = useMemo(() => clips.filter(c => filter === 'all' || (filter === 'hidden' ? c.hidden : !c.hidden)), [clips, filter]);
  const hiddenIds = clips.filter(c => c.hidden).map(c => c.id);
  const deviceName = (id: string | null) => {
    const d = devices.find(x => x.id === id);
    return d?.name || d?.device_code || '';
  };
  const usedBy = devices.filter(d => ((d.reported?.video?.galleryCode ?? d.settings?.video?.galleryCode) as string | undefined) === code);
  const current = galleries?.find(g => g.code === code);
  const siteUrl = (String(usedBy[0]?.reported?.video?.publicSiteUrl ?? '').trim() || DEFAULT_PUBLIC_SITE).replace(/\/+$/, '');

  if (galleries === null) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>;
  if (missing) return <div className={`${card} text-amber-200`}>{missing}</div>;
  if (!galleries.length) {
    return (
      <div className={`${card} text-slate-400`}>
        Todavía no hay galerías. Se crean solas cuando un equipo de la cabina sube su primer video (con Drive configurado).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 min-w-[16rem] flex-1">
            <span className="text-sm font-medium text-slate-300">Galería</span>
            <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" value={code} onChange={e => setCode(e.target.value)}>
              {galleries.map(g => (
                <option key={g.code} value={g.code}>
                  {(g.title || 'Sin nombre')} · {g.code} · {g.count} video{g.count === 1 ? '' : 's'}{g.hidden ? ` (${g.hidden} ocultos)` : ''}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => { void loadGalleries(); void loadClips(); }} className={btnGhost}><RefreshCw className="h-4 w-4" /> Actualizar</button>
          <a href={`${siteUrl}/galeria-video/${code}`} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" /> Ver galería</a>
          <a href={`${siteUrl}/galeria-video/${code}?pantalla=1`} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" /> Modo pantalla</a>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <span>{current?.count ?? clips.length} videos{hiddenIds.length ? ` · ${hiddenIds.length} ocultos o pendientes` : ''}</span>
          {sends && <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-emerald-400" /> {sends.sent} enviados por WhatsApp{sends.failed ? ` · ${sends.failed} fallidos` : ''}</span>}
          {usedBy.length > 0 && <span>Equipos: {usedBy.map(d => d.name || d.device_code).join(', ')}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'visible', 'hidden'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filter === f ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-300'}`}>
              {f === 'all' ? 'Todos' : f === 'visible' ? 'Visibles' : 'Ocultos / pendientes'}
            </button>
          ))}
          <span className="flex-1" />
          {hiddenIds.length > 0 && (
            <button onClick={() => void setHidden(hiddenIds, false)} disabled={!!busy} className={btnPrimary}><Check className="h-4 w-4" /> Aprobar todos ({hiddenIds.length})</button>
          )}
        </div>
      </div>

      {loading && !clips.length ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>
      ) : !shown.length ? (
        <p className="text-center text-slate-500 py-10">No hay videos {filter === 'hidden' ? 'ocultos' : filter === 'visible' ? 'visibles' : ''} en esta galería.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map(c => (
            <div key={c.id} className={`overflow-hidden rounded-2xl border ${c.hidden ? 'border-amber-500/50' : 'border-slate-800'} bg-slate-900/60`}>
              <a href={clipUrl(siteUrl, c)} target="_blank" rel="noreferrer" className="relative block aspect-[9/16] bg-black">
                {c.thumb_id ? (
                  <>
                    <img src={driveImageUrl(c.thumb_id, 400)} alt="" loading="lazy" className={`h-full w-full object-cover ${c.hidden ? 'opacity-50' : ''}`} />
                    <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/50 p-3"><Play className="h-5 w-5 fill-white text-white" /></span></span>
                  </>
                ) : <span className="flex h-full items-center justify-center"><Video className="h-8 w-8 text-slate-600" /></span>}
                {c.hidden && <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">Oculto</span>}
              </a>
              <div className="space-y-2 p-3">
                <p className="text-xs text-slate-400">
                  {MODE_LABEL[c.mode ?? ''] ?? c.mode ?? 'Video'} · {new Date(c.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {c.device_id ? ` · ${deviceName(c.device_id)}` : ''}
                </p>
                <div className="flex gap-2">
                  {(
                    <button onClick={() => void setHidden([c.id], !c.hidden)} disabled={!!busy} className={`${btnGhost} flex-1 px-2`} title={c.hidden ? 'Mostrar' : 'Ocultar'}>
                      {c.hidden ? <><Eye className="h-4 w-4" /> Mostrar</> : <><EyeOff className="h-4 w-4" /> Ocultar</>}
                    </button>
                  )}
                  <button onClick={() => void remove(c)} disabled={busy === c.id} className={`${btnDanger} px-2`} aria-label="Borrar"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
