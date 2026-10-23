import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Sparkles, Video } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { driveImageUrl } from '@/lib/kioskShare';
import { clipPage, clipPlayUrls, clipTime, MODE_LABEL, type Clip } from '@/lib/videoBooth/galleryClips';
import { PREVIEW_COLS, PREVIEW_FRAMES, PREVIEW_ROWS } from '@/lib/videoBooth/preview';

// Pantalla de la galería para una tele, tablet o compu del evento (sin tocarla):
// - "completa": los videos pasando como demostración + portadas con su QR.
// - "portadas": solo portadas, cada una con un QR chico abajo para bajar el video.
// - "videos": los videos a pantalla completa, con el QR del que se está viendo.
// Las páginas de portadas pasan solas y los videos nuevos aparecen al instante.

export type ScreenView = 'completa' | 'portadas' | 'videos';

const PAGE_SECONDS = 12;
/** Tiempo máximo por video en la demostración (por si uno no carga o es muy largo) */
const MAX_VIDEO_SECONDS = 35;

const absolute = (path: string) => `${window.location.origin}${path}`;

/** Tamaño de un elemento en píxeles (se actualiza al cambiar; sirve aunque se monte después). */
function useSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
    measure();
  }, []);
  return [ref, size] as const;
}

function useLandscape() {
  const [landscape, setLandscape] = useState(() => window.innerWidth >= window.innerHeight);
  useEffect(() => {
    const on = () => setLandscape(window.innerWidth >= window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return landscape;
}

const SHORT_MODE: Record<string, string> = { firmas: 'Firmas', lenta: 'Lenta', clasico: 'Video' };

/** Portada de un video con su QR abajo. */
function Card({ clip, imgW, imgH, qr, fresh, onAspect }: {
  clip: Clip; imgW: number; imgH: number; qr: number; fresh: boolean; onAspect: (a: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const small = imgW < 150;
  const mode = clip.mode ? (small ? SHORT_MODE[clip.mode] ?? MODE_LABEL[clip.mode] ?? clip.mode : MODE_LABEL[clip.mode] ?? clip.mode) : '';
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-[1vmin]">
      <span className="relative block overflow-hidden rounded-2xl bg-black/40 ring-2 ring-white/15 shadow-xl" style={{ width: imgW, height: imgH }}>
        {clip.thumb_id && !failed ? (
          <img src={driveImageUrl(clip.thumb_id, 720)} alt="" onError={() => setFailed(true)}
            onLoad={e => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) onAspect(i.naturalWidth / i.naturalHeight); }}
            className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center"><Video className="w-1/3 h-1/3 text-white/30" /></span>
        )}
        {fresh && <span className="absolute top-2 left-2 rounded-full bg-[#ff2e93] px-2.5 py-0.5 text-xs font-black">¡NUEVO!</span>}
        <span className="absolute bottom-1.5 inset-x-1.5 flex justify-between gap-1 text-[11px] font-semibold whitespace-nowrap">
          {mode ? <span className="rounded-full bg-black/55 px-2 py-0.5 truncate">{mode}</span> : <span />}
          {!small && <span className="rounded-full bg-black/55 px-2 py-0.5">{clipTime(clip)}</span>}
        </span>
      </span>
      <span className="bg-white rounded-xl p-1.5 shadow-lg">
        <QRCodeSVG value={absolute(clipPage(clip))} size={qr} level="L" />
      </span>
    </motion.div>
  );
}

// Los videos de Drive no siempre se pueden reproducir desde otra página: si fallan
// dos y ninguno anduvo, se deja de intentar y se muestra la vista previa animada.
const direct = { ok: 0, failed: 0 };
const tryDirect = () => direct.ok > 0 || direct.failed < 2;

/** Lo más grande que entra en (W, H) con la forma `aspect` (ancho / alto). */
const fit = (W: number, H: number, aspect: number) => (W / H > aspect ? { w: H * aspect, h: H } : { w: W, h: W / aspect });

/** Vista previa animada: 24 cuadros en una imagen, pasando a 8 por segundo. */
function SpritePreview({ id, box, onDone, onFail }: { id: string; box: { w: number; h: number }; onDone: () => void; onFail: () => void }) {
  const url = driveImageUrl(id, 1600);
  const [frameAspect, setFrameAspect] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setFrameAspect((img.naturalWidth / PREVIEW_COLS) / (img.naturalHeight / PREVIEW_ROWS));
    img.onerror = onFail;
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  useEffect(() => {
    if (!frameAspect) return;
    let n = 0;
    const t = window.setInterval(() => {
      n += 1;
      setFrame(n % PREVIEW_FRAMES);
      if (n >= PREVIEW_FRAMES * 2) { window.clearInterval(t); onDone(); }
    }, 125);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameAspect]);
  if (!frameAspect) return <Loader2 className="w-12 h-12 animate-spin text-white/50" />;
  const { w, h } = fit(box.w, box.h, frameAspect);
  const col = frame % PREVIEW_COLS;
  const row = Math.floor(frame / PREVIEW_COLS);
  return (
    <div className="rounded-3xl ring-4 ring-white/20 shadow-2xl bg-black" style={{
      width: w, height: h, backgroundImage: `url("${url}")`,
      backgroundSize: `${PREVIEW_COLS * 100}% ${PREVIEW_ROWS * 100}%`,
      backgroundPosition: `${(col / (PREVIEW_COLS - 1)) * 100}% ${(row / (PREVIEW_ROWS - 1)) * 100}%`,
    }} />
  );
}

/** Un video de la demostración: el video, su vista previa animada o la portada con zoom. */
function DemoItem({ clip, box, onDone }: { clip: Clip; box: { w: number; h: number }; onDone: () => void }) {
  const fallback = (): 'preview' | 'cover' => (clip.preview_id ? 'preview' : 'cover');
  const [kind, setKind] = useState<'video' | 'preview' | 'cover'>(() => (tryDirect() ? 'video' : fallback()));
  const plays = useRef(0);
  const loaded = useRef(false);
  const urls = clipPlayUrls(clip.drive_id);
  const [attempt, setAttempt] = useState(0);
  const videoFailed = () => {
    if (loaded.current) { setKind(fallback()); return; }
    // Otra dirección del mismo video; si no queda ninguna, la vista previa
    if (attempt + 1 < urls.length) { setAttempt(a => a + 1); return; }
    direct.failed += 1;
    setKind(fallback());
  };
  // El video tiene unos segundos para empezar; si no, la vista previa
  useEffect(() => {
    if (kind !== 'video') return;
    const t = window.setTimeout(() => { if (!loaded.current) videoFailed(); }, 9000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, attempt]);
  // La portada queda unos segundos con un acercamiento suave
  useEffect(() => {
    if (kind !== 'cover') return;
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (kind === 'video') {
    return (
      <video
        key={attempt} src={urls[attempt]} autoPlay muted playsInline
        onLoadedData={() => { loaded.current = true; direct.ok += 1; }}
        onEnded={e => {
          // Los cortos (boomerang) se ven dos veces
          if (e.currentTarget.duration < 7 && plays.current < 1) { plays.current += 1; void e.currentTarget.play(); }
          else onDone();
        }}
        onError={videoFailed}
        className="rounded-3xl ring-4 ring-white/20 shadow-2xl bg-black object-contain"
        style={{ maxWidth: box.w, maxHeight: box.h }}
      />
    );
  }
  if (kind === 'preview' && clip.preview_id) {
    return <SpritePreview id={clip.preview_id} box={box} onDone={onDone} onFail={() => setKind('cover')} />;
  }
  const { w, h } = fit(box.w, box.h, 9 / 16);
  return (
    <div className="relative overflow-hidden rounded-3xl ring-4 ring-white/20 shadow-2xl bg-black/40" style={{ width: w, height: h }}>
      {clip.thumb_id
        ? <motion.img src={driveImageUrl(clip.thumb_id, 1080)} alt="" initial={{ scale: 1 }} animate={{ scale: 1.12 }} transition={{ duration: 6, ease: 'linear' }}
            className="absolute inset-0 w-full h-full object-cover" />
        : <span className="absolute inset-0 flex items-center justify-center"><Video className="w-1/4 h-1/4 text-white/30" /></span>}
    </div>
  );
}

/** Videos pasando de a uno (demostración), con el QR del que se ve. */
function DemoPlayer({ clips, compact }: { clips: Clip[]; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [ref, box] = useSize();
  const newest = clips[0]?.id;
  const lastNewest = useRef(newest);
  // Video nuevo: se muestra enseguida
  useEffect(() => {
    if (newest && newest !== lastNewest.current) setIndex(0);
    lastNewest.current = newest;
  }, [newest]);
  const list = clips.slice(0, 40);
  const clip = list.length ? list[index % list.length] : null;
  const next = () => setIndex(i => (list.length ? (i + 1) % list.length : 0));
  // Por si un video se queda trabado
  useEffect(() => {
    if (!clip) return;
    const t = window.setTimeout(next, MAX_VIDEO_SECONDS * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.id, index]);
  return (
    <div ref={ref} className="relative h-full w-full flex items-center justify-center">
      {clip && box.w > 0 && (
        <AnimatePresence mode="wait">
          <motion.div key={`${clip.id}-${index}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex items-center justify-center">
            <DemoItem clip={clip} box={box} onDone={next} />
          </motion.div>
        </AnimatePresence>
      )}
      {clip && (
        <div className={`absolute ${compact ? 'bottom-2 right-2' : 'bottom-[3vmin] right-[3vmin]'} flex items-center gap-3 rounded-2xl bg-black/55 backdrop-blur p-2 pr-4`}>
          <span className="bg-white rounded-xl p-1.5"><QRCodeSVG value={absolute(clipPage(clip))} size={compact ? 84 : 120} level="L" /></span>
          <span className={`font-bold leading-tight ${compact ? 'text-sm max-w-[8rem]' : 'text-lg max-w-[11rem]'}`}>¿Sos vos? Escaneá y bajalo</span>
        </div>
      )}
    </div>
  );
}

/**
 * Cuántas columnas y filas usar para que las portadas salgan lo más grandes
 * posible (con pocos videos, grandes; con muchos, hasta el máximo por página).
 */
function layoutGrid(n: number, W: number, H: number, maxCols: number, maxRows: number, aspect: number, gap: number) {
  const need = Math.max(1, Math.min(n, maxCols * maxRows));
  let best = { cols: maxCols, rows: maxRows, imgW: 0, imgH: 0, qr: 64 };
  for (let rows = 1; rows <= maxRows; rows++) {
    for (let cols = 1; cols <= maxCols; cols++) {
      if (cols * rows < need) continue;
      const cellW = (W - gap * (cols - 1)) / cols;
      const cellH = (H - gap * (rows - 1)) / rows;
      const qr = Math.round(Math.max(64, Math.min(140, cellH * 0.26, cellW * 0.7)));
      const maxH = cellH - qr - 28;
      if (maxH < 40) continue;
      const imgW = Math.min(cellW, maxH * aspect);
      // Más grande gana; a igual tamaño, menos lugares vacíos
      if (imgW > best.imgW + 1 || (Math.abs(imgW - best.imgW) <= 1 && cols * rows < best.cols * best.rows)) {
        best = { cols, rows, imgW, imgH: imgW / aspect, qr };
      }
    }
  }
  return best;
}

export default function GalleryScreen({ clips, title, galleryUrl, view }: { clips: Clip[] | null; title: string; galleryUrl: string; view: ScreenView }) {
  const landscape = useLandscape();
  const [gridRef, grid] = useSize();
  const [aspect, setAspect] = useState(9 / 16);
  const list = useMemo(() => clips ?? [], [clips]);
  const [page, setPage] = useState(0);

  // Videos que llegaron mientras la pantalla estaba abierta
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!clips) return;
    if (!seen.current) { seen.current = new Set(clips.map(c => c.id)); return; }
    const added = clips.filter(c => !seen.current!.has(c.id)).map(c => c.id);
    if (!added.length) return;
    added.forEach(id => seen.current!.add(id));
    setFresh(f => new Set([...f, ...added]));
    setPage(0);
    const t = window.setTimeout(() => setFresh(f => new Set([...f].filter(id => !added.includes(id)))), 60000);
    return () => window.clearTimeout(t);
  }, [clips]);

  // Grilla de portadas: columnas y filas según la pantalla, la vista y cuántos videos hay
  const withPlayer = view === 'completa';
  const maxCols = withPlayer ? 4 : (landscape ? 6 : 4);
  const maxRows = withPlayer ? (landscape ? 2 : 1) : (landscape ? 2 : 3);
  const gap = 16;
  const { cols, imgW, imgH, qr } = grid.w ? layoutGrid(list.length, grid.w, grid.h, maxCols, maxRows, aspect, gap) : { cols: maxCols, imgW: 0, imgH: 0, qr: 64 };
  const cellW = imgW;
  const perPage = maxCols * maxRows;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  useEffect(() => {
    if (pages <= 1) return;
    const t = window.setInterval(() => setPage(p => (p + 1) % pages), PAGE_SECONDS * 1000);
    return () => window.clearInterval(t);
  }, [pages]);
  const current = page % pages;
  const shown = list.slice(current * perPage, current * perPage + perPage);

  const header = (
    <header className="relative flex items-center justify-between gap-6 px-[3vmin] pt-[2.5vmin]">
      <EventPixLogo size={40} subtitle="Cabina de video" />
      <h1 className="carlmarx-bold text-center text-[clamp(1.6rem,4.5vmin,3.8rem)] leading-tight flex-1 truncate">{title || 'Videos del evento'}</h1>
      <div className="flex items-center gap-3 rounded-2xl bg-black/40 backdrop-blur p-2 pr-4">
        <span className="bg-white rounded-xl p-1.5"><QRCodeSVG value={galleryUrl} size={84} level="L" /></span>
        <span className="text-sm font-bold max-w-[9rem] leading-tight">Todos los videos en tu celular</span>
      </div>
    </header>
  );

  if (clips === null) {
    return (
      <div className="relative h-screen flex items-center justify-center text-white"><AuroraBackground /><Loader2 className="relative w-14 h-14 animate-spin text-[#00d4ff]" /></div>
    );
  }

  if (!list.length) {
    return (
      <div className="relative h-screen overflow-hidden text-white flex flex-col items-center justify-center gap-8 p-8 text-center">
        <AuroraBackground />
        <EventPixLogo size={56} subtitle="Cabina de video" />
        <h1 className="relative carlmarx-bold text-[clamp(2rem,7vmin,5rem)] leading-tight">{title || 'Videos del evento'}</h1>
        <p className="relative text-white/70 text-2xl flex items-center gap-3"><Sparkles className="w-7 h-7 text-[#ffd23f]" /> Los videos van a aparecer acá apenas se graben</p>
        <span className="relative bg-white p-4 rounded-3xl"><QRCodeSVG value={galleryUrl} size={200} /></span>
      </div>
    );
  }

  if (view === 'videos') {
    return (
      <div className="relative h-screen overflow-hidden text-white flex flex-col">
        <AuroraBackground />
        {header}
        <div className="relative flex-1 min-h-0 p-[3vmin]"><DemoPlayer clips={list} /></div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden text-white flex flex-col">
      <AuroraBackground />
      {header}
      <div className={`relative flex-1 min-h-0 flex gap-[3vmin] p-[3vmin] ${landscape ? 'flex-row' : 'flex-col'}`}>
        {withPlayer && (
          <div className={landscape ? 'h-full w-[34%] min-w-0' : 'w-full h-[46%] min-h-0'}>
            <DemoPlayer clips={list} compact />
          </div>
        )}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <p className="text-center text-[clamp(1rem,2.4vmin,1.6rem)] font-bold text-white/85">Buscá tu video y escaneá el QR para bajarlo</p>
          <div ref={gridRef} className="flex-1 min-h-0">
            {cellW > 0 && (
              <div className="grid h-full content-center justify-items-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
                <AnimatePresence mode="popLayout">
                  {shown.map(c => (
                    <Card key={c.id} clip={c} imgW={imgW} imgH={imgH} qr={qr} fresh={fresh.has(c.id)} onAspect={a => { if (Math.abs(a - aspect) > 0.05) setAspect(a); }} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 pt-1">
              {Array.from({ length: pages }, (_, i) => (
                <span key={i} className={`h-2.5 rounded-full transition-all ${i === current ? 'w-8 bg-white' : 'w-2.5 bg-white/35'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
