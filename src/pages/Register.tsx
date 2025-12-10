import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Building2, ArrowRight } from "lucide-react";

const Register = () => {
    const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        if (formData.password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        account_type: accountType
                    }
                }
            });

            if (error) throw error;

            toast.success("¡Cuenta creada con éxito!");
            // Check if session exists (auto-login) or check email required
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate("/admin");
            } else {
                toast.info("Por favor verifica tu correo para confirmar tu cuenta.");
                navigate("/login");
            }

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-20">
                <div className="absolute top-10 left-10 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
                <div className="absolute top-10 right-10 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
                <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
            </div>

            <Card className="w-full max-w-lg bg-card/50 backdrop-blur-xl border-white/10 shadow-2xl">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">
                        Crear Cuenta
                    </CardTitle>
                    <CardDescription className="text-base text-slate-400">
                        Únete a EventPix y crea experiencias inolvidables
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Account Type Toggle */}
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            onClick={() => setAccountType('personal')}
                            className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-300 ${accountType === 'personal'
                                ? 'border-violet-500 bg-violet-500/10 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                                : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'
                                }`}
                        >
                            <User className={`w-8 h-8 ${accountType === 'personal' ? 'text-violet-400' : 'text-slate-500'}`} />
                            <span className="font-medium">Persona</span>
                            <span className="text-[10px] text-center opacity-70">Para bodas, cumples y fiestas privadas</span>
                        </div>

                        <div
                            onClick={() => setAccountType('business')}
                            className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-300 ${accountType === 'business'
                                ? 'border-fuchsia-500 bg-fuchsia-500/10 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)]'
                                : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'
                                }`}
                        >
                            <Building2 className={`w-8 h-8 ${accountType === 'business' ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                            <span className="font-medium">Empresa</span>
                            <span className="text-[10px] text-center opacity-70">Para organizadores y proveedores de eventos</span>
                        </div>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium ml-1">
                                {accountType === 'personal' ? 'Nombre Completo' : 'Nombre de la Empresa'}
                            </label>
                            <Input
                                type="text"
                                placeholder={accountType === 'personal' ? "Ej. Juan Pérez" : "Ej. Eventos Increíbles SA"}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-black/20 border-white/10 h-12"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium ml-1">Email</label>
                            <Input
                                type="email"
                                placeholder="tu@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="bg-black/20 border-white/10 h-12"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium ml-1">Contraseña</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="bg-black/20 border-white/10 h-12"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium ml-1">Confirmar</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    className="bg-black/20 border-white/10 h-12"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className={`w-full h-12 text-lg font-bold shadow-lg transition-all duration-300 ${accountType === 'personal'
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500'
                                : 'bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500'
                                }`}
                            disabled={loading}
                        >
                            {loading ? "Creando cuenta..." : "Registrarme"} <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </form>

                    <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">
                            ¿Ya tienes cuenta?{' '}
                            <Link to="/login" className="font-bold text-primary hover:underline hover:text-primary/80 transition-colors">
                                Iniciar Sesión
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
};

export default Register;
