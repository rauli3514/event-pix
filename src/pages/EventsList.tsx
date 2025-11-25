import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, ExternalLink, Settings, LogOut, Trash2, Lock, Unlock } from 'lucide-react';

type Event = {
    id: string;
    slug: string;
    name: string;
    date: string;
    status: 'active' | 'closed';
};

const EventsList = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({ name: '', slug: '', date: new Date().toISOString().split('T')[0] });

    const { data: events, isLoading } = useQuery({
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

    const createEvent = useMutation({
        mutationFn: async (eventData: typeof newEvent) => {
            // 1. Create Event
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

            // 2. Create Default Settings for this event
            const { error: settingsError } = await supabase
                .from('event_settings')
                .insert([{
                    event_id: event.id,
                    title: event.name,
                    description: '¡Bienvenidos a nuestra fiesta!',
                    display_template: 'slideshow'
                }]);

            if (settingsError) throw settingsError;

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

    // Auto-generate slug from name
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        const slug = name.toLowerCase()
            .replace(/[^\w\s-]/g, '') // remove non-word chars
            .replace(/\s+/g, '-') // replace spaces with dashes
            .replace(/--+/g, '-'); // replace multiple dashes

        setNewEvent(prev => ({ ...prev, name, slug: prev.slug ? prev.slug : slug }));
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Cargando eventos...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Mis Eventos</h1>
                    <p className="text-slate-500">Administra tus eventos de EventPix</p>
                </div>
                <div className="flex gap-4">
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" /> Nuevo Evento
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crear Nuevo Evento</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nombre del Evento</Label>
                                    <Input
                                        id="name"
                                        value={newEvent.name}
                                        onChange={handleNameChange}
                                        placeholder="Ej: Boda Lau y Raúl"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slug">URL del Evento (Slug)</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">app.event-pix.com.ar/</span>
                                        <Input
                                            id="slug"
                                            value={newEvent.slug}
                                            onChange={(e) => setNewEvent({ ...newEvent, slug: e.target.value })}
                                            placeholder="boda-lau-raul"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="date">Fecha</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={newEvent.date}
                                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={createEvent.isPending}>
                                    {createEvent.isPending ? 'Creando...' : 'Crear Evento'}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" onClick={handleLogout}>
                        <LogOut className="w-4 h-4 mr-2" /> Salir
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events?.map(event => (
                    <Card key={event.id} className="hover:shadow-lg transition-shadow border-slate-200">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl font-bold text-slate-800">{event.name}</CardTitle>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {event.status === 'active' ? 'ACTIVO' : 'CERRADO'}
                                </span>
                            </div>
                            <div className="flex items-center text-sm text-slate-500 mt-1">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(event.date).toLocaleDateString()}
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4 space-y-3">
                            <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                                /{event.slug}
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2 pt-0">
                            <div className="flex gap-2 w-full">
                                <Button asChild className="flex-1" variant="default">
                                    <Link to={`/admin/${event.slug}`}>
                                        <Settings className="w-4 h-4 mr-2" /> Administrar
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="flex-1">
                                    <a href={`/${event.slug}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-4 h-4 mr-2" /> Ver Web
                                    </a>
                                </Button>
                            </div>
                            <div className="flex gap-2 w-full">
                                <Button
                                    variant={event.status === 'active' ? 'outline' : 'secondary'}
                                    className="flex-1"
                                    onClick={() => toggleEventStatus.mutate({ id: event.id, currentStatus: event.status })}
                                    disabled={toggleEventStatus.isPending}
                                >
                                    {event.status === 'active' ? (
                                        <><Lock className="w-4 h-4 mr-2" /> Cerrar</>
                                    ) : (
                                        <><Unlock className="w-4 h-4 mr-2" /> Abrir</>
                                    )}
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => {
                                        if (confirm(`¿Estás seguro de eliminar el evento "${event.name}"? Esta acción no se puede deshacer.`)) {
                                            deleteEvent.mutate(event.id);
                                        }
                                    }}
                                    disabled={deleteEvent.isPending}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                ))}

                {events?.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                        <h3 className="text-lg font-medium text-slate-900">No hay eventos creados</h3>
                        <p className="text-slate-500 mt-2">Crea tu primer evento para comenzar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventsList;
