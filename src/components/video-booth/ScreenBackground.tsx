import { useEffect, useState } from 'react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { AURORA, bgKey, themeBackground, type ThemeBackground } from '@/lib/videoBooth/backgrounds';
import { getMedia, MEDIA_EVENT } from '@/lib/videoBooth/mediaStore';

// Fondo de las pantallas de la cabina: el de siempre, uno de fábrica o uno
// propio (imagen o video en loop, un poco oscurecido para que se lean los textos).

const BLOB_POS = ['a', 'b', 'c', 'd'] as const;

/** Fondo de fábrica: base de color con cuatro manchas que se mueven. */
export function ThemeLayer({ theme, className = '' }: { theme: ThemeBackground; className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: theme.base }} aria-hidden="true">
      {BLOB_POS.map((k, i) => (
        <div key={k} className={`kiosk-aurora-blob ${k}`} style={{ background: `radial-gradient(circle, ${theme.blobs[i]}, transparent 62%)` }} />
      ))}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 40%, ${theme.base}cc)` }} />
    </div>
  );
}

/** Archivo de un fondo propio (se libera solo). */
function useBackgroundFile(id: string | null) {
  const [file, setFile] = useState<{ id: string; url: string; video: boolean } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let current: string | null = null;
    const load = () => getMedia(bgKey(id)).then(rec => {
      if (!alive) return;
      if (current) URL.revokeObjectURL(current);
      current = rec ? URL.createObjectURL(rec.blob) : null;
      setFile(current && rec ? { id, url: current, video: rec.blob.type.startsWith('video/') } : null);
    }).catch(() => { /* sin el archivo: el fondo de siempre */ });
    void load();
    const onChange = (e: Event) => { if ((e as CustomEvent).detail === bgKey(id)) void load(); };
    window.addEventListener(MEDIA_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(MEDIA_EVENT, onChange);
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  return file && file.id === id ? file : null;
}

export default function ScreenBackground({ value, dim = 0.35, className = '' }: { value?: string; dim?: number; className?: string }) {
  const theme = themeBackground(value);
  const ownId = value && value !== AURORA && !theme ? value : null;
  const file = useBackgroundFile(ownId);
  if (theme) return <ThemeLayer theme={theme} className={className} />;
  if (!ownId || !file) return <AuroraBackground className={className} />;
  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${className}`} aria-hidden="true">
      {file.video
        ? <video key={file.url} src={file.url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        : <img src={file.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${Math.max(0, Math.min(0.8, dim))})` }} />
    </div>
  );
}
