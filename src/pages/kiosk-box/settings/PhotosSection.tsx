import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { eventFolder, listEventPhotos } from '@/lib/kioskStorage';
import { Field, inputClass, Panel, Toggle } from './ui';

export default function PhotosSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const [count, setCount] = useState<number | null>(null);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const folder = eventFolder();

  useEffect(() => {
    listEventPhotos(1000).then(p => setCount(p.length)).catch(() => setCount(null));
  }, [folder]);

  return (
    <div className="space-y-6">
      <Panel title="Modo sin conexión" description="Para eventos sin internet: solo saca la foto, pone el marco, la imprime y la guarda en el equipo.">
        <Toggle label="Trabajar sin conexión" hint="Apaga Fotos IA, el QR, compartir y la subida a la nube."
          checked={!!settings.offline} onChange={offline => update({ offline })} />
      </Panel>

      <Panel title="Respaldo en el equipo" description="Cada foto se guarda en la galería del equipo: la original de la cámara y la final con marco.">
        <Field label="Carpeta del evento">
          <input className={inputClass} placeholder={settings.eventTitle || 'EventPix'} value={settings.localFolder || ''}
            onChange={e => update({ localFolder: e.target.value })} />
        </Field>
        <div className="flex items-center gap-3 rounded-2xl bg-black/20 border border-white/10 px-5 py-4">
          <FolderOpen className="w-6 h-6 text-[#00d4ff] shrink-0" />
          <p className="text-lg">
            Imágenes / EventPix / <b>{folder}</b>
            {count !== null && <span className="text-white/55"> · {count} foto{count === 1 ? '' : 's'}</span>}
          </p>
        </div>
        <p className="text-white/50 text-sm">
          La carpeta se crea sola con la primera foto. Si la dejás vacía se usa el nombre del evento: al cambiar el nombre,
          las fotos nuevas van a una carpeta nueva y las anteriores quedan en la suya.
        </p>
      </Panel>

      <Panel title="Opciones para el invitado">
        <Toggle label="Permitir repetir la foto" hint='Muestra "Repetir foto" antes de confirmar.'
          checked={settings.allowRetake !== false} onChange={allowRetake => update({ allowRetake })} />
        <Toggle label="Galería en el inicio" hint="Ícono para ver las fotos que se sacaron en el evento."
          checked={!!settings.enableGallery} onChange={enableGallery => update({ enableGallery })} />
      </Panel>
    </div>
  );
}
