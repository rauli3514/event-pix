import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Music, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RemoteFile, RemoteVideoSettings, VideoAssets } from '@/lib/videoBooth/remote';
import { DEFAULT_PUBLIC_SITE } from '@/lib/videoBooth/share';
import { VIDEO_ACCESSORIES } from '@/lib/videoBooth/accessories';
import {
  ANIMATIONS, CORNERS, DEFAULT_PROMPTS, LOGO_SIZES, newGalleryCode, TEXT_SCALES, VIDEO_MODES, WATERMARK_POSITIONS, WATERMARK_SIZES,
  type VideoBoothSettings, type VideoModeConfig, type VideoModeKey,
} from '@/lib/videoBooth/settings';
import ModeEditor, { type ModeKit } from '@/components/video-booth/ModeEditor';
import { BUILT_IN_VIDEO_FRAMES } from '@/lib/videoBooth/builtinFrames';
import { btnGhost, Check, Field, input, Section, Select } from './ui';
import GalleryLinks from './GalleryLinks';

// Configuración de un equipo de la cabina desde el panel: ajustes y archivos
// (marcos, logo, música, animación). Los archivos se suben al bucket
// video-assets y el equipo los baja y los guarda.

type Setter = (fn: (f: RemoteVideoSettings) => RemoteVideoSettings) => void;

type Tab = 'general' | VideoModeKey | 'biblioteca';
const SHORT: Record<VideoModeKey, string> = { clasico: 'Video', boomerang: 'Boomerang', lenta: 'Cámara lenta', '360': '360', firmas: 'Firmas', glam: 'Glam' };

const kit: ModeKit = {
  Group: ({ title, description, children }) => (
    <Section title={title}>
      {description && <p className="-mt-2 text-sm text-slate-400">{description}</p>}
      {children}
    </Section>
  ),
  Toggle: ({ label, hint, checked, onChange }) => (
    <div className="space-y-1">
      <Check label={label} checked={checked} onChange={onChange} />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  ),
  Pick: ({ label, value, options, onChange }) => <Field label={label}><Select value={value} options={options} onChange={onChange} /></Field>,
  Multi: ({ label, values, options, onChange }) => (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = values.includes(o.value);
          return (
            <button key={o.value} type="button" onClick={() => onChange(on ? values.filter(x => x !== o.value) : [...values, o.value])}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-slate-700 text-slate-400'}`}>
              {o.label}
            </button>
          );
        })}
      </div>
    </Field>
  ),
  Range: ({ label, value, min, max, step, onChange }) => (
    <Field label={label}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-violet-500" />
    </Field>
  ),
  Button: ({ onClick, disabled, children }) => <button type="button" onClick={onClick} disabled={disabled} className={btnGhost}>{children}</button>,
  Note: ({ children }: { children: ReactNode }) => <p className="text-sm text-slate-400">{children}</p>,
};

const uid = () => `r-${Math.random().toString(36).slice(2, 10)}`;

