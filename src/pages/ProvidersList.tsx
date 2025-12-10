import { useState } from 'react';
import { useProviders, useCreateProvider, useIsSuperAdmin } from '@/hooks/use-roles';
import { useUpdateProviderPassword, useToggleProviderStatus } from '@/hooks/use-provider-management';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';
import { UserPlus, Users, ArrowLeft, Mail, Calendar, Shield, Lock, Ban, CheckCircle } from 'lucide-react';

const ProvidersList = () => {
    const isSuperAdmin = useIsSuperAdmin();
    const { data: providers, isLoading } = useProviders();
    const createProvider = useCreateProvider();
    const updatePassword = useUpdateProviderPassword();
    const toggleStatus = useToggleProviderStatus();

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
        <div className="min-h-screen bg-slate-50 p-8">
            <header className="max-w-5xl mx-auto flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="text-slate-500 hover:text-slate-900 transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h1>
                        <p className="text-slate-500">Administra los providers del sistema</p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700">
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
                                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-2 rounded w-full border border-slate-200">
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
                                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-2 rounded w-full border border-slate-200">
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
                            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={createProvider.isPending}>
                                {createProvider.isPending ? 'Creando...' : 'Crear Provider'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers?.map(provider => (
                    <Card key={provider.id} className={`hover:shadow-lg transition-shadow border-slate-200 ${!provider.is_active ? 'opacity-75 bg-slate-100' : ''}`}>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg font-bold text-slate-800 truncate pr-2">
                                {provider.name || 'Sin nombre'}
                            </CardTitle>
                            <Shield className={`w-4 h-4 ${provider.is_active ? 'text-violet-500' : 'text-slate-400'}`} />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center text-sm text-slate-600">
                                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                                <span className="truncate">{provider.email}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-500">
                                <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                                <span>Registrado: {new Date(provider.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="pt-2 flex items-center justify-between">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${provider.is_active !== false
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-red-100 text-red-700 border-red-200'
                                    }`}>
                                    {provider.is_active !== false ? 'Activo' : 'Inactivo'}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${provider.role === 'super_admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                        provider.user_type === 'client' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            'bg-indigo-100 text-indigo-700 border-indigo-200'
                                    }`}>
                                    {provider.role === 'super_admin' ? 'Super Admin' :
                                        provider.user_type === 'client' ? 'Cliente' : 'Proveedor'}
                                </span>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2 border-t bg-slate-50/50 flex justify-between gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8"
                                onClick={() => {
                                    setSelectedProvider(provider);
                                    setPasswordDialogOpen(true);
                                }}
                            >
                                <Lock className="w-3 h-3 mr-1.5" />
                                Contraseña
                            </Button>
                            <Button
                                variant={provider.is_active !== false ? "outline" : "default"}
                                size="sm"
                                className={`flex-1 text-xs h-8 ${provider.is_active !== false
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                                onClick={() => handleToggleStatus(provider)}
                            >
                                {provider.is_active !== false ? (
                                    <>
                                        <Ban className="w-3 h-3 mr-1.5" />
                                        Desactivar
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-3 h-3 mr-1.5" />
                                        Activar
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {providers?.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No hay providers registrados</h3>
                        <p className="text-slate-500 mt-2">Crea el primer usuario para comenzar a delegar eventos.</p>
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
                            <div className="p-2 bg-slate-100 rounded text-sm text-slate-600">
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
                            <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={updatePassword.isPending}>
                                {updatePassword.isPending ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProvidersList;
