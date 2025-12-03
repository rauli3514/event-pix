import { useEventSettings } from '@/hooks/use-event-settings';
import { useEvent } from '@/context/EventContext';

export const SplashScreen = () => {
    const { event } = useEvent();
    const { data: settings } = useEventSettings(event?.id);

    // No mostrar si está deshabilitado o no hay logo
    if (!settings?.show_splash_logo) return null;

    const logoUrl = settings.splash_logo_url ?? settings.background_image_url ?? '/event-hero.jpg';

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-violet-900 via-slate-900 to-black z-50">
            {/* Logo animado */}
            <div className="animate-fade-in-up">
                <img
                    src={logoUrl}
                    alt="Logo del evento"
                    className="max-h-[40vh] max-w-[80vw] object-contain drop-shadow-2xl animate-pulse-slow"
                />
            </div>

            {/* Texto de carga */}
            <div className="mt-8 flex flex-col items-center gap-4 animate-fade-in">
                <div className="flex gap-2">
                    <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-white text-lg font-medium tracking-wide">Cargando evento...</p>
            </div>
        </div>
    );
};
