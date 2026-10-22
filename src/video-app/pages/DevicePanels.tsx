import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Link2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  describeStream, getCameraSettings, listCameras, openCameraStream, saveCameraSettings, stopStream,
  type CameraOption, type VideoCameraSettings,
} from '@/lib/videoBooth/camera';
import {
  checkinDevice, DEVICE_EVENT, getAppVersion, getCachedDeviceState, getDeviceCode, getPin, setPin, setStandalone,
} from '@/lib/videoBooth/device';
import { DEFAULT_SCRIPT_URL, isDriveConfigured, saveDriveConfig, testDrive } from '@/lib/videoBooth/drive';
import { DEFAULT_PUBLIC_SITE } from '@/lib/videoBooth/share';
import { eventFolder } from '@/lib/videoBooth/storage';
import type { VideoBoothSettings } from '@/lib/videoBooth/settings';
import { buttonClass, Choice, Field, inputClass, Panel, primaryClass, Toggle } from '../ui';

// Paneles propios de la app EventPix Video: equipo (vinculación y clave), evento,
// nube (Drive de la cabina) y cámara.

type Update = (patch: Partial<VideoBoothSettings>) => void;
interface Props { s: VideoBoothSettings; update: Update }

export function DevicePanel({ onLink }: { onLink: () => void }) {
  const [state, setState] = useState(getCachedDeviceState);
  const [version, setVersion] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const [pin, setPinText] = useState('');
  useEffect(() => {
    void getAppVersion().then(setVersion);
    const update = () => setState(getCachedDeviceState());
    window.addEventListener(DEVICE_EVENT, update);
    return () => window.removeEventListener(DEVICE_EVENT, update);
  }, []);
  const linked = state?.pairingStatus === 'linked';
  const check = async () => {
    setChecking(true);
    try {
      await checkinDevice();
      toast.success('Conectado con el panel');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };
  return (
    <Panel title="Equipo" description="Vinculado al panel de la cabina, el equipo recibe la configuración y aparece en Cabina de video → Equipos.">
      <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-black/20 border border-white/10 px-6 py-4">
        <div>
          <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Código</p>
          <p className="font-mono text-4xl font-black tracking-[0.2em]">{getDeviceCode()}</p>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <p className="text-lg font-semibold flex items-center gap-2">
            {linked ? <><CheckCircle2 className="w-5 h-5 text-[#2ee6a6]" /> Vinculado{state?.name ? `: ${state.name}` : ''}</> : 'Sin vincular'}
          </p>
          <p className="text-white/50 text-sm">Versión {version ?? 'web'}{isSupabaseConfigured ? '' : ' · sin servidor configurado'}</p>
        </div>
        {isSupabaseConfigured && (
          <button className={buttonClass} disabled={checking} onClick={() => void check()}>
            {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />} Actualizar
          </button>
        )}
        {isSupabaseConfigured && !linked && (
          <button className={primaryClass} onClick={() => { setStandalone(false); onLink(); }}><Link2 className="w-5 h-5" /> Vincular</button>
        )}
      </div>
      <Field label="Clave de Ajustes (4 a 8 números)">
        <div className="flex gap-3">
          <input className={inputClass} inputMode="numeric" type="password" value={pin} placeholder="••••"
            onChange={e => setPinText(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <button className={buttonClass} disabled={pin.length < 4} onClick={() => { setPin(pin); setPinText(''); toast.success('Clave cambiada'); }}>Cambiar</button>
        </div>
      </Field>
      {getPin() === '1234' && <p className="text-amber-200 text-sm">La clave es la de fábrica (1234): cambiala si el equipo se alquila.</p>}
    </Panel>
  );
}

export function EventPanel({ s, update }: Props) {
  return (
    <Panel title="Evento" description="El nombre del evento va en el marco, la placa final y es la carpeta de los videos (en el equipo y en Drive).">
      <Field label="Nombre del evento">
        <input className={inputClass} value={s.eventTitle ?? ''} onChange={e => update({ eventTitle: e.target.value })} placeholder="Ej. 15 de Pía" />
      </Field>
      <p className="text-white/50 text-sm">Carpeta: Películas / EventPix Video / <b>{eventFolder()}</b></p>
      <Toggle label="Trabajar sin conexión" hint="No muestra QR ni WhatsApp: los videos quedan en el equipo y se suben cuando lo vuelvas a activar."
        checked={!!s.offline} onChange={v => update({ offline: v })} />
    </Panel>
  );
}

export function CloudPanel({ s, update }: Props) {
  const [script, setScript] = useState(s.driveScriptUrl ?? '');
  const [folder, setFolder] = useState(s.driveFolderLink ?? '');
  const [testing, setTesting] = useState(false);
  const test = async () => {
    saveDriveConfig(script, folder);
    update({ driveScriptUrl: script.trim(), driveFolderLink: folder.trim() });
    setTesting(true);
    try {
      const name = await testDrive(eventFolder());
      toast.success(`Drive conectado${name ? `: ${name}` : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };
  return (
    <Panel title="Nube (Google Drive de la cabina)" description="Los videos se suben a esta carpeta de Drive (una subcarpeta por evento) para el QR, la galería y WhatsApp. Es otra Drive, separada del kiosco.">
      <Field label={DEFAULT_SCRIPT_URL ? 'Dirección del Apps Script (vacío = el de la app)' : 'Dirección del Apps Script'}>
        <input className={inputClass} value={script} onChange={e => setScript(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
      </Field>
      <Field label="Link de la carpeta de Drive">
        <input className={inputClass} value={folder} onChange={e => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <button className={primaryClass} disabled={testing} onClick={() => void test()}>{testing ? 'Probando…' : 'Guardar y probar'}</button>
        <span className={isDriveConfigured() ? 'text-[#7dffb3]' : 'text-amber-200'}>{isDriveConfigured() ? 'Drive configurado' : 'Drive sin configurar'}</span>
      </div>
      <Field label={`Sitio de la página del invitado (vacío = ${DEFAULT_PUBLIC_SITE})`}>
        <input className={inputClass} value={s.publicSiteUrl ?? ''} onChange={e => update({ publicSiteUrl: e.target.value })} placeholder={DEFAULT_PUBLIC_SITE} />
      </Field>
    </Panel>
  );
}

export function CameraPanel({ s, update }: Props) {
  const [cam, setCam] = useState<VideoCameraSettings>(getCameraSettings);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [info, setInfo] = useState<ReturnType<typeof describeStream>>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  // La vista previa se abre a pedido (la webcam no se puede abrir dos veces a la vez)
  const [preview, setPreview] = useState(false);
  const change = (patch: Partial<VideoCameraSettings>) => setCam(saveCameraSettings(patch));

  // Vista previa con lo elegido (se vuelve a abrir al cambiar de cámara o calidad)
  useEffect(() => {
    if (!preview) return;
    let stream: MediaStream | null = null;
    let alive = true;
    openCameraStream({ facingMode: s.facing, fps: s.highFps !== false ? 60 : 30 })
      .then(async st => {
        if (!alive) { stopStream(st); return; }
        stream = st;
        if (videoRef.current) { videoRef.current.srcObject = st; await videoRef.current.play().catch(() => {}); }
        setInfo(describeStream(st));
        setCameras(await listCameras());
      })
      .then(() => { if (alive) setError(''); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; stopStream(stream); };
  }, [preview, cam.deviceId, cam.quality, cam.focus, s.facing, s.highFps]);

  const rot = Number(cam.rotation) || 0;
  return (
    <Panel title="Cámara" description="Webcam USB en la TV box, o la cámara del celular o tablet.">
      <button className={buttonClass} onClick={() => setPreview(p => !p)}>{preview ? 'Cerrar la cámara' : 'Probar la cámara'}</button>
      {preview && <div className="flex flex-wrap gap-6 items-start">
        <div className="relative w-64 aspect-video rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: `scaleX(${cam.mirror ? -1 : 1}) rotate(${rot}deg)` }} />
        </div>
        <div className="space-y-1 text-white/70">
          {error ? <p className="text-amber-200 max-w-md">{error}</p> : info && <p>{info.width}×{info.height} · {info.fps} cuadros por segundo</p>}
          {info && info.fps < 50 && s.highFps !== false && <p className="text-sm text-white/50">Esta cámara no da 60 cuadros: la cámara lenta va a ser menos fluida.</p>}
        </div>
      </div>}
      {cameras.length > 1 && (
        <Choice label="Cámara" value={cam.deviceId ?? ''} onChange={v => change({ deviceId: v || undefined, deviceLabel: cameras.find(c => c.deviceId === v)?.label })}
          options={[{ value: '', label: 'Automática' }, ...cameras.map(c => ({ value: c.deviceId, label: c.label }))]} />
      )}
      <Choice label="En celular o tablet, usar la cámara" value={s.facing ?? 'user'} onChange={v => update({ facing: v })}
        options={[{ value: 'user', label: 'De adelante (selfie)' }, { value: 'environment', label: 'De atrás' }]} />
      <Choice label="Calidad" value={cam.quality ?? 'auto'} onChange={v => change({ quality: v })}
        options={[{ value: 'auto', label: 'Automática' }, { value: '1080', label: 'Full HD' }, { value: '720', label: 'HD' }, { value: '480', label: 'Baja' }]} />
      <Choice label="Giro de la imagen" value={rot} onChange={v => change({ rotation: v })}
        options={[0, 90, 180, 270].map(n => ({ value: n, label: `${n}°` }))} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Toggle label="Modo espejo" checked={!!cam.mirror} onChange={v => change({ mirror: v })} />
        <Toggle label="Enfoque fijo lejos" hint="Para webcams que pierden el foco con poca luz" checked={cam.focus === 'far'} onChange={v => change({ focus: v ? 'far' : 'auto' })} />
      </div>
    </Panel>
  );
}
