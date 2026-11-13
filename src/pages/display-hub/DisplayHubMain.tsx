import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Activity, Tv, ServerCrash, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserProfile } from "@/hooks/use-roles";
import { useDisplayDevices, useCommerces } from "@/hooks/use-display-hub";
import { ScreenDownAlert } from "@/components/display/ScreenDownAlert";
import { CommerceDirectory } from "@/components/display/admin/CommerceDirectory";

const DisplayHubMain = () => {
    // Antes se decidía con el perfil todavía cargando (contaba como "no es super
    // admin") y mandaba siempre a /admin: hay que esperar a que llegue.
    const { data: profile, isLoading: isProfileLoading } = useUserProfile();
    const isSuperAdmin = profile?.role === 'super_admin';

    // For Super Admin: Load all commerces and all devices to calculate metrics
    const { data: devices, isLoading: isDevicesLoading } = useDisplayDevices(null);
    const { data: commerces, isLoading: isCommercesLoading } = useCommerces();

    // Solo para el super admin; el resto vuelve al panel.
    if (!isProfileLoading && !isSuperAdmin) {
        return <Navigate to="/admin" replace />;
    }

    if (isProfileLoading || isDevicesLoading || isCommercesLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 animate-pulse">Cargando Directorio de Clientes...</p>
            </div>
        </div>
    );

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];
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
                    <CommerceDirectory commerces={commerces} devices={linkedDevices} isSuperAdmin />
                </div>

            </div>
        </div>
    );
};

export default DisplayHubMain;
