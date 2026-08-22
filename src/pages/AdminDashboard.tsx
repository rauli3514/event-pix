import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Plus, Calendar, ExternalLink, Settings, LogOut, Trash2, Lock, Unlock, 
    Users, Sparkles, Monitor, Activity, Tv, ServerCrash, Building2, ChevronRight, PenTool 
} from 'lucide-react';
import TemplateManager from './admin/TemplateManager';

import { useUserProfile, useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayDevices, useCommerces, useCreateCommerce, useDeleteCommerce } from "@/hooks/use-display-hub";

type Event = {
    id: string;
    slug: string;
    name: string;
    date: string;
    status: 'active' | 'closed';
};

const AdminDashboard = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Sistema de roles
    const { data: userProfile } = useUserProfile();
    const isSuperAdmin = useIsSuperAdmin();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({ name: '', slug: '', date: new Date().toISOString().split('T')[0] });

    const [isCreateCommerceOpen, setIsCreateCommerceOpen] = useState(false);
    const [newCommerce, setNewCommerce] = useState({ name: '', email: '' });

    const { data: events, isLoading: isEventsLoading } = useQuery({
        queryKey: ['events'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Event[];
        }
    });

    // Display Hub Data
    const { data: devices, isLoading: isDevicesLoading } = useDisplayDevices(null);
    const { data: commerces, isLoading: isCommercesLoading } = useCommerces();

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];
    const onlineCount = linkedDevices.filter(d => d.derived_status === 'online').length;
    const offlineCount = linkedDevices.filter(d => d.derived_status === 'offline').length;

    const createCommerce = useCreateCommerce();
    const deleteCommerce = useDeleteCommerce();

    const handleCreateCommerceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createCommerce.mutate(newCommerce, {
            onSuccess: () => {
                setIsCreateCommerceOpen(false);
                setNewCommerce({ name: '', email: '' });
                toast.success('Comercio creado exitosamente');
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al crear comercio');
            }
        });
    };

    const createEvent = useMutation({
        mutationFn: async (eventData: typeof newEvent) => {
            const { data: event, error: eventError } = await supabase
                .from('events')
                .insert([{
                    name: eventData.name,
                    slug: eventData.slug,
                    date: eventData.date,
                    status: 'active'
                }])
                .select()
                .single();

            if (eventError) throw eventError;

            const { error: settingsError } = await supabase
                .from('event_settings')
                .upsert({
                    event_id: event.id,
                    title: event.name,
                    description: '¡Bienvenidos a nuestra fiesta!',
                    display_template: 'slideshow'
                }, { onConflict: 'event_id' });

            if (settingsError) {
                await supabase.from('events').delete().eq('id', event.id);
                throw new Error("Faltan permisos o base de datos reportó: " + (settingsError.message || settingsError.code));
            }

            return event;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setIsCreateOpen(false);
            setNewEvent({ name: '', slug: '', date: new Date().toISOString().split('T')[0] });
            toast.success('Evento creado exitosamente');
        },
        onError: (error: any) => {
            console.error(error);
            toast.error(error.message || 'Error al crear evento');
        }
    });

    const toggleEventStatus = useMutation({
        mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: 'active' | 'closed' }) => {
            const newStatus = currentStatus === 'active' ? 'closed' : 'active';
            const { error } = await supabase
                .from('events')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            return newStatus;
        },
        onSuccess: (newStatus) => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast.success(`Evento ${newStatus === 'closed' ? 'cerrado' : 'activado'} exitosamente`);
        },
        onError: (error: any) => {
            console.error(error);
            toast.error('Error al cambiar el estado del evento');
        }
    });

    const deleteEvent = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            toast.success('Evento eliminado exitosamente');
        },
        onError: (error: any) => {
            console.error(error);
            toast.error('Error al eliminar el evento');
        }
    });

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createEvent.mutate(newEvent);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        const newSlug = name.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-');

        setNewEvent(prev => {
            const prevGeneratedSlug = prev.name.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/--+/g, '-');

            if (!prev.slug || prev.slug === prevGeneratedSlug) {
                return { ...prev, name, slug: newSlug };
            }
            return { ...prev, name };
        });
    };

    if (isEventsLoading || isCommercesLoading || isDevicesLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 animate-pulse">Cargando Panel...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />

            <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-12 relative z-10">
                <div className="mb-6 md:mb-0 text-center md:text-left">
                    <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                        <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                            <span className="text-xl">⚡</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white font-[Orbitron]">
                            Centro de <span className="text-blue-500">Control</span>
                        </h1>
                    </div>
                    <div className='flex items-center gap-3 justify-center md:justify-start'>
                        <h2 className="text-slate-400 text-sm">Gestiona tus áreas de negocio</h2>
                        {userProfile && (
                            <div className={`px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-bold border ${isSuperAdmin
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                }`}>
                                {isSuperAdmin ? 'Super Admin' : 'Client / Provider'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-center">
                    {isSuperAdmin && (
                        <>
                            <Button asChild variant="outline" className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                                <Link to="/admin/providers">
                                    <Users className="w-4 h-4 mr-2" /> Gestión de Usuarios
                                </Link>
                            </Button>
                            <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-violet-500/50">
                                <Link to="/admin/kiosco-manager">
                                    <Sparkles className="w-4 h-4 mr-2" /> Kiosco IA Global
                                </Link>
                            </Button>
                        </>
                    )}
                    <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" /> Salir
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto relative z-10 space-y-4">
                <Tabs defaultValue="eventpix" className="w-full">
                    <TabsList className="bg-slate-900/50 border border-slate-800 p-1 w-full flex mb-8">
                        <TabsTrigger value="eventpix" className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            <Calendar className="w-4 h-4 mr-2" /> EventPix (Fotografía)
                        </TabsTrigger>
                        <TabsTrigger value="display" className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                            <Monitor className="w-4 h-4 mr-2" /> Display Digital (Cartelería)
                        </TabsTrigger>
                        {isSuperAdmin && (
                            <TabsTrigger value="templates" className="flex-1 data-[state=active]:bg-[#00C4CC] data-[state=active]:text-white">
                                <PenTool className="w-4 h-4 mr-2" /> Plantillas Canva
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="eventpix" className="space-y-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Eventos Fotográficos</h2>
                            {isSuperAdmin && (
                                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] border border-blue-500/50">
                                            <Plus className="w-4 h-4 mr-2" /> Nuevo Evento
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                                        <DialogHeader>
                                            <DialogTitle>Crear Nuevo Evento</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name" className="text-slate-300">Nombre del Evento</Label>
                                                <Input
                                                    id="name"
                                                    value={newEvent.name}
                                                    onChange={handleNameChange}
                                                    placeholder="Ej: Boda Lau y Raúl"
                                                    className="bg-slate-950 border-slate-700 text-white"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="slug" className="text-slate-300">URL del Evento (Slug)</Label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-500">app.event-pix.com.ar/</span>
                                                    <Input
                                                        id="slug"
                                                        value={newEvent.slug}
                                                        onChange={(e) => setNewEvent({ ...newEvent, slug: e.target.value })}
                                                        placeholder="boda-lau-raul"
                                                        className="bg-slate-950 border-slate-700 text-white"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="date" className="text-slate-300">Fecha</Label>
                                                <Input
                                                    id="date"
                                                    type="date"
                                                    value={newEvent.date}
                                                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                                                    className="bg-slate-950 border-slate-700 text-white"
                                                    required
                                                />
                                            </div>
                                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={createEvent.isPending}>
                                                {createEvent.isPending ? 'Creando...' : 'Crear Evento'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>

                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-slate-500 uppercase tracking-wider">
                            <div className="col-span-5">Evento</div>
                            <div className="col-span-2">Fecha</div>
                            <div className="col-span-2">Estado</div>
                            <div className="col-span-3 text-right">Acciones</div>
                        </div>

                        <div className="space-y-3">
                            {events?.map(event => (
                                <div key={event.id} className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 md:px-6 md:py-4 hover:bg-slate-900 hover:border-blue-500/30 transition-all duration-300 flex flex-col md:grid md:grid-cols-12 gap-4 items-center">
                                    <div className="col-span-5 w-full">
                                        <div className="flex items-center justify-between md:justify-start gap-3">
                                            <Link to={`/admin/${event.slug}`} className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {event.name}
                                            </Link>
                                            <a href={`/${event.slug}`} target="_blank" rel="noreferrer" className="md:hidden text-slate-500">
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                                /{event.slug}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 w-full flex md:block justify-between text-sm text-slate-400">
                                        <span className="md:hidden text-slate-500 font-medium">Fecha:</span>
                                        <div className="flex items-center">
                                            <Calendar className="w-3 h-3 mr-2 text-slate-600" />
                                            {new Date(event.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div className="col-span-2 w-full flex md:block justify-between">
                                        <span className="md:hidden text-slate-500 font-medium font-sm">Estado:</span>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${event.status === 'active'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            }`}>
                                            {event.status === 'active' ? (
                                                <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" /> ACTIVO</>
                                            ) : (
                                                'CERRADO'
                                            )}
                                        </span>
                                    </div>
                                    <div className="col-span-3 w-full flex justify-end gap-2">
                                        <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-900/20">
                                            <Link to={`/admin/${event.slug}`}>
                                                <Settings className="w-3.5 h-3.5 mr-2" /> Gestionar
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800">
                                            <a href={`/${event.slug}`} target="_blank" rel="noreferrer">
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </Button>
                                        {isSuperAdmin && (
                                            <>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className={`${event.status === 'active' ? 'text-amber-500 hover:text-amber-400 hover:bg-amber-950/30' : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/30'}`}
                                                    onClick={() => toggleEventStatus.mutate({ id: event.id, currentStatus: event.status })}
                                                >
                                                    {event.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-400 hover:bg-red-950/30"
                                                    onClick={() => {
                                                        if (confirm(`¿Estás seguro de eliminar el evento "${event.name}"?`)) {
                                                            deleteEvent.mutate(event.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {events?.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <Calendar className="w-8 h-8 text-slate-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">No hay eventos creados</h3>
                                    <p className="text-slate-400 mt-2 max-w-sm text-center">
                                        Comienza creando tu primer evento para gestionar fotos.
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="display" className="space-y-6 pt-4">
                        {isSuperAdmin && (
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
                        )}

                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-white">Comercios / Clientes Registrados</h2>
                                {isSuperAdmin && (
                                    <Dialog open={isCreateCommerceOpen} onOpenChange={setIsCreateCommerceOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                                                <Plus className="w-4 h-4 mr-2" /> Nuevo Comercio
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="bg-slate-900 border-slate-800 text-white">
                                            <DialogHeader>
                                                <DialogTitle>Crear Nuevo Comercio</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={handleCreateCommerceSubmit} className="space-y-4 mt-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="c-name" className="text-slate-300">Nombre del Comercio</Label>
                                                    <Input
                                                        id="c-name"
                                                        value={newCommerce.name}
                                                        onChange={(e) => setNewCommerce({ ...newCommerce, name: e.target.value })}
                                                        placeholder="Ej: Farmacia XYZ"
                                                        className="bg-slate-950 border-slate-700 text-white"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="c-email" className="text-slate-300">Email (Opcional)</Label>
                                                    <Input
                                                        id="c-email"
                                                        type="email"
                                                        value={newCommerce.email}
                                                        onChange={(e) => setNewCommerce({ ...newCommerce, email: e.target.value })}
                                                        placeholder="contacto@empresa.com"
                                                        className="bg-slate-950 border-slate-700 text-white"
                                                    />
                                                </div>
                                                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={createCommerce.isPending}>
                                                    {createCommerce.isPending ? 'Creando...' : 'Crear Comercio'}
                                                </Button>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {commerces?.map(commerce => {
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
                                                <div className="flex gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                                    </div>
                                                    {isSuperAdmin && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="w-8 h-8 rounded-full text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors relative z-20"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (confirm(`¿Eliminar el comercio "${commerce.name}" y todas sus pantallas?`)) {
                                                                    deleteCommerce.mutate(commerce.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
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
                                        <h3 className="text-lg font-bold text-white">No hay clientes de cartelería</h3>
                                        <p className="text-slate-400 text-sm mt-2">Crea un comercio para empezar a gestionar pantallas.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {isSuperAdmin && (
                        <TabsContent value="templates" className="space-y-6 pt-4">
                            <TemplateManager />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
};

export default AdminDashboard;
