import { useState } from "react";
import { EventCard } from "@/components/EventCard";
import { UploadModal } from "@/components/UploadModal";
import { MessageModal } from "@/components/MessageModal";
import { TermsModal } from "@/components/TermsModal";
import { FaWhatsapp, FaInstagram, FaTiktok } from "react-icons/fa";

const Index = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-blue-50 z-0" />

            {/* Header */}
            <header className="relative z-10 pt-8 pb-4 text-center animate-fade-in-down">
                <h1 className="text-3xl font-bold tracking-tight text-violet-900 font-serif">EventPix</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">by Tecno Eventos</p>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative z-10 container px-4 flex items-center justify-center py-6">
                <div className="w-full max-w-md mx-auto animate-fade-in-up">
                    <EventCard
                        onUploadClick={() => setUploadOpen(true)}
                        onMessageClick={() => setMessageOpen(true)}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-6 bg-white/60 backdrop-blur-md border-t border-slate-100">
                <div className="container px-4 mx-auto text-center space-y-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Tecno Eventos – Servicios interactivos para eventos</p>
                    <div className="flex justify-center gap-8">
                        <a href="#" className="text-slate-400 hover:text-green-500 transition-colors transform hover:scale-110 duration-300">
                            <FaWhatsapp size={24} />
                        </a>
                        <a href="#" className="text-slate-400 hover:text-pink-500 transition-colors transform hover:scale-110 duration-300">
                            <FaInstagram size={24} />
                        </a>
                        <a href="#" className="text-slate-400 hover:text-black transition-colors transform hover:scale-110 duration-300">
                            <FaTiktok size={24} />
                        </a>
                    </div>
                </div>
            </footer>

            <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
            <MessageModal open={messageOpen} onOpenChange={setMessageOpen} />
            <TermsModal />
        </div>
    );
};

export default Index;
