import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain } from "lucide-react";

const IntelligenceLogin = () => {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as { from?: string } | null)?.from || "/intelligence";

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        toast.success("Bienvenido a EventPix Intelligence");

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user?.id)
            .maybeSingle();

        navigate(profile?.role === "super_admin" ? "/admin/intelligence" : from);
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
            {/* Fondo decorativo con paleta de Intelligence */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-pink-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
            </div>

            <Card className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border-slate-800 shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-violet-600 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(168,85,247,0.35)]">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white tracking-wide">
                        Intelligence <span className="text-violet-400">by EventPix</span>
                    </CardTitle>
                    <p className="text-slate-400 text-sm mt-2">Analista + Estratega para tu Instagram</p>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="Correo Electrónico"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold h-11 shadow-[0_4px_14px_0_rgba(168,85,247,0.35)] transition-all hover:scale-[1.02]"
                            disabled={loading}
                        >
                            {loading ? "Verificando..." : "Ingresar"}
                        </Button>
                    </form>

                    <div className="text-center pt-6">
                        <p className="text-xs text-slate-500">
                            Acceso exclusivo para clientes de EventPix Intelligence.
                        </p>
                        <Link
                            to="/login"
                            className="inline-block mt-2 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
                        >
                            ¿Buscás Cartelería Digital / Display Hub?
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default IntelligenceLogin;
