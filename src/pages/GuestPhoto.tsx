import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, MessageCircle, Share2 } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { driveImageUrl } from '@/lib/kioskShare';
import { getCachedStore, loadStore } from '@/lib/kioskStore';

// Página que abre el invitado en el celular al escanear el QR del kiosco:
// ve su foto y la baja o la comparte (WhatsApp, Instagram y lo que tenga el teléfono).

// WhatsApp de EventPix por si no está cargado en el panel (Clientes y créditos)
const EVENTPIX_WHATSAPP = '5493624547382';

const isPhotoUrl = (u: string) => /^https:\/\/[\w.-]+\/storage\/v1\/object\/public\//.test(u);

export default function GuestPhoto() {
  const [params] = useSearchParams();
  // La foto viene de Drive (?d=<id>) o de Supabase (?u=<url>)
  const driveId = /^[\w-]{20,}$/.test(params.get('d') || '') ? params.get('d')! : '';
  const url = driveId ? driveImageUrl(driveId) : params.get('u') || '';
  const downloadUrl = driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : url;
  const title = params.get('t') || '';
  const [busy, setBusy] = useState(false);
  const [contactPhone, setContactPhone] = useState(() => getCachedStore().contact_phone || EVENTPIX_WHATSAPP);
  useEffect(() => {
    loadStore().then(s => { if (s.contact_phone) setContactPhone(s.contact_phone); }).catch(() => {});
  }, []);
  const valid = !!driveId || isPhotoUrl(url);

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
      // Drive no deja bajar la imagen desde la página: se abre su descarga
      window.open(downloadUrl, '_blank');
    } finally {
      setBusy(false);
    }
  };

  // Compartir del teléfono: ahí aparecen WhatsApp, Instagram (historia o chat), etc.
  const share = async () => {
    setBusy(true);
    try {
      // Si la imagen no se puede bajar desde la página (p. ej. Drive), se comparte el link
      const file = await fileOf().catch(() => null);
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title || 'Mi foto' });
      } else {
        await navigator.share({ url: window.location.href, title: title || 'Mi foto' });
      }
    } catch {
      // cancelado por el usuario o sin soporte
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title ? `Mi foto de ${title} 📸 ` : 'Mi foto 📸 '}${window.location.href}`)}`;
  const contactText = title
    ? `Hola! Vi mi foto del photobooth de EventPix en ${title} y quiero info para mi evento.`
    : 'Hola! Vi mi foto del photobooth de EventPix y quiero info para mi evento.';
  const contact = `https://wa.me/${contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(contactText)}`;
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

        {/* Contacto con EventPix: el invitado que quiere el photobooth para su evento */}
        <div className="w-full kiosk-glass rounded-3xl p-5 mt-2 flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-bold">¿Querés un photobooth como este en tu evento?</p>
          <p className="text-white/60 text-sm">Fotos al instante, impresión y fotos con IA.</p>
          <a href={contact} target="_blank" rel="noreferrer" className={`${button} bg-[#25D366] text-[#05300f]`}>
            <MessageCircle className="w-6 h-6" /> Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
