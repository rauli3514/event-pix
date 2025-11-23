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
import { Send } from "lucide-react";
import { useSubmissions } from "@/hooks/use-submissions";

interface MessageModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const MessageModal = ({ open, onOpenChange }: MessageModalProps) => {
    const { createSubmission } = useSubmissions();
    const [message, setMessage] = useState("");
    const [name, setName] = useState("");

    const handleSubmit = () => {
        if (!message.trim()) return;

        createSubmission.mutate({
            type: 'message',
            content: message,
            author: name || 'Invitado'
        }, {
            onSuccess: () => {
                setMessage("");
                setName("");
                onOpenChange(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-script text-center text-secondary">Dejar un Mensaje</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Input
                            placeholder="Tu nombre (opcional)"
                            value={name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            className="bg-black/20 border-white/10 focus:border-secondary/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Textarea
                            placeholder="Escribe tu mensaje aquí..."
                            value={message}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                            className="min-h-[150px] bg-black/20 border-white/10 focus:border-secondary/50 resize-none"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={!message.trim() || createSubmission.isPending}
                        className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
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
            </DialogContent>
        </Dialog>
    );
};
