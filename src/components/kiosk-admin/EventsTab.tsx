import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckSquare, Download, ExternalLink, FolderOpen, KeyRound, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { folderNameFor } from '@/lib/kioskStorage';
import {
  deleteDriveFolder, deleteDrivePhotos, driveDownloadUrl, listDriveFolders, listDrivePhotos,
  type DriveFolder, type DrivePhoto,
} from '@/lib/driveAdmin';
import { btnDanger, btnGhost, btnPrimary, card, input } from './ui';
import type { KioskDeviceRow, KioskEventRow } from './types';

// Eventos (kiosk_events) y sus fotos en Google Drive. Cada evento usa una carpeta
// con su nombre (el equipo sube a la carpeta de su "Nombre del evento"), así que
// acá se cruzan por nombre. También aparecen carpetas de Drive sin evento creado.

const PAGE = 40;

interface Row { key: string; name: string; event?: KioskEventRow; folder?: DriveFolder }

export default function EventsTab({ events, devices, onChange }: {
  events: KioskEventRow[];
  devices: KioskDeviceRow[];
  onChange: () => void;
}) {
  const [folders, setFolders] = useState<DriveFolder[] | null>(null);
  const [rootUrl, setRootUrl] = useState('');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await listDriveFolders();
      setFolders(res.folders);
      setRootUrl(res.rootUrl);
      setDriveError(null);
    } catch (e) {
      setDriveError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFolders(false);
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(loadFolders, 0);
    return () => window.clearTimeout(t);
  }, [loadFolders]);

  const createEvent = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('kiosk_events').insert({ name: newName.trim(), event_date: newDate || null });
    if (error) {
      toast.error(`No se pudo crear: ${error.message}`);
      return;
    }
    setNewName('');
    setNewDate('');
    onChange();
  };

  const deleteEvent = async (ev: KioskEventRow) => {
    if (!window.confirm(`¿Borrar el evento "${ev.name}"? Las fotos en Drive no se borran.`)) return;
    const { error } = await supabase.from('kiosk_events').delete().eq('id', ev.id);
    if (error) toast.error(error.message);
    else onChange();
  };

  // Eventos + carpetas de Drive, cruzados por nombre de carpeta
  const rows: Row[] = events.map(ev => ({ key: ev.id, name: ev.name, event: ev, folder: folders?.find(f => f.name === folderNameFor(ev.name)) }));
  for (const f of folders ?? []) {
    if (!rows.some(r => r.folder?.id === f.id)) rows.push({ key: f.id, name: f.name, folder: f });
  }
  const current = rows.find(r => r.key === selected) ?? null;

  return (
    <div className="space-y-6">
      {/* Conexión con Drive (configurada en Supabase: función drive-admin) */}
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-violet-300" />
            {driveError ? <span className="text-amber-300">Drive: {driveError}</span>
              : folders ? <span className="text-slate-300">Fotos en Drive conectadas{rootUrl && <> · <a href={rootUrl} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">abrir carpeta</a></>}</span>
              : <span className="text-slate-400">Conectando con Drive…</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={loadFolders} disabled={loadingFolders} className={btnGhost}><RefreshCw className={`h-4 w-4 ${loadingFolders ? 'animate-spin' : ''}`} /> Actualizar</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className={`${card} space-y-3`}>
            <h3 className="text-base font-bold text-white">Nuevo evento</h3>
            <input className={input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="15 de Pía" />
            <input className={input} type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <button onClick={createEvent} disabled={!newName.trim()} className={`${btnPrimary} w-full`}><Plus className="h-4 w-4" /> Crear evento</button>
            <p className="text-xs text-slate-500">Después asignalo a un equipo en Equipos: la TV toma el nombre y sube las fotos a su carpeta.</p>
          </div>

          <div className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-slate-400">Todavía no hay eventos.</p>}
            {rows.map(r => {
              const onDevices = r.event ? devices.filter(d => d.kiosk_event_id === r.event!.id) : [];
              return (
                <button key={r.key} onClick={() => setSelected(r.key)}
                  className={`w-full rounded-xl border px-4 py-3 text-left ${selected === r.key ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'}`}>
                  <p className="font-semibold text-white">{r.name}</p>
                  <p className="text-xs text-slate-400">
                    {r.event?.event_date ? `${new Date(`${r.event.event_date}T12:00`).toLocaleDateString('es-AR')} · ` : ''}
                    {r.folder ? `${r.folder.count} fotos` : 'sin fotos en Drive'}
                    {!r.event && ' · solo carpeta'}
                    {onDevices.length > 0 && ` · en ${onDevices.map(d => d.name || d.device_code).join(', ')}`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {current ? (
            <EventPhotos key={current.key} row={current} onDeleteEvent={current.event ? () => deleteEvent(current.event!) : undefined}
              onFolderDeleted={() => { setSelected(null); void loadFolders(); }} onPhotosDeleted={loadFolders} />
          ) : (
            <div className={`${card} flex min-h-[240px] items-center justify-center text-slate-400`}>
              <FolderOpen className="mr-2 h-5 w-5" /> Elegí un evento para ver sus fotos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventPhotos({ row, onDeleteEvent, onFolderDeleted, onPhotosDeleted }: {
  row: Row;
  onDeleteEvent?: () => void;
  onFolderDeleted: () => void;
  onPhotosDeleted: () => void;
}) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const folder = row.folder;

  const load = useCallback(async (offset: number) => {
    if (!folder) return;
    setLoading(true);
    try {
      const res = await listDrivePhotos(folder.id, offset, PAGE);
      setPhotos(p => (offset ? [...p, ...res.photos] : res.photos));
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [folder]);
  useEffect(() => {
    const t = window.setTimeout(() => load(0), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const toggle = (id: string) => setPicked(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const removePicked = async () => {
    if (!picked.size || !window.confirm(`¿Borrar ${picked.size} foto(s)? Van a la papelera de Drive (se recuperan durante 30 días).`)) return;
    try {
      const res = await deleteDrivePhotos([...picked]);
      toast.success(`${res.deleted} foto(s) borradas`);
      setPhotos(p => p.filter(x => !picked.has(x.id)));
      setTotal(t => t - res.deleted);
      setPicked(new Set());
      onPhotosDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const removeFolder = async () => {
    if (!folder || !window.confirm(`¿Borrar TODAS las fotos de "${row.name}" (${folder.count})? La carpeta va a la papelera de Drive.`)) return;
    try {
      await deleteDriveFolder(folder.id);
      toast.success('Carpeta borrada');
      onFolderDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{row.name}</h3>
          <p className="text-sm text-slate-400">{folder ? `${total || folder.count} fotos en Drive` : 'Todavía no hay fotos de este evento en Drive.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {folder && <a href={folder.url} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" /> Abrir en Drive</a>}
          {photos.length > 0 && (
            <button onClick={() => setPicked(s => (s.size === photos.length ? new Set() : new Set(photos.map(p => p.id))))} className={btnGhost}>
              {picked.size === photos.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Elegir todas
            </button>
          )}
          {picked.size > 0 && <button onClick={removePicked} className={btnDanger}><Trash2 className="h-4 w-4" /> Borrar {picked.size}</button>}
          {folder && <button onClick={removeFolder} className={btnDanger}><Trash2 className="h-4 w-4" /> Borrar todas</button>}
          {onDeleteEvent && <button onClick={onDeleteEvent} className={btnGhost}><Trash2 className="h-4 w-4" /> Borrar evento</button>}
        </div>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map(p => (
          <div key={p.id} className={`group relative overflow-hidden rounded-xl border ${picked.has(p.id) ? 'border-violet-500 ring-2 ring-violet-500' : 'border-slate-800'} bg-slate-950`}>
            <button onClick={() => toggle(p.id)} className="block aspect-[3/4] w-full">
              {p.thumb
                ? <img src={p.thumb} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                : <span className="flex h-full items-center justify-center text-xs text-slate-500">Sin miniatura</span>}
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white">
              <span className="truncate">{new Date(p.created).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex gap-1">
                <a href={p.url} target="_blank" rel="noreferrer" title="Ver" className="rounded bg-white/15 p-1 hover:bg-white/30"><ExternalLink className="h-3.5 w-3.5" /></a>
                <a href={driveDownloadUrl(p.id)} target="_blank" rel="noreferrer" title="Descargar" className="rounded bg-white/15 p-1 hover:bg-white/30"><Download className="h-3.5 w-3.5" /></a>
              </span>
            </div>
            {picked.has(p.id) && <CheckSquare className="absolute right-2 top-2 h-5 w-5 text-violet-300" />}
          </div>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">Cargando fotos…</p>}
      {!loading && photos.length < total && (
        <button onClick={() => load(photos.length)} className={btnGhost}>Ver más ({total - photos.length})</button>
      )}
    </div>
  );
}
