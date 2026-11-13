import { useState, useEffect } from 'react';
import { useProviders, useCreateProvider, useIsSuperAdmin } from '@/hooks/use-roles';
import { useUpdateProviderPassword, useToggleProviderStatus } from '@/hooks/use-provider-management';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';
import { UserPlus, Users, ArrowLeft, Mail, Calendar, Shield, Lock, Ban, CheckCircle, Settings2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEventProviders, useUserEventAssignments, useCommerceAssignments, useUserCommerceAssignments } from '@/hooks/use-roles';
import { useCommerces } from '@/hooks/use-display-hub';
import { useTrialUsers } from '@/hooks/use-accounts';
import { accountStatus, daysLeft } from '@/lib/accounts';

const ProvidersList = () => {
    const queryClient = useQueryClient();
    const isSuperAdmin = useIsSuperAdmin();
    const { data: providers, isLoading } = useProviders();
    // Los que se registraron para probar llevan la etiqueta "Prueba" (naranja).
    const { data: trialUsers = {} } = useTrialUsers(isSuperAdmin);
    const createProvider = useCreateProvider();
    const updatePassword = useUpdateProviderPassword();
    const toggleStatus = useToggleProviderStatus();

    // Auto-corregir rol de sebadj si está marcado como super_admin en la BD
    useEffect(() => {
        if (isSuperAdmin && providers) {
            const seba = providers.find(p => p.email === 'sebadj@eventpix.com' && p.role === 'super_admin');
            if (seba) {
                supabase
                    .from('profiles')
                    .update({ role: 'provider' })
                    .eq('id', seba.id)
                    .then(({ error }) => {
                        if (!error) {
                            queryClient.invalidateQueries({ queryKey: ['providers'] });
                        }
                    });
            }
        }
    }, [isSuperAdmin, providers, queryClient]);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newProvider, setNewProvider] = useState({
        email: '',
        name: '',
        password: '',
        user_type: 'provider' as 'provider' | 'client'
    });

    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');

    const [accessDialogOpen, setAccessDialogOpen] = useState(false);

    // Fetch all available resources
    const { data: allEvents } = useQuery({
        queryKey: ['events'],
        queryFn: async () => {
            const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
            return data || [];
        }
    });
    const { data: allCommerces } = useCommerces();

    // Assignment hooks
    const { assignProvider: assignEvent, removeProvider: removeEvent } = useEventProviders();
    const { assignCommerce, removeCommerce } = useCommerceAssignments();

    const { data: userEvents } = useUserEventAssignments(selectedProvider?.id);
    const { data: userCommerces } = useUserCommerceAssignments(selectedProvider?.id);

    const toggleEventAccess = (eventId: string, hasAccess: boolean) => {
        if (!selectedProvider) return;
        if (hasAccess) {
            removeEvent.mutate({ eventId, providerId: selectedProvider.id });
        } else {
            assignEvent.mutate({ eventId, providerId: selectedProvider.id });
        }
    };

    const toggleCommerceAccess = (commerceId: string, hasAccess: boolean) => {
        if (!selectedProvider) return;
        if (hasAccess) {
            removeCommerce.mutate({ commerceId, userId: selectedProvider.id });
        } else {
            assignCommerce.mutate({ commerceId, userId: selectedProvider.id });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // @ts-ignore
        createProvider.mutate(newProvider, {
            onSuccess: () => {
                setIsCreateOpen(false);
                setNewProvider({ email: '', name: '', password: '', user_type: 'provider' });
                toast.success('Usuario creado exitosamente');
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al crear usuario');
            }
        });
    };

    const handlePasswordUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProvider) return;

        updatePassword.mutate({ userId: selectedProvider.id, newPassword }, {
            onSuccess: () => {
                setPasswordDialogOpen(false);
                setNewPassword('');
                setSelectedProvider(null);
                toast.success('Contraseña actualizada exitosamente');
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al actualizar contraseña');
            }
        });
    };

    const handleToggleStatus = (provider: any) => {
        const newStatus = !provider.is_active;
        toggleStatus.mutate({ userId: provider.id, isActive: newStatus }, {
            onSuccess: () => {
                toast.success(`Provider ${newStatus ? 'activado' : 'desactivado'} exitosamente`);
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al cambiar estado');
            }
        });
    };

    // Protección de ruta: Solo Super Admin
    if (!isSuperAdmin && !isLoading) {
        return <Navigate to="/admin" />;
    }

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Cargando usuarios...</div>;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
            <header className="max-w-5xl mx-auto flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
                        <p className="text-muted-foreground">Administra los providers del sistema</p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                            <UserPlus className="w-4 h-4 mr-2" /> Nuevo Provider
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Provider</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newProvider.email}
                                    onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
                                    placeholder="usuario@ejemplo.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre (Opcional)</Label>
                                <Input
                                    id="name"
                                    value={newProvider.name}
                                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                                    placeholder="Juan Pérez"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Usuario</Label>
                                <div className="flex gap-4 p-1">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded w-full border border-border">
                                        <input
                                            type="radio"
                                            name="user_type"
                                            value="provider"
                                            checked={newProvider.user_type === 'provider'}
                                            onChange={() => setNewProvider({ ...newProvider, user_type: 'provider' })}
                                            className="accent-violet-600"
                                        />
                                        Proveedor
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded w-full border border-border">
                                        <input
                                            type="radio"
                                            name="user_type"
                                            value="client"
                                            checked={newProvider.user_type === 'client'}
                                            onChange={() => setNewProvider({ ...newProvider, user_type: 'client' })}
                                            className="accent-violet-600"
                                        />
                                        Cliente
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={newProvider.password}
                                    onChange={(e) => setNewProvider({ ...newProvider, password: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={createProvider.isPending}>
                                {createProvider.isPending ? 'Creando...' : 'Crear Provider'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers?.map(provider => (
                    <Card key={provider.id} className={`hover:shadow-lg transition-shadow border-border ${!provider.is_active ? 'opacity-70' : ''}`}>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg font-bold text-foreground truncate pr-2">
                                {provider.name || 'Sin nombre'}
                            </CardTitle>
                            <Shield className={`w-4 h-4 ${provider.is_active ? 'text-violet-500' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center text-sm text-muted-foreground min-w-0">
                                <Mail className="w-4 h-4 mr-2 shrink-0" />
                                <span className="truncate">{provider.email}</span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4 mr-2 shrink-0" />
                                <span>Registrado: {new Date(provider.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="pt-2 flex items-center justify-between">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${provider.is_active !== false
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-red-100 text-red-700 border-red-200'
                                    }`}>
                                    {provider.is_active !== false ? 'Activo' : 'Inactivo'}
                                </span>
                                <TypeBadge provider={provider} trial={trialUsers[provider.id]} />
                            </div>
                        </CardContent>
                        <CardFooter className="pt-3 border-t bg-muted/30 grid grid-cols-3 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full min-w-0 px-2 text-xs h-8"
                                onClick={() => {
                                    setSelectedProvider(provider);
                                    setPasswordDialogOpen(true);
                                }}
                            >
                                <Lock className="w-3 h-3 md:mr-1.5" />
                                <span className="hidden md:inline">Clave</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full min-w-0 px-2 text-xs h-8 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30"
                                onClick={() => {
                                    setSelectedProvider(provider);
                                    setAccessDialogOpen(true);
                                }}
                            >
                                <Settings2 className="w-3 h-3 md:mr-1.5" />
                                <span className="hidden md:inline">Accesos</span>
                            </Button>
                            <Button
                                variant={provider.is_active !== false ? "outline" : "default"}
                                size="sm"
                                className={`w-full min-w-0 px-2 text-xs h-8 ${provider.is_active !== false
                                    ? 'text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 border-red-500/30'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                                onClick={() => handleToggleStatus(provider)}
                            >
                                {provider.is_active !== false ? (
                                    <>
                                        <Ban className="w-3 h-3 md:mr-1.5" />
                                        <span className="hidden md:inline">Desactivar</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-3 h-3 md:mr-1.5" />
                                        <span className="hidden md:inline">Activar</span>
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {providers?.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-card rounded-xl border border-dashed border-border">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No hay providers registrados</h3>
                        <p className="text-muted-foreground mt-2">Crea el primer usuario para comenzar a delegar eventos.</p>
                    </div>
                )}
            </div>

            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cambiar Contraseña</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Usuario</Label>
                            <div className="p-2 bg-muted rounded text-sm text-muted-foreground">
                                {selectedProvider?.email}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nueva Contraseña</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white" disabled={updatePassword.isPending}>
                                {updatePassword.isPending ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Gestionar Accesos: {selectedProvider?.name || selectedProvider?.email}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 mt-4">
                        
                        <div>
                            <h3 className="font-bold text-foreground border-b pb-2 mb-3">Accesos Display Digital (Cartelería)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {allCommerces?.map((commerce: any) => {
                                    const hasAccess = userCommerces?.includes(commerce.id);
                                    return (
                                        <div key={commerce.id} className="flex items-center justify-between p-3 bg-muted/40 border rounded-lg">
                                            <span className="text-sm font-medium text-foreground">{commerce.name}</span>
                                            <Button 
                                                size="sm" 
                                                variant={hasAccess ? "default" : "outline"}
                                                className={hasAccess ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                                                onClick={() => toggleCommerceAccess(commerce.id, !!hasAccess)}
                                            >
                                                {hasAccess ? "Asignado" : "Asignar"}
                                            </Button>
                                        </div>
                                    )
                                })}
                                {(!allCommerces || allCommerces.length === 0) && (
                                    <p className="text-sm text-muted-foreground italic">No hay comercios creados.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold text-foreground border-b pb-2 mb-3">Accesos EventPix (Eventos)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {allEvents?.map((evt: any) => {
                                    const hasAccess = userEvents?.includes(evt.id);
                                    return (
                                        <div key={evt.id} className="flex items-center justify-between p-3 bg-muted/40 border rounded-lg">
                                            <span className="text-sm font-medium text-foreground truncate mr-2">{evt.name}</span>
                                            <Button 
                                                size="sm" 
                                                variant={hasAccess ? "default" : "outline"}
                                                className={hasAccess ? "bg-blue-600 hover:bg-blue-700" : ""}
                                                onClick={() => toggleEventAccess(evt.id, !!hasAccess)}
                                            >
                                                {hasAccess ? "Asignado" : "Asignar"}
                                            </Button>
                                        </div>
                                    )
                                })}
                                {(!allEvents || allEvents.length === 0) && (
                                    <p className="text-sm text-muted-foreground italic">No hay eventos creados.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// Tipo de usuario: Super Admin, Proveedor, Cliente o Prueba (se registró en "Probalo").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TypeBadge({ provider, trial }: { provider: any; trial?: { plan: 'cliente' | 'prueba' | 'baja'; trial_ends_at: string | null } }) {
    const status = trial ? accountStatus(trial) : null;
    const cls = 'px-2 py-1 rounded-full text-xs font-medium border';
    if (provider.role === 'super_admin') return <span className={`${cls} bg-purple-100 text-purple-700 border-purple-200`}>Super Admin</span>;
    if (status === 'prueba') {
        const left = daysLeft(trial?.trial_ends_at);
        return <span className={`${cls} bg-orange-100 text-orange-700 border-orange-300`}>Prueba · {left === 1 ? '1 día' : `${left} días`}</span>;
    }
    if (status === 'vencida') return <span className={`${cls} bg-rose-100 text-rose-700 border-rose-200`}>Prueba vencida</span>;
    if (status === 'baja') return <span className={`${cls} bg-slate-200 text-slate-600 border-slate-300`}>Baja</span>;
    if (provider.user_type === 'client') return <span className={`${cls} bg-emerald-100 text-emerald-700 border-emerald-200`}>Cliente</span>;
    return <span className={`${cls} bg-indigo-100 text-indigo-700 border-indigo-200`}>Proveedor</span>;
}

export default ProvidersList;
