import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCommerces, useDisplayDevices, useDisplayCampaigns, useDisplaySchedules } from '@/hooks/use-display-hub';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { Monitor, ListVideo, Rocket, ChevronRight, CheckCircle2, CloudOff, CalendarClock, HardDrive, MonitorPlay, Smartphone } from 'lucide-react';
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
    const { data: media = [] } = useDisplayMedia(commerceId);
    const { data: schedules = [] } = useDisplaySchedules(commerceId);
    
    const commerce = commerces?.find(c => c.id === commerceId);
    
    const onlineDevices = devices.filter(d => (d as any).derived_status === 'online').length;
    const offlineDevices = devices.filter(d => (d as any).derived_status === 'offline').length;
    
    const imageMediaCount = media.filter(m => m.type === 'image' || m.type === 'image_ad').length;
    const videoMediaCount = media.filter(m => m.type === 'video' || m.type === 'video_ad').length;

    const activeSchedulesCount = schedules.length;

    const recentCampaigns = [...campaigns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3);
    const upcomingSchedules = [...schedules].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).slice(0, 3);

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 w-full max-w-7xl mx-auto">
            {/* Top Banner (Hero) */}
            <div className="relative overflow-hidden rounded-3xl bg-black border border-border shadow-2xl min-h-[160px] md:min-h-[240px] flex items-center">
                <div 
                    className="absolute inset-0 bg-contain md:bg-cover sm:bg-[length:auto_100%] bg-right bg-no-repeat pointer-events-none opacity-80 sm:opacity-100"
                    style={{ backgroundImage: 'url("/banner-dashboard.PNG")' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
                </div>
                
                <div className="relative z-10 p-6 md:p-12 lg:p-16 flex flex-col items-start w-full">
                    <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-2 tracking-tight">
                        ¡Hola, {greeting}!
                    </h1>
                    <p className="text-gray-300 text-sm md:text-base mb-4 md:mb-6 max-w-md">
                        {commerce?.name || 'Administrador'}
                    </p>
                    <Button 
                        onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace/playlists`)}
                        className="bg-white hover:bg-gray-200 text-black rounded-full px-4 md:px-5 py-4 md:py-5 text-xs md:text-base font-bold shadow-lg shadow-white/10 transition-all hover:scale-105"
                    >
                        Crear Contenido <Rocket className="w-4 h-4 md:w-5 md:h-5 ml-2 text-indigo-600" />
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-muted-foreground text-sm font-medium">Equipos</h3>
                        <div className="p-2 bg-blue-500/10 rounded-lg"><Monitor className="w-4 h-4 text-blue-500" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">{devices.length}</p>
                    <div className="flex items-center text-xs gap-2">
                        <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {onlineDevices} online</span>
                        <span className="text-rose-500 flex items-center gap-1"><CloudOff className="w-3 h-3" /> {offlineDevices} offline</span>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-muted-foreground text-sm font-medium">Contenido</h3>
                        <div className="p-2 bg-purple-500/10 rounded-lg"><HardDrive className="w-4 h-4 text-purple-500" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">{media.length}</p>
                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                        <span>{imageMediaCount} img</span>
                        <span>&bull;</span>
                        <span>{videoMediaCount} vid</span>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-muted-foreground text-sm font-medium">Playlists</h3>
                        <div className="p-2 bg-fuchsia-500/10 rounded-lg"><ListVideo className="w-4 h-4 text-fuchsia-500" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">{campaigns.length}</p>
                    <p className="text-xs text-muted-foreground">Listas listas para emitir</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-muted-foreground text-sm font-medium">Programaciones</h3>
                        <div className="p-2 bg-amber-500/10 rounded-lg"><CalendarClock className="w-4 h-4 text-amber-500" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-1">{activeSchedulesCount}</p>
                    <p className="text-xs text-muted-foreground">Schedules configurados</p>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Equipos (Spans 2 columns on lg) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">Estado de Equipos</h2>
                        <Link to={`/admin/display/commerce/${commerceId}/workspace/screens`} className="text-sm text-primary hover:underline flex items-center">
                            Ver todos <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                    </div>
                    
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        {devices.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center justify-center">
                                <MonitorPlay className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                                <p className="text-muted-foreground text-sm">No tienes equipos registrados.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {devices.slice(0, 5).map(device => {
                                    const isOnline = (device as any).derived_status === 'online';
                                    const isVertical = device.orientation === 'portrait' || device.orientation === '90' || device.orientation === '270';
                                    return (
                                        <div key={device.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="relative shrink-0">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOnline ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                                        {isVertical ? (
                                                            <Smartphone className={`w-5 h-5 ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`} />
                                                        ) : (
                                                            <MonitorPlay className={`w-5 h-5 ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`} />
                                                        )}
                                                    </div>
                                                    <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-sm text-foreground line-clamp-1">{device.name || 'Dispositivo sin nombre'}</h4>
                                                    <div className="flex items-center text-xs text-muted-foreground mt-0.5 gap-2">
                                                        <span>{isVertical ? 'Vertical' : 'Horizontal'}</span>
                                                        <span>&bull;</span>
                                                        <span>{device.last_seen ? new Date(device.last_seen).toLocaleDateString() : 'Nunca visto'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Link 
                                                to={`/admin/display/commerce/${commerceId}/workspace/screens`}
                                                className="px-3 py-1.5 text-xs font-medium rounded-full bg-secondary text-secondary-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-4"
                                            >
                                                Gestionar
                                            </Link>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Playlists & Schedules */}
                <div className="space-y-8">
                    {/* Recent Playlists */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-foreground">Playlists Recientes</h2>
                            <Link to={`/admin/display/commerce/${commerceId}/workspace/playlists`} className="text-sm text-primary hover:underline flex items-center">
                                Ver todas <ChevronRight className="w-4 h-4 ml-1" />
                            </Link>
                        </div>
                        <div className="bg-card border border-border rounded-2xl shadow-sm p-2 space-y-2">
                            {recentCampaigns.length === 0 ? (
                                <div className="p-6 text-center">
                                    <p className="text-xs text-muted-foreground">Sin playlists aún.</p>
                                </div>
                            ) : (
                                recentCampaigns.map(playlist => (
                                    <Link key={playlist.id} to={`/admin/display/commerce/${commerceId}/playlists/${playlist.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center shrink-0">
                                                <ListVideo className="w-4 h-4 text-fuchsia-500" />
                                            </div>
                                            <span className="font-medium text-sm text-foreground truncate">{playlist.name}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Upcoming Schedules */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-foreground">Próximos Eventos</h2>
                            <Link to={`/admin/display/commerce/${commerceId}/workspace/schedules`} className="text-sm text-primary hover:underline flex items-center">
                                Ver panel <ChevronRight className="w-4 h-4 ml-1" />
                            </Link>
                        </div>
                        <div className="bg-card border border-border rounded-2xl shadow-sm p-2 space-y-2">
                            {upcomingSchedules.length === 0 ? (
                                <div className="p-6 text-center">
                                    <p className="text-xs text-muted-foreground">No hay eventos programados.</p>
                                </div>
                            ) : (
                                upcomingSchedules.map(schedule => (
                                    <div key={schedule.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/30">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium text-sm text-foreground truncate">{(schedule as any).name || 'Programación'}</span>
                                            <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                <CalendarClock className="w-3 h-3 shrink-0" /> 
                                                <span className="truncate">{new Date(schedule.scheduled_at).toLocaleDateString()}</span>
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
