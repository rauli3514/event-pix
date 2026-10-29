import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Última foto de lo que se ve en cada pantalla (la manda la TV cada 5 minutos).
export interface DeviceScreen {
    device_id: string;
    image: string | null;         // JPEG en base64
    image_at: string | null;
    now_playing: { name?: string; type?: string } | null;
    captured_at: string;
}

export const screenImageSrc = (screen?: DeviceScreen | null) =>
    screen?.image ? `data:image/jpeg;base64,${screen.image}` : null;

// Vacío si el servidor todavía no tiene la tabla (falta correr la migración).
export const useDeviceScreens = (deviceIds: string[]) => useQuery({
    queryKey: ['display_device_screens', [...deviceIds].sort().join(',')],
    enabled: deviceIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<string, DeviceScreen>> => {
        const { data, error } = await supabase
            .from('display_device_screens')
            .select('device_id, image, image_at, now_playing, captured_at')
            .in('device_id', deviceIds);
        if (error) return {};
        return Object.fromEntries((data as DeviceScreen[]).map(s => [s.device_id, s]));
    },
});

// Pide a la TV una foto nueva y vuelve a leer las fotos hasta que llega.
// Resultado: 'photo' (llegó), 'no_photo' (la TV respondió pero su app no saca
// fotos: hay que actualizarla) o 'no_response'.
export const useRequestScreenshot = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (p: { id: string; device_id: string; before?: DeviceScreen | null }): Promise<'photo' | 'no_photo' | 'no_response'> => {
            const channel = supabase.channel(`device:${p.device_id}`);
            try {
                const result = await channel.httpSend('command', { action: 'screenshot' });
                if (!result.success) throw new Error(result.error || 'No se pudo pedir la foto');
            } finally {
                supabase.removeChannel(channel);
            }
            const latest = () => {
                for (const [, data] of queryClient.getQueriesData<Record<string, DeviceScreen>>({ queryKey: ['display_device_screens'] })) {
                    if (data?.[p.id]) return data[p.id];
                }
                return null;
            };
            // La TV tarda unos segundos en sacarla y subirla.
            let answered = false;
            for (const wait of [4000, 4000, 5000, 7000]) {
                await new Promise(r => setTimeout(r, wait));
                await queryClient.refetchQueries({ queryKey: ['display_device_screens'] });
                const now = latest();
                if (now?.image_at && now.image_at !== p.before?.image_at) return 'photo';
                if (now?.captured_at && now.captured_at !== p.before?.captured_at) answered = true;
            }
            return answered ? 'no_photo' : 'no_response';
        },
    });
};
