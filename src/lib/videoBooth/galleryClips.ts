import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// Videos de una galería online de la cabina (solo los aprobados), en vivo.

export interface Clip { id: string; drive_id: string; thumb_id: string | null; title: string | null; mode: string | null; created_at: string }

export const MODE_LABEL: Record<string, string> = {
  clasico: 'Video', boomerang: 'Boomerang', lenta: 'Cámara lenta', '360': '360', firmas: 'Libro de firmas', glam: 'Glam',
};

export const clipVideoUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download`;
/** Página del invitado para ver y bajar un video (relativa al sitio). */
export const clipPage = (c: Clip) => `/clip?${new URLSearchParams({ d: c.drive_id, ...(c.title ? { t: c.title } : {}) }).toString()}`;
export const clipTime = (c: Clip) => new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

export function useGalleryClips(code: string) {
  const [clips, setClips] = useState<Clip[] | null>(() => (!isSupabaseConfigured || !code ? [] : null));
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isSupabaseConfigured || !code) return;
    let alive = true;
    const load = async () => {
      const query = () => supabase.from('video_clips')
        .select('id, drive_id, thumb_id, title, mode, created_at')
        .eq('gallery', code).order('created_at', { ascending: false }).limit(300);
      // Solo los aprobados (aunque mire alguien logueado en el panel)
      let { data, error: e } = await query().eq('hidden', false);
      // Base sin la migración de moderación: no hay columna "hidden"
      if (e && /hidden/i.test(e.message)) ({ data, error: e } = await query());
      if (!alive) return;
      if (e) setError(e.message);
      else { setError(''); setClips(data as Clip[]); }
    };
    void load();
    // En vivo: videos nuevos, aprobados, ocultos o borrados (y por las dudas, cada 30 s)
    let pending = 0;
    const reload = () => { window.clearTimeout(pending); pending = window.setTimeout(load, 400); };
    const channel = supabase.channel(`video_clips:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_clips', filter: `gallery=eq.${code}` }, reload)
      .subscribe();
    const timer = window.setInterval(load, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [code]);
  return { clips, error };
}