async function uploadAsset(kind: string, file: File) {
  const path = `${kind}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
  const { error } = await supabase.storage.from('video-assets').upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Falta correr la migración de la cabina de video (bucket video-assets)' : error.message);
  return supabase.storage.from('video-assets').getPublicUrl(path).data.publicUrl;
}

export default function SettingsForm({ form, setForm }: { form: RemoteVideoSettings; setForm: Setter }) {
  const v = form.video ?? {};
  const assets: VideoAssets = form.assets ?? {};
  const cam = form.camera ?? {};
  const setCam = (key: string, value: unknown) => setForm(f => ({ ...f, camera: { ...(f.camera ?? {}), [key]: value } }));
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<Tab>('general');
  const frameInput = useRef<HTMLInputElement>(null);
  const songInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const animInput = useRef<HTMLInputElement>(null);
  const endInput = useRef<HTMLInputElement>(null);

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, video: { ...(f.video ?? {}), [key]: value } }));
  const setAssets = (patch: Partial<VideoAssets>) => setForm(f => ({ ...f, assets: { ...(f.assets ?? {}), ...patch } }));
  const val = <T,>(key: string, def: T) => (v[key] === undefined || v[key] === null ? def : v[key] as T);
  const modes = (v.modes ?? {}) as Partial<Record<VideoModeKey, Partial<VideoModeConfig>>>;
  const mode = (key: VideoModeKey) => ({ ...VIDEO_MODES.find(m => m.key === key)!.defaults, ...(modes[key] ?? {}) });
  const isMode = VIDEO_MODES.some(m => m.key === tab);
  const [promptsText, setPromptsText] = useState(() => ((v.prompts as string[] | undefined)?.length ? v.prompts as string[] : DEFAULT_PROMPTS).join('\n'));
  const setMode = (key: VideoModeKey, patch: Partial<VideoModeConfig>) =>
    set('modes', { ...modes, [key]: { ...(modes[key] ?? {}), ...patch } });

  const upload = async (kind: 'frames' | 'songs' | 'logo' | 'anim' | 'endcard', files: FileList | null) => {
    if (!files?.length) return;
    setBusy(kind);
    try {
      if (kind === 'frames' || kind === 'songs') {
        const added: RemoteFile[] = [];
        for (const file of Array.from(files)) added.push({ id: uid(), name: file.name.replace(/\.\w+$/, ''), url: await uploadAsset(kind, file) });
        setAssets({ [kind]: [...(assets[kind] ?? []), ...added] });
        // Con marcos nuevos, el equipo pasa a usar marco (el primero subido si no había uno elegido)
        if (kind === 'frames') {
          setForm(f => {
            const video = f.video ?? {};
            const hasOwn = (f.assets?.frames ?? []).length > added.length || ((video.frames ?? []) as { id: string }[]).some(x => !x.id.startsWith('r-'));
            return { ...f, video: { ...video, overlay: 'custom', ...(hasOwn && video.frameId ? {} : { frameId: added[0].id }) } };
          });
        }
      } else {
        setAssets({ [kind]: await uploadAsset(kind, files[0]) });
      }
      toast.success('Archivo subido. Guardá y enviá para mandarlo al equipo.');
    } catch (e) {
      toast.error(`No se pudo subir: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy('');
    }
  };

  // Marcos y canciones que el equipo tiene cargados por su cuenta (no se manejan desde acá)
  const localFrames = ((v.frames ?? []) as { id: string; name: string }[]).filter(f => !f.id.startsWith('r-'));
  const localSongs = ((v.songs ?? []) as { id: string; name: string }[]).filter(f => !f.id.startsWith('r-'));
  const frameOptions = [
    ...localFrames.map(f => ({ value: f.id, label: `${f.name} (cargado en el equipo)` })),
    ...(assets.frames ?? []).map(f => ({ value: f.id, label: f.name })),
    ...BUILT_IN_VIDEO_FRAMES.map(f => ({ value: f.id, label: `${f.name} (de fábrica)` })),
  ];
  const overlay = val('overlay', 'none') as string;
  const dateMode = val('overlayDateMode', 'auto') as string;
  const songOptions = [
    ...localSongs.map(f => ({ value: f.id, label: `${f.name} (cargada en el equipo)` })),
    ...(assets.songs ?? []).map(f => ({ value: f.id, label: f.name })),
  ];
  const gallery = String(v.galleryCode ?? '');
  const site = (String(v.publicSiteUrl ?? '').trim() || DEFAULT_PUBLIC_SITE).replace(/\/+$/, '');

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-1.5">
        {([['general', 'General'], ...VIDEO_MODES.map(m => [m.key, SHORT[m.key]]), ['biblioteca', 'Biblioteca']] as [Tab, string][]).map(([key, label]) => {
          const off = VIDEO_MODES.some(m => m.key === key) && !mode(key as VideoModeKey).enabled;
          return (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-violet-600 text-white' : off ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-200 hover:bg-slate-800'}`}>
              {label}
            </button>
          );
        })}
      </nav>
      {tab === 'general' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Evento">
            <Field label="Nombre del evento" hint="Va en el marco y la placa final, y es la carpeta de los videos.">
              <input className={input} value={val('eventTitle', '')} onChange={e => set('eventTitle', e.target.value)} placeholder="15 de Pía" />
            </Field>
            <Field label="Texto de la bienvenida">
              <input className={input} value={val('title', '')} onChange={e => set('title', e.target.value)} placeholder="¡Grabá tu video!" />
            </Field>
            <Check label="Trabajar sin conexión (sin QR ni WhatsApp)" checked={val('offline', false)} onChange={x => set('offline', x)} />
            <Check label="Actualizar la app sola al prender el equipo" checked={val('autoUpdate', true)} onChange={x => set('autoUpdate', x)} />
          </Section>
          <Section title="Cámara">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calidad">
                <Select value={String(cam.quality ?? 'auto')} options={[{ value: 'auto', label: 'Automática' }, { value: '1080', label: 'Full HD' }, { value: '720', label: 'HD' }, { value: '480', label: 'Baja' }]} onChange={x => setCam('quality', x)} />
              </Field>
              <Field label="Giro de la imagen">
                <Select value={Number(cam.rotation ?? 0)} options={[0, 90, 180, 270].map(n => ({ value: n, label: `${n}°` }))} onChange={x => setCam('rotation', x)} />
              </Field>
              <Field label="En celular o tablet">
                <Select value={val('facing', 'user')} options={[{ value: 'user', label: 'Cámara de adelante' }, { value: 'environment', label: 'Cámara de atrás' }]} onChange={x => set('facing', x)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Check label="Modo espejo" checked={!!cam.mirror} onChange={x => setCam('mirror', x)} />
              <Check label="Enfoque fijo lejos" checked={cam.focus === 'far'} onChange={x => setCam('focus', x ? 'far' : 'auto')} />
              <Check label="Pedir 60 cuadros por segundo" checked={val('highFps', true)} onChange={x => set('highFps', x)} />
            </div>
          </Section>
          <Section title="Nube (Google Drive de la cabina)">
            <Field label="Dirección del Apps Script" hint="Vacío = el incluido en la app (VITE_VIDEO_DRIVE_SCRIPT_URL).">
              <input className={input} value={val('driveScriptUrl', '')} onChange={e => set('driveScriptUrl', e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" />
            </Field>
            <Field label="Link de la carpeta de Drive">
              <input className={input} value={val('driveFolderLink', '')} onChange={e => set('driveFolderLink', e.target.value.trim())} placeholder="https://drive.google.com/drive/folders/…" />
            </Field>
            <Field label="Sitio de la página del invitado" hint={`Vacío = ${DEFAULT_PUBLIC_SITE}`}>
              <input className={input} value={val('publicSiteUrl', '')} onChange={e => set('publicSiteUrl', e.target.value.trim())} placeholder={DEFAULT_PUBLIC_SITE} />
            </Field>
          </Section>
          <Section title="Experiencias">
            <p className="-mt-2 text-sm text-slate-400">Cada experiencia tiene su pestaña: duración, música, marco, animación, accesorio y efectos.</p>
            <div className="space-y-2">
              {VIDEO_MODES.map(m => {
                const c = mode(m.key);
                return (
                  <div key={m.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Check label={m.label} checked={c.enabled} onChange={on => setMode(m.key, { enabled: on })} />
                    <button type="button" onClick={() => setTab(m.key)} className={btnGhost}>Configurar</button>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Forma">
                <Select value={val('aspect', '9:16')} options={[{ value: '9:16', label: 'Vertical' }, { value: '16:9', label: 'Horizontal' }, { value: '1:1', label: 'Cuadrado' }]} onChange={x => set('aspect', x)} />
              </Field>
              <Field label="Calidad">
                <Select value={val('resolution', 720)} options={[{ value: 720, label: 'HD 720p' }, { value: 1080, label: 'Full HD 1080p' }]} onChange={x => set('resolution', x)} />
              </Field>
              <Field label="Cuenta regresiva (General)">
                <Select value={val('countdown', 3)} options={[0, 3, 5, 10].map(n => ({ value: n, label: n ? `${n} s` : 'Sin cuenta' }))} onChange={x => set('countdown', x)} />
              </Field>
              <Field label="Resultado en pantalla">
                <Select value={val('resultSeconds', 45)} options={[30, 45, 60, 90, 120].map(n => ({ value: n, label: `${n} s` }))} onChange={x => set('resultSeconds', x)} />
              </Field>
            </div>
            <Check label="El invitado revisa su video y puede repetirlo" checked={val('review', true)} onChange={x => set('review', x)} />
          </Section>
          <Section title="Animación y accesorio (General)">
            <p className="-mt-2 text-sm text-slate-400">Los usan las experiencias que no tienen uno propio.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Animación encima">
                <Select value={val('animation', 'none')} options={ANIMATIONS.map(a => ({ value: a.value as string, label: a.label }))} onChange={x => set('animation', x)} />
              </Field>
              <Field label="Accesorio que sigue la cara">
                <Select value={val('accessory', 'none')} options={[{ value: 'none', label: 'Ninguno' }, { value: 'random', label: 'Al azar' }, ...VIDEO_ACCESSORIES]} onChange={x => set('accessory', x)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Check label="Zoom suave" checked={val('zoomEffect', false)} onChange={x => set('zoomEffect', x)} />
              <Check label="Destellos en el 360" checked={val('flashEffect', false)} onChange={x => set('flashEffect', x)} />
            </div>
          </Section>
          <Section title="Entrega, galería y WhatsApp">
            <Field label="El QR del resultado abre">
              <Select value={val('delivery', 'video')} options={[{ value: 'video', label: 'El video del invitado' }, { value: 'gallery', label: 'La galería del evento' }, { value: 'both', label: 'Los dos (dos QR)' }]} onChange={x => set('delivery', x)} />
            </Field>
            <Check label="Mostrar QR" checked={val('showQr', true)} onChange={x => set('showQr', x)} />
            <Field label="Videos en la galería" hint="Con aprobación, los videos esperan en Kioscos → Videos hasta que los apruebes.">
              <Select value={val('galleryModeration', 'post')} options={[{ value: 'post', label: 'Aparecen solos' }, { value: 'pre', label: 'Con aprobación previa' }]} onChange={x => set('galleryModeration', x)} />
            </Field>
            <Check label="Botón “Enviar por WhatsApp”" checked={val('whatsappEnabled', false)} onChange={x => set('whatsappEnabled', x)} />
            {val('whatsappEnabled', false) && (
              <Field label="Prefijo del país" hint="Va antes del número que escribe el invitado. 549 = Argentina, celulares.">
                <input className={input} inputMode="numeric" value={val('whatsappPrefix', '549')} onChange={e => set('whatsappPrefix', e.target.value.replace(/\D/g, ''))} />
              </Field>
            )}
            <Field label="Código de la galería" hint="Lleva el nombre del evento (fácil de encontrar). Al cambiar el nombre del evento, el equipo empieza una galería nueva sola.">
              <div className="flex gap-2">
                <input className={input} value={gallery} onChange={e => set('galleryCode', e.target.value.trim())} placeholder="Se crea solo en el equipo" />
                <button onClick={() => { const ev = String(v.eventTitle ?? '').trim(); setForm(f => ({ ...f, video: { ...(f.video ?? {}), galleryCode: newGalleryCode(ev), galleryEvent: ev } })); }} className={btnGhost}>Nueva</button>
              </div>
            </Field>
            {gallery && <GalleryLinks site={site} code={gallery} />}
          </Section>
        </div>
      )}
      {isMode && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ModeEditor key={tab} modeKey={tab as VideoModeKey} s={v as VideoBoothSettings} frames={frameOptions} songs={songOptions} kit={kit}
            onChange={patch => setMode(tab as VideoModeKey, patch)} />
          {tab === '360' && (
            <Section title="Arranque automático del 360">
              <Check label="Empieza solo cuando gira la plataforma" checked={val('autoStart360', false)} onChange={x => set('autoStart360', x)} />
              <Check label="Y corta solo cuando la plataforma para" checked={val('autoStop360', false)} onChange={x => set('autoStop360', x)} />
              <Check label="Modo continuo (vuelve directo a esperar el próximo giro)" checked={val('continuous360', false)} onChange={x => set('continuous360', x)} />
              <Field label="Sensibilidad del movimiento" hint="Lo ideal es calibrarla en el equipo (Ajustes → 360). Más bajo = arranca con menos movimiento.">
                <input type="range" min={2} max={60} value={val('motionThreshold', 14)} onChange={e => set('motionThreshold', Number(e.target.value))} className="w-full accent-violet-500" />
              </Field>
            </Section>
          )}
          {tab === 'firmas' && (
            <Section title="Preguntas del libro de firmas">
              <Field label="Una por renglón" hint="A cada invitado le toca una al azar.">
                <textarea className={`${input} min-h-40`} value={promptsText} onChange={e => setPromptsText(e.target.value)}
                  onBlur={() => set('prompts', promptsText.split('\n').map(x => x.trim()).filter(Boolean))} />
              </Field>
            </Section>
          )}
        </div>
      )}
      {tab === 'biblioteca' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Marcos (plantillas)">
            <Field label="Marco de General">
              <Select value={overlay} options={[{ value: 'none', label: 'Sin marco' }, { value: 'title', label: 'Nombre y fecha' }, { value: 'custom', label: 'Marco (plantilla)' }]} onChange={x => set('overlay', x)} />
            </Field>
            {overlay === 'custom' && (
              <>
                <Field label="Qué marco se usa" hint="Hay marcos de fábrica (con el logo de EventPix y los del espejo) y los que subas.">
                  <Select value={val('frameId', frameOptions[0].value)} options={[{ value: 'random', label: 'Uno al azar en cada video' }, ...frameOptions]} onChange={x => set('frameId', x)} />
                </Field>
                <Check label="El invitado elige el marco" checked={val('frameChoice', false)} onChange={x => set('frameChoice', x)} />
                {(val('frameChoice', false) || val<string>('frameId', '') === 'random') && (
                  <Field label="Marcos para elegir o para el azar" hint="Sin marcar ninguno: los que subiste (o los de fábrica si no subiste).">
                    <div className="flex flex-wrap gap-2">
                      {frameOptions.map(o => {
                        const list = (v.guestFrames ?? []) as string[];
                        const on = list.includes(o.value);
                        return (
                          <button key={o.value} type="button" onClick={() => set('guestFrames', on ? list.filter(x => x !== o.value) : [...list, o.value])}
                            className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-slate-700 text-slate-400'}`}>{o.label}</button>
                        );
                      })}
                    </div>
                  </Field>
                )}
                <Check label="Nombre y fecha encima del marco" checked={val('frameText', false)} onChange={x => set('frameText', x)} />
              </>
            )}
            {(overlay === 'title' || (overlay === 'custom' && val('frameText', false))) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Texto grande" hint="Vacío = nombre del evento">
                  <input className={input} value={val('overlayText', '')} onChange={e => set('overlayText', e.target.value)} placeholder={String(v.eventTitle ?? 'Sofi & Juan')} />
                </Field>
                <Field label="Fecha">
                  <Select value={dateMode} options={[{ value: 'auto', label: 'La de hoy (automática)' }, { value: 'custom', label: 'La escribo yo' }, { value: 'none', label: 'Sin fecha' }]} onChange={x => set('overlayDateMode', x)} />
                </Field>
                {dateMode === 'custom' && (
                  <Field label="Fecha o texto chico">
                    <input className={input} value={val('overlayDate', '')} onChange={e => set('overlayDate', e.target.value)} placeholder="14 de diciembre de 2026" />
                  </Field>
                )}
                <Field label="Dónde">
                  <Select value={val('textPosition', 'bottom')} options={[{ value: 'bottom', label: 'Abajo' }, { value: 'top', label: 'Arriba' }]} onChange={x => set('textPosition', x)} />
                </Field>
                <Field label="Tamaño del texto">
                  <Select value={val('textScale', 1)} options={TEXT_SCALES} onChange={x => set('textScale', x)} />
                </Field>
                <Field label="Color del texto">
                  <input type="color" className={`${input} h-11 p-1`} value={val('textColor', '#ffffff')} onChange={e => set('textColor', e.target.value)} />
                </Field>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {(assets.frames ?? []).map(f => (
                <div key={f.id} className="relative">
                  <img src={f.url} alt={f.name} className="h-28 rounded-lg border border-slate-700 bg-[repeating-conic-gradient(#334155_0_25%,#1e293b_0_50%)] bg-[length:12px_12px]" />
                  <button onClick={() => setAssets({ frames: (assets.frames ?? []).filter(x => x.id !== f.id) })} className="absolute -top-2 -right-2 rounded-full bg-red-600 p-1" aria-label="Quitar"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <input ref={frameInput} type="file" accept="image/png,image/webp" multiple className="hidden" onChange={e => { void upload('frames', e.target.files); e.target.value = ''; }} />
            <button onClick={() => frameInput.current?.click()} disabled={!!busy} className={btnGhost}><ImagePlus className="h-4 w-4" /> {busy === 'frames' ? 'Subiendo…' : 'Subir mis marcos PNG'}</button>
            <p className="text-xs text-slate-500">PNG con el centro transparente y la misma forma que el video (1080×1920 vertical, 1920×1080 horizontal o 1080×1080). Al subirlos, el equipo pasa a usar marco.</p>
          </Section>
          <Section title="Música">
            <div className="space-y-2">
              {(assets.songs ?? []).map(sg => (
                <div key={sg.id} className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-violet-400 shrink-0" />
                  <span className="flex-1 truncate text-sm text-slate-200">{sg.name}</span>
                  <input type="number" min={0} className={`${input} w-24`} value={sg.start ?? 0} title="Empieza en el segundo"
                    onChange={e => setAssets({ songs: (assets.songs ?? []).map(x => x.id === sg.id ? { ...x, start: Number(e.target.value) || 0 } : x) })} />
                  <button onClick={() => setAssets({ songs: (assets.songs ?? []).filter(x => x.id !== sg.id) })} className={btnGhost} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <input ref={songInput} type="file" accept="audio/*" multiple className="hidden" onChange={e => { void upload('songs', e.target.files); e.target.value = ''; }} />
            <button onClick={() => songInput.current?.click()} disabled={!!busy} className={btnGhost}><Upload className="h-4 w-4" /> {busy === 'songs' ? 'Subiendo…' : 'Subir canciones (MP3)'}</button>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qué canción suena (General)">
                <Select value={val('songMode', 'fixed')} options={[{ value: 'fixed', label: 'Siempre la misma' }, { value: 'random', label: 'Una al azar' }, { value: 'guest', label: 'La elige el invitado' }]} onChange={x => set('songMode', x)} />
              </Field>
              {songOptions.length > 0 && (
                <Field label="Canción fija">
                  <Select value={val('songId', songOptions[0].value)} options={songOptions} onChange={x => set('songId', x)} />
                </Field>
              )}
              <Field label="Volumen">
                <Select value={val('musicVolume', 0.8)} options={[0.4, 0.6, 0.8, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} onChange={x => set('musicVolume', x)} />
              </Field>
            </div>
          </Section>
          <Section title="Marca">
            <div className="flex flex-wrap items-center gap-3">
              {assets.logo && <img src={assets.logo} alt="Logo" className="h-14 rounded bg-slate-800 p-1" />}
              <input ref={logoInput} type="file" accept="image/png,image/webp,image/svg+xml" className="hidden" onChange={e => { void upload('logo', e.target.files); e.target.value = ''; }} />
              <button onClick={() => logoInput.current?.click()} disabled={!!busy} className={btnGhost}><ImagePlus className="h-4 w-4" /> {busy === 'logo' ? 'Subiendo…' : assets.logo ? 'Cambiar logo' : 'Subir logo (PNG)'}</button>
              {assets.logo && <button onClick={() => setAssets({ logo: null })} className={btnGhost}><Trash2 className="h-4 w-4" /> Quitar</button>}
            </div>
            <Check label="Mostrar el logo en los videos" checked={val('showLogo', true)} onChange={x => set('showLogo', x)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lugar del logo">
                <Select value={val('logoPosition', 'tr')} options={CORNERS} onChange={x => set('logoPosition', x)} />
              </Field>
              <Field label="Tamaño del logo">
                <Select value={val('logoSize', 0.22)} options={LOGO_SIZES.map(n => ({ value: n, label: `${Math.round(n * 100)}% del ancho` }))} onChange={x => set('logoSize', x)} />
              </Field>
              <Field label="Marca de agua (texto)">
                <input className={input} value={val('watermark', '')} onChange={e => set('watermark', e.target.value)} placeholder="@tuempresa" />
              </Field>
              <Field label="Lugar de la marca de agua">
                <Select value={val('watermarkPosition', 'bl')} options={WATERMARK_POSITIONS} onChange={x => set('watermarkPosition', x)} />
              </Field>
              <Field label="Tamaño de la marca de agua">
                <Select value={val('watermarkSize', 0.035)} options={WATERMARK_SIZES} onChange={x => set('watermarkSize', x)} />
              </Field>
              <Field label="Transparencia de la marca de agua">
                <Select value={val('watermarkOpacity', val<string>('watermarkPosition', 'bl') === 'tile' ? 0.3 : 0.85)} options={[0.15, 0.3, 0.5, 0.7, 0.85, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} onChange={x => set('watermarkOpacity', x)} />
              </Field>
              <Field label="Color de la marca">
                <input type="color" className={`${input} h-11 p-1`} value={val('brandColor', '#7b2ff7')} onChange={e => set('brandColor', e.target.value)} />
              </Field>
              <Field label="Placa final">
                <Select value={val('endCard', false) ? val('endCardSeconds', 2.5) : 0} options={[{ value: 0, label: 'Sin placa' }, { value: 2, label: '2 s' }, { value: 2.5, label: '2,5 s' }, { value: 3.5, label: '3,5 s' }, { value: 5, label: '5 s' }]}
                  onChange={x => { set('endCard', x > 0); if (x > 0) set('endCardSeconds', x); }} />
              </Field>
            </div>
            <Field label="Texto de la placa final">
              <input className={input} value={val('endCardText', '')} onChange={e => set('endCardText', e.target.value)} placeholder="www.tuempresa.com" />
            </Field>
            <Field label="Fondo de la placa final" hint="Sin imagen: degradé con el color de la marca. Conviene la forma del video (1080×1920).">
              <div className="flex flex-wrap items-center gap-3">
                {assets.endcard && <img src={assets.endcard} alt="Placa final" className="h-20 rounded object-cover" />}
                <input ref={endInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { void upload('endcard', e.target.files); e.target.value = ''; }} />
                <button type="button" onClick={() => endInput.current?.click()} disabled={!!busy} className={btnGhost}><ImagePlus className="h-4 w-4" /> {busy === 'endcard' ? 'Subiendo…' : assets.endcard ? 'Cambiar imagen' : 'Subir imagen propia'}</button>
                {assets.endcard && <button type="button" onClick={() => setAssets({ endcard: null })} className={btnGhost}><Trash2 className="h-4 w-4" /> Quitar</button>}
              </div>
            </Field>
            {assets.endcard && <Check label="Logo y textos encima de la imagen" checked={val('endCardOverlay', true)} onChange={x => set('endCardOverlay', x)} />}
          </Section>
          <Section title="Animación propia (video)">
            <p className="-mt-2 text-sm text-slate-400">Video corto en loop (WebM con transparencia o MP4 con fondo negro). Se usa eligiendo “Video propio” como animación.</p>
            <input ref={animInput} type="file" accept="video/webm,video/mp4" className="hidden" onChange={e => { void upload('anim', e.target.files); e.target.value = ''; }} />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => animInput.current?.click()} disabled={!!busy} className={btnGhost}><Upload className="h-4 w-4" /> {busy === 'anim' ? 'Subiendo…' : assets.anim ? 'Cambiar animación propia' : 'Subir animación propia (video)'}</button>
              {assets.anim && <button onClick={() => setAssets({ anim: null })} className={btnGhost}><Trash2 className="h-4 w-4" /> Quitar</button>}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
