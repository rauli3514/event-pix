import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings2, Video } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import ModeEditor, { type ModeKit } from '@/components/video-booth/ModeEditor';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import { UPDATE_EVENT, updateAvailable } from '@/lib/videoBooth/device';
import { recordingSupport } from '@/lib/videoBooth/recorder';
import { REMOTE_APPLIED_EVENT } from '@/lib/videoBooth/remote';
import { AnimVideoPanel, BackgroundsPanel, BrandPanel, DeliveryPanel, FramesPanel, GalleryPanel, LayersPanel, MotionPanel, MusicPanel, PreviewPanel } from './VideoSettingsPanels';
import { allFrames } from '@/lib/videoBooth/builtinFrames';
import { backgroundOptions } from '@/lib/videoBooth/backgrounds';
import {
  DEFAULT_PROMPTS, getVideoSettings, modeConfig, saveModeConfig, saveVideoSettings,
  VIDEO_MODES, type VideoBoothSettings, type VideoModeKey,
} from '@/lib/videoBooth/settings';
import { buttonClass, Choice, Field, inputClass, MultiChoice, Note, Panel, Stepper, Tabs, Toggle } from '../ui';
import { CameraPanel, CloudPanel, DevicePanel, EventPanel, UpdatePanel } from './DevicePanels';

// Ajustes de la app EventPix Video (detrás de la clave del equipo), en pestañas:
// General, una por experiencia, Biblioteca (marcos, música, marca) y Equipo.
// Casi todo se puede cambiar también desde el panel de la cabina.

type Tab = 'general' | VideoModeKey | 'biblioteca' | 'equipo';
const TAB_KEY = 'video_settings_tab';
const SHORT: Record<VideoModeKey, string> = { clasico: 'Video', boomerang: 'Boomerang', lenta: 'Cámara lenta', '360': '360', firmas: 'Firmas', glam: 'Glam' };

const kit: ModeKit = {
  Group: ({ title, description, children }) => <Panel title={title} description={description}>{children}</Panel>,
  Toggle: p => <Toggle {...p} />,
  Pick: p => <Choice {...p} />,
  Multi: p => <MultiChoice {...p} />,
  Range: p => <Stepper {...p} />,
  Button: ({ onClick, disabled, children }) => <button className={buttonClass} onClick={onClick} disabled={disabled}>{children}</button>,
  Note: ({ children }) => <Note>{children}</Note>,
};

