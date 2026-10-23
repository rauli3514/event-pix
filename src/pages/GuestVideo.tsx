import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, MessageCircle, Share2 } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { clipPlayUrls } from '@/lib/videoBooth/galleryClips';

// Página que abre el invitado al escanear el QR de la cabina de video: ve su
// video y lo baja o lo comparte. El video está en Drive (compartido con link).

const EVENTPIX_WHATSAPP = '5493624547382';

export default function GuestVideo() {
  const [params] = useSearchParams();
  const id = /^[\w-]{20,}$/.test(params.get('d') || '') ? params.get('d')! : '';
  const title = params.get('t') || '';
  const fileUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
  // Se prueba cada dirección; si ninguna se puede reproducir, el reproductor de Drive
  const playUrls = clipPlayUrls(id);
  const [attempt, setAttempt] = useState(0);
  const useDrivePlayer = attempt >= playUrls.length;
  const contactPhone = EVENTPIX_WHATSAPP;

  const share = async () => {
    try {
      await navigator.share({ url: window.location.href, title: title ? `Mi video de ${title}` : 'Mi video' });
    } catch { /* cancelado */ }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title ? `Mi video de ${title} 🎬 ` : 'Mi video 🎬 '}${window.location.href}`)}`;
  const contactText = title
    ? `Hola! Vi mi video de la cabina de EventPix en ${title} y quiero info para mi evento.`
    : 'Hola! Vi mi video de la cabina de EventPix y quiero info para mi evento.';
  const contact = `https://wa.me/${contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(contactText)}`;
  const button = 'w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold';

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <AuroraBackground />
      <div className="relative min-h-screen max-w-md mx-auto flex flex-col items-center gap-6 px-5 py-8">
        <EventPixLogo size={40} />
        {title && <h1 className="carlmarx-bold text-4xl text-center">{title}</h1>}
        {id ? (
          <>
            {useDrivePlayer ? (
              <iframe src={`https://drive.google.com/file/d/${id}/preview`} allow="autoplay" title="Tu video"
                className="w-full aspect-[9/16] rounded-3xl shadow-2xl border border-white/20 bg-black" />
            ) : (
              <video key={attempt} src={playUrls[attempt]} controls autoPlay loop playsInline muted onError={() => setAttempt(a => a + 1)}
                className="w-full rounded-3xl shadow-2xl border border-white/20 bg-black" />
            )}
            <div className="w-full space-y-3">
              <a href={fileUrl} className={`${button} bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]`}>
                <Download className="w-6 h-6" /> Descargar video
              </a>
              <a href={whatsapp} target="_blank" rel="noreferrer" className={`${button} bg-[#25D366] text-[#05300f]`}>
                <MessageCircle className="w-6 h-6" /> Enviar por WhatsApp
              </a>
              {typeof navigator.share === 'function' && (
                <button onClick={share} className={`${button} bg-white/15 border border-white/25`}>
                  <Share2 className="w-6 h-6" /> Compartir link
                </button>
              )}
            </div>
            <p className="text-white/50 text-sm text-center">
              Para subirlo a Instagram, primero descargalo y después compartilo desde la galería del celular.
              Si recién lo grabaste y no carga, esperá unos segundos y recargá la página.
            </p>
          </>
        ) : (
          <p className="text-white/70 text-center mt-10">No encontramos el video. Volvé a escanear el código de la cabina.</p>
        )}

        <div className="w-full kiosk-glass rounded-3xl p-5 mt-2 flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-bold">¿Querés una cabina de video en tu evento?</p>
          <p className="text-white/60 text-sm">Plataforma 360, boomerang, cámara lenta, glam y libro de firmas en video.</p>
          <a href={contact} target="_blank" rel="noreferrer" className={`${button} bg-[#25D366] text-[#05300f]`}>
            <MessageCircle className="w-6 h-6" /> Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
