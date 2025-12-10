import { useEventSettings } from '@/hooks/use-event-settings';
import { useEvent } from '@/context/EventContext';

export const SplashScreen = () => {
    const { event } = useEvent();
    const { data: settings } = useEventSettings(event?.id);

    // No mostrar si está deshabilitado o no hay logo
    if (!settings?.show_splash_logo) return null;

    const DEFAULT_BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 ${settings?.font_family || 'font-sans'} transition-opacity duration-1000`}>
            {/* Fondo de pantalla completa (Theme Background) */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                    src={settings?.background_image_url || DEFAULT_BACKGROUND_IMAGE}
                    alt="Background"
                    className="w-full h-full object-cover scale-105"
                />
                {/* Overlay más sutil y elegante para que se vea el tema */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
            </div>

            {/* Contenido Central */}
            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700 ease-out">
                {/* Logo Circular (Party Image) */}
                {settings?.splash_logo_url && (
                    <div className="relative group">
                        {/* Efecto de brillo detrás del logo */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full opacity-70 blur-md group-hover:opacity-100 transition duration-1000 animate-pulse"></div>

                        <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full bg-black/20 backdrop-blur-xl p-1.5 shadow-2xl ring-1 ring-white/20">
                            <img
                                src={settings.splash_logo_url}
                                alt="Logo del evento"
                                className="w-full h-full object-cover rounded-full shadow-inner"
                            />
                        </div>
                    </div>
                )}

                {/* Texto opcional o solo loading */}
                {settings?.title && (
                    <h1 className="mt-8 text-3xl md:text-5xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] tracking-tight text-center px-4">
                        {settings.title}
                    </h1>
                )}

                {/* Indicador de carga ultra-minimalista */}
                <div className="mt-10 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-bounce"></div>
                </div>
            </div>
        </div>
    );
};
