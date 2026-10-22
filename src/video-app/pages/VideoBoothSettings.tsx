import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Video } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { recordingSupport } from '@/lib/videoBooth/recorder';
import { REMOTE_APPLIED_EVENT } from '@/lib/videoBooth/remote';
import { BrandPanel, DeliveryPanel, FramesPanel, LayersPanel, MotionPanel, MusicPanel } from './VideoSettingsPanels';
import {
  DEFAULT_PROMPTS, getVideoSettings, modeConfig, RAMP_PRESETS, saveModeConfig, saveVideoSettings,
  VIDEO_FILTERS, VIDEO_MODES, type VideoBoothSettings,
} from '@/lib/videoBooth/settings';
import { buttonClass, Choice, Field, inputClass, Panel, Toggle } from '../ui';
import { CameraPanel, CloudPanel, DevicePanel, EventPanel } from './DevicePanels';

// Ajustes de la app EventPix Video (detrás de la clave del equipo). Casi todo se
// puede cambiar también desde el panel de la cabina.

export default function VideoBoothSettings() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [s, setS] = useState<VideoBoothSettings>(getVideoSettings);
  const update = (patch: Partial<VideoBoothSettings>) => setS(saveVideoSettings(patch));
  const updateMode = (key: Parameters<typeof saveModeConfig>[0], patch: Parameters<typeof saveModeConfig>[1]) => setS(saveModeConfig(key, patch));
  useRemoteFocus(rootRef, []);

  const support = recordingSupport();
  const [promptsText, setPromptsText] = useState(() => (s.prompts?.length ? s.prompts : DEFAULT_PROMPTS).join('\n'));

  // Cambios que llegan del panel mientras Ajustes está abierto
  useEffect(() => {
    const reload = () => setS(getVideoSettings());
    window.addEventListener(REMOTE_APPLIED_EVENT, reload);
    return () => window.removeEventListener(REMOTE_APPLIED_EVENT, reload);
  }, []);

  return (
    <div ref={rootRef} className="relative min-h-screen text-white">
      <AuroraBackground className="fixed" />
      <div className="relative max-w-5xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className={buttonClass} data-autofocus><ArrowLeft className="w-6 h-6" /> Volver</button>
          <h1 className="text-3xl font-black flex items-center gap-3"><Video className="w-8 h-8 text-[#00d4ff]" /> Ajustes de EventPix Video</h1>
        </header>

        <div className={`kiosk-glass rounded-2xl px-6 py-4 ${support.ok && support.mp4 ? 'text-white/80' : 'text-amber-100'}`}>
          Formato de video de este equipo: <b>{support.format}</b>
          {support.ok && !support.mp4 && ' — los iPhone no reproducen WebM: conviene actualizar el WebView del equipo (Chrome 126 o más nuevo graba MP4).'}
        </div>

        <DevicePanel onLink={() => navigate('/')} />
        <EventPanel s={s} update={update} />

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
                      <Toggle label="Música de fondo" hint={s.songs?.length ? 'Tu música (panel Música)' : 'Primero cargá una canción'} checked={c.music} onChange={v => updateMode(m.key, { music: v })} />
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

        <FramesPanel s={s} update={update} />
        <LayersPanel s={s} update={update} />
        <BrandPanel s={s} update={update} />
        <MusicPanel s={s} update={update} />

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

        <MotionPanel s={s} update={update} />
        <DeliveryPanel s={s} update={update} />
        <CloudPanel s={s} update={update} />

        <Panel title="Pantalla de inicio">
          <Field label="Texto grande (vacío = nombre del evento)">
            <input className={inputClass} value={s.title ?? ''} onChange={e => update({ title: e.target.value })} placeholder="¡Grabá tu video!" />
          </Field>
        </Panel>

        <CameraPanel s={s} update={update} />
      </div>
    </div>
  );
}
