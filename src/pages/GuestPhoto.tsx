import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, MessageCircle, Share2 } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';

// Página que abre el invitado en el celular al escanear el QR del kiosco:
// ve su foto y la baja o la comparte (WhatsApp, Instagram y lo que tenga el teléfono).

const isPhotoUrl = (u: string) => /^https:\/\/[\w.-]+\/storage\/v1\/object\/public\//.test(u);

export default function GuestPhoto() {
  const [params] = useSearchParams();
  const url = params.get('u') || '';
  const title = params.get('t') || '';
  const [busy, setBusy] = useState(false);
  const valid = isPhotoUrl(url);

  const fileOf = async () => {
    const blob = await (await fetch(url)).blob();
    return new File([blob], `${(title || 'foto').replace(/[^\w-]+/g, '-')}.jpg`, { type: blob.type || 'image/jpeg' });
  };

  const download = async () => {
    setBusy(true);
    try {
      const file = await fileOf();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      window.open(url, '_blank');
    } finally {
      setBusy(false);
    }
  };

  // Compartir del teléfono: ahí aparecen WhatsApp, Instagram (historia o chat), etc.
  const share = async () => {
    setBusy(true);
    try {
      const file = await fileOf();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title || 'Mi foto' });
      } else {
        await navigator.share({ url, title: title || 'Mi foto' });
      }
    } catch {
      // cancelado por el usuario o sin soporte
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title ? `Mi foto de ${title} 📸 ` : 'Mi foto 📸 '}${url}`)}`;
  const button = 'w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold disabled:opacity-50';

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <AuroraBackground />
      <div className="relative min-h-screen max-w-md mx-auto flex flex-col items-center gap-6 px-5 py-8">
        <EventPixLogo size={40} />
        {title && <h1 className="carlmarx-bold text-4xl text-center">{title}</h1>}
        {valid ? (
          <>
            <img src={url} alt="Tu foto" className="w-full rounded-3xl shadow-2xl border border-white/20" />
            <div className="w-full space-y-3">
              {typeof navigator.share === 'function' && (
                <button onClick={share} disabled={busy} className={`${button} bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]`}>
                  <Share2 className="w-6 h-6" /> Compartir (Instagram, WhatsApp…)
                </button>
              )}
              <a href={whatsapp} target="_blank" rel="noreferrer" className={`${button} bg-[#25D366] text-[#05300f]`}>
                <MessageCircle className="w-6 h-6" /> Enviar por WhatsApp
              </a>
              <button onClick={download} disabled={busy} className={`${button} bg-white/15 border border-white/25`}>
                <Download className="w-6 h-6" /> Descargar foto
              </button>
            </div>
            <p className="text-white/50 text-sm text-center">Si no se descarga, mantené apretada la foto y elegí "Guardar imagen".</p>
          </>
        ) : (
          <p className="text-white/70 text-center mt-10">No encontramos la foto. Volvé a escanear el código del kiosco.</p>
        )}
      </div>
    </div>
  );
}
