import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { listEventPhotos, readStoredPhoto, type StoredPhoto } from '@/lib/kioskStorage';
import { getGeneralSettings } from '@/lib/kioskSettings';

// Galería de la TV box: las fotos finales del evento guardadas en el equipo.

function Thumb({ photo, onOpen }: { photo: StoredPhoto; onOpen: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    readStoredPhoto(photo.uri, 360).then(s => alive && setSrc(s)).catch(() => {});
    return () => { alive = false; };
  }, [photo.uri]);
  return (
    <button onClick={onOpen}
      className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 transition-transform focus:outline-none focus:ring-4 focus:ring-[#00d4ff] focus:scale-105 hover:scale-105">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse bg-white/10" />}
    </button>
  );
}

export default function KioskGallery() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<StoredPhoto[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ index: number; src: string } | null>(null);
  const full = loaded && loaded.index === open ? loaded.src : null;
  const eventTitle = getGeneralSettings().eventTitle;

  useEffect(() => {
    listEventPhotos(120).then(setPhotos).catch(() => setPhotos([]));
  }, []);

  useEffect(() => {
    if (open === null || !photos) return;
    let alive = true;
    readStoredPhoto(photos[open].uri, 1600).then(src => alive && setLoaded({ index: open, src })).catch(() => {});
    return () => { alive = false; };
  }, [open, photos]);

  useRemoteFocus(rootRef, [photos?.length, open]);

  const move = (delta: number) => photos && open !== null && setOpen((open + delta + photos.length) % photos.length);

  return (
    <div ref={rootRef} className="relative h-screen text-white overflow-hidden">
      <AuroraBackground />
      <div className="relative h-full flex flex-col">
        <header className="flex items-center justify-between px-12 pt-10 pb-6">
          <button onClick={() => navigate('/box')}
            className="kiosk-glass flex items-center gap-3 rounded-full px-6 py-3 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
            <ArrowLeft className="w-6 h-6" /> Inicio
          </button>
          <div className="text-center">
            <p className="text-white/60 uppercase tracking-[0.3em] text-sm">Galería</p>
            <p className="text-3xl font-black">{eventTitle || 'Fotos del evento'}</p>
          </div>
          <p className="w-40 text-right text-white/60 text-lg">{photos ? `${photos.length} fotos` : ''}</p>
        </header>

        <main className="flex-1 overflow-y-auto px-12 pb-12">
          {photos && photos.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-white/60">
              <Images className="w-20 h-20" />
              <p className="text-2xl">Todavía no hay fotos en este evento.</p>
            </div>
          )}
          <div className="grid grid-cols-6 gap-5">
            {photos?.map((p, i) => <Thumb key={p.uri} photo={p} onOpen={() => setOpen(i)} />)}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {open !== null && photos && (
          <motion.div className="fixed inset-0 z-50 bg-[#07051a]/95 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button onClick={() => move(-1)} className="absolute left-10 kiosk-glass w-20 h-20 rounded-full flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" aria-label="Anterior">
              <ChevronLeft className="w-10 h-10" />
            </button>
            {full ? (
              <motion.img key={full} src={full} alt="" className="max-h-[90vh] max-w-[70vw] rounded-3xl shadow-2xl"
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} />
            ) : <div className="w-[40vh] h-[60vh] rounded-3xl bg-white/10 animate-pulse" />}
            <button data-autofocus onClick={() => move(1)} className="absolute right-10 kiosk-glass w-20 h-20 rounded-full flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" aria-label="Siguiente">
              <ChevronRight className="w-10 h-10" />
            </button>
            <button onClick={() => setOpen(null)} className="absolute top-8 right-10 kiosk-glass w-16 h-16 rounded-full flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-[#00d4ff]" aria-label="Cerrar">
              <X className="w-8 h-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
