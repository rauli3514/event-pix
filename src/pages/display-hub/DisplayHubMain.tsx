import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Tv, ServerCrash, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayDevices, useCommerces } from "@/hooks/use-display-hub";
import { useAdminAccounts } from "@/hooks/use-accounts";
import { useNow } from "@/hooks/use-now";
import { ScreenDownAlert } from "@/components/display/ScreenDownAlert";
import { AccountCard } from "@/components/display/admin/AccountCard";
import { accountStatus, accountsErrorText, type AccountStatus } from "@/lib/accounts";
import { cn } from "@/lib/utils";

// Pestañas del directorio: los que contrataron, los que están probando, las
// pruebas vencidas (para llamarlos) y las bajas.
const TABS: { id: AccountStatus; label: string }[] = [
    { id: 'cliente', label: 'Clientes' },
    { id: 'prueba', label: 'En prueba' },
    { id: 'vencida', label: 'Pruebas vencidas' },
    { id: 'baja', label: 'Bajas' },
];

const EMPTY: Record<AccountStatus, { title: string; text: string }> = {
    cliente: { title: 'Todavía no hay clientes', text: 'Cuando pases una prueba a cliente, o crees un comercio, aparece acá.' },
    prueba: { title: 'Nadie está probando ahora', text: 'Los que se registren en "Probalo" aparecen acá con sus datos.' },
    vencida: { title: 'No hay pruebas vencidas', text: 'Acá quedan los que no contrataron, para llamarlos.' },
    baja: { title: 'No hay bajas', text: 'Los comercios dados de baja quedan acá.' },
};

const DisplayHubMain = () => {
    const navigate = useNavigate();
    const isSuperAdmin = useIsSuperAdmin();
    
    // For Super Admin: Load all commerces and all devices to calculate metrics
    const { data: devices, isLoading: isDevicesLoading } = useDisplayDevices(null);
    const { data: commerces, isLoading: isCommercesLoading } = useCommerces();
    const { data: accountsData } = useAdminAccounts(isSuperAdmin === true);
    const now = useNow(60000);
    const [tab, setTab] = useState<AccountStatus>('cliente');

    // Estado de cada negocio (si la migración no se corrió, todos quedan como clientes).
    const byId = useMemo(() => new Map((accountsData?.accounts || []).map(a => [a.id, a])), [accountsData]);
    const statusOf = (id: string) => accountStatus(byId.get(id), now);

    // Si es un provider, redirigirlo a su vista directamente.
    // Asumimos que si no es super admin, lo enviamos al listado genérico que internamente estará filtrado por su ID gracias al hook/RLS.
    if (isSuperAdmin === false) {
        // TODO: Redirect to /admin/display/commerce/:su_id
        // Por ahora lo mandamos a /admin
        navigate('/admin', { replace: true });
        return null;
    }

    if (isDevicesLoading || isCommercesLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 animate-pulse">Cargando Directorio de Clientes...</p>
            </div>
        </div>
    );

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];
    // Pruebas: las que vencen antes, primero. El resto, por nombre.
    const visible = (commerces || [])
        .filter(c => statusOf(c.id) === tab)
        .sort((a, b) => {
            if (tab === 'prueba' || tab === 'vencida') {
                const ea = Date.parse(byId.get(a.id)?.trial_ends_at || '') || 0;
                const eb = Date.parse(byId.get(b.id)?.trial_ends_at || '') || 0;
                return tab === 'prueba' ? ea - eb : eb - ea;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

    const onlineCount = linkedDevices.filter(d => d.derived_status === 'online').length;
    const offlineCount = linkedDevices.filter(d => d.derived_status === 'offline').length;

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative overflow-hidden text-slate-200">
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white hover:bg-slate-800 -ml-4">
                            <Link to="/admin">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Panel
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <Building2 className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white font-[Orbitron]">
                                    Directorio de <span className="text-indigo-400">Clientes</span>
                                </h1>
                                <p className="text-slate-400 text-sm">Gestiona la cartelería digital por Comercio</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Pantallas sin conexión hace más de 10 min, de todos los negocios */}
                <ScreenDownAlert commerceId={null} showCommerce className="" />

                {/* Dashboard Metrics (Globales) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Tv className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Pantallas Globales</p>
                            <p className="text-3xl font-bold text-white">{linkedDevices.length}</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-emerald-900/30 rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-emerald-400/80 font-medium uppercase tracking-wider">Online Global</p>
                            <p className="text-3xl font-bold text-emerald-400">{onlineCount}</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-rose-900/30 rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                            <ServerCrash className="w-6 h-6 text-rose-400" />
                        </div>
                        <div>
                            <p className="text-sm text-rose-400/80 font-medium uppercase tracking-wider">Offline Global</p>
                            <p className="text-3xl font-bold text-rose-400">{offlineCount}</p>
                        </div>
                    </div>
                </div>

                {/* Lista de Clientes / Comercios */}
                <div className="space-y-4 pt-4">
                    <h2 className="text-xl font-bold text-white">Comercios</h2>

                    {accountsData?.error && (
                        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            {accountsErrorText(accountsData.error)} Mientras tanto se muestran todos como clientes.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2" role="tablist">
                        {TABS.map(t => {
                            const count = commerces?.filter(c => statusOf(c.id) === t.id).length || 0;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.id}
                                    onClick={() => setTab(t.id)}
                                    className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                                        tab === t.id ? 'border-indigo-500 bg-indigo-500/15 text-white' : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-600')}
                                >
                                    {t.label} <span className={cn('ml-1 rounded-full px-1.5 text-xs', t.id === 'prueba' && count > 0 ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300')}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visible.map(commerce => {
                            const commerceDevices = linkedDevices.filter(d => d.commerce_id === commerce.id);
                            return (
                                <AccountCard
                                    key={commerce.id}
                                    commerce={commerce}
                                    account={byId.get(commerce.id) || null}
                                    screens={{
                                        total: commerceDevices.length,
                                        online: commerceDevices.filter(d => d.derived_status === 'online').length,
                                        offline: commerceDevices.filter(d => d.derived_status === 'offline').length,
                                    }}
                                    now={now}
                                />
                            );
                        })}

                        {visible.length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                                <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-white">{EMPTY[tab].title}</h3>
                                <p className="text-slate-400 text-sm mt-2">{EMPTY[tab].text}</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DisplayHubMain;
