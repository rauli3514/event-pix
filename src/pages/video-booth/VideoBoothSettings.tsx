import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Trash2, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { getScreenMedia, removeScreenMedia, saveScreenMedia } from '@/lib/kioskMedia';
import { isDriveConfigured } from '@/lib/driveBackup';
import { recordingSupport } from '@/lib/videoBooth/recorder';
import {
  DEFAULT_PROMPTS, getVideoSettings, modeConfig, RAMP_PRESETS, saveModeConfig, saveVideoSettings,
  VIDEO_FILTERS, VIDEO_MODES, type VideoBoothSettings,
} from '@/lib/videoBooth/settings';
import { buttonClass, Choice, Field, inputClass, Panel, Toggle } from '@/pages/kiosk-box/settings/ui';

// Ajustes de la cabina de video (detrás de la clave del equipo). La cámara
// (cuál, espejo, giro, calidad) es la misma del kiosco: se cambia en sus Ajustes.

function useMediaName(key: string) {
  const [name, setName] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    const load = () => getScreenMedia(key).then(rec => {
      if (!alive) return;
      setName(rec?.name ?? null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = rec ? URL.createObjectURL(rec.blob) : null;
      setUrl(objectUrl);
    }).catch(() => {});
    void load();
    const onChange = (e: Event) => { if ((e as CustomEvent).detail === key) void load(); };
    window.addEventListener('kiosk-media-changed', onChange);
    return () => {
      alive = false;
      window.removeEventListener('kiosk-media-changed', onChange);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key]);
  return { name, url };
}

