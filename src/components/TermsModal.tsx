import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

export const TermsModal = () => {
    const [open, setOpen] = useState(() => {
        return !localStorage.getItem("termsAccepted");
    });

    const handleAccept = () => {
        localStorage.setItem("termsAccepted", "true");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px] bg-slate-900/95 backdrop-blur-xl border-white/10 text-white" onInteractOutside={(e: Event) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-script text-white">Bienvenido a EventPix</DialogTitle>
                    <DialogDescription className="text-slate-300">
                        Por favor acepta los términos para continuar.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[200px] w-full rounded-md border border-white/10 p-4">
                    <div className="text-sm text-slate-300 space-y-4">
                        <p>
                            Al usar EventPix, aceptas compartir tu imagen y mensajes en la pantalla pública del evento.
                        </p>
                        <p>
                            Nos reservamos el derecho de moderar y rechazar contenido que sea inapropiado, ofensivo o que viole las normas del evento.
                        </p>
                        <p>
                            Tu contenido será visible para todos los asistentes al evento.
                        </p>
                    </div>
                </ScrollArea>
                <div className="flex justify-end pt-4">
                    <Button onClick={handleAccept} className="bg-violet-600 hover:bg-violet-500 text-white">
                        Aceptar y Continuar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
