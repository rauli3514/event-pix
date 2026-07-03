import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MonitorPlay, LogIn, Lock, Mail } from "lucide-react";

export default function DisplayUserLogin() {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error, data } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        if (data?.user) {
            // Find which commerce this user belongs to by checking assignments
            const { data: assignments, error: assignError } = await supabase
                .from('display_commerce_users')
                .select('commerce_id')
                .eq('user_id', data.user.id)
                .limit(1);

            if (assignError || !assignments || assignments.length === 0) {
                toast.error("No se encontró un negocio asociado a tu cuenta.");
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            const commerceId = assignments[0].commerce_id;

            const { data: commerce, error: commerceError } = await supabase
                .from('display_commerces')
                .select('id, name')
                .eq('id', commerceId)
                .single();

            if (commerceError || !commerce) {
                toast.error("Error al cargar los datos de tu negocio.");
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            toast.success(`Bienvenido a ${commerce.name}`);
            
            // Set flag for user mode to restrict navigation
            localStorage.setItem('display_user_mode', 'true');
            
            navigate(`/admin/display/commerce/${commerce.id}/workspace`);
        }
        
        setLoading(false);
    };

    return (
        <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background font-sans">
            
            {/* Left Side: Form (White in light mode, Dark in dark mode) */}
            <div className="w-full md:w-[450px] lg:w-[500px] shrink-0 flex flex-col justify-center p-8 sm:p-12 md:p-16 border-r border-border bg-card relative z-10 shadow-2xl">
                
                <div className="w-full max-w-[320px] mx-auto space-y-8">
                    {/* Header */}
                    <div className="space-y-2 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                                <MonitorPlay className="w-7 h-7" />
                            </div>
                            <span className="text-2xl font-bold font-[Orbitron] tracking-tight">Display <span className="text-indigo-500">Hub</span></span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Iniciar Sesión</h1>
                        <p className="text-sm text-muted-foreground">
                            Ingresa tus credenciales para administrar tus pantallas.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Correo electrónico</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                    type="email" 
                                    placeholder="tu@correo.com" 
                                    className="pl-9 h-11 bg-muted/50 border-border/50 focus:border-indigo-500 transition-colors rounded-xl"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-foreground">Contraseña</label>
                            </div>
                            <div className="relative">
                                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    className="pl-9 h-11 bg-muted/50 border-border/50 focus:border-indigo-500 transition-colors rounded-xl"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]"
                        >
                            {loading ? "Ingresando..." : (
                                <>
                                    Ingresar a mi negocio <LogIn className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>
                    
                    <div className="text-center">
                        <span className="text-xs text-muted-foreground">Desarrollado por EventPix</span>
                    </div>
                </div>
            </div>

            {/* Right Side: Image/Banner Cover */}
            <div className="hidden md:block flex-1 relative bg-black overflow-hidden">
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 hover:scale-105"
                    style={{ backgroundImage: 'url("/edm-assets/fondo con logo.PNG")' }}
                >
                    {/* Dark gradient overlay to ensure the image isn't too bright or to add depth */}
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/60"></div>
                </div>
            </div>
            
        </div>
    );
}
