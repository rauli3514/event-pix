import { useState } from "react";
import { EventCard } from "@/components/EventCard";
import { UploadModal } from "@/components/UploadModal";
import { MessageModal } from "@/components/MessageModal";
import { TermsModal } from "@/components/TermsModal";

const Index = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
            {/* Decorative Elements */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-20 right-10 w-64 h-64 bg-secondary/20 rounded-full blur-[100px] animate-pulse delay-1000" />

            {/* Butterflies */}
            <div className="absolute top-1/4 left-10 w-16 h-16 animate-float opacity-80 pointer-events-none">
                {/* Placeholder for butterfly-purple */}
                <div className="w-full h-full bg-secondary/50 rounded-full blur-sm" />
            </div>
            <div className="absolute bottom-1/3 right-10 w-12 h-12 animate-float opacity-80 pointer-events-none" style={{ animationDelay: "1.5s" }}>
                {/* Placeholder for butterfly-teal */}
                <div className="w-full h-full bg-primary/50 rounded-full blur-sm" />
            </div>

            <div className="container px-4 py-8 mx-auto relative z-10 min-h-screen flex flex-col items-center justify-center">
                <div className="mb-8 text-center">
                    <h1 className="text-5xl md:text-7xl font-script text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-secondary mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                        EventPix
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                        Captura el momento, comparte la magia
                    </p>
                </div>

                <EventCard
                    onUploadClick={() => setUploadOpen(true)}
                    onMessageClick={() => setMessageOpen(true)}
                />
            </div>

            <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
            <MessageModal open={messageOpen} onOpenChange={setMessageOpen} />
            <TermsModal />
        </div>
    );
};

export default Index;