export default function VideoBoothSettings() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [s, setS] = useState<VideoBoothSettings>(getVideoSettings);
  const update = (patch: Partial<VideoBoothSettings>) => setS(saveVideoSettings(patch));
  const updateMode = (key: Parameters<typeof saveModeConfig>[0], patch: Parameters<typeof saveModeConfig>[1]) => setS(saveModeConfig(key, patch));
  useRemoteFocus(rootRef, []);

  const overlay = useMediaName('video:overlay');
  const music = useMediaName('video:music');
  const overlayInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);
  const support = recordingSupport();
  const [promptsText, setPromptsText] = useState(() => (s.prompts?.length ? s.prompts : DEFAULT_PROMPTS).join('\n'));

  const upload = async (key: 'video:overlay' | 'video:music', file: File | undefined) => {
    if (!file) return;
    try {
      await saveScreenMedia(key, file);
      toast.success('Archivo guardado en el equipo');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el archivo');
    }
  };

  return (
    <div ref={rootRef} className="relative min-h-screen text-white">
      <AuroraBackground className="fixed" />
      <div className="relative max-w-5xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/video')} className={buttonClass} data-autofocus><ArrowLeft className="w-6 h-6" /> Volver</button>
          <h1 className="text-3xl font-black flex items-center gap-3"><Video className="w-8 h-8 text-[#00d4ff]" /> Ajustes de la cabina de video</h1>
        </header>

        <div className={`kiosk-glass rounded-2xl px-6 py-4 ${support.ok && support.mp4 ? 'text-white/80' : 'text-amber-100'}`}>
          Formato de video de este equipo: <b>{support.format}</b>
          {support.ok && !support.mp4 && ' — los iPhone no reproducen WebM: conviene actualizar el WebView del equipo (Chrome 126 o más nuevo graba MP4).'}
        </div>

        <Panel title="Experiencias" description="Las que se activen aparecen en la pantalla “¿Qué video hacemos?”. Con una sola, arranca directo.">
          {VIDEO_MODES.map(m => {
            const c = modeConfig(m.key, s);
            return (
              <div key={m.key} className="rounded-2xl border border-white/10 bg-black/15 p-4 space-y-4">
                <Toggle label={m.label} hint={m.hint} checked={c.enabled} onChange={v => updateMode(m.key, { enabled: v })} />
                {c.enabled && (
                  <div className="space-y-4 pl-2">
                    <Choice label={m.guestbook || m.canStop ? 'Duración máxima' : 'Segundos de grabación'} value={c.seconds}
                      options={m.secondsOptions.map(n => ({ value: n, label: `${n} s` }))}
                      onChange={v => updateMode(m.key, { seconds: v })} />
                    <Choice label="Filtro" value={c.filter} options={VIDEO_FILTERS.map(f => ({ value: f.value, label: f.label }))}
                      onChange={v => updateMode(m.key, { filter: v })} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Toggle label="Música de fondo" hint={music.name ? music.name : 'Primero cargá una canción'} checked={c.music} onChange={v => updateMode(m.key, { music: v })} />
                      {m.effect === 'none' && <Toggle label="Sonido del ambiente" hint="Micrófono de la webcam" checked={c.mic} onChange={v => updateMode(m.key, { mic: v })} />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Panel>

        <Panel title="Formato del video">
          <Choice label="Forma" value={s.aspect ?? '9:16'} onChange={v => update({ aspect: v })}
            options={[{ value: '9:16', label: 'Vertical (historias)' }, { value: '16:9', label: 'Horizontal' }, { value: '1:1', label: 'Cuadrado' }]} />
          <Choice label="Calidad" value={s.resolution ?? 720} onChange={v => update({ resolution: v })}
            options={[{ value: 720, label: 'HD 720p (recomendada en TV box)' }, { value: 1080, label: 'Full HD 1080p' }]} />
          <Choice label="Cuenta regresiva" value={s.countdown ?? 3} onChange={v => update({ countdown: v })}
            options={[0, 3, 5, 10].map(n => ({ value: n, label: n ? `${n} s` : 'Sin cuenta' }))} />
          <Toggle label="El invitado revisa su video" hint="Puede repetirlo antes de llevárselo" checked={s.review !== false} onChange={v => update({ review: v })} />
          <Choice label="Tiempo del resultado en pantalla" value={s.resultSeconds ?? 45} onChange={v => update({ resultSeconds: v })}
            options={[30, 45, 60, 90].map(n => ({ value: n, label: `${n} s` }))} />
        </Panel>

        <Panel title="Marco del video" description="Se dibuja encima de todo el video. El PNG propio tiene que tener la misma forma que el video (por ejemplo 1080×1920 para vertical) y el centro transparente.">
          <Choice label="Marco" value={s.overlay ?? 'none'} onChange={v => update({ overlay: v })}
            options={[{ value: 'none', label: 'Sin marco' }, { value: 'title', label: 'Nombre del evento' }, { value: 'custom', label: 'PNG propio' }]} />
          {(s.overlay ?? 'none') === 'title' && (
            <Field label="Texto (vacío = nombre del evento)">
              <input className={inputClass} value={s.overlayText ?? ''} onChange={e => update({ overlayText: e.target.value })} placeholder="Ej. Sofi & Juan" />
            </Field>
          )}
          {s.overlay === 'custom' && (
            <div className="flex flex-wrap items-center gap-4">
              {overlay.url && <img src={overlay.url} alt="" className="h-40 rounded-xl bg-[repeating-conic-gradient(#444_0_25%,#666_0_50%)] bg-[length:20px_20px]" />}
              <input ref={overlayInput} type="file" accept="image/png,image/webp" className="hidden" onChange={e => { void upload('video:overlay', e.target.files?.[0]); e.target.value = ''; }} />
              <button className={buttonClass} onClick={() => overlayInput.current?.click()}><Upload className="w-5 h-5" /> {overlay.name ? 'Cambiar PNG' : 'Subir PNG'}</button>
              {overlay.name && <button className={buttonClass} onClick={() => void removeScreenMedia('video:overlay')}><Trash2 className="w-5 h-5" /> Quitar</button>}
            </div>
          )}
        </Panel>

        <Panel title="Música" description="Una canción (MP3) que suena en los videos con música. Queda guardada en el equipo.">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-lg"><Music className="w-5 h-5 text-[#ff2e93]" /> {music.name ?? 'Sin canción'}</span>
            {music.url && <audio src={music.url} controls className="h-10" />}
            <input ref={musicInput} type="file" accept="audio/*" className="hidden" onChange={e => { void upload('video:music', e.target.files?.[0]); e.target.value = ''; }} />
            <button className={buttonClass} onClick={() => musicInput.current?.click()}><Upload className="w-5 h-5" /> {music.name ? 'Cambiar' : 'Cargar canción'}</button>
            {music.name && <button className={buttonClass} onClick={() => void removeScreenMedia('video:music')}><Trash2 className="w-5 h-5" /> Quitar</button>}
          </div>
          <Choice label="Volumen" value={s.musicVolume ?? 0.8} onChange={v => update({ musicVolume: v })}
            options={[0.4, 0.6, 0.8, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
        </Panel>

        <Panel title="Efectos" description="Cámara lenta, plataforma 360 y boomerang.">
          <Choice label="Rampa de velocidad del 360" value={s.rampPreset ?? 'clasica'} onChange={v => update({ rampPreset: v })}
            options={RAMP_PRESETS.map(r => ({ value: r.value, label: `${r.label}: ${r.hint}` }))} />
          <Choice label="Velocidad de la cámara lenta" value={s.slowSpeed ?? 0.5} onChange={v => update({ slowSpeed: v })}
            options={[{ value: 0.5, label: 'La mitad' }, { value: 0.33, label: 'Un tercio' }, { value: 0.25, label: 'Un cuarto (necesita 60 fps)' }]} />
          <Choice label="Vueltas del boomerang" value={s.boomerangLoops ?? 3} onChange={v => update({ boomerangLoops: v })}
            options={[2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))} />
          <Toggle label="Pedir 60 cuadros por segundo" hint="Cámara lenta más fluida si la cámara lo da (celulares y webcams buenas)" checked={s.highFps !== false} onChange={v => update({ highFps: v })} />
        </Panel>

        <Panel title="Libro de firmas" description="Una pregunta por renglón. A cada invitado le toca una al azar.">
          <textarea className={`${inputClass} min-h-48`} value={promptsText}
            onChange={e => setPromptsText(e.target.value)}
            onBlur={() => update({ prompts: promptsText.split('\n').map(p => p.trim()).filter(Boolean) })} />
        </Panel>

        <Panel title="Pantalla de inicio y QR">
          <Field label="Texto grande (vacío = nombre del evento)">
            <input className={inputClass} value={s.title ?? ''} onChange={e => update({ title: e.target.value })} placeholder="¡Grabá tu video!" />
          </Field>
          <Toggle label="Mostrar QR para bajar el video" hint={isDriveConfigured() ? 'Se sube a la carpeta de Drive del kiosco' : 'Falta configurar Drive en Ajustes del kiosco → Compartir y nube'} checked={s.showQr !== false} onChange={v => update({ showQr: v })} />
        </Panel>

        <Panel title="Cámara" description="La webcam, el espejo y el giro son los del kiosco de fotos (Ajustes del kiosco → Cámara).">
          <Choice label="En celular o tablet (fotos itinerantes), usar la cámara" value={s.facing ?? 'user'} onChange={v => update({ facing: v })}
            options={[{ value: 'user', label: 'De adelante (selfie)' }, { value: 'environment', label: 'De atrás' }]} />
          <button className={buttonClass} onClick={() => navigate('/box/ajustes')}>Abrir Ajustes del kiosco</button>
        </Panel>
      </div>
    </div>
  );
}
