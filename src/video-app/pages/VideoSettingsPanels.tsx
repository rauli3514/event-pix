import { useEffect, useRef, useState } from 'react';
import { isLicensed } from '@/lib/videoBooth/device';
import { QRCodeSVG } from 'qrcode.react';
import { CloudUpload, Copy, ExternalLink, ImagePlus, Music, Play, Square, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { VIDEO_ACCESSORIES } from '@/lib/videoBooth/accessories';
import { AURA_COLORS, AURA_STYLES } from '@/lib/videoBooth/aura';
import { openCameraStream, stopStream } from '@/lib/videoBooth/camera';
import { getMedia, MEDIA_EVENT, removeMedia, saveMedia } from '@/lib/videoBooth/mediaStore';
import { isDriveConfigured } from '@/lib/videoBooth/drive';
import { isSupabaseConfigured } from '@/lib/supabase';
import { galleryScreenUrl, galleryUrl, pendingVideoCount, processVideoQueue, SCREEN_VIEWS, VIDEO_QUEUE_EVENT, type ScreenViewKey } from '@/lib/videoBooth/cloud';
import { MotionDetector, suggestThreshold } from '@/lib/videoBooth/motion';
import {
  ANIM_KEY, ANIMATIONS, CORNERS, END_KEY, frameKey, galleryCode, LOGO_KEY, LOGO_SIZES, newGalleryCode, newMediaId, outputSize, resolveMode, songKey,
  TEXT_SCALES, videoFilter, WATERMARK_POSITIONS, WATERMARK_SIZES, type VideoBoothSettings, type VideoModeKey,
} from '@/lib/videoBooth/settings';
import { buildDecor, framePool, type DecorBundle } from '@/lib/videoBooth/media';
import { isLibraryId } from '@/lib/videoBooth/library';
import { AURORA, backgroundOptions, bgKey, isBuiltinBackground } from '@/lib/videoBooth/backgrounds';
import ScreenBackground from '@/components/video-booth/ScreenBackground';
import { allFrames, builtinFrameThumb, isBuiltinFrame } from '@/lib/videoBooth/builtinFrames';
import { buttonClass, Choice, Field, inputClass, MultiChoice, Note, Panel, primaryClass, Toggle } from '../ui';

// Paneles de Ajustes de la cabina de video: marcos, capas, marca, música, 360 y entrega.

type Update = (patch: Partial<VideoBoothSettings>) => void;
interface Props { s: VideoBoothSettings; update: Update }

/** De dónde vino un archivo: el panel de este equipo o la biblioteca compartida. */
const originTag = (id: string) => (isLibraryId(id) ? ' (biblioteca)' : id.startsWith('r-') ? ' (panel)' : '');

/** URL de un archivo guardado en el equipo (se libera sola). */
function useMediaUrl(key: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let current: string | null = null;
    const load = () => getMedia(key).then(rec => {
      if (!alive) return;
      if (current) URL.revokeObjectURL(current);
      current = rec ? URL.createObjectURL(rec.blob) : null;
      setUrl(current);
    }).catch(() => {});
    void load();
    const onChange = (e: Event) => { if ((e as CustomEvent).detail === key) void load(); };
    window.addEventListener(MEDIA_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(MEDIA_EVENT, onChange);
      if (current) URL.revokeObjectURL(current);
    };
  }, [key]);
  return url;
}

const save = async (key: string, file: File) => {
  try {
    await saveMedia(key, file);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'No se pudo guardar el archivo');
    return false;
  }
};

function FrameThumb({ id, name, active, size, onPick, onRemove }: {
  id: string; name: string; active: boolean; size: { width: number; height: number }; onPick: () => void; onRemove?: () => void;
}) {
  const own = useMediaUrl(isBuiltinFrame(id) ? '' : frameKey(id));
  const [builtin, setBuiltin] = useState<string | null>(null);
  useEffect(() => {
    if (!isBuiltinFrame(id)) return;
    let alive = true;
    void builtinFrameThumb(id, size.width, size.height).then(u => { if (alive) setBuiltin(u); });
    return () => { alive = false; };
  }, [id, size.width, size.height]);
  const url = isBuiltinFrame(id) ? builtin : own;
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={onPick} className={`rounded-2xl p-1.5 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10'}`}>
        {url
          ? <img src={url} alt={name} className="h-36 rounded-xl bg-gradient-to-br from-[#6b4a8a] to-[#d9937a] object-fill" style={{ aspectRatio: `${size.width} / ${size.height}` }} />
          : <span className="block h-36 w-20" />}
      </button>
      <span className="text-sm max-w-[9rem] truncate">{name}{originTag(id)}</span>
      {onRemove
        ? <button onClick={onRemove} className="text-white/60 hover:text-white text-sm flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#00d4ff] rounded"><Trash2 className="w-4 h-4" /> Quitar</button>
        : <span className="text-white/40 text-xs">De fábrica</span>}
    </div>
  );
}

