import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CloudUpload, Loader2 } from 'lucide-react';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import {
  DEFAULT_DRIVE_SCRIPT_URL, DRIVE_EVENT, folderIdFromLink, isDriveConfigured, pendingCount, processDriveQueue, queueWholeEvent, testDrive,
} from '@/lib/driveBackup';
import { publicSiteUrl } from '@/lib/kioskShare';
import { buttonClass, Field, inputClass, Panel, primaryClass, Toggle } from './ui';

// Compartir y nube: QR (sube a Supabase), página del invitado y respaldo en Google Drive.
export default function ShareSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const [pending, setPending] = useState(pendingCount);
  const [testing, setTesting] = useState(false);
  const [driveFolder, setDriveFolder] = useState<string | null>(null);

  useEffect(() => {
    const onChange = () => setPending(pendingCount());
    window.addEventListener(DRIVE_EVENT, onChange);
    return () => window.removeEventListener(DRIVE_EVENT, onChange);
  }, []);

  const folderLink = (settings.driveFolderLink as string) || '';
  const badLink = !!folderLink && !folderIdFromLink(folderLink);
  const qrOn = settings.showQr !== false;

  const test = async () => {
    setTesting(true);
    try {
      const name = await testDrive();
      setDriveFolder(name);
      toast.success(`Conectado a la carpeta "${name}"`);
    } catch (e) {
      setDriveFolder(null);
      toast.error(`No se pudo conectar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setTesting(false);
    }
  };

  const uploadAll = async () => {
    const n = await queueWholeEvent();
    toast.success(`${n} fotos del evento en cola para Drive`);
  };

  return (
    <div className="space-y-6">
      <Panel title="QR y fotos en la nube"
        description="Con el QR activado, cada foto se sube a la nube (Supabase) para que el invitado la baje al celular. Con el QR apagado, las fotos quedan solo en el equipo.">
        <Toggle label="Mostrar QR en la pantalla final" hint={qrOn ? 'Las fotos se suben a la nube.' : 'Las fotos quedan solo en el equipo.'}
          checked={qrOn} onChange={showQr => update({ showQr })} />
        <Field label="Dirección del sitio para la página del invitado (opcional)">
          <input className={inputClass} placeholder="Ej: https://fotos.eventpix.com" value={(settings.publicSiteUrl as string) || ''}
            onChange={e => update({ publicSiteUrl: e.target.value })} />
        </Field>
        <p className="text-white/55 text-sm">
          El QR abre una página con la foto y botones para <b>descargarla</b>, <b>compartirla</b> (Instagram, WhatsApp y lo que tenga el celular)
          o <b>mandarla por WhatsApp</b>. {publicSiteUrl()
            ? <>Se usa: <b className="text-white/80">{publicSiteUrl()}</b></>
            : 'Sin una dirección pública, el QR lleva directo a la imagen.'}
        </p>
        <p className="text-white/55 text-sm">
          Para borrar lo subido: en el panel web, <b>Kiosco IA → el evento → "Borrar de la nube"</b>. Las copias del equipo no se tocan.
        </p>
      </Panel>

      <Panel title="Respaldo en Google Drive"
        description="Cada foto se guarda también en una carpeta de Drive, con una subcarpeta por evento. Si no hay internet, quedan en cola y se suben solas cuando vuelve.">
        <Field label="Link de la carpeta de Drive">
          <input className={inputClass} placeholder="https://drive.google.com/drive/folders/…" value={folderLink}
            onChange={e => update({ driveFolderLink: e.target.value })} />
        </Field>
        {badLink && <p className="text-amber-300">Ese link no parece de una carpeta de Drive.</p>}
        {DEFAULT_DRIVE_SCRIPT_URL && (
          <p className="text-emerald-300">
            Esta app ya trae el script de Drive de EventPix. Solo pegá el link de la carpeta (sin carpeta se usa "EventPix Kiosco" en Mi unidad).
          </p>
        )}
        <Field label={DEFAULT_DRIVE_SCRIPT_URL ? 'Otro script de Drive (opcional, termina en /exec)' : 'URL del script de Drive (termina en /exec)'}>
          <input className={inputClass} placeholder="https://script.google.com/macros/s/…/exec" value={(settings.driveScriptUrl as string) || ''}
            onChange={e => update({ driveScriptUrl: e.target.value })} />
        </Field>
        <Toggle label="Subir también las originales de la cámara" hint="Además de la foto final con marco."
          checked={!!settings.driveOriginals} onChange={driveOriginals => update({ driveOriginals })} />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={test} disabled={!isDriveConfigured() || testing} className={primaryClass}>
            {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Probar conexión
          </button>
          <button onClick={() => processDriveQueue()} disabled={!isDriveConfigured() || !pending} className={buttonClass}>
            <CloudUpload className="w-5 h-5" /> Subir pendientes ({pending})
          </button>
          <button onClick={uploadAll} disabled={!isDriveConfigured()} className={buttonClass}>
            Subir todas las fotos del evento
          </button>
        </div>
        {driveFolder && <p className="text-emerald-300">Conectado a "{driveFolder}".</p>}
        <div className="rounded-2xl bg-black/20 border border-white/10 p-5 text-white/75 space-y-1 text-sm">
          <p className="font-bold text-white">Cómo se configura (una vez, desde una computadora)</p>
          <p>1. Entrá a script.google.com → Nuevo proyecto, y pegá el script de EventPix (docs/kiosco-drive-apps-script.gs).</p>
          <p>2. Implementar → Nueva implementación → Aplicación web. Ejecutar como: Yo. Acceso: Cualquier usuario.</p>
          <p>3. Copiá la URL que termina en /exec y pegala acá, junto con el link de la carpeta.</p>
        </div>
      </Panel>
    </div>
  );
}
