import { useState } from "react";
import { EventCard } from "@/components/EventCard";
import { UploadModal } from "@/components/UploadModal";
import { MessageModal } from "@/components/MessageModal";
import { TermsModal } from "@/components/TermsModal";
import { useEventSettings } from "@/hooks/use-event-settings";

const Index = () => {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [messageOpen, setMessageOpen] = useState(false);
    const { data: settings } = useEventSettings();

    return (
        <div
            className="min-h-screen bg-background bg-cover bg-center bg-no-repeat relative"
            style={settings?.background_image_url ? { backgroundImage: `url(${settings.background_image_url})` } : {}}
        >
            {settings?.background_image_url && (
                <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/90 to-white/95 backdrop-blur-sm" />
            )}

            <div className="container px-4 min-h-screen flex items-center justify-center relative z-10 py-12">
                <div className="w-full max-w-md mx-auto">
                    <EventCard
                        onUploadClick={() => setUploadOpen(true)}
                        onMessageClick={() => setMessageOpen(true)}
                    />
                </div>
            </div>

            <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
            <MessageModal open={messageOpen} onOpenChange={setMessageOpen} />
            <TermsModal />
        </div>
    );
};

export default Index;
