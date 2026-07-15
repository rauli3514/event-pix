import { Link, useNavigate } from 'react-router-dom';
import { Monitor, ArrowLeft, Activity, Tv, ServerCrash, Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayDevices, useCommerces } from "@/hooks/use-display-hub";

const DisplayHubMain = () => {
    const navigate = useNavigate();
    const isSuperAdmin = useIsSuperAdmin();
    
    // For Super Admin: Load all commerces and all devices to calculate metrics
    const { data: devices, isLoading: isDevicesLoading } = useDisplayDevices(null);
    const { data: commerces, isLoading: isCommercesLoading } = useCommerces();

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
                    <h2 className="text-xl font-bold text-white mb-4">Comercios Registrados</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {commerces?.map(commerce => {
                            // Calcular métricas para este comercio específico
                            const commerceDevices = linkedDevices.filter(d => d.commerce_id === commerce.id);
                            const commerceOnline = commerceDevices.filter(d => d.derived_status === 'online').length;
                            const commerceOffline = commerceDevices.filter(d => d.derived_status === 'offline').length;
                            
                            return (
                                <Link 
                                    key={commerce.id}
                                    to={`/admin/display/commerce/${commerce.id}/workspace`}
                                    className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 block"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{commerce.name || 'Sin Nombre'}</h3>
                                            <p className="text-xs text-slate-500 mt-1">{commerce.email}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-2">
                                        <div className="flex items-center gap-1.5 text-sm text-slate-400">
                                            <Monitor className="w-4 h-4" />
                                            <span>{commerceDevices.length} Pantallas</span>
                                        </div>
                                        
                                        <div className="flex gap-3">
                                            {commerceOnline > 0 && (
                                                <div className="flex items-center text-xs font-bold text-emerald-400 gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    {commerceOnline}
                                                </div>
                                            )}
                                            {commerceOffline > 0 && (
                                                <div className="flex items-center text-xs font-bold text-rose-400 gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                    {commerceOffline}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}

                        {commerces?.length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                                <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-white">No hay clientes (Providers)</h3>
                                <p className="text-slate-400 text-sm mt-2">Los usuarios que se registren como Proveedores aparecerán aquí.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DisplayHubMain;
