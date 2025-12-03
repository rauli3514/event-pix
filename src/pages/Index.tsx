import { useState } from "react";
import { useEvent } from "@/context/EventContext";
import { useParams } from "react-router-dom";
import { EventCard } from "@/components/EventCard";
import { UploadModal } from "@/components/UploadModal";
import { MessageModal } from "@/components/MessageModal";
import { TermsModal } from "@/components/TermsModal";
import { ChallengeRoulette } from "@/components/ChallengeRoulette";
import { SplashScreen } from "@/components/SplashScreen";
import { PhotoBoothModal } from "@/components/PhotoBoothModal";
import { useEventSettings } from "@/hooks/use-event-settings";
import { FaWhatsapp, FaInstagram, FaTiktok } from "react-icons/fa";

const Index = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);

    // Estados para Photo Booth
    const [photoBoothOpen, setPhotoBoothOpen] = useState(false);
    const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

    const { event, isLoading, error } = useEvent();
    const { data: settings } = useEventSettings(event?.id);
    const params = useParams<{ slug?: string }>();

    if (isLoading) return <SplashScreen />;
    if (error || !event) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200">
                <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-xl">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Evento No Encontrado</h1>
                    <p className="text-slate-600 mb-4">
                        No pudimos encontrar el evento: <span className="font-mono bg-slate-100 px-2 py-1 rounded">{params.slug || '(sin slug)'}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                        Verifica que la URL sea correcta o contacta al administrador del evento.
                    </p>
                </div>
            </div>
        );
    }

    const handleUploadSuccess = (photoUrl: string) => {
        // Solo abrir Photo Booth si está habilitado y hay un marco configurado
        if (settings?.photo_booth_enabled && settings?.photobooth_frame_url) {
            setUploadedPhotoUrl(photoUrl);
            // Pequeño delay para que la transición del modal de éxito sea suave
            setTimeout(() => {
                setPhotoBoothOpen(true);
            }, 2000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-blue-50 z-0" />

            {/* Header */}
            <header className="relative z-10 pt-8 pb-4 text-center animate-fade-in-down">
                <h1 className="text-3xl font-bold tracking-tight text-violet-900 font-sans">EventPix</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">by Tecno Eventos</p>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative z-10 container px-4 flex items-center justify-center py-6">
                <div className="w-full max-w-md mx-auto animate-fade-in-up">
                    {event.status === 'active' ? (
                        <EventCard
                            onUploadClick={() => setUploadOpen(true)}
                            onMessageClick={() => setMessageOpen(true)}
                            eventId={event.id}
                        />
                    ) : (
                        <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-200">
                            <h2 className="text-2xl font-bold text-slate-800 mb-4">Evento Finalizado</h2>
                            <p className="text-slate-600">Muchas gracias por participar en {event.name}.</p>
                            <p className="text-slate-500 mt-2 text-sm">Ya no se aceptan nuevas fotos ni mensajes.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-6 bg-white/60 backdrop-blur-md border-t border-slate-100">
                <div className="container px-4 mx-auto text-center space-y-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Tecno Eventos – Servicios interactivos para eventos</p>
                    <div className="flex justify-center gap-8">
                        <a href="https://wa.me/543624547382" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-500 transition-colors transform hover:scale-110 duration-300">
                            <FaWhatsapp size={24} />
                        </a>
                        <a href="https://www.instagram.com/tecno_eventos_arg/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-500 transition-colors transform hover:scale-110 duration-300">
                            <FaInstagram size={24} />
                        </a>
                        <a href="https://www.tiktok.com/@tecno_eventos_arg?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-black transition-colors transform hover:scale-110 duration-300">
                            <FaTiktok size={24} />
                        </a>
                    </div>
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
                    <ChallengeRoulette onOpenCamera={() => setUploadOpen(true)} />

                    {/* Photo Booth Modal - Solo si hay marco configurado */}
                    {uploadedPhotoUrl && settings?.photobooth_frame_url && (
                        <PhotoBoothModal
                            isOpen={photoBoothOpen}
                            onClose={() => setPhotoBoothOpen(false)}
                            photoUrl={uploadedPhotoUrl}
                            frameUrl={settings.photobooth_frame_url}
                        />
                    )}
                </>
            )}
            <TermsModal />
        </div>
    );
};

export default Index;
