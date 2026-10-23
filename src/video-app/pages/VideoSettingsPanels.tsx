import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CloudUpload, ImagePlus, Music, Play, Square, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { VIDEO_ACCESSORIES } from '@/lib/videoBooth/accessories';
import { openCameraStream, stopStream } from '@/lib/videoBooth/camera';
import { getMedia, MEDIA_EVENT, removeMedia, saveMedia } from '@/lib/videoBooth/mediaStore';
import { isDriveConfigured } from '@/lib/videoBooth/drive';
import { isSupabaseConfigured } from '@/lib/supabase';
import { galleryUrl, pendingVideoCount, processVideoQueue, VIDEO_QUEUE_EVENT } from '@/lib/videoBooth/cloud';
import { MotionDetector, suggestThreshold } from '@/lib/videoBooth/motion';
import {
  ANIM_KEY, ANIMATIONS, CORNERS, frameKey, galleryCode, LOGO_KEY, newGalleryCode, newMediaId, songKey,
  type VideoBoothSettings,
} from '@/lib/videoBooth/settings';
import { buttonClass, Choice, Field, inputClass, Panel, primaryClass, Toggle } from '../ui';

// Paneles de Ajustes de la cabina de video: marcos, capas, marca, música, 360 y entrega.

type Update = (patch: Partial<VideoBoothSettings>) => void;
interface Props { s: VideoBoothSettings; update: Update }

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

function FrameThumb({ id, name, active, onPick, onRemove }: { id: string; name: string; active: boolean; onPick: () => void; onRemove: () => void }) {
  const url = useMediaUrl(frameKey(id));
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={onPick} className={`rounded-2xl p-1.5 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10'}`}>
        {url ? <img src={url} alt={name} className="h-36 rounded-xl bg-[repeating-conic-gradient(#444_0_25%,#666_0_50%)] bg-[length:16px_16px]" /> : <span className="block h-36 w-20" />}
      </button>
      <span className="text-sm max-w-[9rem] truncate">{name}{id.startsWith('r-') ? ' (panel)' : ''}</span>
      <button onClick={onRemove} className="text-white/60 hover:text-white text-sm flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#00d4ff] rounded"><Trash2 className="w-4 h-4" /> Quitar</button>
    </div>
  );
}

