import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CloudUpload, Loader2 } from 'lucide-react';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import {
  DEFAULT_DRIVE_SCRIPT_URL, DRIVE_EVENT, folderIdFromLink, getDriveLinks, isDriveConfigured, pendingCount, processDriveQueue, queueWholeEvent, testDrive,
} from '@/lib/driveBackup';
import { publicSiteUrl } from '@/lib/kioskShare';
import { buttonClass, Field, inputClass, Panel, primaryClass, Toggle } from './ui';

// Compartir y nube: QR (sube a Supabase), página del invitado y respaldo en Google Drive.
export default function ShareSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const [pending, setPending] = useState(pendingCount);
  const [testing, setTesting] = useState(false);
  const [links, setLinks] = useState(getDriveLinks);

  useEffect(() => {
    const onChange = () => { setPending(pendingCount()); setLinks(getDriveLinks()); };
    window.addEventListener(DRIVE_EVENT, onChange);
    return () => window.removeEventListener(DRIVE_EVENT, onChange);
  }, []);

  const folderLink = (settings.driveFolderLink as string) || '';
  const badLink = !!folderLink && !folderIdFromLink(folderLink);
  const qrOn = settings.showQr !== false;

  const test = async () => {
    setTesting(true);
    try {
      const info = await testDrive();
      setLinks(info);
      toast.success(`Conectado a la carpeta "${info.folder}"`);
    } catch (e) {
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
      <Panel title="QR para el invitado"
        description="El QR lleva a la foto en tu Google Drive: se sube apenas se saca y queda visible solo esa foto (no la carpeta). Con el QR apagado, la foto igual se respalda en Drive.">
        <Toggle label="Mostrar QR en la pantalla final" hint={qrOn ? 'La foto se comparte desde Drive.' : 'Sin QR: la foto queda en el equipo y en Drive.'}
          checked={qrOn} onChange={showQr => update({ showQr })} />
        {qrOn && !isDriveConfigured() && !settings.cloudSupabase && (
          <p className="text-amber-300">Para el QR hace falta Drive configurado (abajo).</p>
        )}
        <Toggle label="Usar Supabase para el QR en lugar de Drive" hint="Opcional. Requiere que el equipo tenga un evento asignado en el panel."
          checked={!!settings.cloudSupabase} onChange={cloudSupabase => update({ cloudSupabase })} />
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
        {settings.cloudSupabase && (
          <p className="text-white/55 text-sm">
            Para borrar lo subido a Supabase: en el panel web, <b>Kiosco IA → el evento → "Borrar de la nube"</b>.
          </p>
        )}
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
        {/* Link de la carpeta del evento: el operador lo escanea con el celular para ver las fotos en Drive */}
        {links?.eventUrl ? (
          <div className="flex items-center gap-5 rounded-2xl bg-white/95 p-4 text-slate-900">
            <img alt="QR de la carpeta de Drive" className="w-36 h-36 shrink-0"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(links.eventUrl)}`} />
            <div className="min-w-0">
              <p className="font-bold text-lg">Carpeta del evento en Drive</p>
              <p className="text-slate-600">{links.folder} / <b>{links.eventFolder}</b></p>
              <p className="text-slate-500 text-sm mt-1">Escaneá con el celular para ver las fotos que se van subiendo.</p>
              <p className="text-violet-700 text-sm mt-1 break-all">{links.eventUrl}</p>
            </div>
          </div>
        ) : isDriveConfigured() && (
          <p className="text-white/60">Tocá "Probar conexión" para ver el QR con el link a la carpeta del evento en Drive.</p>
        )}
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
