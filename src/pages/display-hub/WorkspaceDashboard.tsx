import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCommerces, useDisplayDevices, useDisplayCampaigns } from '@/hooks/use-display-hub';
import { Monitor, ListVideo, Rocket, Image as ImageIcon, ChevronRight, CheckCircle2, CloudOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function WorkspaceDashboard() {
    const { commerceId } = useParams();
    const navigate = useNavigate();
    const [greeting, setGreeting] = useState('Administrador');
    
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.user_metadata?.full_name) {
                setGreeting(user.user_metadata.full_name.split(' ')[0]);
            }
        });
    }, []);

    const { data: commerces } = useCommerces();
    const { data: devices = [] } = useDisplayDevices(commerceId);
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    
    const commerce = commerces?.find(c => c.id === commerceId);
    
    const onlineDevices = devices.filter(d => d.derived_status === 'online').length;
    const offlineDevices = devices.filter(d => d.derived_status === 'offline').length;
    const unassignedDevices = devices.filter(d => !d.group_id).length;


    const onlinePercent = devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 0;
    const offlinePercent = devices.length > 0 ? Math.round((offlineDevices / devices.length) * 100) : 0;

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 w-full max-w-7xl mx-auto">
            {/* Top Banner (Hero) */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl h-72 md:h-80 flex items-center">
                {/* Custom Image Background */}
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                    style={{ backgroundImage: 'url("/banner-dashboard.PNG")' }}
                >
                    {/* Dark overlay just in case the image is too bright, so text stays readable */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/40 to-transparent"></div>
                </div>
                
                <div className="relative z-10 p-10 md:p-16 flex flex-col items-start w-full">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                        ¡Hola, {greeting}!
                    </h1>
                    <p className="text-slate-400 mb-8 max-w-md">
                        {commerce?.name || 'Administrador'}
                    </p>
                    <Button 
                        onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace/playlists`)}
                        className="bg-white hover:bg-slate-200 text-slate-900 rounded-full px-6 py-6 text-base font-bold shadow-lg shadow-white/10 transition-all hover:scale-105"
                    >
                        Crear Contenido <Rocket className="w-5 h-5 ml-2 text-indigo-600" />
                    </Button>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column: Contenidos y publicaciones */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Contenidos y publicaciones</h2>
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md h-full min-h-[320px] flex flex-col">
                        <div className="mb-8">
                            <h3 className="text-slate-200 font-medium">Tus listas (Playlists)</h3>
                            <p className="text-sm text-slate-500">Editadas recientemente</p>
                        </div>

                        {campaigns.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <div className="w-24 h-24 mb-4 relative">
                                    {/* Empty state illustration */}
                                    <div className="absolute inset-0 bg-slate-800 rounded-xl transform -rotate-6 scale-90"></div>
                                    <div className="absolute inset-0 bg-slate-700 rounded-xl shadow-lg border border-slate-600 flex items-center justify-center">
                                        <ImageIcon className="w-10 h-10 text-slate-400" />
                                    </div>
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-2 bg-slate-500/50 rounded-full"></div>
                                </div>
                                <p className="text-slate-500 text-sm mb-6">Nada por acá</p>
                                <Link 
                                    to={`/admin/display/commerce/${commerceId}/workspace/playlists`} 
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                >
                                    Mis Playlists <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <div className="w-20 h-20 bg-fuchsia-500/10 rounded-2xl flex items-center justify-center mb-4">
                                    <ListVideo className="w-10 h-10 text-fuchsia-400" />
                                </div>
                                <p className="text-white text-2xl font-bold mb-1">{campaigns.length}</p>
                                <p className="text-slate-500 text-sm mb-6">Playlists creadas en total</p>
                                <Link 
                                    to={`/admin/display/commerce/${commerceId}/workspace/playlists`} 
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                >
                                    Ver Playlists <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Mis equipos */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Tus equipos</h2>

                    <div className="space-y-4">
                        {/* Equipos con contenidos */}
                        <Link to={`/admin/display/commerce/${commerceId}/workspace/screens`} className="block bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-md transition-colors group">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-slate-200 font-medium">Equipos registrados</h3>
                                    <p className="text-sm text-slate-500">Resumen de estado</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                            </div>

                            <div className="space-y-4 mt-6">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <Monitor className="w-5 h-5 text-slate-400" />
                                        <span className="text-slate-300 font-medium">{devices.length}</span>
                                        <span className="text-slate-500">equipos totales</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        <span className="text-slate-300 font-medium">{onlineDevices}</span>
                                        <span className="text-slate-500">conectados y online</span>
                                    </div>
                                    <span className="text-emerald-500 font-medium">{onlinePercent}%</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <CloudOff className="w-5 h-5 text-rose-500" />
                                        <span className="text-slate-300 font-medium">{offlineDevices}</span>
                                        <span className="text-slate-500">desconectados</span>
                                    </div>
                                    <span className="text-rose-500 font-medium">{offlinePercent}%</span>
                                </div>
                            </div>
                        </Link>

                        {/* Equipos libres */}
                        <Link to={`/admin/display/commerce/${commerceId}/workspace/screens`} className="block bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-md transition-colors group">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-slate-200 font-medium">Equipos libres</h3>
                                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                            </div>
                            <p className="text-sm text-slate-500">
                                {unassignedDevices === 0 
                                    ? "No tienes equipos libres actualmente." 
                                    : `Tienes ${unassignedDevices} equipo${unassignedDevices === 1 ? '' : 's'} sin grupo asignado.`}
                            </p>
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
