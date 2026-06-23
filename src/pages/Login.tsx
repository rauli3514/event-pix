import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const Login = () => {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (supabase.supabaseUrl?.includes('placeholder')) {
            toast.success("Modo Mock: Acceso concedido");
            navigate("/admin/display");
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success("Bienvenido de nuevo");
            navigate("/admin/display");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
            </div>

            <Card className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border-slate-800 shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <CardTitle className="text-3xl font-bold text-white font-[Orbitron] tracking-wide">
                        EventPix <span className="text-blue-500">.</span>
                    </CardTitle>
                    <p className="text-slate-400 text-sm mt-2">Acceso Administrativo</p>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="Correo Electrónico"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all hover:scale-[1.02]"
                            disabled={loading}
                        >
                            {loading ? "Verificando..." : "Ingresar"}
                        </Button>
                    </form>

                    <div className="text-center pt-8">
                        <p className="text-sm text-slate-500">
                            ¿No tienes cuenta?{' '}
                            <Link to="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                                Solicitar acceso
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