export function FramesPanel({ s, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const frames = s.frames ?? [];
  const add = async (files: FileList | null) => {
    const added = [];
    for (const file of Array.from(files ?? [])) {
      const id = newMediaId();
      if (await save(frameKey(id), file)) added.push({ id, name: file.name.replace(/\.\w+$/, '') });
    }
    if (added.length) update({ frames: [...frames, ...added], frameId: s.frameId || added[0].id, overlay: 'custom' });
  };
  const remove = async (id: string) => {
    await removeMedia(frameKey(id)).catch(() => {});
    const rest = frames.filter(f => f.id !== id);
    update({ frames: rest, frameId: s.frameId === id ? rest[0]?.id : s.frameId });
  };
  return (
    <Panel title="Marcos (plantillas)" description="PNG con el centro transparente y la misma forma que el video (1080×1920 vertical). Podés cargar varios: cada experiencia puede usar uno distinto (en su pestaña) y el invitado puede elegir.">
      <Choice label="Marco de General" value={s.overlay ?? 'none'} onChange={v => update({ overlay: v })}
        options={[{ value: 'none', label: 'Sin marco' }, { value: 'title', label: 'Nombre del evento' }, { value: 'custom', label: 'PNG' }]} />
      {(s.overlay ?? 'none') === 'title' && (
        <Field label="Texto (vacío = nombre del evento)">
          <input className={inputClass} value={s.overlayText ?? ''} onChange={e => update({ overlayText: e.target.value })} placeholder="Ej. Sofi & Juan" />
        </Field>
      )}
      {s.overlay === 'custom' && (
        <>
          <div className="flex flex-wrap gap-4">
            {frames.map(f => (
              <FrameThumb key={f.id} id={f.id} name={f.name} active={(s.frameId ?? frames[0]?.id) === f.id}
                onPick={() => update({ frameId: f.id })} onRemove={() => void remove(f.id)} />
            ))}
          </div>
          <input ref={input} type="file" accept="image/png,image/webp" multiple className="hidden" onChange={e => { void add(e.target.files); e.target.value = ''; }} />
          <button className={buttonClass} onClick={() => input.current?.click()}><ImagePlus className="w-5 h-5" /> Agregar marcos PNG</button>
          <Toggle label="El invitado elige el marco" hint="Antes de grabar ve los marcos y toca el que quiere (con más de uno)." checked={!!s.frameChoice} onChange={v => update({ frameChoice: v })} />
        </>
      )}
    </Panel>
  );
}

export function LayersPanel({ s, update }: Props) {
  return (
    <Panel title="Animación y accesorio (General)" description="Los usan las experiencias que no tienen uno propio (cada experiencia tiene su pestaña). Los accesorios siguen la cara; en equipos lentos conviene no usarlos.">
      <Choice label="Animación" value={s.animation ?? 'none'} onChange={v => update({ animation: v })}
        options={ANIMATIONS.map(a => ({ value: a.value, label: a.label }))} />
      <Choice label="Accesorio en la cara" value={s.accessory ?? 'none'} onChange={v => update({ accessory: v })}
        options={[{ value: 'none', label: 'Ninguno' }, { value: 'random', label: 'Al azar' }, ...VIDEO_ACCESSORIES]} />
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
          <Choice label="Tamaño" value={s.logoSize ?? 0.22} onChange={v => update({ logoSize: v })}
            options={[0.12, 0.18, 0.22, 0.3, 0.4].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
          <Choice label="Transparencia" value={s.logoOpacity ?? 0.9} onChange={v => update({ logoOpacity: v })}
            options={[0.5, 0.7, 0.9, 1].map(n => ({ value: n, label: `${Math.round(n * 100)}%` }))} />
        </>
      )}
      <Field label="Marca de agua (texto chico, ej. @tuempresa)">
        <input className={inputClass} value={s.watermark ?? ''} onChange={e => update({ watermark: e.target.value })} placeholder="@eventpix" />
      </Field>
      {!!s.watermark && <Choice label="Lugar de la marca de agua" value={s.watermarkPosition ?? 'bl'} onChange={v => update({ watermarkPosition: v })} options={CORNERS} />}
      <Field label="Color de la marca (placa final y borde neón)">
        <input type="color" className="h-14 w-28 rounded-xl bg-transparent" value={s.brandColor ?? '#7b2ff7'} onChange={e => update({ brandColor: e.target.value })} />
      </Field>
      <Toggle label="Placa final" hint="Al final de cada video: logo, nombre del evento y tu texto" checked={!!s.endCard} onChange={v => update({ endCard: v })} />
      {s.endCard && (
        <>
          <Choice label="Duración de la placa" value={s.endCardSeconds ?? 2.5} onChange={v => update({ endCardSeconds: v })}
            options={[2, 2.5, 3.5].map(n => ({ value: n, label: `${n} s` }))} />
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
      <span className="flex-1 min-w-[8rem] font-semibold truncate">{name}{id.startsWith('r-') ? ' (panel)' : ''}</span>
      <label className="flex items-center gap-2 text-white/70">
        Empieza en
        <input type="number" min={0} value={start} onChange={e => onStart(Math.max(0, Number(e.target.value) || 0))} className="w-20 rounded-xl bg-black/30 border border-white/15 px-3 py-2 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" />
        s
      </label>
      <button onClick={onDefault} className={`rounded-xl px-4 py-2 font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${active ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10'}`}>{active ? 'Fija' : 'Usar fija'}</button>
      <button onClick={onRemove} className="rounded-xl bg-white/10 p-2 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" aria-label="Quitar"><Trash2 className="w-5 h-5" /></button>
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
    <Panel title="Tu música" description="Subí tus canciones (MP3): suenan en los videos que tienen música activada. Quedan guardadas en el equipo.">
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

export function DeliveryPanel({ s, update }: Props) {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    const refresh = () => { void pendingVideoCount().then(setPending); };
    refresh();
    window.addEventListener(VIDEO_QUEUE_EVENT, refresh);
    return () => window.removeEventListener(VIDEO_QUEUE_EVENT, refresh);
  }, []);
  const code = isSupabaseConfigured ? s.galleryCode || galleryCode() : '';
  const url = code ? galleryUrl(code) : '';
  return (
    <Panel title="Entrega del video y galería" description="El invitado escanea el QR y baja su video, o entra a la galería con todos los videos del evento. Sin internet, los videos quedan en el equipo y se suben solos cuando vuelve.">
      <Toggle label="Mostrar QR al terminar" hint={isDriveConfigured() ? 'Los videos se suben a la carpeta de Drive de la cabina' : 'Falta configurar Drive en el panel Nube'} checked={s.showQr !== false} onChange={v => update({ showQr: v })} />
      <Choice label="El QR abre" value={s.delivery ?? 'video'} onChange={v => update({ delivery: v })}
        options={[{ value: 'video', label: 'Su video' }, { value: 'gallery', label: 'La galería del evento' }, { value: 'both', label: 'Los dos (dos QR)' }]} />
      <Choice label="Videos en la galería" value={s.galleryModeration ?? 'post'} onChange={v => update({ galleryModeration: v })}
        options={[{ value: 'post', label: 'Aparecen solos (se pueden ocultar desde el panel)' }, { value: 'pre', label: 'Aparecen cuando los apruebo en el panel' }]} />
      <Toggle label="Botón “Enviar por WhatsApp”" hint="El invitado escribe su número y le llega el video. Necesita el WhatsApp de la empresa configurado en el servidor (ver docs/cabina-video.md)."
        checked={!!s.whatsappEnabled} onChange={v => update({ whatsappEnabled: v })} />
      {s.whatsappEnabled && (
        <Field label="Prefijo del país (va antes del número; 549 = Argentina celulares)">
          <input className={inputClass} inputMode="numeric" value={s.whatsappPrefix ?? '549'} onChange={e => update({ whatsappPrefix: e.target.value.replace(/\D/g, '') })} />
        </Field>
      )}
      {code ? (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-black/20 border border-white/10 p-5">
          <span className="bg-white p-3 rounded-2xl"><QRCodeSVG value={`${url}?pantalla=1`} size={140} /></span>
          <div className="space-y-2 min-w-0">
            <p className="text-lg">Galería: <b className="font-mono">{code}</b></p>
            <p className="text-white/60 text-sm break-all">{url}</p>
            <p className="text-white/60 text-sm">El código lleva el nombre del evento: al cambiar el evento se crea una galería nueva sola.</p>
            <p className="text-white/60 text-sm">Escaneá este QR con una tablet o tele del evento para mostrar la galería en pantalla (modo pantalla).</p>
            <button className={buttonClass} onClick={() => update({ galleryCode: newGalleryCode(s.eventTitle), galleryEvent: (s.eventTitle || '').trim() })}>Empezar galería nueva</button>
          </div>
        </div>
      ) : <p className="text-amber-200">La galería online necesita el servidor de EventPix configurado.</p>}
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
