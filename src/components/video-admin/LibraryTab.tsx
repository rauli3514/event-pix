import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Music, Pause, Play, Trash2, Upload } from 'lucide-react';
import {
  emptyLibrary, fetchLibrary, removeLibraryFiles, saveLibrary, uploadLibraryFile,
  type LibraryItem, type LibraryKind, type VideoLibrary,
} from '@/lib/videoBooth/library';
import { btnGhost, btnPrimary, card, input } from './ui';

// Biblioteca compartida de la cabina: lo que se sube acá lo bajan solos todos los
// equipos (los de ahora y los que se instalen después), sin configurarlos uno por uno.

const MAX_MB: Record<LibraryKind, number> = { songs: 15, frames: 8, backgrounds: 25 };
const KINDS: { kind: LibraryKind; title: string; hint: string; accept: string; button: string }[] = [
  { kind: 'songs', title: 'Música', hint: 'MP3. Conviene hasta 10 MB por canción (una canción entera de 3–4 minutos pesa 4–8 MB). En "Empieza en" marcá el segundo del estribillo.', accept: 'audio/*', button: 'Subir canciones' },
  { kind: 'frames', title: 'Marcos (plantillas)', hint: 'PNG con el centro transparente, con la forma del video (1080×1920 vertical).', accept: 'image/png,image/webp', button: 'Subir marcos' },
  { kind: 'backgrounds', title: 'Fondos de las pantallas', hint: 'Imágenes o videos cortos (1920×1080 para una tele horizontal). Los videos, livianos.', accept: 'image/png,image/jpeg,image/webp,video/mp4,video/webm', button: 'Subir fondos' },
];

function SongPreview({ url, start }: { url: string; start: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    a.currentTime = start;
    void a.play().then(() => setPlaying(true)).catch(() => {});
  };
  return (
    <>
      <audio ref={ref} src={url} preload="none" onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <button type="button" onClick={toggle} className={btnGhost} aria-label={playing ? 'Pausar' : 'Escuchar'}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
    </>
  );
}

export default function LibraryTab() {
  const [lib, setLib] = useState<VideoLibrary | null>(null);
  const [busy, setBusy] = useState<LibraryKind | 'save' | null>(null);
  const [dirty, setDirty] = useState(false);
  const inputs = useRef<Partial<Record<LibraryKind, HTMLInputElement | null>>>({});

  useEffect(() => {
    fetchLibrary().then(setLib).catch(e => { toast.error(e instanceof Error ? e.message : String(e)); setLib(emptyLibrary()); });
  }, []);

  const publish = async (next: VideoLibrary, message?: string) => {
    setBusy('save');
    try {
      await saveLibrary(next);
      setLib(next);
      setDirty(false);
      if (message) toast.success(message);
    } catch (e) {
      toast.error(`No se pudo guardar la biblioteca: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (kind: LibraryKind, files: FileList | null) => {
    if (!lib || !files?.length) return;
    setBusy(kind);
    const added: LibraryItem[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB[kind] * 1024 * 1024) { toast.error(`${file.name}: pesa más de ${MAX_MB[kind]} MB`); continue; }
        added.push(await uploadLibraryFile(kind, file));
      }
    } catch (e) {
      toast.error(`No se pudo subir: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
    if (added.length) await publish({ ...lib, [kind]: [...lib[kind], ...added] }, `${added.length} archivo${added.length === 1 ? '' : 's'} en la biblioteca. Los equipos los bajan solos.`);
  };

  const remove = async (kind: LibraryKind, item: LibraryItem) => {
    if (!lib || !window.confirm(`¿Sacar "${item.name}" de la biblioteca? Se borra de todos los equipos.`)) return;
    await publish({ ...lib, [kind]: lib[kind].filter(x => x.id !== item.id) }, 'Quitado de la biblioteca');
    void removeLibraryFiles([item.path]).catch(() => {});
  };

  const edit = (kind: LibraryKind, id: string, patch: Partial<LibraryItem>) => {
    if (!lib) return;
    setLib({ ...lib, [kind]: lib[kind].map(x => (x.id === id ? { ...x, ...patch } : x)) });
    setDirty(true);
  };

  if (!lib) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>;

  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-slate-300 max-w-3xl">
          Lo que subas acá lo tienen <b>todos los equipos</b> de la cabina, también los que instales después: lo bajan solos
          (al abrir la app y cada 10 minutos). Después, en cada equipo, elegís qué canción, marco o fondo usa cada experiencia.
        </p>
        {dirty && <button onClick={() => void publish(lib, 'Cambios guardados')} disabled={busy === 'save'} className={btnPrimary}>{busy === 'save' ? 'Guardando…' : 'Guardar cambios'}</button>}
      </div>
      {KINDS.map(({ kind, title, hint, accept, button }) => (
        <section key={kind} className={`${card} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">{title} <span className="text-sm font-normal text-slate-500">({lib[kind].length})</span></h3>
              <p className="text-xs text-slate-500">{hint}</p>
            </div>
            <input ref={el => { inputs.current[kind] = el; }} type="file" accept={accept} multiple className="hidden" onChange={e => { void upload(kind, e.target.files); e.target.value = ''; }} />
            <button onClick={() => inputs.current[kind]?.click()} disabled={!!busy} className={btnGhost}>
              {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === 'songs' ? <Upload className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
              {busy === kind ? 'Subiendo…' : button}
            </button>
          </div>
          {!lib[kind].length && <p className="text-sm text-slate-500">Todavía no hay nada.</p>}
          {kind === 'songs' ? (
            <div className="space-y-2">
              {lib.songs.map(sg => (
                <div key={sg.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 px-3 py-2">
                  <Music className="h-4 w-4 shrink-0 text-violet-400" />
                  <input className={`${input} min-w-[10rem] flex-1`} value={sg.name} onChange={e => edit('songs', sg.id, { name: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    Empieza en
                    <input type="number" min={0} className={`${input} w-20`} value={sg.start ?? 0} onChange={e => edit('songs', sg.id, { start: Math.max(0, Number(e.target.value) || 0) })} />
                    s
                  </label>
                  <SongPreview url={sg.url} start={sg.start ?? 0} />
                  <button type="button" onClick={() => void remove('songs', sg)} className={btnGhost} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {lib[kind].map(it => (
                <div key={it.id} className="w-32 space-y-1">
                  <div className="relative">
                    {/\.(mp4|webm)(\?|$)/i.test(it.url)
                      ? <video src={it.url} muted loop autoPlay playsInline className="h-28 w-full rounded-lg border border-slate-700 object-cover" />
                      : <img src={it.url} alt={it.name} className="h-28 w-full rounded-lg border border-slate-700 object-contain bg-[repeating-conic-gradient(#334155_0_25%,#1e293b_0_50%)] bg-[length:12px_12px]" />}
                    <button type="button" onClick={() => void remove(kind, it)} className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1" aria-label="Quitar"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <input className={`${input} py-1 text-xs`} value={it.name} onChange={e => edit(kind, it.id, { name: e.target.value })} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
