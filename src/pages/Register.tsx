import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Building2, 
  ArrowRight, 
  Store, 
  Instagram, 
  PhoneCall, 
  Sparkles, 
  ShieldCheck, 
  Tv,
  CheckCircle2
} from "lucide-react";
import { IntelligenceStorageService } from "@/services/intelligence/IntelligenceStorageService";
import { MetaGraphService, MetaCredentials } from "@/services/meta/MetaGraphService";
import { ConnectionStorageService } from "@/services/intelligence/ConnectionStorageService";

const BUSINESS_NICHES = [
  'Gastronomía & Bares',
  'Salud & Farmacias',
  'Indumentaria & Calzado',
  'Estética & Barberías',
  'Gimnasios & Deporte',
  'Comercios & Retail',
  'Entretenimiento & Eventos',
  'Servicios Profesionales',
  'Otro Rubro'
];

const Register = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Paso 1: Datos de Acceso y Comercio
  const [commerceName, setCommerceName] = useState("");
  const [niche, setNiche] = useState("Gastronomía & Bares");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Paso 2: Conexión de Instagram y WhatsApp
  const [instagramHandle, setInstagramHandle] = useState("");
  const [phone, setPhone] = useState("+54 9 ");
  const [hasMetaToken, setHasMetaToken] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState("");

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!commerceName.trim()) {
      toast.error("Ingresá el nombre del comercio");
      return;
    }
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instagramHandle.trim()) {
      toast.error("Ingresá el usuario de Instagram del local");
      return;
    }

    setLoading(true);

    try {
      // 1. Registro de usuario en Supabase Auth
      let userId = `user_${Date.now()}`;
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: contactName || commerceName,
              commerce_name: commerceName,
              niche,
              account_type: 'business'
            }
          }
        });
        if (!authError && authData.user) {
          userId = authData.user.id;
        }
      } catch {
        // En caso de mock o fallback local continuamos
      }

      // 2. Registrar el nuevo comercio en IntelligenceStorageService
      const newBusiness = await IntelligenceStorageService.registerClientAccount({
        name: commerceName.trim(),
        instagramHandle: instagramHandle.trim(),
        niche,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });

      // 3. Guardar credenciales de Meta Graph API si las ingresó
      if (hasMetaToken && metaAccessToken.trim() && instagramAccountId.trim()) {
        const creds: MetaCredentials = {
          appId: '2345235469580053',
          appSecret: '',
          accessToken: metaAccessToken.trim(),
          instagramAccountId: instagramAccountId.trim(),
          accountUsername: instagramHandle.replace('@', '')
        };
        MetaGraphService.saveCredentials(creds, newBusiness.id);
      }

      // 4. Guardar teléfono de WhatsApp
      if (phone.trim()) {
        const conns = ConnectionStorageService.loadConnections(newBusiness.id);
        ConnectionStorageService.saveConnections(newBusiness.id, {
          ...conns,
          business_id: newBusiness.id,
          whatsapp: {
            ...conns.whatsapp,
            phoneNumberId: conns.whatsapp.phoneNumberId || 'phone_' + Date.now()
          }
        });
      }

      // 5. Vincular usuario y comercio en display_commerce_users si Supabase está activo
      try {
        await supabase.from('display_commerce_users').insert({
          commerce_id: newBusiness.id,
          user_id: userId
        });
      } catch {
        // fallback
      }

      toast.success(`¡Bienvenido a EventPix! Cuenta de "${newBusiness.name}" activada.`);
      localStorage.setItem('display_user_mode', 'true');

      // Redirigir directamente al panel de inteligencia del nuevo cliente
      navigate("/admin/intelligence");

    } catch (error: any) {
      toast.error(error.message || "Error al registrar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden text-slate-100">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-25">
        <div className="absolute top-10 left-10 w-96 h-96 bg-violet-600 rounded-full mix-blend-screen filter blur-3xl animate-blob" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-600 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      <Card className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl border-slate-800 shadow-2xl">
        <CardHeader className="text-center space-y-1.5 pb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-violet-600/30 mb-2">
            <Store className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 font-[Orbitron] tracking-tight">
            Registrar mi Comercio
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Cartelería Digital en Vidrieras + Asistente de Ventas con IA en Instagram y WhatsApp
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-2">
          
          {/* Stepper */}
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                step >= 1 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                1
              </div>
              <span className={step >= 1 ? 'font-bold text-slate-200' : 'text-slate-500'}>
                Datos del Local
              </span>
            </div>
            <div className={`h-0.5 flex-1 mx-4 ${step === 2 ? 'bg-violet-600' : 'bg-slate-800'}`} />
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                step === 2 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                2
              </div>
              <span className={step === 2 ? 'font-bold text-slate-200' : 'text-slate-500'}>
                Instagram & WhatsApp
              </span>
            </div>
          </div>

          {/* PASO 1: DATOS DEL COMERCIO Y ACCESO */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Nombre del Comercio o Local *
                </label>
                <Input
                  type="text"
                  placeholder="Ej. Café Martínez, Barbería Deluxe, Farmacia San Martín"
                  value={commerceName}
                  onChange={(e) => setCommerceName(e.target.value)}
                  className="bg-slate-950 border-slate-800 h-11 text-sm text-slate-100 placeholder:text-slate-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Rubro Comercial *
                  </label>
                  <select
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md h-11 px-3 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  >
                    {BUSINESS_NICHES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Nombre del Responsable
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej. Martín Benítez"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="bg-slate-950 border-slate-800 h-11 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Correo Electrónico (Para Iniciar Sesión) *
                </label>
                <Input
                  type="email"
                  placeholder="admin@milocallocal.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 h-11 text-sm text-slate-100 placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Contraseña *
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-950 border-slate-800 h-11 text-sm text-slate-100 placeholder:text-slate-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Confirmar Contraseña *
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-slate-950 border-slate-800 h-11 text-sm text-slate-100 placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2"
                >
                  Continuar a Instagram & WhatsApp <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          )}

          {/* PASO 2: INSTAGRAM Y WHATSAPP */}
          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Usuario de Instagram del Local *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400 font-bold text-sm">@</span>
                  <Input
                    type="text"
                    placeholder="cafemartinez_ar"
                    value={instagramHandle.replace('@', '')}
                    onChange={(e) => setInstagramHandle('@' + e.target.value.trim())}
                    className="bg-slate-950 border-slate-800 h-11 pl-8 text-sm text-slate-100 placeholder:text-slate-500 font-mono"
                    required
                    autoFocus
                  />
                </div>
                <span className="text-[11px] text-slate-500">
                  Tus Reels y consultas de clientes se vincularán a este perfil.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Número de WhatsApp Comercial *
                </label>
                <div className="relative">
                  <PhoneCall className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <Input
                    type="text"
                    placeholder="+54 9 362 405-5257"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 h-11 pl-10 text-sm text-slate-100 placeholder:text-slate-500 font-mono"
                    required
                  />
                </div>
                <span className="text-[11px] text-slate-500">
                  Para respuestas automáticas de cotizaciones y consultas.
                </span>
              </div>

              {/* Opción Meta Graph API */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                    ¿Querés conectar tu Access Token de Meta Graph API ahora?
                  </span>
                  <input
                    type="checkbox"
                    checked={hasMetaToken}
                    onChange={(e) => setHasMetaToken(e.target.checked)}
                    className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {hasMetaToken ? (
                  <div className="space-y-2 pt-2 border-t border-slate-800 text-xs animate-in fade-in">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">User Access Token</label>
                      <Input
                        type="password"
                        placeholder="EAA..."
                        value={metaAccessToken}
                        onChange={(e) => setMetaAccessToken(e.target.value)}
                        className="bg-slate-900 border-slate-800 h-9 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Instagram Account ID</label>
                      <Input
                        type="text"
                        placeholder="178414..."
                        value={instagramAccountId}
                        onChange={(e) => setInstagramAccountId(e.target.value)}
                        className="bg-slate-900 border-slate-800 h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Podés continuar solo con <strong className="text-pink-300">@{instagramHandle.replace('@', '') || 'tu_cuenta'}</strong> y vincular el token más tarde desde tu panel.
                  </p>
                )}
              </div>

              {/* Nota de IA Centralizada */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-300/90">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>IA Incluida:</strong> El motor de inteligencia comercial (Claude & GPT-4o) es provisto por EventPix. No tenés que pagar suscripciones de IA.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Atrás
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {loading ? "Creando tu espacio..." : "Crear Espacio y Comenzar"}
                </Button>
              </div>
            </form>
          )}

          <div className="text-center pt-2 border-t border-slate-800/60">
            <p className="text-xs text-slate-400">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="font-bold text-violet-400 hover:text-violet-300 transition-colors">
                Iniciar Sesión
              </Link>
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
