import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Play, Video } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { driveImageUrl } from '@/lib/kioskShare';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// Galería online de la cabina de video: todos los videos del evento.
// En el celular: grilla para ver y bajar cada video. Con ?pantalla=1 (una tele
// o tablet en el evento): el último video en grande, la grilla y el QR.

interface Clip { id: string; drive_id: string; thumb_id: string | null; title: string | null; mode: string | null; created_at: string }

const MODE_LABEL: Record<string, string> = {
  clasico: 'Video', boomerang: 'Boomerang', lenta: 'Cámara lenta', '360': '360', firmas: 'Libro de firmas', glam: 'Glam',
};

const videoUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download`;
const clipPage = (c: Clip) => `/clip?${new URLSearchParams({ d: c.drive_id, ...(c.title ? { t: c.title } : {}) }).toString()}`;

function useClips(code: string) {
  const [clips, setClips] = useState<Clip[] | null>(() => (!isSupabaseConfigured || !code ? [] : null));
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isSupabaseConfigured || !code) return;
    let alive = true;
    const load = async () => {
      const { data, error: e } = await supabase.from('video_clips')
        .select('id, drive_id, thumb_id, title, mode, created_at')
        .eq('gallery', code).order('created_at', { ascending: false }).limit(300);
      if (!alive) return;
      if (e) setError(e.message);
      else { setError(''); setClips(data as Clip[]); }
    };
    void load();
    // Videos nuevos en vivo (y por las dudas, cada 30 s)
    const channel = supabase.channel(`video_clips:${code}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_clips', filter: `gallery=eq.${code}` }, payload => {
        setClips(list => {
          const row = payload.new as Clip;
          return list?.some(c => c.id === row.id) ? list : [row, ...(list ?? [])];
        });
      })
      .subscribe();
    const timer = window.setInterval(load, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [code]);
  return { clips, error };
}

function Thumb({ clip, big }: { clip: Clip; big?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`relative block w-full aspect-[9/16] overflow-hidden rounded-2xl bg-black/40 border border-white/15 ${big ? 'rounded-3xl' : ''}`}>
      {clip.thumb_id && !failed ? (
        <img src={driveImageUrl(clip.thumb_id, 480)} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center"><Video className="w-10 h-10 text-white/40" /></span>
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-12 h-12 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"><Play className="w-6 h-6 text-white fill-white ml-0.5" /></span>
      </span>
      {clip.mode && <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold">{MODE_LABEL[clip.mode] ?? clip.mode}</span>}
    </span>
  );
}

export default function VideoGallery() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const screen = params.get('pantalla') === '1';
  const { clips, error } = useClips(code);
  const title = useMemo(() => clips?.find(c => c.title)?.title ?? '', [clips]);
  const shareUrl = `${window.location.origin}/galeria-video/${encodeURIComponent(code)}`;

  if (screen) {
    const latest = clips?.[0];
    return (
      <div className="relative h-screen overflow-hidden text-white">
        <AuroraBackground />
        <div className="relative h-full grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] portrait:grid-cols-1 portrait:grid-rows-[auto_1fr] gap-[3vmin] p-[4vmin]">
          <div className="flex flex-col items-center justify-center gap-[3vmin] min-h-0">
            <EventPixLogo size={48} subtitle="Cabina de video" />
            {title && <h1 className="carlmarx-bold text-[clamp(2rem,6vmin,5rem)] text-center leading-tight">{title}</h1>}
            {latest ? (
              <motion.video key={latest.drive_id} src={videoUrl(latest.drive_id)} autoPlay loop muted playsInline
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="max-h-[52vh] portrait:max-h-[34vh] rounded-3xl ring-4 ring-white/20 shadow-2xl bg-black" />
            ) : (
              <p className="text-white/60 text-2xl">Los videos van a aparecer acá</p>
            )}
            <div className="flex items-center gap-5 kiosk-glass rounded-3xl p-4 pr-7">
              <span className="bg-white p-3 rounded-2xl"><QRCodeSVG value={shareUrl} size={150} /></span>
              <span className="text-xl font-bold max-w-[16rem]">Escaneá y buscá tu video para bajarlo</span>
            </div>
          </div>
          <div className="min-h-0 overflow-hidden">
            <div className="grid grid-cols-4 portrait:grid-cols-5 gap-3">
              {(clips ?? []).slice(1, 21).map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Thumb clip={c} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white">
      <AuroraBackground className="fixed" />
      <div className="relative max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
        <EventPixLogo size={40} subtitle="Cabina de video" />
        <h1 className="carlmarx-bold text-4xl text-center">{title || 'Videos del evento'}</h1>
        {!isSupabaseConfigured && <p className="text-amber-200">La galería no está disponible en este sitio.</p>}
        {error && <p className="text-amber-200 text-center">No se pudo cargar la galería ({error}).</p>}
        {clips === null ? (
          <Loader2 className="w-10 h-10 animate-spin text-[#00d4ff] mt-10" />
        ) : !isSupabaseConfigured ? null : clips.length === 0 ? (
          <p className="text-white/70 text-center mt-6">Todavía no hay videos. Si recién grabaste el tuyo, esperá un ratito: aparece apenas se sube.</p>
        ) : (
          <>
            <p className="text-white/60 text-sm">{clips.length} video{clips.length === 1 ? '' : 's'} · tocá el tuyo para verlo y bajarlo</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
              {clips.map(c => (
                <Link key={c.id} to={clipPage(c)} className="block focus:outline-none focus:ring-4 focus:ring-[#00d4ff] rounded-2xl">
                  <Thumb clip={c} />
                  <span className="block text-xs text-white/50 mt-1 text-center">
                    {new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
