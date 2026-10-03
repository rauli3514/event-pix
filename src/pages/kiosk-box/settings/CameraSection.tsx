import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { listCameras, openCameraStream, stopStream, type CameraOption } from '@/lib/kioskCamera';
import { getCameraSettings, saveCameraSettings } from '@/lib/kioskSettings';
import { Choice, Panel, Toggle, primaryClass } from './ui';

export default function CameraSection() {
  const [settings, setSettings] = useState(getCameraSettings);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [live, setLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const update = (patch: Parameters<typeof saveCameraSettings>[0]) => setSettings(saveCameraSettings(patch));

  /** Abre la cámara (esto también pide el permiso de Android) y lista las conectadas. */
  const start = useCallback(async (deviceId?: string) => {
    setSearching(true);
    setError(null);
    stopStream(streamRef.current);
    try {
      const stream = await openCameraStream(deviceId);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setLive(true);
      const found = await listCameras();
      setCameras(found);
      // Si no había ninguna elegida, queda la que se abrió
      const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (!deviceId && activeId) {
        setSettings(saveCameraSettings({ deviceId: activeId, deviceLabel: found.find(c => c.deviceId === activeId)?.label }));
      }
    } catch (err) {
      setLive(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => () => stopStream(streamRef.current), []);

  const choose = (camera: CameraOption) => {
    update({ deviceId: camera.deviceId, deviceLabel: camera.label });
    start(camera.deviceId);
  };

  const rotation = settings.rotation || 0;
  const transform = `${settings.mirror ? 'scaleX(-1) ' : ''}rotate(${rotation}deg)`;

  return (
    <div className="space-y-6">
      <Panel title="Cámara" description="Conectá la webcam USB a la TV box y tocá Buscar cámaras. La primera vez Android pide permiso: aceptalo.">
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${live ? '' : 'hidden'}`} style={{ transform }} />
          {!live && (
            <div className="text-center text-white/50 px-6">
              <Camera className="w-16 h-16 mx-auto mb-3" />
              {error ? <p className="text-amber-300 text-lg">{error}</p> : <p className="text-lg">Sin vista previa</p>}
            </div>
          )}
        </div>
        <button data-autofocus onClick={() => start(settings.deviceId)} disabled={searching} className={primaryClass}>
          <RefreshCw className={`w-5 h-5 ${searching ? 'animate-spin' : ''}`} /> {live ? 'Actualizar' : 'Buscar cámaras'}
        </button>
        {cameras.length > 0 && (
          <div className="space-y-2">
            <p className="text-white/70">Cámaras conectadas</p>
            {cameras.map(c => (
              <button key={c.deviceId} onClick={() => choose(c)}
                className={`w-full text-left rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-4 focus:ring-cyan-400 ${c.deviceId === settings.deviceId ? 'bg-violet-600' : 'bg-white/10 hover:bg-white/20'}`}>
                {c.label}{c.deviceId === settings.deviceId ? '  ✓' : ''}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Imagen">
        <Toggle label="Modo espejo" hint="Como un espejo: lo que está a la derecha se ve a la derecha."
          checked={!!settings.mirror} onChange={mirror => update({ mirror })} />
        <Choice label="Rotación (si la cámara está girada)" value={rotation}
          options={[0, 90, 180, 270].map(r => ({ value: r, label: `${r}°` }))}
          onChange={r => update({ rotation: r })} />
      </Panel>

      <Panel title="Cuenta regresiva">
        <Choice label="Segundos antes de sacar la foto" value={settings.timer || 5}
          options={[3, 5, 10].map(t => ({ value: t, label: `${t} s` }))}
          onChange={t => update({ timer: t })} />
      </Panel>
    </div>
  );
}
