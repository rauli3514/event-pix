import { useEffect, useState } from 'react';
import { renderMagazineCover, type CoverOptions } from '@/lib/magazineCover';

// Vista previa chica de la tapa de revista (Portada Fashion) armada con el mismo
// generador del kiosco y los textos de portada cargados, para mostrar en tarjetas y en
// el panel cómo queda de verdad. Se guarda en memoria para no rehacerla a cada render.

const cache = new Map<string, string>();

export function useCoverPreview(photo: string | null | undefined, options: CoverOptions, width = 600) {
  const key = photo ? JSON.stringify([photo, options, width]) : '';
  const [url, setUrl] = useState<string | null>(() => (key ? cache.get(key) ?? null : null));

  useEffect(() => {
    if (!key || !photo) { setUrl(null); return; }
    const hit = cache.get(key);
    if (hit) { setUrl(hit); return; }
    let alive = true;
    renderMagazineCover(photo, { ...options, width })
      .then(u => { cache.set(key, u); if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
    // key resume photo, options y width
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}
