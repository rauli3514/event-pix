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
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            )}

            <div className="container px-4 py-16 mx-auto max-w-4xl relative z-10">
                <div className="mb-16 text-center space-y-4">
                    <h1 className="text-6xl md:text-7xl font-serif text-foreground tracking-tight">
                        {settings?.title || "EventPix"}
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        {settings?.description || "Captura el momento, comparte la magia"}
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
