import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trash2, Dices } from "lucide-react";
import { toast } from "sonner";

// LISTA FIJA DE 20 DESAFÍOS (NO EDITABLES DESDE LA UI)
const DESAFIOS = [
    "Sáquense una foto haciendo la cara más divertida que puedan.",
    "Foto de toda la mesa levantando los vasos como brindis.",
    "Selfie grupal donde todos miran para un lado distinto.",
    "Foto imitando una escena dramática de novela.",
    "Foto abrazando a la persona que tengas más cerca.",
    "Selfie grupal sacando la lengua.",
    "Foto de todos haciendo una pose de superhéroes.",
    "Foto de la mesa haciendo como si estuvieran en una montaña rusa.",
    "Selfie de la mesa entera mirando a la cámara con cara de sorpresa.",
    "Foto formando con las manos un corazón hacia la cámara.",
    "Foto de todos tapándose un ojo como piratas.",
    "Selfie grupal haciendo una pose de modelo exagerada.",
    "Foto de la mesa riéndose a carcajadas (aunque sea actuado).",
    "Foto donde todos señalan al invitado más tímido de la mesa.",
    "Selfie de la mesa simulando que están congelados (sin moverse).",
    "Foto de todos haciendo un baile raro frente a la cámara.",
    "Foto recreando una escena famosa de película o serie.",
    "Selfie de la mesa haciendo caras de ‘¡ganamos!’.",
    "Foto donde todos fingen estar hablando por teléfono.",
    "Foto de la mesa formando una fila, uno detrás de otro, mirando a cámara."
];

export const RouletteModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [participants, setParticipants] = useState<string[]>(() => {
        // Cargar participantes guardados al iniciar
        const saved = localStorage.getItem("roulette_participants");
        return saved ? JSON.parse(saved) : [];
    });
    const [newParticipant, setNewParticipant] = useState("");
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState<{ participant: string; challenge: string } | null>(null);

    // Guardar participantes cuando cambian
    useEffect(() => {
        localStorage.setItem("roulette_participants", JSON.stringify(participants));
    }, [participants]);

    const addParticipant = () => {
        if (!newParticipant.trim()) return;
        if (participants.includes(newParticipant.trim())) {
            toast.error("Este participante ya existe");
            return;
        }
        setParticipants([...participants, newParticipant.trim()]);
        setNewParticipant("");
    };

    const removeParticipant = (index: number) => {
        const newParticipants = [...participants];
        newParticipants.splice(index, 1);
        setParticipants(newParticipants);
    };

    const spinRoulette = () => {
        if (participants.length === 0) {
            toast.error("Agrega al menos un jugador o mesa para usar la ruleta.");
            return;
        }

        setIsSpinning(true);
        setResult(null);

        // Animación simple de selección
        setTimeout(() => {
            const randomParticipantIndex = Math.floor(Math.random() * participants.length);
            const randomChallengeIndex = Math.floor(Math.random() * DESAFIOS.length);

            setResult({
                participant: participants[randomParticipantIndex],
                challenge: DESAFIOS[randomChallengeIndex]
            });
            setIsSpinning(false);
        }, 2000); // 2 segundos de "giro"
    };

    return (
        <>
            {/* BOTÓN FLOTANTE (Posición: bottom-8 right-8) */}
            <Button
                className="fixed bottom-8 right-8 z-50 h-16 w-16 rounded-full shadow-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-110 transition-transform duration-300 border-4 border-white"
                onClick={() => setIsOpen(true)}
            >
                <span className="text-3xl">🎰</span>
            </Button>

            {/* MODAL */}
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-background w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Dices className="w-6 h-6 text-purple-500" />
                                Ruleta de Desafíos
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                                <X className="w-6 h-6" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* RESULTADO DEL GIRO */}
                            {result ? (
                                <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 p-8 rounded-xl border border-purple-500/30 text-center space-y-4 animate-scale-in">
                                    <div className="space-y-2">
                                        <p className="text-sm text-purple-300 uppercase tracking-wider font-semibold">Participante Seleccionado</p>
                                        <p className="text-4xl font-bold text-white">{result.participant}</p>
                                    </div>
                                    <div className="h-px w-full bg-white/10 my-4" />
                                    <div className="space-y-2">
                                        <p className="text-sm text-pink-300 uppercase tracking-wider font-semibold">Tu Desafío</p>
                                        <p className="text-2xl text-white font-medium leading-relaxed">"{result.challenge}"</p>
                                    </div>
                                    <Button
                                        onClick={() => setResult(null)}
                                        variant="outline"
                                        className="mt-4 border-white/20 hover:bg-white/10 text-white"
                                    >
                                        Girar de nuevo
                                    </Button>
                                </div>
                            ) : (
                                /* ESTADO INICIAL / GIRANDO */
                                <div className="text-center py-8 space-y-6">
                                    {isSpinning ? (
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-xl font-medium animate-pulse">Eligiendo víctima...</p>
                                        </div>
                                    ) : (
                                        <Button
                                            size="lg"
                                            className="w-full h-20 text-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg transform hover:scale-[1.02] transition-all"
                                            onClick={spinRoulette}
                                        >
                                            🎲 ¡GIRAR RULETA!
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* GESTIÓN DE PARTICIPANTES */}
                            <div className="space-y-4 pt-4 border-t border-border">
                                <h3 className="font-medium text-muted-foreground">Participantes ({participants.length})</h3>

                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nombre del jugador o mesa"
                                        value={newParticipant}
                                        onChange={(e) => setNewParticipant(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                                    />
                                    <Button onClick={addParticipant}>Agregar</Button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2">
                                    {participants.map((p, index) => (
                                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md text-sm group">
                                            <span className="truncate">{p}</span>
                                            <button
                                                onClick={() => removeParticipant(index)}
                                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {participants.length === 0 && (
                                        <p className="col-span-full text-center text-muted-foreground text-sm py-4 italic">
                                            Agrega participantes para comenzar...
                                        </p>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
