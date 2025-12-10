import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Send, CheckCircle2, Trash2 } from "lucide-react";
import { useSubmissions } from "@/hooks/use-submissions";

interface AudioRecorderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId?: string;
}

export const AudioRecorderModal = ({ open, onOpenChange, eventId }: AudioRecorderModalProps) => {
    const { createSubmission } = useSubmissions(eventId);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [name, setName] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!open) {
            resetRecording();
        }
    }, [open]);

    const resetRecording = () => {
        setIsRecording(false);
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
        audioChunksRef.current = [];
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // webm is standard for MediaRecorder
                const audioUrl = URL.createObjectURL(audioBlob);
                setAudioBlob(audioBlob);
                setAudioUrl(audioUrl);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("No se pudo acceder al micrófono. Por favor permite el acceso.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSubmit = () => {
        if (!audioBlob) return;

        // Convert Blob to File
        const file = new File([audioBlob], `audio_message.webm`, { type: 'audio/webm' });

        createSubmission.mutate({
            type: 'audio',
            content: '', // Will be filled by hook with URL
            file: file,
            author: name || 'Invitado'
        }, {
            onSuccess: () => {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    resetRecording();
                    onOpenChange(false);
                }, 2500);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur-xl border-white/10">
                {showSuccess ? (
                    <div className="py-8 px-4">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-secondary">¡Audio enviado!</h3>
                                <p className="text-muted-foreground">
                                    Se escuchará genial 🎤
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-script text-center text-secondary">
                                {isRecording ? "Grabando..." : audioBlob ? "Escuchar y Enviar" : "Grabar Mensaje"}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col items-center gap-6 py-6">

                            {/* Visualizer / Timer Circle */}
                            <div className={`relative h-32 w-32 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${isRecording ? "border-red-500 bg-red-500/10 animate-pulse" : "border-slate-700 bg-slate-900"}`}>
                                {isRecording ? (
                                    <div className="flex flex-col items-center">
                                        <Mic className="h-10 w-10 text-red-500 mb-1" />
                                        <span className="text-xl font-mono text-red-400">{formatTime(recordingTime)}</span>
                                    </div>
                                ) : audioBlob ? (
                                    <Play className="h-12 w-12 text-secondary ml-1" />
                                ) : (
                                    <Mic className="h-12 w-12 text-slate-500" />
                                )}
                            </div>

                            {/* Controls */}
                            <div className="w-full space-y-4">
                                {!audioBlob ? (
                                    isRecording ? (
                                        <Button
                                            onClick={stopRecording}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-lg rounded-xl"
                                        >
                                            <Square className="mr-2 h-5 w-5 fill-current" /> Dejar de Grabar
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={startRecording}
                                            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground h-12 text-lg rounded-xl"
                                        >
                                            <Mic className="mr-2 h-5 w-5" /> Comenzar a Grabar
                                        </Button>
                                    )
                                ) : (
                                    <div className="space-y-4">
                                        {/* Audio Player Preview */}
                                        <audio src={audioUrl!} controls className="w-full" />

                                        <Input
                                            placeholder="Tu nombre (opcional)"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="bg-black/20 border-white/10"
                                        />

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={resetRecording}
                                                className="border-red-900/50 text-red-400 hover:bg-red-950/50"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Descartar
                                            </Button>
                                            <Button
                                                onClick={handleSubmit}
                                                disabled={createSubmission.isPending}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                {createSubmission.isPending ? "Enviando..." : <><Send className="mr-2 h-4 w-4" /> Enviar Audio</>}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
