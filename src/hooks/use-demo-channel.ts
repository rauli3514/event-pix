import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DEMO_EVENT, demoChannelName, type DemoPost } from "@/lib/demoWall";

// Canal en tiempo real de la demo (broadcast): el celular manda, la pantalla recibe.
// No pasa por la base de datos ni por el almacenamiento.

/** Pantalla: escucha lo que mandan a esta sesión */
export const useDemoReceiver = (session: string | null, onPost: (post: DemoPost) => void) => {
    const handler = useRef(onPost);
    useEffect(() => { handler.current = onPost; }, [onPost]);

    useEffect(() => {
        if (!session) return;
        const channel = supabase
            .channel(demoChannelName(session))
            .on('broadcast', { event: DEMO_EVENT }, ({ payload }) => {
                const post = payload as DemoPost;
                if (post && typeof post.content === 'string' && (post.type === 'photo' || post.type === 'message')) {
                    // Solo fotos chicas en JPEG/PNG/WebP como data URL
                    if (post.type === 'photo' && !/^data:image\/(jpeg|png|webp);base64,/.test(post.content)) return;
                    handler.current(post);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [session]);
};

/** Celular: manda a la pantalla de esta sesión */
export const useDemoSender = (session: string | null) => {
    const channelRef = useRef<Promise<RealtimeChannel> | null>(null);

    useEffect(() => () => {
        channelRef.current?.then((ch) => supabase.removeChannel(ch)).catch(() => undefined);
        channelRef.current = null;
    }, [session]);

    return useCallback(async (post: DemoPost) => {
        if (!session) throw new Error('Falta el código de la pantalla');
        if (!channelRef.current) {
            channelRef.current = new Promise<RealtimeChannel>((resolve, reject) => {
                const ch = supabase.channel(demoChannelName(session));
                const timer = setTimeout(() => reject(new Error('No se pudo conectar con la pantalla')), 10000);
                ch.subscribe((status) => {
                    if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(ch); }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error('No se pudo conectar con la pantalla')); }
                });
            });
            channelRef.current.catch(() => { channelRef.current = null; });
        }
        const channel = await channelRef.current;
        const res = await channel.send({ type: 'broadcast', event: DEMO_EVENT, payload: post });
        if (res !== 'ok') throw new Error('No llegó a la pantalla. Probá de nuevo.');
    }, [session]);
};
