import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, Loader2, MonitorPlay } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useUploadDisplayMedia } from '@/hooks/use-display-media';
import { useCreatePriceList } from '@/hooks/use-price-lists';
import { PosterView } from '@/components/display/posters/PosterView';
import { POSTER_TEMPLATES, configFromTemplate } from '@/lib/posters';
import { FUDO_OPTIONS, RUBROS, SALES_WHATSAPP, SOURCE_OPTIONS, TV_COUNT_OPTIONS, posterMetadata, starterPoster, trialErrorText } from '@/lib/trial';
import { TRIAL_DAYS } from '@/lib/accounts';

// "Probalo" (app.event-pix.com.ar/probar): cualquiera crea su cuenta y prueba
// 7 días el mismo panel que usan los clientes. Paso 1: la cuenta y el negocio.
// Paso 2 (opcional): unas preguntas para saber cómo ayudarlo.

const DEMO = POSTER_TEMPLATES.find(t => t.id === 'pizzas') || POSTER_TEMPLATES[0];
const DEMO_CONFIG = { ...configFromTemplate(DEMO, '16:9'), animation: 'none' as const };

export default function TrialSignup() {
    const navigate = useNavigate();
    const upload = useUploadDisplayMedia();
    const createList = useCreatePriceList();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [commerceId, setCommerceId] = useState<string | null>(null);

    const [contact, setContact] = useState('');
    const [business, setBusiness] = useState('');
    const [rubro, setRubro] = useState<string>('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [city, setCity] = useState('');
    const [tvCount, setTvCount] = useState('');
    const [usesFudo, setUsesFudo] = useState('');
    const [source, setSource] = useState('');

    const createAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact.trim() || !business.trim()) { toast.error('Completá tu nombre y el de tu negocio.'); return; }
        if (whatsapp.replace(/\D/g, '').length < 8) { toast.error('Escribí tu WhatsApp con la característica, por ejemplo 362 454-7382.'); return; }
        if (password.length < 6) { toast.error('La contraseña tiene que tener al menos 6 caracteres.'); return; }
        setLoading(true);
        try {
            // 1. La cuenta (sin confirmar el email: entra directo).
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: { data: { name: contact.trim(), user_type: 'client', commerce_name: business.trim() } },
            });
            if (error) throw error;
            if (!data.session) throw new Error('Falta confirmar el email: revisá tu correo y después entrá desde "Ya tengo cuenta".');

            // 2. El negocio en prueba, vinculado a la cuenta, con sus datos.
            const { data: id, error: trialError } = await supabase.rpc('display_start_trial', {
                p: { contact_name: contact.trim(), business_name: business.trim(), rubro: rubro || null, whatsapp: whatsapp.trim() },
            });
            if (trialError) {
                await supabase.auth.signOut();
                throw new Error(trialError.message || trialError.code);
            }
            const newId = String(id);
            setCommerceId(newId);
            localStorage.setItem('display_user_mode', 'true');

            // 3. Un cartel de ejemplo de su rubro, con el nombre del negocio y su lista de
            //    precios (si algo falla, sigue igual: no es indispensable).
            const starter = starterPoster(rubro, business);
            if (starter) {
                let config = starter.config;
                if (starter.items.length) {
                    try {
                        const list = await createList.mutateAsync({ commerceId: newId, name: starter.listName, items: starter.items });
                        config = { ...config, listId: list.id };
                    } catch { /* sin lista: el cartel igual se crea */ }
                }
                try {
                    await upload.mutateAsync({ commerceId: newId, folderPath: '/', webUrl: 'app://poster', webName: starter.name, type: 'app', metadata: posterMetadata(config) });
                } catch { /* no es indispensable */ }
            }
            setStep(2);
        } catch (err) {
            const msg = (err as Error).message || '';
            toast.error(/confirmar el email/.test(msg) ? msg : trialErrorText(msg));
        } finally {
            setLoading(false);
        }
    };

    const enter = async (save: boolean) => {
        if (!commerceId) return;
        if (save && (city.trim() || tvCount || usesFudo || source)) {
            setLoading(true);
            try {
                await supabase.rpc('display_trial_details', { p: { city: city.trim(), tv_count: tvCount, uses_fudo: usesFudo, source } });
            } catch { /* opcional */ }
            setLoading(false);
        }
        toast.success(`¡Listo! Ya podés probar Display Digital con ${business.trim()}.`);
        navigate(`/admin/display/commerce/${commerceId}/workspace/dashboard`, { replace: true });
    };

    const field = 'h-11 bg-muted/50 border-border/50 focus:border-indigo-500 rounded-xl text-foreground';

    return (
        <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background text-foreground font-sans">
            <div className="w-full lg:w-[520px] shrink-0 flex flex-col justify-center px-5 py-8 sm:p-12 border-r border-border bg-card relative z-10">
                <div className="w-full max-w-[400px] mx-auto space-y-7">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                                <MonitorPlay className="w-6 h-6" />
                            </div>
                            <span className="text-xl font-bold font-[Orbitron] tracking-tight">Display <span className="text-indigo-500">Digital</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <span className={cn('rounded-full px-2 py-0.5', step === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white')}>{step === 1 ? '1' : <Check className="w-3 h-3 inline" />}</span>
                            Tu cuenta
                            <span className="h-px w-6 bg-border" />
                            <span className={cn('rounded-full px-2 py-0.5', step === 2 ? 'bg-indigo-600 text-white' : 'bg-muted')}>2</span>
                            Unas preguntas
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight pt-2">
                            {step === 1 ? `Probá Display Digital ${TRIAL_DAYS} días` : `¡Bienvenido, ${contact.trim().split(/\s+/)[0]}!`}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {step === 1
                                ? 'Armá tus carteles, cargá tus precios y miralos en una pantalla de prueba. Es el mismo panel que usan nuestros clientes.'
                                : 'Contanos un poco más para ayudarte mejor. Es opcional.'}
                        </p>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={createAccount} className="space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Tu nombre</span>
                                <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Ana Gómez" autoComplete="name" className={field} required maxLength={120} />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Nombre del negocio</span>
                                <Input value={business} onChange={e => setBusiness(e.target.value)} placeholder="La Esquina" autoComplete="organization" className={field} required maxLength={120} />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Rubro</span>
                                <select value={rubro} onChange={e => setRubro(e.target.value)} required
                                    className={cn('w-full px-3 text-sm border', field)}>
                                    <option value="" disabled>Elegí el rubro</option>
                                    {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">WhatsApp</span>
                                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="362 454-7382" inputMode="tel" autoComplete="tel" className={field} required maxLength={40} />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Email</span>
                                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" className={field} required />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Contraseña</span>
                                <span className="relative block">
                                    <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Al menos 6 caracteres" autoComplete="new-password" className={cn(field, 'pr-11')} required minLength={6} />
                                    <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </span>
                            </label>
                            <Button type="submit" disabled={loading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-semibold">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Crear mi cuenta de prueba <ArrowRight className="w-4 h-4 ml-2" /></>}
                            </Button>
                            <p className="text-center text-sm text-muted-foreground">
                                ¿Ya tenés cuenta? <Link to="/usuarios" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Ingresá</Link>
                            </p>
                        </form>
                    ) : (
                        <div className="space-y-5">
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">¿En qué ciudad está el negocio?</span>
                                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Resistencia" className={field} maxLength={80} />
                            </label>
                            <Chips label="¿Cuántas TV tenés en el local?" options={TV_COUNT_OPTIONS} value={tvCount} onChange={setTvCount} />
                            <Chips label="¿Usás Fudo?" options={FUDO_OPTIONS} value={usesFudo} onChange={setUsesFudo} />
                            <Chips label="¿Cómo nos conociste?" options={SOURCE_OPTIONS} value={source} onChange={setSource} />
                            <div className="space-y-2 pt-1">
                                <Button onClick={() => enter(true)} disabled={loading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-semibold">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar a mi panel <ArrowRight className="w-4 h-4 ml-2" /></>}
                                </Button>
                                <button type="button" onClick={() => enter(false)} className="w-full text-sm text-muted-foreground hover:text-foreground py-2">Saltear</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lo que va a poder hacer, con un cartel de verdad en una TV. */}
            <div className="flex-1 relative overflow-hidden bg-[#0B0F19] text-white px-5 py-10 sm:p-12 flex items-center justify-center">
                <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-indigo-600/25 blur-[120px] pointer-events-none" />
                <div className="relative w-full max-w-xl space-y-8">
                    <div className="rounded-[10px] bg-black p-[5px] ring-1 ring-white/10 shadow-2xl">
                        <div className="relative aspect-video overflow-hidden rounded-[5px]">
                            <PosterView config={DEMO_CONFIG} lists={[]} sampleList={DEMO.sampleList} />
                        </div>
                    </div>
                    <ul className="space-y-3 text-base">
                        {[
                            'Más de 50 carteles listos para tu rubro',
                            'Tus precios en todas las pantallas, al instante (o traelos de Fudo)',
                            'Descuentos por tiempo, QR de tu menú y mosaicos de varias TV',
                            'Todo desde el celular o la compu',
                        ].map(t => (
                            <li key={t} className="flex items-start gap-3"><Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> {t}</li>
                        ))}
                    </ul>
                    <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                        En la prueba ves tus carteles en una <strong className="text-white">pantalla de prueba</strong> (una pestaña del navegador).
                        Cuando lo contrates, funciona con el <strong className="text-white">equipo Display Digital</strong>, que se conecta a tu TV por HDMI.
                    </p>
                    <a href={`https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent('¡Hola! Tengo una consulta sobre Display Digital.')}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
                        <FaWhatsapp className="w-4 h-4" /> ¿Dudas? Escribinos
                    </a>
                </div>
            </div>
        </div>
    );
}

function Chips({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">{label}</p>
            <div className="flex flex-wrap gap-2">
                {options.map(o => (
                    <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)} aria-pressed={value === o}
                        className={cn('rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                            value === o ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'border-border hover:bg-muted')}>
                        {o}
                    </button>
                ))}
            </div>
        </div>
    );
}
