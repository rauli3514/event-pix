import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Dices, Camera, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface ChallengeRouletteProps {
    onOpenCamera: () => void;
}

const CHALLENGES = [
    "📸 Selfie con los novios/homenajeados",
    "🍹 Foto del trago más rico de la noche",
    "🤪 La cara más graciosa que puedas hacer",
    "💃 Foto bailando en la pista (sin vergüenza)",
    "🥂 Un brindis épico con amigos",
    "👯‍♀️ Foto grupal (mínimo 5 personas)",
    "💋 Beso a la cámara",
    "👔 El mejor outfit de la fiesta",
    "😲 Cara de sorpresa exagerada",
    "🤳 Selfie con alguien que acabas de conocer"
];

export const ChallengeRoulette = ({ onOpenCamera }: ChallengeRouletteProps) => {
    const [open, setOpen] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [currentChallenge, setCurrentChallenge] = useState(CHALLENGES[0]);
    const [finalChallenge, setFinalChallenge] = useState<string | null>(null);

    const spin = () => {
        setIsSpinning(true);
        setFinalChallenge(null);

        let duration = 2000; // 2 segundos de giro
        let intervalTime = 50;
        let elapsed = 0;

        const interval = setInterval(() => {
            const random = Math.floor(Math.random() * CHALLENGES.length);
            setCurrentChallenge(CHALLENGES[random]);
            elapsed += intervalTime;

            if (elapsed >= duration) {
                clearInterval(interval);
                setIsSpinning(false);
                const final = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
                setFinalChallenge(final);
                setCurrentChallenge(final);
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    zIndex: 9999
                });
            }
        }, intervalTime);
    };

    const handleAccept = () => {
        setOpen(false);
        // Pequeño delay para que cierre el modal antes de abrir la cámara
        setTimeout(() => {
            onOpenCamera();
        }, 300);
    };

    return (
        <>
            {/* Botón Flotante para abrir la ruleta */}
            <div className="fixed bottom-24 right-4 z-40 md:bottom-8 md:right-8">
                <Button
                    onClick={() => setOpen(true)}
                    className="h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:scale-110 transition-transform border-2 border-white animate-bounce-slow"
                >
                    <Dices className="h-8 w-8 text-white" />
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-violet-200">
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl font-bold text-violet-900 flex items-center justify-center gap-2">
                            <Sparkles className="text-yellow-500" />
                            Ruleta de Desafíos
                            <Sparkles className="text-yellow-500" />
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">

                        {/* Área del Desafío */}
                        <div className={`
                            w-full p-6 rounded-2xl border-4 border-dashed transition-all duration-300
                            ${finalChallenge
                                ? "bg-violet-50 border-violet-400 scale-105 shadow-lg"
                                : "bg-slate-50 border-slate-200"}
                        `}>
                            <p className={`text-xl md:text-2xl font-medium transition-all ${isSpinning ? "blur-sm opacity-50" : "opacity-100"}`}>
                                {currentChallenge}
                            </p>
                        </div>

                        {/* Botones de Acción */}
                        {!finalChallenge ? (
                            <Button
                                onClick={spin}
                                disabled={isSpinning}
                                size="lg"
                                className="w-full text-lg font-bold bg-violet-600 hover:bg-violet-700 h-14 rounded-xl shadow-lg shadow-violet-200"
                            >
                                {isSpinning ? "Girando..." : "🎲 ¡Girar Ruleta!"}
                            </Button>
                        ) : (
                            <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-4">
                                <Button
                                    onClick={handleAccept}
                                    size="lg"
                                    className="w-full text-lg font-bold bg-green-500 hover:bg-green-600 h-14 rounded-xl shadow-lg shadow-green-200"
                                >
                                    <Camera className="mr-2 h-5 w-5" /> ¡Acepto el Reto!
                                </Button>
                                <Button
                                    onClick={spin}
                                    variant="ghost"
                                    className="w-full text-slate-500 hover:text-violet-600"
                                >
                                    Girar de nuevo
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
