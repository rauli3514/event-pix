import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { HardDrive, Trash2 } from 'lucide-react';
import { deletePhotos, eventFolder, formatBytes, storageInfo, type StorageInfo } from '@/lib/kioskStorage';
import { buttonClass, Panel } from './ui';

// Espacio del equipo y borrado de fotos (con doble toque para confirmar: se usa con el control).
export default function StoragePanel() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [confirm, setConfirm] = useState<'event' | 'all' | null>(null);
  const folder = eventFolder();

  const refresh = useCallback(() => {
    storageInfo().then(setInfo).catch(() => setInfo(null));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // El pedido de confirmación se olvida a los 5 segundos
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), 5000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const remove = async (which: 'event' | 'all') => {
    if (confirm !== which) { setConfirm(which); return; }
    setConfirm(null);
    try {
      const n = await deletePhotos(which === 'event' ? folder : null);
      toast.success(`Se borraron ${n} fotos del equipo`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron borrar');
    }
    refresh();
  };

  const used = info ? Math.max(0, info.total - info.free) : 0;
  const pct = info && info.total ? Math.min(100, (used / info.total) * 100) : 0;
  const photosPct = info && info.total ? Math.min(100, (info.photosBytes / info.total) * 100) : 0;
  const color = pct > 90 ? 'from-red-500 to-red-400' : pct > 75 ? 'from-amber-500 to-amber-400' : 'from-[#00d4ff] to-[#7b2ff7]';

  return (
    <Panel title="Almacenamiento del equipo" description="Cuánto espacio queda y cuánto ocupan las fotos. Conviene borrar cuando la barra pasa el 80 %.">
      {info ? (
        <>
          <div className="flex items-center gap-3">
            <HardDrive className="w-7 h-7 text-[#00d4ff] shrink-0" />
            <div className="flex-1">
              <div className="relative h-6 rounded-full bg-white/10 overflow-hidden">
                <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                {/* parte que ocupan las fotos de EventPix */}
                <div className="absolute inset-y-0 left-0 bg-[#ff2e93]" style={{ width: `${photosPct}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-white/75">
                <span><b className="text-white">{formatBytes(info.free)}</b> libres de {formatBytes(info.total)}</span>
                <span>{Math.round(pct)} % usado</span>
              </div>
            </div>
          </div>
          <p className="text-white/70">
            <span className="inline-block w-3 h-3 rounded-full bg-[#ff2e93] mr-2" />
            Fotos de EventPix: <b className="text-white">{info.photosCount}</b> ({formatBytes(info.photosBytes)}) ·
            de este evento ({folder}): <b className="text-white">{info.eventCount}</b> ({formatBytes(info.eventBytes)})
          </p>
          <p className="text-white/50 text-sm">Cada foto ocupa ~1 a 3 MB (la final más la original). Unas 1.000 fotos son ~2 GB.</p>
        </>
      ) : (
        <p className="text-white/60">Leyendo el almacenamiento…</p>
      )}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => remove('event')} className={`${buttonClass} ${confirm === 'event' ? 'bg-red-600 hover:bg-red-500' : ''}`}>
          <Trash2 className="w-5 h-5" /> {confirm === 'event' ? 'Tocá de nuevo para borrar' : `Borrar fotos de "${folder}"`}
        </button>
        <button onClick={() => remove('all')} className={`${buttonClass} ${confirm === 'all' ? 'bg-red-600 hover:bg-red-500' : ''}`}>
          <Trash2 className="w-5 h-5" /> {confirm === 'all' ? 'Tocá de nuevo para borrar TODO' : 'Borrar todas las fotos del equipo'}
        </button>
      </div>
      <p className="text-white/50 text-sm">
        Antes de borrar, bajá las fotos: están en <b>Imágenes / EventPix / (carpeta del evento)</b>. Las ves con el administrador
        de archivos de la TV box y las podés copiar a un pendrive. Lo que ya se subió a Drive queda allá.
      </p>
    </Panel>
  );
}