export function FramesPanel({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const frames = s.frames ?? [];
  const all = allFrames(s);
  const size = outputSize(s);
  const overlay = s.overlay ?? 'none';
  const current = s.frameId === 'random' ? 'random' : all.some(f => f.id === s.frameId) ? s.frameId! : all[0]?.id;
  const add = async (files: FileList | null) => {
    const added = [];
    for (const file of Array.from(files ?? [])) {
      const id = newMediaId();
      if (await save(frameKey(id), file)) added.push({ id, name: file.name.replace(/\.\w+$/, '') });
    }
    if (added.length) {
      // El primer marco propio pasa a ser el que se usa
      update({ frames: [...frames, ...added], frameId: frames.length ? current : added[0].id, overlay: 'custom' });
      toast.success(added.length > 1 ? `${added.length} marcos cargados` : 'Marco cargado');
    }
  };
  const remove = async (id: string) => {
    await removeMedia(frameKey(id)).catch(() => {});
    const rest = frames.filter(f => f.id !== id);
    update({ frames: rest, frameId: s.frameId === id ? undefined : s.frameId, guestFrames: s.guestFrames?.filter(x => x !== id) });
  };
  const pool = framePool(s);
  return (
    <Panel title="Marcos (plantillas)" description="Tocá un marco para usarlo. Hay marcos de fábrica (con el logo de EventPix y los del espejo) y podés cargar los tuyos: PNG con el centro transparente y la misma forma que el video (1080×1920 vertical). Cada experiencia puede usar uno distinto (en su pestaña).">
      <Choice label="Marco de General" value={overlay} onChange={v => update({ overlay: v })}
        options={[{ value: 'none', label: 'Sin marco' }, { value: 'title', label: 'Nombre y fecha' }, { value: 'custom', label: 'Marco (plantilla)' }]} />
      {overlay === 'custom' && (
        <>
          <div className="flex flex-wrap gap-4">
            {all.map(f => (
              <FrameThumb key={f.id} id={f.id} name={f.name} size={size} active={current === f.id}
                onPick={() => update({ frameId: f.id })} onRemove={f.builtin || isLibraryId(f.id) ? undefined : () => void remove(f.id)} />
            ))}
          </div>
          <input ref={input} type="file" accept="image/png,image/webp" multiple className="hidden" onChange={e => { void add(e.target.files); e.target.value = ''; }} />
          <button className={buttonClass} onClick={() => input.current?.click()}><ImagePlus className="w-5 h-5" /> Agregar mis marcos PNG</button>
          <Choice label="Qué marco se usa" value={current === 'random' ? 'random' : 'fixed'}
            onChange={v => update({ frameId: v === 'random' ? 'random' : all[0]?.id })}
            options={[{ value: 'fixed', label: 'El marcado arriba' }, { value: 'random', label: 'Uno al azar en cada video' }]} />
          <Toggle label="El invitado elige el marco" hint="Antes de grabar ve los marcos y toca el que quiere." checked={!!s.frameChoice} onChange={v => update({ frameChoice: v })} />
          {(s.frameChoice || current === 'random') && (
            <MultiChoice label={`Marcos para ${s.frameChoice ? 'elegir' : 'el azar'} (${pool.length})`} values={pool.map(f => f.id)}
              options={all.map(f => ({ value: f.id, label: f.name }))} onChange={v => update({ guestFrames: v })} />
          )}
        </>
      )}
      {overlay !== 'none' && <CaptionFields s={s} update={update} />}
    </Panel>
  );
}

/** Nombre y fecha del marco: el texto, la fecha que se quiera, dónde y cómo. */
function CaptionFields({ s, update }: Props) {
  const overlay = s.overlay ?? 'none';
  const show = overlay === 'title' || !!s.frameText;
  const dateMode = s.overlayDateMode ?? 'auto';
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4">
      {overlay === 'custom' && (
        <Toggle label="Nombre y fecha encima del PNG" hint="Si tu PNG ya trae los textos, dejalo apagado." checked={!!s.frameText} onChange={v => update({ frameText: v })} />
      )}
      {show && (
        <>
          <Field label="Texto grande (vacío = nombre del evento)">
            <input className={inputClass} value={s.overlayText ?? ''} onChange={e => update({ overlayText: e.target.value })} placeholder={s.eventTitle || 'Ej. Sofi & Juan'} />
          </Field>
          <Choice label="Fecha" value={dateMode} onChange={v => update({ overlayDateMode: v })}
            options={[{ value: 'auto', label: 'La de hoy (automática)' }, { value: 'custom', label: 'La escribo yo' }, { value: 'none', label: 'Sin fecha' }]} />
          {dateMode === 'custom' && (
            <Field label="Fecha o texto chico (lo que quieras)">
              <input className={inputClass} value={s.overlayDate ?? ''} onChange={e => update({ overlayDate: e.target.value })} placeholder="14 de diciembre de 2026" />
            </Field>
          )}
          <Choice label="Dónde" value={s.textPosition ?? 'bottom'} onChange={v => update({ textPosition: v })}
            options={[{ value: 'bottom', label: 'Abajo' }, { value: 'top', label: 'Arriba' }]} />
          <Choice label="Tamaño del texto" value={s.textScale ?? 1} onChange={v => update({ textScale: v })} options={TEXT_SCALES} />
          <Field label="Color del texto">
            <input type="color" className="h-14 w-28 rounded-xl bg-transparent" value={s.textColor ?? '#ffffff'} onChange={e => update({ textColor: e.target.value })} />
          </Field>
        </>
      )}
    </div>
  );
}

