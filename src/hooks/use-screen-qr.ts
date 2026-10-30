import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ScreenQr } from '@/lib/qr';

// Avisa a las TVs que vuelvan a leer su QR (no lleva datos: no hace falta firmarlo).
async function notifyScreens(deviceCodes: string[]) {
    await Promise.all(deviceCodes.map(async code => {
        const channel = supabase.channel(`device:${code}`);
        try {
            await channel.httpSend('command', { action: 'qr' });
        } catch {
            // Si no responde, lo toma en su próxima consulta (2 minutos).
        } finally {
            supabase.removeChannel(channel);
        }
    }));
}

export class MissingQrColumnError extends Error {}

// Pone (o saca, con null) el QR fijo de una o varias pantallas.
export const useSetScreenQr = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ screens, qr }: { screens: { id: string; device_id: string }[]; qr: ScreenQr | null }) => {
            if (screens.length === 0) return;
            const { error } = await supabase
                .from('display_devices')
                .update({ qr_overlay: qr })
                .in('id', screens.map(s => s.id));
            if (error) {
                // La columna todavía no existe: falta correr el SQL.
                if (/qr_overlay/.test(error.message || '')) throw new MissingQrColumnError(error.message);
                throw error;
            }
            await notifyScreens(screens.map(s => s.device_id));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['display_devices'] });
            queryClient.invalidateQueries({ queryKey: ['display_device'] });
        },
    });
};
