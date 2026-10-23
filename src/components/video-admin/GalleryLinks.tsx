import { toast } from 'sonner';
import { Copy, ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { SCREEN_VIEWS } from '@/lib/videoBooth/cloud';
import { btnGhost } from './ui';

// Enlaces públicos de una galería (no piden entrar al panel): la de los invitados
// y la pantalla para una tele, tablet o compu del evento, en sus tres vistas.

const copy = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Enlace copiado');
  } catch {
    window.prompt('Copiá el enlace', url);
  }
};

const galleryLinks = (site: string, code: string) => {
  const base = `${site.replace(/\/+$/, '')}/galeria-video/${encodeURIComponent(code)}`;
  return {
    guest: base,
    screens: SCREEN_VIEWS.map(v => ({ ...v, url: `${base}?pantalla=1${v.value === 'completa' ? '' : `&vista=${v.value}`}` })),
  };
};

export default function GalleryLinks({ site, code, compact }: { site: string; code: string; compact?: boolean }) {
  const { guest, screens } = galleryLinks(site, code);
  if (compact) {
    return (
      <>
        <a href={guest} target="_blank" rel="noreferrer" className={btnGhost}><Smartphone className="h-4 w-4" /> Galería</a>
        <a href={screens[0].url} target="_blank" rel="noreferrer" className={btnGhost}><Monitor className="h-4 w-4" /> Pantalla</a>
      </>
    );
  }
  const row = (icon: React.ReactNode, label: string, hint: string, url: string) => (
    <div key={url} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">{icon} {label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <button type="button" onClick={() => void copy(url)} className={btnGhost}><Copy className="h-4 w-4" /> Copiar</button>
      <a href={url} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" /> Abrir</a>
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Para compartir sin dar acceso al panel. No muestran los videos ocultos.</p>
      {row(<Smartphone className="h-4 w-4 text-violet-400" />, 'Galería para los invitados', 'En el celular: ver y bajar los videos', guest)}
      {screens.map(s => row(<Monitor className="h-4 w-4 text-sky-400" />, `Pantalla: ${s.label}`, s.hint, s.url))}
    </div>
  );
}