export function LayersPanel({ s, update }: Props) {
  return (
    <Panel title="Animación, accesorio y aura (General)" description="Los usan las experiencias que no tienen uno propio (cada experiencia tiene su pestaña). Los accesorios siguen la cara; en equipos lentos conviene no usarlos.">
      <Choice label="Animación" value={s.animation ?? 'none'} onChange={v => update({ animation: v })}
        options={ANIMATIONS.map(a => ({ value: a.value, label: a.label }))} />
      <Choice label="Accesorio en la cara" value={s.accessory ?? 'none'} onChange={v => update({ accessory: v })}
        options={[{ value: 'none', label: 'Ninguno' }, { value: 'random', label: 'Al azar' }, ...VIDEO_ACCESSORIES]} />
      <Choice label="Aura alrededor de las personas (neón y rayos)" value={s.aura ?? 'none'} onChange={v => update({ aura: v })}
        options={AURA_STYLES.map(a => ({ value: a.value as string, label: a.label }))} />
      {(s.aura ?? 'none') !== 'none' && (
        <Choice label="Color del aura" value={s.auraColor ?? '#00e5ff'} onChange={v => update({ auraColor: v })}
          options={AURA_COLORS.map(c => ({ value: c.value as string, label: c.label }))} />
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Toggle label="Zoom suave" hint="Se acerca de a poco (modos con efectos)" checked={!!s.zoomEffect} onChange={v => update({ zoomEffect: v })} />
        <Toggle label="Destellos en el 360" hint="Un flash en cada cambio de velocidad" checked={!!s.flashEffect} onChange={v => update({ flashEffect: v })} />
      </div>
    </Panel>
  );
}

/** Animación propia: un video corto que va encima (se elige como "Video propio"). */
export function AnimVideoPanel({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const anim = useMediaUrl(ANIM_KEY);
  return (
    <Panel title="Animación propia (video)" description="Para usarla, elegí “Video propio” en la animación de General o de una experiencia.">
      <div className="space-y-3">
          <p className="text-white/55 text-sm">Video corto en loop. WebM con transparencia, o MP4 con fondo negro (se mezcla en modo "pantalla": el negro desaparece).</p>
          <div className="flex flex-wrap items-center gap-4">
            {anim && <video src={anim} autoPlay loop muted playsInline className="h-32 rounded-xl bg-black" />}
            <input ref={input} type="file" accept="video/webm,video/mp4" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void save(ANIM_KEY, f); e.target.value = ''; }} />
            <button className={buttonClass} onClick={() => input.current?.click()}><Upload className="w-5 h-5" /> {anim ? 'Cambiar video' : 'Subir video'}</button>
            {anim && <button className={buttonClass} onClick={() => void removeMedia(ANIM_KEY)}><Trash2 className="w-5 h-5" /> Quitar</button>}
          </div>
          <Choice label="Mezcla" value={s.animBlend ?? 'screen'} onChange={v => update({ animBlend: v })}
            options={[{ value: 'screen', label: 'Pantalla (fondo negro)' }, { value: 'normal', label: 'Normal (con transparencia)' }]} />
      </div>
    </Panel>
  );
}

/** Fondo de la placa final: color de la marca o una imagen propia. */
function EndCardImage({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const img = useMediaUrl(END_KEY);
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-white/70">Fondo de la placa final: {img ? 'tu imagen' : 'degradé con el color de la marca'}</p>
      <div className="flex flex-wrap items-center gap-4">
        {img && <img src={img} alt="Placa final" className="h-32 rounded-xl object-cover" style={{ aspectRatio: '9 / 16' }} />}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void save(END_KEY, f); e.target.value = ''; }} />
        <button className={buttonClass} onClick={() => input.current?.click()}><ImagePlus className="w-5 h-5" /> {img ? 'Cambiar imagen' : 'Usar una imagen propia'}</button>
        {img && <button className={buttonClass} onClick={() => void removeMedia(END_KEY)}><Trash2 className="w-5 h-5" /> Quitar</button>}
      </div>
      {img && <Toggle label="Logo y textos encima de la imagen" hint="Apagalo si tu imagen ya trae todo (por ejemplo, un diseño hecho en Canva)." checked={s.endCardOverlay !== false} onChange={v => update({ endCardOverlay: v })} />}
      <p className="text-white/45 text-sm">Conviene que tenga la forma del video (1080×1920 vertical); si no, se recorta para llenar la pantalla.</p>
    </div>
  );
}

