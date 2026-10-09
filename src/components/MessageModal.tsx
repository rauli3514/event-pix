import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { useSubmissions } from "@/hooks/use-submissions";
import { getGuestName, saveGuestName } from "@/lib/guestSubmissions";

interface MessageModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId?: string;
}

export const MessageModal = ({ open, onOpenChange, eventId }: MessageModalProps) => {
    const { createSubmission } = useSubmissions(eventId, { list: false });
    const [message, setMessage] = useState("");
    const [name, setName] = useState(getGuestName);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = () => {
        if (!message.trim()) return;

        saveGuestName(name);
        createSubmission.mutate({
            type: 'message',
            content: message,
            author: name.trim() || undefined
        }, {
            onSuccess: () => {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    setMessage("");
                    onOpenChange(false);
                }, 2500);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-slate-900/95 backdrop-blur-xl border-white/10 text-white">
                {showSuccess ? (
                    // Success View
                    <div className="py-8 px-4">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-white">¡Tu mensaje se envió!</h3>
                                <p className="text-slate-300">
                                    Gracias por participar 🥳
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Normal Message View
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-script text-center text-white">Dejar un Mensaje</DialogTitle>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="Tu nombre (opcional)"
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                    className="bg-white/10 border-white/15 text-white placeholder:text-slate-400 focus:border-violet-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <Textarea
                                    placeholder="Escribe tu mensaje aquí..."
                                    value={message}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                                    className="min-h-[150px] bg-white/10 border-white/15 text-white placeholder:text-slate-400 focus:border-violet-400 resize-none"
                                />
                            </div>

                            <Button
                                onClick={handleSubmit}
                                disabled={!message.trim() || createSubmission.isPending}
                                className="w-full bg-violet-600 hover:bg-violet-500 text-white"
                            >
                                {createSubmission.isPending ? (
                                    "Enviando..."
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Enviar Mensaje
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
