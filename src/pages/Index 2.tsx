import { useState } from "react";
import { useEvent } from "@/context/EventContext";
import { useParams } from "react-router-dom";
import { EventCard } from "@/components/EventCard";
import { UploadModal } from "@/components/UploadModal";
import { MessageModal } from "@/components/MessageModal";
import { AudioRecorderModal } from "@/components/AudioRecorderModal";
import { TermsModal } from "@/components/TermsModal";
import { ChallengeRoulette } from "@/components/ChallengeRoulette";
import { SplashScreen } from "@/components/SplashScreen";
import { PhotoBoothModal } from "@/components/PhotoBoothModal";
import { TriviaGuestView } from "@/components/trivia/TriviaGuestView";
import { PhotoBattleView } from "@/components/photovote/PhotoBattleView";
import { useEventSettings } from "@/hooks/use-event-settings";
import { FaWhatsapp, FaInstagram, FaTiktok } from "react-icons/fa";
import { Button } from "@/components/ui/button";

const Index = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);
    const [audioOpen, setAudioOpen] = useState(false);

    // Estados para Photo Booth
    const [photoBoothOpen, setPhotoBoothOpen] = useState(false);
    const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

    const { event, isLoading, error } = useEvent();
    const { data: settings } = useEventSettings(event?.id);
    const params = useParams<{ slug?: string }>();

    if (isLoading) {
        if (settings?.show_splash_logo) {
            return <SplashScreen />;
        }
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            </div>
        );
    }
    if (error || !event) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-black text-white">
                <div className="text-center max-w-md bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white/10">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold mb-2">Evento No Encontrado</h1>
                    <p className="text-slate-300 mb-4">
                        No pudimos encontrar el evento: <span className="font-mono bg-white/10 px-2 py-1 rounded">{params.slug || '(sin slug)'}</span>
                    </p>
                    <p className="text-sm text-slate-400 mb-6">
                        Verifica que la URL sea correcta o contacta al administrador del evento.
                    </p>
                    <Button 
                        onClick={() => {
                            const w = window as any;
                            if (w.caches) {
                                w.caches.keys().then((names: string[]) => Promise.all(names.map((name: string) => w.caches.delete(name))))
                                .then(() => window.location.reload());
                            } else {
                                window.location.reload();
                            }
                        }}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold h-12"
                    >
                        Limpiar Caché y Recargar App
                    </Button>
                </div>
            </div>
        );
    }

    const handleUploadSuccess = (photoUrl: string) => {
        // Solo abrir Photo Booth si está habilitado en los ajustes
        if (settings?.photo_booth_enabled) {
            setUploadedPhotoUrl(photoUrl);
            // Pequeño delay para que la transición del modal de éxito sea suave
            setTimeout(() => {
                setPhotoBoothOpen(true);
            }, 2000);
        }
    };

    const DEFAULT_BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

    return (
        <div className={`min-h-screen bg-slate-950 flex flex-col relative overflow-hidden ${settings?.font_family || 'font-sans'}`}>
            {/* Full Screen Background Skin (Custom or Default) */}
            <div className="absolute inset-0 z-0">
                <img
                    src={settings?.background_image_url || DEFAULT_BACKGROUND_IMAGE}
                    alt="Background"
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
            </div>



            {/* Main Content */}
            <main className="flex-1 relative z-10 container px-4 flex flex-col items-center justify-center py-6">
                <div className="w-full max-w-md mx-auto animate-fade-in-up">
                    {event.status === 'active' ? (
                        <>
                            {/* Los juegos dinámicos aparecen encima cuando están activos */}
                            <TriviaGuestView eventId={event.id} />
                            <PhotoBattleView eventId={event.id} />

                            <EventCard
                                onUploadClick={() => setUploadOpen(true)}
                                onMessageClick={() => setMessageOpen(true)}
                                onAudioClick={() => setAudioOpen(true)}
                                eventId={event.id}
                            />
                        </>
                    ) : (
                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl text-center border border-white/10 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-4">Evento Finalizado</h2>
                            <p className="text-slate-300">Muchas gracias por participar en {event.name}.</p>
                            <p className="text-slate-400 mt-2 text-sm">Ya no se aceptan nuevas fotos ni mensajes.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Promo Banner (bottom) */}
            {/* Promo Banner (bottom) */}
            {(settings?.promo_banner_enabled ?? true) && (
                <div className="relative z-10 w-full max-w-md mx-auto mb-4 px-4">
                    <a
                        href={settings?.promo_banner_link || undefined}
                        target={settings?.promo_banner_link ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className={`block transition-transform hover:scale-[1.02] ${settings?.promo_banner_link ? 'cursor-pointer' : 'cursor-default'}`}
                        onClick={(e) => !settings?.promo_banner_link && e.preventDefault()}
                    >
                        {settings?.promo_banner_url ? (
                            <img
                                src={settings.promo_banner_url}
                                className="w-full rounded-2xl shadow-lg object-contain"
                            />
                        ) : (
                            <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-orange-500 rounded-2xl p-4 shadow-lg text-white flex items-center justify-between animate-gradient-x">
                                <div className="flex-1 text-center">
                                    <p className="text-xs font-bold uppercase tracking-wider text-pink-100 mb-1">¡Ganá un EventPix!</p>
                                    <p className="font-bold text-sm leading-tight">📸 Sacale una foto a tu foto, subila y etiquetanos <span className="underline">@eventpix</span></p>
                                </div>
                            </div>
                        )}
                    </a>
                </div>
            )}

            {/* Footer */}
            <footer className="relative z-10 py-6 text-center space-y-4 bg-black/20 backdrop-blur-sm -mx-4 px-4">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Vive la experiencia EventPix</p>
                <div className="flex justify-center gap-8">
                    <a href="https://wa.me/543624547382" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-green-400 transition-colors transform hover:scale-110 duration-300">
                        <FaWhatsapp size={24} />
                    </a>
                    <a href="https://www.instagram.com/tecno_eventos_arg/" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-pink-500 transition-colors transform hover:scale-110 duration-300">
                        <FaInstagram size={24} />
                    </a>
                    <a href="https://www.tiktok.com/@tecno_eventos_arg" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-cyan-400 transition-colors transform hover:scale-110 duration-300">
                        <FaTiktok size={24} />
                    </a>
                </div>
            </footer>

            {event.status === 'active' && (
                <>
                    <UploadModal
                        open={uploadOpen}
                        onOpenChange={setUploadOpen}
                        eventId={event.id}
                        onSuccess={handleUploadSuccess}
                    />
                    <MessageModal open={messageOpen} onOpenChange={setMessageOpen} eventId={event.id} />
                    <AudioRecorderModal open={audioOpen} onOpenChange={setAudioOpen} eventId={event.id} />
                    <ChallengeRoulette onOpenCamera={() => setUploadOpen(true)} />

                    {/* Photo Booth Modal */}
                    {uploadedPhotoUrl && (
                        <PhotoBoothModal
                            isOpen={photoBoothOpen}
                            onClose={() => setPhotoBoothOpen(false)}
                            photoUrl={uploadedPhotoUrl}
                            frameUrl={settings?.photobooth_frame_url}
                            themeBackgroundUrl={settings?.background_image_url}
                            eventName={event.name}
                            aiGenerationEnabled={settings?.ai_generation_enabled ?? false}
                        />
                    )}
                </>
            )}
            <TermsModal />
        </div>
    );
};

export default Index;

