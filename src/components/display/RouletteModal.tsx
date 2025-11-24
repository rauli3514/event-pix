import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trash2, Dices, Sparkles } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

// LISTA FIJA DE 20 DESAFÍOS
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

const WHEEL_COLORS = [
    "#8b5cf6", // Violeta
    "#ec4899", // Rosa
    "#3b82f6", // Azul
    "#10b981", // Verde
    "#f59e0b", // Amarillo
    "#6366f1", // Índigo
];

export const RouletteModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [participants, setParticipants] = useState<string[]>(() => {
        const saved = localStorage.getItem("roulette_participants");
        return saved ? JSON.parse(saved) : [];
    });
    const [newParticipant, setNewParticipant] = useState("");
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<{ participant: string; challenge: string } | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);

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
        if (isSpinning) return;

        setIsSpinning(true);
        setResult(null);
        setShowResultModal(false);

        // Seleccionar ganador
        const randomIndex = Math.floor(Math.random() * participants.length);
        const selectedParticipant = participants[randomIndex];
        const selectedChallenge = DESAFIOS[Math.floor(Math.random() * DESAFIOS.length)];

        // Calcular rotación:
        // Cada segmento ocupa (360 / N) grados.
        // Queremos que el segmento ganador termine arriba (ángulo 0 o 360).
        // El puntero está arriba.
        const segmentAngle = 360 / participants.length;
        // Vueltas completas (mínimo 5)
        const spins = 360 * 5;
        // Ángulo final: spins + (360 - (index * segmentAngle)) - offset
        // Restamos para girar en sentido horario y que el índice correcto llegue arriba
        const targetRotation = rotation + spins + (360 - (randomIndex * segmentAngle)) + Math.random() * 10; // Random jitter

        setRotation(targetRotation);

        // Tiempo de giro (debe coincidir con CSS transition duration)
        setTimeout(() => {
            setIsSpinning(false);
            setResult({ participant: selectedParticipant, challenge: selectedChallenge });
            setShowResultModal(true);
            triggerConfetti();
        }, 5000);
    };

    const triggerConfetti = () => {
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: WHEEL_COLORS
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: WHEEL_COLORS
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    return (
        <>
            {/* BOTÓN FLOTANTE */}
            <Button
                className="fixed bottom-8 right-8 z-50 h-16 w-16 rounded-full shadow-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-110 transition-transform duration-300 border-4 border-white"
                onClick={() => setIsOpen(true)}
            >
                <span className="text-3xl">🎰</span>
            </Button>

            {/* MODAL PRINCIPAL */}
            {isOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 animate-fade-in">
                    {/* Contenedor ajustado para no tapar Header/Footer visualmente si fuera necesario, aunque z-index ya maneja la superposición */}
                    <div className="w-full max-w-6xl h-full max-h-[80vh] flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center relative mt-[5vh]">

                        {/* Botón Cerrar */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 text-white hover:bg-white/10 z-50"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="w-8 h-8" />
                        </Button>

                        {/* ZONA IZQUIERDA: RULETA */}
                        <div className="flex-1 flex flex-col items-center justify-center relative w-full max-w-[500px] aspect-square shrink-0">
                            {/* Puntero */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 w-10 h-14 filter drop-shadow-md">
                                <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-white" />
                            </div>

                            {/* Rueda - Optimizada sin sombras excesivas */}
                            <div
                                className="w-full h-full rounded-full border-[8px] border-white shadow-xl relative overflow-hidden transition-transform duration-[5000ms] cubic-bezier(0.15, 0, 0.15, 1) will-change-transform"
                                style={{ transform: `rotate(${rotation}deg)` }}
                            >
                                {participants.length > 0 ? (
                                    participants.map((p, i) => {
                                        const angle = 360 / participants.length;
                                        const rotate = i * angle;
                                        const skew = 90 - angle;
                                        const color = WHEEL_COLORS[i % WHEEL_COLORS.length];

                                        if (participants.length === 1) return (
                                            <div key={i} className="absolute inset-0 flex items-center justify-center bg-violet-600 text-white font-bold text-2xl">
                                                {p}
                                            </div>
                                        );

                                        return (
                                            <div
                                                key={i}
                                                className="absolute top-0 right-0 w-[50%] h-[50%] origin-bottom-left"
                                                style={{
                                                    transform: `rotate(${rotate}deg) skewY(-${skew}deg)`,
                                                    background: color,
                                                }}
                                            >
                                                <div
                                                    className="absolute left-0 bottom-0 flex items-center justify-start origin-bottom-left"
                                                    style={{
                                                        width: '100%',
                                                        height: '40px',
                                                        transform: `skewY(${skew}deg) rotate(${angle / 2}deg) translate(0, -50%)`,
                                                        paddingLeft: '60px', // Alejar del centro
                                                    }}
                                                >
                                                    <span className="text-white font-bold text-lg md:text-xl truncate max-w-[160px] drop-shadow-md">
                                                        {p}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 font-medium">
                                        Agrega participantes
                                    </div>
                                )}
                            </div>

                            {/* Centro de la rueda */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-10">
                                <Dices className="w-6 h-6 text-violet-600" />
                            </div>
                        </div>

                        {/* ZONA DERECHA: CONTROLES Y RESULTADO */}
                        <div className="w-full md:w-1/3 flex flex-col gap-4 max-h-full overflow-hidden">

                            {/* Panel de Resultado (Overlay) */}
                            {showResultModal && result && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-xl animate-in fade-in zoom-in duration-300">
                                    <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/20 shadow-2xl text-center max-w-md mx-4 relative overflow-hidden">
                                        <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />

                                        <h3 className="text-violet-200 text-lg font-bold uppercase tracking-widest mb-2">¡Tenemos un ganador!</h3>
                                        <p className="text-4xl md:text-5xl font-bold text-white mb-8 drop-shadow-md">{result.participant}</p>

                                        <div className="bg-black/30 p-6 rounded-xl border border-white/10 mb-8">
                                            <p className="text-sm text-pink-300 font-bold uppercase mb-2">Desafío</p>
                                            <p className="text-xl text-white font-medium leading-relaxed">"{result.challenge}"</p>
                                        </div>

                                        <Button
                                            size="lg"
                                            onClick={() => setShowResultModal(false)}
                                            className="w-full bg-white text-violet-900 hover:bg-violet-50 font-bold text-lg h-14 rounded-xl"
                                        >
                                            Continuar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Controles */}
                            <div className="bg-slate-900/80 p-6 rounded-2xl border border-white/10 space-y-4">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold text-white mb-1">Ruleta de Desafíos</h2>
                                    <p className="text-slate-400 text-sm">¡Gira la rueda y que la suerte decida!</p>
                                </div>

                                <Button
                                    size="lg"
                                    className={`w-full h-14 text-xl font-bold rounded-xl shadow-md transition-all ${isSpinning
                                        ? "bg-slate-700 cursor-not-allowed opacity-80"
                                        : "bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.01]"
                                        }`}
                                    onClick={spinRoulette}
                                    disabled={isSpinning || participants.length === 0}
                                >
                                    {isSpinning ? "Girando..." : "¡GIRAR AHORA!"}
                                </Button>

                                {/* Lista de Participantes */}
                                <div className="space-y-3 pt-4 border-t border-white/10">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Nuevo participante..."
                                            value={newParticipant}
                                            onChange={(e) => setNewParticipant(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                                            className="bg-slate-800 border-slate-700 text-white"
                                        />
                                        <Button onClick={addParticipant} variant="secondary">Agregar</Button>
                                    </div>

                                    <div className="max-h-[150px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {participants.map((p, index) => (
                                            <div key={index} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5 group hover:border-white/20 transition-colors">
                                                <span className="text-slate-200 font-medium truncate">{p}</span>
                                                <button
                                                    onClick={() => removeParticipant(index)}
                                                    className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {participants.length === 0 && (
                                            <p className="text-center text-slate-500 text-sm py-4 italic">
                                                Agrega participantes para comenzar
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
