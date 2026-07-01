import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCommerces, useDisplayDevices, useDisplayCampaigns } from '@/hooks/use-display-hub';
import { Monitor, ListVideo, FolderOpen, Zap, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function WorkspaceDashboard() {
    const { commerceId } = useParams();
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

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
            {/* Portada Premium */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 border border-white/10 shadow-2xl">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none mix-blend-overlay"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none mix-blend-overlay"></div>
                
                <div className="relative z-10 p-10 md:p-16 flex flex-col items-start">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-100 text-sm font-medium mb-6 backdrop-blur-md">
                        <Sparkles className="w-4 h-4 text-indigo-300" />
                        <span>Display Hub by EventPix</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                        Hola, {greeting} 👋
                    </h1>
                    <p className="text-lg text-indigo-100 max-w-xl leading-relaxed">
                        Bienvenido al panel de control de <strong className="text-white">{commerce?.name || 'tu negocio'}</strong>. 
                        Desde aquí puedes gestionar todas tus pantallas, diseñar listas de reproducción y mantener a tu audiencia conectada.
                    </p>
                </div>
            </div>

            {/* Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1 */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Monitor className="w-24 h-24 text-indigo-500" />
                    </div>
                    <h3 className="text-slate-400 font-medium mb-1">Pantallas Totales</h3>
                    <div className="text-4xl font-black text-white mb-4">{devices.length}</div>
                    <div className="flex items-center gap-2 text-sm relative z-10">
                        <div className={`w-2 h-2 rounded-full ${onlineDevices > 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                        <span className={onlineDevices > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                            {onlineDevices} online ahora mismo
                        </span>
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-fuchsia-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ListVideo className="w-24 h-24 text-fuchsia-500" />
                    </div>
                    <h3 className="text-slate-400 font-medium mb-1">Listas de Reproducción</h3>
                    <div className="text-4xl font-black text-white mb-4">{campaigns.length}</div>
                    <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`} className="text-sm text-fuchsia-400 hover:text-fuchsia-300 font-medium inline-flex items-center gap-1 relative z-10">
                        Ver todas <span aria-hidden="true">&rarr;</span>
                    </Link>
                </div>

                {/* Metric 3 */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-sky-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="w-24 h-24 text-sky-500" />
                    </div>
                    <h3 className="text-slate-400 font-medium mb-1">Estado de Red</h3>
                    <div className="text-2xl font-bold text-white mb-4 mt-2">
                        {devices.length === 0 ? 'Sin pantallas' : (onlineDevices === devices.length ? '100% Operativo' : 'Requiere Atención')}
                    </div>
                    <Link to={`/admin/display/commerce/${commerceId}/workspace/screens`} className="text-sm text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 relative z-10">
                        Ver monitoreo <span aria-hidden="true">&rarr;</span>
                    </Link>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    Accesos Rápidos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Link to={`/admin/display/commerce/${commerceId}/workspace/screens`} className="bg-slate-900 border border-slate-800 hover:bg-slate-800 p-4 rounded-xl flex items-center gap-4 transition-colors">
                        <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <Monitor className="w-6 h-6" />
                        </div>
                        <div className="font-medium text-slate-200">Vincular Pantalla</div>
                    </Link>
                    <Link to={`/admin/display/commerce/${commerceId}/workspace/library`} className="bg-slate-900 border border-slate-800 hover:bg-slate-800 p-4 rounded-xl flex items-center gap-4 transition-colors">
                        <div className="p-3 bg-fuchsia-500/10 rounded-lg text-fuchsia-400">
                            <FolderOpen className="w-6 h-6" />
                        </div>
                        <div className="font-medium text-slate-200">Subir Contenido</div>
                    </Link>
                    <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`} className="bg-slate-900 border border-slate-800 hover:bg-slate-800 p-4 rounded-xl flex items-center gap-4 transition-colors">
                        <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
                            <ListVideo className="w-6 h-6" />
                        </div>
                        <div className="font-medium text-slate-200">Crear Playlist</div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
