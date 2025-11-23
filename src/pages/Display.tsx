import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useSubmissions } from "@/hooks/use-submissions";

const Display = () => {
    const { submissions, isLoading } = useSubmissions();
    const approvedContent = submissions.filter(s => s.status === 'approved');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (approvedContent.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % approvedContent.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [approvedContent.length]);

    if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Cargando...</div>;
    if (approvedContent.length === 0) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Esperando contenido aprobado...</div>;

    const currentItem = approvedContent[currentIndex];

    return (
        <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />

            {/* Navigation Overlay (Hidden in fullscreen usually, but visible on hover for demo) */}
            <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
                <NavLink to="/admin">Admin</NavLink>
            </div>

            <div className="relative z-10 w-full max-w-6xl p-8">
                <div className="transition-all duration-500 transform">
                    {currentItem.type === 'photo' ? (
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
                            <img
                                src={currentItem.content}
                                alt="Display"
                                className="w-full h-full object-cover animate-in fade-in zoom-in duration-1000"
                            />
                            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-2xl text-white font-script">{currentItem.author}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-video w-full rounded-2xl flex items-center justify-center bg-card/30 backdrop-blur-xl border border-white/10 p-12 shadow-[0_0_50px_rgba(var(--primary),0.2)]">
                            <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-700">
                                <p className="text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80 mb-8 leading-tight">
                                    "{currentItem.content}"
                                </p>
                                <p className="text-3xl text-primary font-script">- {currentItem.author}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Indicators */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
                    {approvedContent.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-white/20'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Display;