export default function VideoBoothSettings() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [s, setS] = useState<VideoBoothSettings>(getVideoSettings);
  const update = (patch: Partial<VideoBoothSettings>) => setS(saveVideoSettings(patch));
  const updateMode = (key: VideoModeKey, patch: Parameters<typeof saveModeConfig>[1]) => setS(saveModeConfig(key, patch));
  const [tab, setTabState] = useState<Tab>(() => {
    try { return (localStorage.getItem(TAB_KEY) as Tab) || 'general'; } catch { return 'general'; }
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* sin espacio */ }
  };
  const [hasUpdate, setHasUpdate] = useState(updateAvailable);
  useRemoteFocus(rootRef, [tab]);

  const support = recordingSupport();
  const [promptsText, setPromptsText] = useState(() => (s.prompts?.length ? s.prompts : DEFAULT_PROMPTS).join('\n'));

  // Cambios que llegan del panel mientras Ajustes está abierto, y versiones nuevas
  useEffect(() => {
    const reload = () => setS(getVideoSettings());
    const onUpdate = () => setHasUpdate(updateAvailable());
    window.addEventListener(REMOTE_APPLIED_EVENT, reload);
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener(REMOTE_APPLIED_EVENT, reload);
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, []);

  const frames = [{ value: 'random', label: 'Uno al azar' }, ...allFrames(s).map(f => ({ value: f.id, label: f.name }))];
  const songs = (s.songs ?? []).map(f => ({ value: f.id, label: f.name }));
  const isMode = VIDEO_MODES.some(m => m.key === tab);

  const tabs = [
    { value: 'general' as Tab, label: 'General' },
    ...VIDEO_MODES.map(m => ({ value: m.key as Tab, label: SHORT[m.key], off: !modeConfig(m.key, s).enabled })),
    { value: 'biblioteca' as Tab, label: 'Biblioteca' },
    { value: 'equipo' as Tab, label: 'Equipo', dot: hasUpdate },
  ];

  return (
    <div ref={rootRef} className="relative min-h-screen text-white">
      <AuroraBackground className="fixed" />
      <div className="relative max-w-5xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className={buttonClass} data-autofocus><ArrowLeft className="w-6 h-6" /> Volver</button>
          <h1 className="text-3xl font-black flex items-center gap-3"><Video className="w-8 h-8 text-[#00d4ff]" /> Ajustes de EventPix Video</h1>
        </header>

        <Tabs value={tab} tabs={tabs} onChange={setTab} />

        {tab === 'general' && (
          <>
            <EventPanel s={s} update={update} />
            <Panel title="Experiencias" description="Las que se activen aparecen en “¿Qué video hacemos?”. Cada una se configura en su pestaña.">
              {VIDEO_MODES.map(m => {
                const c = modeConfig(m.key, s);
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="flex-1"><Toggle label={m.label} hint={m.hint} checked={c.enabled} onChange={v => updateMode(m.key, { enabled: v })} /></div>
                    <button className={buttonClass} onClick={() => setTab(m.key)} aria-label={`Configurar ${m.label}`}><Settings2 className="w-5 h-5" /> Configurar</button>
                  </div>
                );
              })}
            </Panel>
            <Panel title="Formato del video">
              <Choice label="Forma" value={s.aspect ?? '9:16'} onChange={v => update({ aspect: v })}
                options={[{ value: '9:16', label: 'Vertical (historias)' }, { value: '16:9', label: 'Horizontal' }, { value: '1:1', label: 'Cuadrado' }]} />
              <Choice label="Calidad" value={s.resolution ?? 720} onChange={v => update({ resolution: v })}
                options={[{ value: 720, label: 'HD 720p (recomendada en TV box)' }, { value: 1080, label: 'Full HD 1080p' }]} />
              <Choice label="Cuenta regresiva (General)" value={s.countdown ?? 3} onChange={v => update({ countdown: v })}
                options={[0, 3, 5, 10].map(n => ({ value: n, label: n ? `${n} s` : 'Sin cuenta' }))} />
              <Toggle label="El invitado revisa su video" hint="Puede repetirlo antes de llevárselo" checked={s.review !== false} onChange={v => update({ review: v })} />
              <Choice label="Tiempo del resultado en pantalla" value={s.resultSeconds ?? 45} onChange={v => update({ resultSeconds: v })}
                options={[30, 45, 60, 90, 120].map(n => ({ value: n, label: `${n} s` }))} />
            </Panel>
            <LayersPanel s={s} update={update} />
            <DeliveryPanel s={s} update={update} />
            <GalleryPanel s={s} update={update} />
            <Panel title="Pantalla de inicio">
              <Field label="Texto grande (vacío = nombre del evento)">
                <input className={inputClass} value={s.title ?? ''} onChange={e => update({ title: e.target.value })} placeholder="¡Grabá tu video!" />
              </Field>
              <Note>Al elegir una experiencia, la cabina se queda en esa. Con el candado de la pantalla de inicio se bloquea (para salir pide la clave).</Note>
            </Panel>
          </>
        )}

        {isMode && (
          <>
            <PreviewPanel s={s} modeKey={tab as VideoModeKey} />
            <ModeEditor key={tab} modeKey={tab as VideoModeKey} s={s} frames={frames} songs={songs} backgrounds={backgroundOptions(s)} kit={kit}
              onChange={patch => updateMode(tab as VideoModeKey, patch)} />
            {tab === '360' && <MotionPanel s={s} update={update} />}
            {tab === 'firmas' && (<>
              <Panel title="Pantalla del libro de firmas" description="Lo que ve el invitado antes de grabar. El fondo se elige arriba (o en Biblioteca → Fondos).">
                <Field label="Título (vacío = Libro de firmas)">
                  <input className={inputClass} value={s.guestbookTitle ?? ''} onChange={e => update({ guestbookTitle: e.target.value })} placeholder="Libro de firmas" />
                </Field>
                <Field label="Texto propio (opcional)">
                  <input className={inputClass} value={s.guestbookText ?? ''} onChange={e => update({ guestbookText: e.target.value })} placeholder="Dejales un mensaje a Roxana y Martín" />
                </Field>
              </Panel>
              <Panel title="Preguntas del libro de firmas" description="Una por renglón. A cada invitado le toca una al azar.">
                <textarea className={`${inputClass} min-h-48`} value={promptsText}
                  onChange={e => setPromptsText(e.target.value)}
                  onBlur={() => update({ prompts: promptsText.split('\n').map(p => p.trim()).filter(Boolean) })} />
              </Panel>
            </>
            )}
          </>
        )}

        {tab === 'biblioteca' && (
          <>
            <PreviewPanel s={s} />
            <FramesPanel s={s} update={update} />
            <BackgroundsPanel s={s} update={update} />
            <MusicPanel s={s} update={update} />
            <BrandPanel s={s} update={update} />
            <AnimVideoPanel s={s} update={update} />
          </>
        )}

        {tab === 'equipo' && (
          <>
            <div className={`kiosk-glass rounded-2xl px-6 py-4 ${support.ok && support.mp4 ? 'text-white/80' : 'text-amber-100'}`}>
              Formato de video de este equipo: <b>{support.format}</b>
              {support.ok && !support.mp4 && ' — los iPhone no reproducen WebM: conviene actualizar el WebView del equipo (Chrome 126 o más nuevo graba MP4).'}
            </div>
            <DevicePanel onLink={() => navigate('/')} />
            <UpdatePanel s={s} update={update} />
            <CloudPanel s={s} update={update} />
            <CameraPanel s={s} update={update} />
            <Panel title="Cuadros por segundo">
              <Toggle label="Pedir 60 cuadros por segundo" hint="Cámara lenta más fluida si la cámara lo da (celulares y webcams buenas)" checked={s.highFps !== false} onChange={v => update({ highFps: v })} />
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
