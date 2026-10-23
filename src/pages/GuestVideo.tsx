import { useEffect, useState } from 'react';
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
  // Diagnóstico (?diag=1): qué contesta cada dirección y por qué no se reproduce
  const diag = params.get('diag') === '1';
  const [report, setReport] = useState<string[]>([]);
  const note = (line: string) => setReport(r => [...r, line]);
  useEffect(() => {
    if (!diag || !id) return;
    note(`Clave de Google en el sitio: ${playUrls.length > 1 ? 'sí' : 'NO (falta VITE_GOOGLE_API_KEY o el redeploy)'}`);
    note(`Navegador: ${navigator.userAgent}`);
    for (const [i, url] of playUrls.entries()) {
      const name = url.includes('googleapis') ? 'API de Drive' : 'Drive directo';
      fetch(url, { headers: { Range: 'bytes=0-1' } })
        .then(async r => {
          const body = r.ok ? '' : (await r.text()).replace(/\s+/g, ' ').slice(0, 300);
          note(`${i + 1}. ${name}: ${r.status} ${r.headers.get('content-type') ?? ''} ${body}`);
        })
        .catch(e => note(`${i + 1}. ${name}: no se pudo pedir (${e instanceof Error ? e.message : e})`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diag, id]);
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
              <video key={attempt} src={playUrls[attempt]} controls autoPlay loop playsInline muted onError={e => {
                const err = e.currentTarget.error;
                if (diag) note(`Reproductor, intento ${attempt + 1}: error ${err?.code ?? '?'} ${err?.message ?? ''}`);
                setAttempt(a => a + 1);
              }}
              onLoadedData={() => { if (diag) note(`Reproductor: se reproduce con el intento ${attempt + 1}`); }}
                className="w-full rounded-3xl shadow-2xl border border-white/20 bg-black" />
            )}
            {diag && (
              <pre className="w-full whitespace-pre-wrap break-all rounded-2xl bg-black/60 p-3 text-xs text-white/80">{report.join('\n') || 'Probando…'}</pre>
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
