import { useState } from "react";
import { useEvent } from "@/context/EventContext";
import { EventCard } from "@/components/EventCard";
import { UploadModal } from "@/components/UploadModal";
import { MessageModal } from "@/components/MessageModal";
import { TermsModal } from "@/components/TermsModal";
import { FaWhatsapp, FaInstagram, FaTiktok } from "react-icons/fa";

const Index = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);
    const { event, isLoading, error } = useEvent();

    if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando evento...</div>;
    if (error || !event) return <div className="min-h-screen flex items-center justify-center text-slate-500">Evento no encontrado</div>;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-blue-50 z-0" />

            {/* Header */}
            <header className="relative z-10 pt-8 pb-4 text-center animate-fade-in-down">
                <h1 className="text-3xl font-bold tracking-tight text-violet-900 font-sans">{event.name}</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">by EventPix</p>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative z-10 container px-4 flex items-center justify-center py-6">
                <div className="w-full max-w-md mx-auto animate-fade-in-up">
                    {event.status === 'active' ? (
                        <EventCard
                            onUploadClick={() => setUploadOpen(true)}
                            onMessageClick={() => setMessageOpen(true)}
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
                        {/* Reemplaza con tu número de WhatsApp (ej: https://wa.me/5491112345678) */}
                        <a href="https://wa.me/543624547382" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-500 transition-colors transform hover:scale-110 duration-300">
                            <FaWhatsapp size={24} />
                        </a>
                        {/* Reemplaza con tu perfil de Instagram */}
                        <a href="https://www.instagram.com/tecno_eventos_arg/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-500 transition-colors transform hover:scale-110 duration-300">
                            <FaInstagram size={24} />
                        </a>
                        {/* Reemplaza con tu perfil de TikTok */}
                        <a href="https://www.tiktok.com/@tecno_eventos_arg?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-black transition-colors transform hover:scale-110 duration-300">
                            <FaTiktok size={24} />
                        </a>
                    </div>
                </div>
            </footer>

            {event.status === 'active' && (
                <>
                    <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} eventId={event.id} />
                    <MessageModal open={messageOpen} onOpenChange={setMessageOpen} eventId={event.id} />
                </>
            )}
            <TermsModal />
        </div>
    );
};

export default Index;
