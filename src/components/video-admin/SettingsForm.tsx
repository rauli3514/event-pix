import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, ImagePlus, Music, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RemoteFile, RemoteVideoSettings, VideoAssets } from '@/lib/videoBooth/remote';
import { DEFAULT_PUBLIC_SITE } from '@/lib/videoBooth/share';
import {
  ANIMATIONS, CORNERS, newGalleryCode, RAMP_PRESETS, VIDEO_FILTERS, VIDEO_MODES,
  type VideoModeConfig, type VideoModeKey,
} from '@/lib/videoBooth/settings';
import { btnGhost, Check, Field, input, Section, Select } from './ui';

// Configuración de un equipo de la cabina desde el panel: ajustes y archivos
// (marcos, logo, música, animación). Los archivos se suben al bucket
// video-assets y el equipo los baja y los guarda.

type Setter = (fn: (f: RemoteVideoSettings) => RemoteVideoSettings) => void;

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
  const frameInput = useRef<HTMLInputElement>(null);
  const songInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const animInput = useRef<HTMLInputElement>(null);

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, video: { ...(f.video ?? {}), [key]: value } }));
  const setAssets = (patch: Partial<VideoAssets>) => setForm(f => ({ ...f, assets: { ...(f.assets ?? {}), ...patch } }));
  const val = <T,>(key: string, def: T) => (v[key] === undefined || v[key] === null ? def : v[key] as T);
  const modes = (v.modes ?? {}) as Partial<Record<VideoModeKey, Partial<VideoModeConfig>>>;
  const mode = (key: VideoModeKey) => ({ ...VIDEO_MODES.find(m => m.key === key)!.defaults, ...(modes[key] ?? {}) });
  const setMode = (key: VideoModeKey, patch: Partial<VideoModeConfig>) =>
    set('modes', { ...modes, [key]: { ...(modes[key] ?? {}), ...patch } });

  const upload = async (kind: 'frames' | 'songs' | 'logo' | 'anim', files: FileList | null) => {
    if (!files?.length) return;
    setBusy(kind);
    try {
      if (kind === 'frames' || kind === 'songs') {
        const added: RemoteFile[] = [];
        for (const file of Array.from(files)) added.push({ id: uid(), name: file.name.replace(/\.\w+$/, ''), url: await uploadAsset(kind, file) });
        setAssets({ [kind]: [...(assets[kind] ?? []), ...added] });
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
  ];
  const songOptions = [
    ...localSongs.map(f => ({ value: f.id, label: `${f.name} (cargada en el equipo)` })),
    ...(assets.songs ?? []).map(f => ({ value: f.id, label: f.name })),
  ];
  const gallery = String(v.galleryCode ?? '');
  const site = (String(v.publicSiteUrl ?? '').trim() || DEFAULT_PUBLIC_SITE).replace(/\/+$/, '');

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Evento">
        <Field label="Nombre del evento" hint="Va en el marco y la placa final, y es la carpeta de los videos.">
          <input className={input} value={val('eventTitle', '')} onChange={e => set('eventTitle', e.target.value)} placeholder="15 de Pía" />
        </Field>
        <Field label="Texto de la bienvenida">
          <input className={input} value={val('title', '')} onChange={e => set('title', e.target.value)} placeholder="¡Grabá tu video!" />
        </Field>
        <Check label="Trabajar sin conexión (sin QR ni WhatsApp)" checked={val('offline', false)} onChange={x => set('offline', x)} />
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
        <div className="space-y-3">
          {VIDEO_MODES.map(m => {
            const c = mode(m.key);
            return (
              <div key={m.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <Check label={m.label} checked={c.enabled} onChange={on => setMode(m.key, { enabled: on })} />
                <Select value={c.seconds} options={m.secondsOptions.map(n => ({ value: n, label: `${n} s` }))} onChange={n => setMode(m.key, { seconds: n })} />
                <Select value={c.filter} options={VIDEO_FILTERS.map(f => ({ value: f.value, label: f.label }))} onChange={f => setMode(m.key, { filter: f })} />
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
          <Field label="Cuenta regresiva">
            <Select value={val('countdown', 3)} options={[0, 3, 5, 10].map(n => ({ value: n, label: n ? `${n} s` : 'Sin cuenta' }))} onChange={x => set('countdown', x)} />
          </Field>
        </div>
        <Check label="El invitado revisa su video y puede repetirlo" checked={val('review', true)} onChange={x => set('review', x)} />
      </Section>

      <Section title="360 y efectos">
        <Check label="El 360 empieza solo cuando gira la plataforma" checked={val('autoStart360', false)} onChange={x => set('autoStart360', x)} />
        <Check label="Y corta solo cuando la plataforma para" checked={val('autoStop360', false)} onChange={x => set('autoStop360', x)} />
        <Check label="Modo continuo (vuelve directo a esperar el próximo giro)" checked={val('continuous360', false)} onChange={x => set('continuous360', x)} />
        <Field label="Sensibilidad del movimiento" hint="Lo ideal es calibrarla en el equipo (Ajustes de la cabina → 360). Más bajo = arranca con menos movimiento.">
          <input type="range" min={2} max={60} value={val('motionThreshold', 14)} onChange={e => set('motionThreshold', Number(e.target.value))} className="w-full" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rampa del 360">
            <Select value={val('rampPreset', 'clasica')} options={RAMP_PRESETS.map(r => ({ value: r.value as string, label: r.label }))} onChange={x => set('rampPreset', x)} />
          </Field>
          <Field label="Cámara lenta">
            <Select value={val('slowSpeed', 0.5)} options={[{ value: 0.5, label: '½' }, { value: 0.33, label: '⅓' }, { value: 0.25, label: '¼' }]} onChange={x => set('slowSpeed', x)} />
          </Field>
          <Field label="Animación encima">
            <Select value={val('animation', 'none')} options={ANIMATIONS.map(a => ({ value: a.value as string, label: a.label }))} onChange={x => set('animation', x)} />
          </Field>
          <Field label="Vueltas del boomerang">
            <Select value={val('boomerangLoops', 3)} options={[2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))} onChange={x => set('boomerangLoops', x)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Check label="Zoom suave" checked={val('zoomEffect', false)} onChange={x => set('zoomEffect', x)} />
          <Check label="Destellos en el 360" checked={val('flashEffect', false)} onChange={x => set('flashEffect', x)} />
        </div>
        <input ref={animInput} type="file" accept="video/webm,video/mp4" className="hidden" onChange={e => { void upload('anim', e.target.files); e.target.value = ''; }} />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => animInput.current?.click()} disabled={!!busy} className={btnGhost}><Upload className="h-4 w-4" /> {busy === 'anim' ? 'Subiendo…' : assets.anim ? 'Cambiar animación propia' : 'Subir animación propia (video)'}</button>
          {assets.anim && <button onClick={() => setAssets({ anim: null })} className={btnGhost}><Trash2 className="h-4 w-4" /> Quitar</button>}
        </div>
      </Section>

      <Section title="Marcos">
        <Field label="Marco">
          <Select value={val('overlay', 'none')} options={[{ value: 'none', label: 'Sin marco' }, { value: 'title', label: 'Nombre del evento' }, { value: 'custom', label: 'PNG' }]} onChange={x => set('overlay', x)} />
        </Field>
        {frameOptions.length > 0 && (
          <Field label="Marco PNG por defecto">
            <Select value={val('frameId', frameOptions[0].value)} options={frameOptions} onChange={x => set('frameId', x)} />
          </Field>
        )}
        <Check label="El invitado elige el marco" checked={val('frameChoice', false)} onChange={x => set('frameChoice', x)} />
        <div className="flex flex-wrap gap-3">
          {(assets.frames ?? []).map(f => (
            <div key={f.id} className="relative">
              <img src={f.url} alt={f.name} className="h-28 rounded-lg border border-slate-700 bg-[repeating-conic-gradient(#334155_0_25%,#1e293b_0_50%)] bg-[length:12px_12px]" />
              <button onClick={() => setAssets({ frames: (assets.frames ?? []).filter(x => x.id !== f.id) })} className="absolute -top-2 -right-2 rounded-full bg-red-600 p-1" aria-label="Quitar"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
        <input ref={frameInput} type="file" accept="image/png,image/webp" multiple className="hidden" onChange={e => { void upload('frames', e.target.files); e.target.value = ''; }} />
        <button onClick={() => frameInput.current?.click()} disabled={!!busy} className={btnGhost}><ImagePlus className="h-4 w-4" /> {busy === 'frames' ? 'Subiendo…' : 'Subir marcos PNG'}</button>
        <p className="text-xs text-slate-500">PNG con el centro transparente y la misma forma que el video (1080×1920 vertical, 1920×1080 horizontal o 1080×1080).</p>
        <Field label="Accesorio que sigue la cara">
          <Select value={val('accessory', 'none')} options={[{ value: 'none', label: 'Ninguno' }, { value: 'glasses', label: 'Anteojos' }, { value: 'stars', label: 'Anteojos estrella' }, { value: 'crown', label: 'Corona' }, { value: 'bunny', label: 'Orejas de conejo' }, { value: 'party', label: 'Gorro de fiesta' }, { value: 'mustache', label: 'Bigote' }]} onChange={x => set('accessory', x)} />
        </Field>
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
            <Select value={val('logoSize', 0.22)} options={[0.12, 0.18, 0.22, 0.3, 0.4].map(n => ({ value: n, label: `${Math.round(n * 100)}% del ancho` }))} onChange={x => set('logoSize', x)} />
          </Field>
          <Field label="Marca de agua (texto)">
            <input className={input} value={val('watermark', '')} onChange={e => set('watermark', e.target.value)} placeholder="@tuempresa" />
          </Field>
          <Field label="Lugar de la marca de agua">
            <Select value={val('watermarkPosition', 'bl')} options={CORNERS} onChange={x => set('watermarkPosition', x)} />
          </Field>
          <Field label="Color de la marca">
            <input type="color" className={`${input} h-11 p-1`} value={val('brandColor', '#7b2ff7')} onChange={e => set('brandColor', e.target.value)} />
          </Field>
          <Field label="Placa final">
            <Select value={val('endCard', false) ? val('endCardSeconds', 2.5) : 0} options={[{ value: 0, label: 'Sin placa' }, { value: 2, label: '2 s' }, { value: 2.5, label: '2,5 s' }, { value: 3.5, label: '3,5 s' }]}
              onChange={x => { set('endCard', x > 0); if (x > 0) set('endCardSeconds', x); }} />
          </Field>
        </div>
        <Field label="Texto de la placa final">
          <input className={input} value={val('endCardText', '')} onChange={e => set('endCardText', e.target.value)} placeholder="www.tuempresa.com" />
        </Field>
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
          <Field label="Qué canción suena">
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
        <Field label="Código de la galería" hint="Cambialo para empezar una galería nueva (por ejemplo, en cada evento).">
          <div className="flex gap-2">
            <input className={input} value={gallery} onChange={e => set('galleryCode', e.target.value.trim())} placeholder="Se crea solo en el equipo" />
            <button onClick={() => set('galleryCode', newGalleryCode())} className={btnGhost}>Nueva</button>
          </div>
        </Field>
        {gallery && (
          <div className="flex flex-wrap gap-2">
            <a href={`${site}/galeria-video/${gallery}`} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" /> Galería</a>
            <a href={`${site}/galeria-video/${gallery}?pantalla=1`} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" /> Modo pantalla</a>
          </div>
        )}
      </Section>
    </div>
  );
}
