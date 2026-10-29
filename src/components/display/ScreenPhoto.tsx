import { type ReactNode, useEffect, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type DeviceScreen, screenImageSrc, useRequestScreenshot } from '@/hooks/use-device-screens';
import { formatDownFor } from '@/lib/screenAlerts';

// Más vieja que esto no se muestra (mejor la miniatura del contenido).
const MAX_PHOTO_AGE_MS = 24 * 60 * 60 * 1000;

interface Props {
    device: { id: string; device_id: string; derived_status?: string };
    screen?: DeviceScreen | null;
    // Lo que se muestra si no hay foto.
    fallback: ReactNode;
    // Lo que va encima de la foto (link, etiquetas…).
    children?: ReactNode;
    className?: string;
}

// Foto real de lo que se ve en la TV (la manda la app cada 5 minutos), con la
// hora y un botón para pedir una nueva.
export function ScreenPhoto({ device, screen, fallback, children, className = '' }: Props) {
    const request = useRequestScreenshot();
    const online = device.derived_status === 'online';
    const src = screenImageSrc(screen);
    // Hora actual, renovada cada 30 s para que "hace X min" se mantenga al día.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, []);
    const ageMs = screen?.image_at ? Math.max(0, now - new Date(screen.image_at).getTime()) : Infinity;
    const showPhoto = !!src && ageMs < MAX_PHOTO_AGE_MS;

    const refresh = async () => {
        try {
            const result = await request.mutateAsync({ id: device.id, device_id: device.device_id, before: screen });
            if (result === 'no_photo') toast.info('Esta pantalla todavía no puede mandar fotos: actualizá la app del TV desde los detalles del equipo.');
            if (result === 'no_response') toast.error('La pantalla no respondió. Fijate que esté prendida y con internet.');
        } catch {
            toast.error('No se pudo pedir la foto. Probá de nuevo.');
        }
    };

    return (
        <div className={`relative overflow-hidden bg-zinc-900 ${className}`}>
            {showPhoto
                ? <img src={src!} alt="Lo que se ve ahora en la pantalla" className={`absolute inset-0 w-full h-full object-contain ${online ? '' : 'grayscale opacity-60'}`} />
                : fallback}
            {children}
            {showPhoto && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/65 px-2 py-0.5 text-xs font-medium text-white pointer-events-none">
                    <Camera className="w-3 h-3" /> Foto real · {ageMs < 60_000 ? 'recién' : formatDownFor(ageMs)}
                </span>
            )}
            {online && (
                <button
                    type="button"
                    onClick={refresh}
                    disabled={request.isPending}
                    title="Sacar una foto nueva de la pantalla"
                    className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white hover:bg-black/80 disabled:opacity-80"
                >
                    {request.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    {request.isPending ? 'Sacando foto…' : 'Ver ahora'}
                </button>
            )}
        </div>
    );
}
