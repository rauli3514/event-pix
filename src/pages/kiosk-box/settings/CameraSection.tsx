import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { applyFocus, describeStream, focusSupport, listCameras, openCameraStream, stopStream, type CameraOption } from '@/lib/kioskCamera';
import { getCameraSettings, getGeneralSettings, saveCameraSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { useShutter } from '@/lib/kioskShutter';
import { Choice, Panel, Toggle, primaryClass } from './ui';

export default function CameraSection() {
  const [settings, setSettings] = useState(getCameraSettings);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [live, setLive] = useState(false);
  const [info, setInfo] = useState<ReturnType<typeof describeStream>>(null);
  const [focusCaps, setFocusCaps] = useState<ReturnType<typeof focusSupport>>(null);
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
      setInfo(describeStream(stream));
      setFocusCaps(focusSupport(stream));
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
          {live && info && (
            <span className={`absolute top-3 left-3 rounded-full px-4 py-1.5 font-bold ${info.height >= 720 ? 'bg-emerald-600' : 'bg-amber-600'}`}>
              {info.width}×{info.height}{info.fps ? ` · ${info.fps} cuadros/s` : ''}
              {info.maxWidth > info.width ? ` (máx. ${info.maxWidth}×${info.maxHeight})` : ''}
            </span>
          )}
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
                className={`w-full text-left rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${c.deviceId === settings.deviceId ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10 hover:bg-white/20'}`}>
                {c.label}{c.deviceId === settings.deviceId ? '  ✓' : ''}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Imagen">
        <Toggle label="Modo espejo" hint="Como un espejo: lo que está a la derecha se ve a la derecha."
          checked={!!settings.mirror} onChange={mirror => update({ mirror })} />
        <Choice label="Calidad de imagen" value={settings.quality ?? 'auto'}
          options={[
            { value: 'auto', label: 'Automática' },
            { value: '1080', label: 'Full HD (1080p)' },
            { value: '720', label: 'HD (720p)' },
            { value: '480', label: 'Baja (480p)' },
          ]}
          onChange={quality => { update({ quality }); if (live) void start(settings.deviceId); }} />
        <p className="text-white/55 text-sm -mt-2">
          Si la imagen se ve borrosa o pixelada (pasa con la Logitech C920 en algunas TV box), elegí Full HD o HD y mirá arriba de la vista previa
          la resolución que da de verdad. Si se ve trabada, bajá a HD.
        </p>
        <Choice label="Enfoque" value={settings.focus ?? 'auto'}
          options={[
            { value: 'auto', label: 'Automático' },
            { value: 'far', label: 'Fijo lejos' },
            { value: 'manual', label: 'Fijo a mano' },
          ]}
          onChange={focus => {
            const next = saveCameraSettings({ focus });
            setSettings(next);
            if (streamRef.current) void applyFocus(streamRef.current, next).catch(() => {});
          }} />
        {settings.focus === 'manual' && focusCaps?.manual && (
          <div className="space-y-1">
            <input type="range" min={0} max={100} value={Math.round((Number(settings.focusPos ?? 0.8)) * 100)}
              onChange={e => {
                const next = saveCameraSettings({ focusPos: Number(e.target.value) / 100 });
                setSettings(next);
                if (streamRef.current) void applyFocus(streamRef.current, next).catch(() => {});
              }}
              className="w-full accent-[#ff2e93]" />
            <div className="flex justify-between text-white/50 text-sm"><span>Cerca</span><span>Lejos</span></div>
          </div>
        )}
        <p className="text-white/55 text-sm -mt-2">
          {!live ? 'Abrí la vista previa (Buscar cámaras) para ver si tu cámara permite fijar el enfoque.'
            : focusCaps?.manual ? 'Si la foto sale desenfocada (con poca luz la cámara "busca"), usá Fijo lejos o ajustalo a mano mirando la vista previa a la distancia de los invitados.'
              : 'Esta cámara no deja fijar el enfoque desde Android: lo maneja ella sola. Con más luz enfoca mejor.'}
        </p>
        <Choice label="Rotación (si la cámara está girada)" value={rotation}
          options={[0, 90, 180, 270].map(r => ({ value: r, label: `${r}°` }))}
          onChange={r => update({ rotation: r })} />
      </Panel>

      <Panel title="Cuenta regresiva">
        <Choice label="Segundos antes de sacar la foto" value={settings.timer || 5}
          options={[3, 5, 10].map(t => ({ value: t, label: `${t} s` }))}
          onChange={t => update({ timer: t })} />
        <Toggle label="Flash con la pantalla" hint="Al sacar la foto la pantalla se pone toda blanca un instante: ilumina la cara con poca luz."
          checked={settings.screenFlash !== false} onChange={screenFlash => update({ screenFlash })} />
      </Panel>

      <ShutterPanel />
    </div>
  );
}

/** Disparador Bluetooth: para fotos grupales a distancia. */
function ShutterPanel() {
  const [on, setOn] = useState(() => !!getGeneralSettings().bluetoothShutter);
  const [hits, setHits] = useState(0);
  useShutter(() => setHits(h => h + 1), on);
  return (
    <Panel title="Disparador Bluetooth" description='El botoncito "selfie remote": vinculalo en Ajustes → Equipo → Bluetooth y el grupo saca la foto a distancia.'>
      <Toggle label="Esperar el disparador para sacar la foto" hint='En "Mirá a la cámara" la cuenta regresiva arranca con el botón (o tocando la pantalla), no sola.'
        checked={on} onChange={v => { setOn(v); saveGeneralSettings({ bluetoothShutter: v }); }} />
      {on && (
        <p className={`rounded-2xl px-5 py-4 text-lg font-semibold ${hits ? 'bg-emerald-500/15 text-emerald-200' : 'bg-black/20 text-white/70'}`}>
          {hits ? `¡Disparador recibido! (${hits})` : 'Probalo: apretá el botón del disparador y acá aparece el aviso.'}
        </p>
      )}
    </Panel>
  );
}
