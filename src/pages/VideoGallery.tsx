import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Play, Video } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { driveImageUrl } from '@/lib/kioskShare';
import { isSupabaseConfigured } from '@/lib/supabase';
import { clipPage, clipTime, MODE_LABEL, useGalleryClips, type Clip } from '@/lib/videoBooth/galleryClips';
import GalleryScreen, { type ScreenView } from './VideoGalleryScreen';

// Galería online de la cabina de video: todos los videos del evento, sin entrar
// al panel. En el celular: grilla para ver y bajar cada video. Con ?pantalla=1
// (una tele, tablet o compu en el evento): portadas con su QR y los videos de
// demostración (VideoGalleryScreen).

function Thumb({ clip }: { clip: Clip }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`relative block w-full aspect-[9/16] overflow-hidden rounded-2xl bg-black/40 border border-white/15`}>
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
  const { clips, error } = useGalleryClips(code);
  const title = useMemo(() => clips?.find(c => c.title)?.title ?? '', [clips]);
  const shareUrl = `${window.location.origin}/galeria-video/${encodeURIComponent(code)}`;

  if (screen) {
    const view = (['completa', 'portadas', 'videos'] as ScreenView[]).find(v => v === params.get('vista')) ?? 'completa';
    return <GalleryScreen clips={clips} title={title} galleryUrl={shareUrl} view={view} />;
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
                  <span className="block text-xs text-white/50 mt-1 text-center">{clipTime(c)}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