export function BrandPanel({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const logo = useMediaUrl(LOGO_KEY);
  return (
    <Panel title="Marca" description="Tu logo y una marca de agua en todos los videos, y una placa final con el logo y el nombre del evento.">
      <div className="flex flex-wrap items-center gap-4">
        {logo && <img src={logo} alt="Logo" className="h-20 rounded-xl bg-white/10 p-2" />}
        <input ref={input} type="file" accept="image/png,image/webp,image/svg+xml" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void save(LOGO_KEY, f); e.target.value = ''; }} />
        <button className={buttonClass} onClick={() => input.current?.click()}><ImagePlus className="w-5 h-5" /> {logo ? 'Cambiar logo' : 'Subir logo (PNG)'}</button>
        {logo && <button className={buttonClass} onClick={() => void removeMedia(LOGO_KEY)}><Trash2 className="w-5 h-5" /> Quitar</button>}
      </div>
      {logo && (
        <>
          <Toggle label="Logo en los videos" checked={s.showLogo !== false} onChange={v => update({ showLogo: v })} />
          <Choice label="Lugar del logo" value={s.logoPosition ?? 'tr'} onChange={v => update({ logoPosition: v })} options={CORNERS} />
          <Choice label="Tamaño (ancho del video)" value={s.logoSize ?? 0.22} onChange={v => update({ logoSize: v })}
            options={LOGO_SIZES.map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
          <Choice label="Transparencia" value={s.logoOpacity ?? 0.9} onChange={v => update({ logoOpacity: v })}
            options={[0.5, 0.7, 0.9, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
        </>
      )}
      <Field label="Marca de agua (texto, ej. @tuempresa)">
        <input className={inputClass} value={s.watermark ?? ''} onChange={e => update({ watermark: e.target.value })} placeholder="@eventpix" />
      </Field>
      {!!s.watermark && (
        <>
          <Choice label="Lugar de la marca de agua" value={s.watermarkPosition ?? 'bl'} onChange={v => update({ watermarkPosition: v })} options={WATERMARK_POSITIONS} />
          <Choice label="Tamaño de la marca de agua" value={s.watermarkSize ?? 0.035} onChange={v => update({ watermarkSize: v })} options={WATERMARK_SIZES} />
          <Choice label="Transparencia de la marca de agua" value={s.watermarkOpacity ?? (s.watermarkPosition === 'tile' ? 0.3 : 0.85)} onChange={v => update({ watermarkOpacity: v })}
            options={[0.15, 0.3, 0.5, 0.7, 0.85, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
        </>
      )}
      <Field label="Color de la marca (placa final y borde neón)">
        <input type="color" className="h-14 w-28 rounded-xl bg-transparent" value={s.brandColor ?? '#7b2ff7'} onChange={e => update({ brandColor: e.target.value })} />
      </Field>
      <Toggle label="Placa final" hint="Al final de cada video: logo, nombre del evento y tu texto" checked={!!s.endCard} onChange={v => update({ endCard: v })} />
      {s.endCard && (
        <>
          <EndCardImage s={s} update={update} />
          <Choice label="Duración de la placa" value={s.endCardSeconds ?? 2.5} onChange={v => update({ endCardSeconds: v })}
            options={[2, 2.5, 3.5, 5].map(n => ({ value: n, label: `${n} s` }))} />
          <Field label="Texto de la placa (ej. tu web o Instagram)">
            <input className={inputClass} value={s.endCardText ?? ''} onChange={e => update({ endCardText: e.target.value })} placeholder="www.tuempresa.com" />
          </Field>
        </>
      )}
    </Panel>
  );
}

function SongRow({ id, name, start, onStart, onRemove, active, onDefault }: {
  id: string; name: string; start: number; active: boolean;
  onStart: (n: number) => void; onRemove: () => void; onDefault: () => void;
}) {
  const url = useMediaUrl(songKey(id));
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    a.currentTime = start;
    void a.play().then(() => setPlaying(true)).catch(() => {});
  };
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${active ? 'border-[#ff2e93] bg-[#ff2e93]/10' : 'border-white/10 bg-black/15'}`}>
      {url && <audio ref={audio} src={url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />}
      <button onClick={toggle} className="rounded-full bg-white/10 p-3 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" aria-label="Escuchar">
        {playing ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5" />}
      </button>
      <span className="flex-1 min-w-[8rem] font-semibold truncate">{name}{originTag(id)}</span>
      <label className="flex items-center gap-2 text-white/70">
        Empieza en
        <input type="number" min={0} value={start} disabled={isLibraryId(id)} title={isLibraryId(id) ? 'Se ajusta en el panel (Biblioteca)' : undefined} onChange={e => onStart(Math.max(0, Number(e.target.value) || 0))} className="w-20 rounded-xl bg-black/30 border border-white/15 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" />
        s
      </label>
      <button onClick={onDefault} className={`rounded-xl px-4 py-2 font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10'}`}>{active ? 'Fija' : 'Usar fija'}</button>
      {!isLibraryId(id) && <button onClick={onRemove} className="rounded-xl bg-white/10 p-2 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" aria-label="Quitar"><Trash2 className="w-5 h-5" /></button>}
    </div>
  );
}

export function MusicPanel({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const songs = s.songs ?? [];
  const add = async (files: FileList | null) => {
    const added = [];
    for (const file of Array.from(files ?? [])) {
      const id = newMediaId();
      if (await save(songKey(id), file)) added.push({ id, name: file.name.replace(/\.\w+$/, ''), start: 0 });
    }
    if (added.length) update({ songs: [...songs, ...added], songId: s.songId || added[0].id });
  };
  const remove = async (id: string) => {
    await removeMedia(songKey(id)).catch(() => {});
    const rest = songs.filter(x => x.id !== id);
    update({ songs: rest, songId: s.songId === id ? rest[0]?.id : s.songId });
  };
  return (
    <Panel title="Tu música" description="Subí tus canciones (MP3): suenan en los videos que tienen música activada. Quedan guardadas en el equipo. Las de la biblioteca del panel (las tienen todos los equipos) aparecen solas, marcadas “(biblioteca)”.">
      <div className="space-y-3">
        {songs.map(sg => (
          <SongRow key={sg.id} id={sg.id} name={sg.name} start={sg.start ?? 0} active={(s.songId ?? songs[0]?.id) === sg.id}
            onStart={n => update({ songs: songs.map(x => x.id === sg.id ? { ...x, start: n } : x) })}
            onDefault={() => update({ songId: sg.id })} onRemove={() => void remove(sg.id)} />
        ))}
        {!songs.length && <p className="text-white/55 flex items-center gap-2"><Music className="w-5 h-5" /> Todavía no hay canciones.</p>}
      </div>
      <input ref={input} type="file" accept="audio/*" multiple className="hidden" onChange={e => { void add(e.target.files); e.target.value = ''; }} />
      <button className={buttonClass} onClick={() => input.current?.click()}><Upload className="w-5 h-5" /> Agregar canciones</button>
      <Choice label="Qué canción suena (General; cada experiencia puede tener la suya)" value={s.songMode ?? 'fixed'} onChange={v => update({ songMode: v })}
        options={[{ value: 'fixed', label: 'Siempre la fija' }, { value: 'random', label: 'Una al azar' }, { value: 'guest', label: 'La elige el invitado' }]} />
      <Choice label="Volumen" value={s.musicVolume ?? 0.8} onChange={v => update({ musicVolume: v })}
        options={[0.4, 0.6, 0.8, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
    </Panel>
  );
}

/** 360: arranque automático por movimiento, con calibración en vivo. */
export function MotionPanel({ s, update }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<MotionDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const [idle, setIdle] = useState<number | null>(null);
  const [spin, setSpin] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState<'' | 'idle' | 'spin'>('');
  const threshold = s.motionThreshold ?? 14;

  const stop = () => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    setOpen(false);
  };
  useEffect(() => () => {
    detectorRef.current?.stop();
    stopStream(streamRef.current);
  }, []);

  const openCam = async () => {
    try {
      const stream = await openCameraStream({ facingMode: s.facing });
      streamRef.current = stream;
      setOpen(true);
      await new Promise(r => setTimeout(r, 50));
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const d = new MotionDetector(v, { onLevel: setLevel });
      d.start();
      detectorRef.current = d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir la cámara');
    }
  };

  // Promedio (quieta) o nivel alto sostenido (girando) durante 3 segundos
  const measure = (kind: 'idle' | 'spin') => {
    const d = detectorRef.current;
    if (!d) return;
    setMeasuring(kind);
    const samples: number[] = [];
    const t = window.setInterval(() => samples.push(d.level), 100);
    window.setTimeout(() => {
      window.clearInterval(t);
      setMeasuring('');
      const sorted = [...samples].sort((a, b) => a - b);
      const value = kind === 'idle'
        ? sorted[Math.floor(sorted.length * 0.9)] ?? 0
        : sorted[Math.floor(sorted.length * 0.3)] ?? 0;
      if (kind === 'idle') setIdle(value); else setSpin(value);
      const i = kind === 'idle' ? value : idle;
      const sp = kind === 'spin' ? value : spin;
      if (i !== null && sp !== null) {
        if (sp <= i + 2) toast.warning('Casi no hay diferencia entre quieta y girando: acercá la cámara o mejorá la luz.');
        update({ motionThreshold: suggestThreshold(i, sp) });
      }
    }, 3000);
  };

  return (
    <Panel title="Plataforma 360: arranque automático" description="La cámara detecta cuando la plataforma empieza a girar y graba sola; opcionalmente corta cuando para. Calibralo con la plataforma armada.">
      <Toggle label="Empezar a grabar cuando gira" checked={!!s.autoStart360} onChange={v => update({ autoStart360: v })} />
      <Toggle label="Cortar cuando la plataforma para" hint="Si no, graba los segundos configurados (o hasta Terminar / el disparador)" checked={!!s.autoStop360} onChange={v => update({ autoStop360: v })} />
      <Toggle label="Modo continuo" hint="Después de cada video vuelve directo a esperar el próximo giro (sin pasar por el inicio)" checked={!!s.continuous360} onChange={v => update({ continuous360: v })} />
      <Field label={`Sensibilidad: arranca con movimiento mayor a ${threshold}`}>
        <input type="range" min={2} max={60} value={threshold} onChange={e => update({ motionThreshold: Number(e.target.value) })} className="w-full accent-[#ff2e93]" />
      </Field>
      {!open ? (
        <button className={buttonClass} onClick={() => void openCam()}>Calibrar con la cámara</button>
      ) : (
        <div className="space-y-4">
          <video ref={videoRef} muted playsInline className="h-48 rounded-2xl bg-black" />
          <div className="relative h-5 rounded-full bg-white/15 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00d4ff] to-[#ff2e93] transition-[width] duration-100" style={{ width: `${Math.min(100, level * 1.5)}%` }} />
            <div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${Math.min(100, threshold * 1.5)}%` }} />
          </div>
          <p className="text-white/70">Movimiento ahora: <b>{Math.round(level)}</b> · {level >= threshold ? <b className="text-[#2ee6a6]">arrancaría</b> : 'no arranca'}</p>
          <div className="flex flex-wrap gap-3">
            <button className={buttonClass} disabled={!!measuring} onClick={() => measure('idle')}>{measuring === 'idle' ? 'Midiendo…' : `1. Medir quieta${idle !== null ? ` (${Math.round(idle)})` : ''}`}</button>
            <button className={buttonClass} disabled={!!measuring} onClick={() => measure('spin')}>{measuring === 'spin' ? 'Midiendo…' : `2. Medir girando${spin !== null ? ` (${Math.round(spin)})` : ''}`}</button>
            <button className={buttonClass} onClick={stop}>Cerrar cámara</button>
          </div>
          <p className="text-white/50 text-sm">Primero con alguien parado en la plataforma sin girar; después con la plataforma girando a la velocidad del evento. El umbral se ajusta solo.</p>
        </div>
      )}
    </Panel>
  );
}

/** Copia un texto (en equipos que no dejan, avisa que lo anoten). */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Enlace copiado');
  } catch {
    toast.message('Anotá el enlace o escaneá el QR', { description: text });
  }
};

function LinkBox({ title, hint, url }: { title: string; hint: string; url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-black/20 border border-white/10 p-5">
      <span className="bg-white p-3 rounded-2xl"><QRCodeSVG value={url} size={140} /></span>
      <div className="space-y-2 min-w-0 flex-1">
        <p className="text-lg font-bold">{title}</p>
        <p className="text-white/60 text-sm">{hint}</p>
        <p className="text-white/80 text-sm break-all font-mono">{url}</p>
        <div className="flex flex-wrap gap-3">
          <button className={buttonClass} onClick={() => void copyText(url)}><Copy className="w-5 h-5" /> Copiar enlace</button>
          <a className={buttonClass} href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-5 h-5" /> Abrir</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Galería del evento para compartir sin dar acceso al panel: la de los invitados
 * (celular) y la pantalla para una tele, tablet o compu del evento.
 */
export function GalleryPanel({ s, update }: Props) {
  const [view, setView] = useState<ScreenViewKey>('completa');
  const code = isSupabaseConfigured ? s.galleryCode || galleryCode() : '';
  if (!code) {
    return (
      <Panel title="Galería del evento">
        <p className="text-amber-200">La galería online necesita el servidor de EventPix configurado.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Galería del evento" description="Para compartir sin dar acceso al panel. Muestra los videos de este evento (los ocultos en el panel no aparecen).">
      <p className="text-lg">Código: <b className="font-mono">{code}</b> <span className="text-white/50 text-sm">(lleva el nombre del evento; al cambiar el evento se crea una galería nueva sola)</span></p>
      <LinkBox title="Pantalla del evento" url={galleryScreenUrl(code, view)}
        hint="Abrila en una tele, tablet o compu del evento: los invitados se buscan y escanean el QR de su video. No hace falta tocarla: pasa sola y los videos nuevos aparecen al instante." />
      <Choice label="Qué muestra la pantalla" value={view} onChange={setView} options={SCREEN_VIEWS.map(v => ({ value: v.value, label: v.label }))} />
      <Note>{SCREEN_VIEWS.find(v => v.value === view)?.hint}</Note>
      <LinkBox title="Galería para los invitados" url={galleryUrl(code)} hint="Para el celular: todos los videos del evento para ver y bajar. Se puede mandar por WhatsApp o imprimir el QR." />
      <button className={buttonClass} onClick={() => update({ galleryCode: newGalleryCode(s.eventTitle), galleryEvent: (s.eventTitle || '').trim() })}>Empezar galería nueva</button>
    </Panel>
  );
}

export function DeliveryPanel({ s, update }: Props) {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    const refresh = () => { void pendingVideoCount().then(setPending); };
    refresh();
    window.addEventListener(VIDEO_QUEUE_EVENT, refresh);
    return () => window.removeEventListener(VIDEO_QUEUE_EVENT, refresh);
  }, []);
  return (
    <Panel title="Entrega del video" description="El invitado escanea el QR y baja su video, o entra a la galería con todos los videos del evento. Sin internet, los videos quedan en el equipo y se suben solos cuando vuelve.">
      <Toggle label="Mostrar QR al terminar" hint={isDriveConfigured() ? 'Los videos se suben a la carpeta de Drive de la cabina' : 'Falta configurar Drive en el panel Nube'} checked={s.showQr !== false} onChange={v => update({ showQr: v })} />
      <Choice label="El QR abre" value={s.delivery ?? 'video'} onChange={v => update({ delivery: v })}
        options={[{ value: 'video', label: 'Su video' }, { value: 'gallery', label: 'La galería del evento' }, { value: 'both', label: 'Los dos (dos QR)' }]} />
      <Choice label="Videos en la galería" value={s.galleryModeration ?? 'post'} onChange={v => update({ galleryModeration: v })}
        options={[{ value: 'post', label: 'Aparecen solos (se pueden ocultar desde el panel)' }, { value: 'pre', label: 'Aparecen cuando los apruebo en el panel' }]} />
      <Toggle label="Botón “Enviar por WhatsApp”" hint={isLicensed() ? 'El invitado escribe su número y le llega el video. Necesita el WhatsApp de la empresa configurado en el servidor (ver docs/cabina-video.md).' : 'Disponible con la licencia de EventPix Video (Ajustes → Equipo).'}
        checked={!!s.whatsappEnabled} onChange={v => update({ whatsappEnabled: v })} />
      {s.whatsappEnabled && (
        <Field label="Prefijo del país (va antes del número; 549 = Argentina celulares)">
          <input className={inputClass} inputMode="numeric" value={s.whatsappPrefix ?? '549'} onChange={e => update({ whatsappPrefix: e.target.value.replace(/\D/g, '') })} />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-lg">{pending ? `${pending} video${pending === 1 ? '' : 's'} esperando internet para subirse` : 'No hay videos pendientes de subir'}</p>
        {pending > 0 && (
          <button className={primaryClass} disabled={syncing} onClick={async () => { setSyncing(true); await processVideoQueue(); setSyncing(false); setPending(await pendingVideoCount()); }}>
            <CloudUpload className="w-5 h-5" /> {syncing ? 'Subiendo…' : 'Subir ahora'}
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Fondo de ejemplo para la vista previa: dos personas en un salón. */
function drawSample(ctx: CanvasRenderingContext2D, W: number, H: number, filter: string) {
  ctx.save();
  ctx.filter = filter || 'none';
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#3b2a5e');
  g.addColorStop(0.55, '#a85b7a');
  g.addColorStop(1, '#f2b880');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(255,240,200,${0.08 + (i % 3) * 0.05})`;
    ctx.beginPath();
    ctx.arc(((i * 137) % 100) / 100 * W, ((i * 71) % 45) / 100 * H, Math.min(W, H) * (0.04 + (i % 4) * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
  const u = Math.min(W, H);
  for (const [cx, tone] of [[0.38, '#2a1f33'], [0.62, '#33243d']] as const) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(cx * W, H * 0.45, u * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx * W, H * 0.45 + u * 0.5, u * 0.21, u * 0.36, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Vista previa del video terminado (marco, nombre y fecha, logo, marca de agua,
 * animación y placa final) con los ajustes de ahora, sin tener que grabar.
 */
export function PreviewPanel({ s, modeKey }: { s: VideoBoothSettings; modeKey?: VideoModeKey }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mediaRev, setMediaRev] = useState(0);
  const [endCard, setEndCard] = useState(false);
  const { width, height } = outputSize(s);
  useEffect(() => {
    const bump = () => setMediaRev(n => n + 1);
    window.addEventListener(MEDIA_EVENT, bump);
    return () => window.removeEventListener(MEDIA_EVENT, bump);
  }, []);
  useEffect(() => {
    let alive = true;
    let bundle: DecorBundle | null = null;
    let raf = 0;
    const timer = window.setTimeout(async () => {
      const r = modeKey ? resolveMode(modeKey, s) : null;
      const animation = r ? (r.animation === 'random' ? r.animationPool[0] : r.animation) : s.animation;
      bundle = await buildDecor(s, { width, height }, { eventTitle: s.eventTitle, overlay: r?.overlay, frameId: r?.frameId, animation });
      const canvas = canvasRef.current;
      if (!alive || !canvas) { bundle.dispose(); return; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const filter = videoFilter(r?.cfg.filter).css;
      const t0 = performance.now();
      const endSeconds = s.endCardSeconds ?? 2.5;
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        if (endCard) {
          bundle!.decor.drawEndCard(ctx, t % (endSeconds + 0.8), endSeconds);
        } else {
          drawSample(ctx, width, height, filter);
          bundle!.decor.draw(ctx, t);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      bundle?.dispose();
    };
  }, [s, modeKey, width, height, mediaRev, endCard]);
  return (
    <Panel title="Vista previa" description="Así sale el video terminado con estos ajustes (las personas son de ejemplo). Se actualiza al cambiar algo.">
      <div className="flex flex-wrap items-start gap-5">
        <canvas ref={canvasRef} className="rounded-2xl ring-2 ring-white/15 bg-black" style={{ height: 'min(60vh, 34rem)', aspectRatio: `${width} / ${height}` }} />
        <div className="space-y-3">
          <button className={buttonClass} onClick={() => setEndCard(v => !v)}>{endCard ? 'Ver el video' : 'Ver la placa final'}</button>
          {endCard && !s.endCard && <p className="text-amber-200 text-sm max-w-xs">La placa final está apagada (Marca → Placa final).</p>}
        </div>
      </div>
    </Panel>
  );
}

function BackgroundThumb({ value, label, active, onPick, onRemove }: { value: string; label: string; active: boolean; onPick: () => void; onRemove?: () => void }) {
  const builtin = isBuiltinBackground(value);
  const own = useMediaUrl(builtin ? '' : bgKey(value));
  const [isVideo, setIsVideo] = useState(false);
  useEffect(() => {
    if (builtin) return;
    let alive = true;
    void getMedia(bgKey(value)).then(rec => { if (alive) setIsVideo(!!rec?.blob.type.startsWith('video/')); }).catch(() => {});
    return () => { alive = false; };
  }, [value, builtin]);
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={onPick} className={`rounded-2xl p-1.5 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10'}`}>
        <span className="relative block w-40 h-24 rounded-xl overflow-hidden">
          {builtin ? <ScreenBackground value={value} />
            : own ? (isVideo ? <video src={own} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" /> : <img src={own} alt="" className="absolute inset-0 w-full h-full object-cover" />)
            : <span className="absolute inset-0 bg-black/40" />}
        </span>
      </button>
      <span className="text-sm max-w-[10rem] truncate">{label}</span>
      {onRemove && <button onClick={onRemove} className="text-white/60 hover:text-white text-sm flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#00d4ff] rounded"><Trash2 className="w-4 h-4" /> Quitar</button>}
    </div>
  );
}

/** Fondos de las pantallas: de fábrica o propios (imágenes o videos en loop). */
export function BackgroundsPanel({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const list = s.backgrounds ?? [];
  const current = s.background || AURORA;
  const add = async (files: FileList | null) => {
    const added = [];
    for (const file of Array.from(files ?? [])) {
      const id = newMediaId();
      if (await save(bgKey(id), file)) added.push({ id, name: file.name.replace(/\.\w+$/, '') });
    }
    if (added.length) {
      update({ backgrounds: [...list, ...added], background: added[0].id });
      toast.success(added.length > 1 ? `${added.length} fondos cargados` : 'Fondo cargado');
    }
  };
  const remove = async (id: string) => {
    await removeMedia(bgKey(id)).catch(() => {});
    update({ backgrounds: list.filter(b => b.id !== id), background: s.background === id ? AURORA : s.background });
  };
  return (
    <Panel title="Fondos de las pantallas" description="El fondo del inicio, de la pregunta del libro de firmas, de los marcos y del resultado. Tocá uno para usarlo en General; cada experiencia puede tener el suyo (en su pestaña). Podés cargar imágenes o un video corto que se repite.">
      <div className="flex flex-wrap gap-4">
        {backgroundOptions(s).map(o => (
          <BackgroundThumb key={o.value} value={o.value} label={o.label} active={current === o.value}
            onPick={() => update({ background: o.value })}
            onRemove={list.some(b => b.id === o.value) && !isLibraryId(o.value) ? () => void remove(o.value) : undefined} />
        ))}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" multiple className="hidden" onChange={e => { void add(e.target.files); e.target.value = ''; }} />
      <button className={buttonClass} onClick={() => input.current?.click()}><ImagePlus className="w-5 h-5" /> Cargar mis fondos (imagen o video)</button>
      <p className="text-white/45 text-sm">Conviene que tengan la forma de la pantalla del equipo (horizontal 1920×1080 en una tele, vertical en una tablet parada). Los videos, cortos y livianos.</p>
      {list.length > 0 && (
        <Choice label="Oscurecer los fondos propios (para que se lean los textos)" value={s.backgroundDim ?? 0.35} onChange={v => update({ backgroundDim: v })}
          options={[0, 0.2, 0.35, 0.5, 0.65].map(n => ({ value: n, label: n ? `${Math.round(n * 100)}%` : 'Nada' }))} />
      )}
    </Panel>
  );
}
